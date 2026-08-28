/**
 * Storefront catalog service.
 *
 * Provides the public API consumed by storefront pages and route handlers.
 * All data is sourced from Prisma (PostgreSQL) via the catalog query layer
 * in src/server/db/catalog-queries.ts.
 *
 * Visibility rules enforced here:
 *   - Only PUBLISHED categories are surfaced.
 *   - Only PUBLISHED products within PUBLISHED categories are surfaced.
 *   - Only APPROVED reviews are shown on the storefront.
 *   - DRAFT and ARCHIVED content is invisible to anonymous store visitors.
 *
 * Caching / revalidation:
 *   - Storefront route pages declare `export const revalidate = 900` (15 min ISR).
 *   - After an admin publish action, call `revalidatePath('/categories')` and
 *     `revalidatePath('/categories/[slug]', 'page')` inside the server action
 *     to trigger on-demand ISR. See docs/dev/architecture.md § Cache Strategy.
 */

import type { Prisma } from "@prisma/client";

import { routes } from "@/config/routes";
import { createLogger } from "@/lib/logger";
import type {
  StorefrontCategoryRecord,
  StorefrontProductDetailRecord,
  StorefrontProductRecord,
} from "@/server/db/catalog-queries";
import {
  countPublishedOneDollarProducts,
  getAllPublishedProductSlugsWithCategories,
  getPublishedCategoryBySlug,
  getPublishedProductBySlug as dbGetPublishedProductBySlug,
  getPublishedProductContextBySlug,
  getRelatedPublishedProducts,
  listAllPublishedProducts,
  listPublishedCategories,
  listPublishedProductsByCategory,
  listPublishedProductsByIds,
} from "@/server/db/catalog-queries";
import { createPaginatedResult } from "@/server/db/pagination";

import { normalizeCatalogImageUrl } from "./lib/product-image-url";
import type { CatalogSearchParams } from "./filters";
import { parseCatalogSearchParams } from "./filters";
import {
  createOneDollarVirtualCategory,
  isOneDollarCategorySlug,
  ONE_DOLLAR_CATEGORY_SLUG,
  ONE_DOLLAR_MAX_PRICE_PKR,
} from "./one-dollar";
import { getCatalogSearchAdapter } from "./search-adapter";
import type {
  CatalogCategory,
  CatalogCategoryListing,
  CatalogProductCard,
  CatalogProductDetail,
  CatalogProductImageTone,
  ProductImage,
  ProductReview,
  ProductReviewSummary,
  ProductVariantGroup,
  ProductVariantOption,
} from "./types";

const catalogServiceLogger = createLogger("catalog-service");
const RELATED_PRODUCTS_LIMIT = 4;
const RELATED_FALLBACK_FETCH_SIZE = 12;

// ---------------------------------------------------------------------------
// Internal helpers — DB record → storefront type mapping
// ---------------------------------------------------------------------------

/**
 * Deterministic image tone derived from category slug.
 * Keeps gradient placeholder colours consistent per category.
 */
const CATEGORY_TONE_MAP: Record<string, CatalogProductImageTone> = {
  "home-care": "sky",
  grocery: "amber",
  "personal-care": "rose",
};

const TONE_CYCLE: CatalogProductImageTone[] = ["sky", "emerald", "amber", "rose", "slate"];

function deriveTone(categorySlug: string, productSlug: string): CatalogProductImageTone {
  if (categorySlug in CATEGORY_TONE_MAP) {
    return CATEGORY_TONE_MAP[categorySlug]!;
  }

  // Fallback: hash product slug characters to pick a tone deterministically
  const hash = [...productSlug].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return TONE_CYCLE[hash % TONE_CYCLE.length]!;
}

/**
 * Human-readable label for a variant used on image thumbnails.
 * Prefers option values ("Small / Blue") over the variant title, falling back
 * to a generic "Variant" label when neither is meaningful.
 */
function variantDisplayLabel(variant: StorefrontProductRecord["variants"][number]): string {
  if (variant.options && typeof variant.options === "object") {
    const values = Object.values(variant.options as Record<string, unknown>)
      .map((value) => `${value ?? ""}`.trim())
      .filter(Boolean);

    if (values.length > 0) {
      return values.join(" / ");
    }
  }

  return variant.title ?? "Variant";
}

function mapImageToStorefront(
  image: StorefrontProductRecord["images"][number],
  productName: string,
  tone: CatalogProductImageTone,
  isPrimary: boolean,
  variantId: string | undefined,
  variantLabels: Map<string, string> | undefined,
): ProductImage {
  const normalizedUrl = normalizeCatalogImageUrl(image.url);

  return {
    id: image.id,
    ...(normalizedUrl ? { url: normalizedUrl } : {}),
    label: image.alt?.trim() || productName,
    tone,
    isPrimary,
    ...(variantId
      ? { variantId, variantLabel: variantLabels?.get(variantId) ?? "Variant" }
      : {}),
  };
}

/**
 * Maps DB images to the storefront ProductImage shape.
 *
 * For variant products each image may be attached to a specific variant
 * (`productVariantId`). This mapper:
 *  - orders product-level (shared) images first, then variant images grouped
 *    by the product's variant order so thumbnails stay grouped per variant,
 *  - marks the first image of each variant group as `isPrimary` so the gallery
 *    can show the correct image when a variant is selected,
 *  - keeps `url` for real-image rendering and `label`/`tone` for the legacy
 *    placeholder gradient UI.
 */
function mapProductImages(
  images: StorefrontProductRecord["images"],
  productName: string,
  categorySlug: string,
  productSlug: string,
  variantLabels?: Map<string, string>,
): ProductImage[] {
  if (images.length === 0) {
    // Provide a single placeholder image so the gallery always renders
    return [
      {
        id: `placeholder-${productSlug}`,
        label: productName,
        tone: deriveTone(categorySlug, productSlug),
        isPrimary: true,
      },
    ];
  }

  const tone = deriveTone(categorySlug, productSlug);

  const variantOrder = new Map<string, number>();
  if (variantLabels) {
    let order = 0;
    for (const variantId of variantLabels.keys()) {
      variantOrder.set(variantId, order);
      order += 1;
    }
  }

  const productImages = images.filter((image) => !image.productVariantId);
  const variantImages = images
    .filter((image) => image.productVariantId != null)
    .sort((left, right) => {
      const leftOrder = variantOrder.get(left.productVariantId!) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = variantOrder.get(right.productVariantId!) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.position - right.position;
    });

  const mapped: ProductImage[] = [];

  productImages.forEach((image, index) => {
    mapped.push(mapImageToStorefront(image, productName, tone, index === 0, undefined, variantLabels));
  });

  const seenVariantIds = new Set<string>();
  for (const image of variantImages) {
    const variantId = image.productVariantId!;
    const isPrimary = !seenVariantIds.has(variantId);
    seenVariantIds.add(variantId);
    mapped.push(mapImageToStorefront(image, productName, tone, isPrimary, variantId, variantLabels));
  }

  return mapped;
}

/**
 * Computes average rating and review count from a list of approved review
 * ratings. Returns zero-state when no approved reviews exist.
 */
function computeReviewStats(reviewRatings: Array<{ rating: number }>): {
  averageRating: number;
  reviewCount: number;
} {
  if (reviewRatings.length === 0) {
    return { averageRating: 0, reviewCount: 0 };
  }

  const total = reviewRatings.reduce((sum, r) => sum + r.rating, 0);

  return {
    averageRating: Number((total / reviewRatings.length).toFixed(1)),
    reviewCount: reviewRatings.length,
  };
}

function toIsoDateString(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));

  if (Number.isNaN(date.getTime())) {
    return new Date(0).toISOString();
  }

  return date.toISOString();
}

/**
 * Derives a short attribute summary from the first two specification values.
 * Falls back to an empty array if the product has no specifications.
 */
function deriveAttributeSummary(
  specifications: StorefrontProductRecord["specifications"],
): string[] {
  return specifications.slice(0, 2).map((spec) => spec.value);
}

/**
 * Computes the total available inventory across all variants.
 */
function computeTotalInventory(
  variants: StorefrontProductRecord["variants"],
): number {
  return variants.reduce(
    (total, variant) => total + (variant.inventory?.quantity ?? 0),
    0,
  );
}

/**
 * Picks the selling price and compare-at price from the default (or first) variant.
 */
function extractPricing(variants: StorefrontProductRecord["variants"]): {
  price: number;
  compareAt?: number;
} {
  const defaultVariant =
    variants.find((v) => v.isDefault) ?? variants[0] ?? null;

  if (!defaultVariant) {
    return { price: 0 };
  }

  return {
    price: defaultVariant.price,
    ...(typeof defaultVariant.compareAtPrice === "number" &&
    defaultVariant.compareAtPrice > defaultVariant.price
      ? { compareAt: defaultVariant.compareAtPrice }
      : {}),
  };
}

/**
 * Parses the product's `metadata` JSON to determine if variants are enabled.
 */
function parseVariantsEnabled(metadata: Prisma.JsonValue | null | undefined): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }

  return (metadata as Record<string, unknown>).variantsEnabled === true;
}

function parseRelatedProductIds(metadata: Prisma.JsonValue | null | undefined): string[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const source = metadata as Record<string, unknown>;
  const candidates = [source.relatedProductIds, source.relatedProducts]
    .filter(Array.isArray)
    .flatMap((value) => value as unknown[]);

  if (candidates.length === 0) {
    return [];
  }

  const normalizedIds = candidates
    .map((value) => {
      if (typeof value === "string" || typeof value === "number") {
        return `${value}`.trim();
      }

      if (value && typeof value === "object" && !Array.isArray(value)) {
        const id = (value as Record<string, unknown>).id;
        if (typeof id === "string" || typeof id === "number") {
          return `${id}`.trim();
        }
      }

      return "";
    })
    .filter(Boolean);

  return [...new Set(normalizedIds)];
}

/**
 * Builds ProductVariantGroup[] from the DB variant records.
 * Groups variants by their option keys and deduplicates option values.
 *
 * Variants that carry no `options` JSON (e.g. legacy records where the admin
 * left the options field blank) are grouped under a generic "Variant" group
 * using their human-friendly `title` as the option label, so the storefront
 * picker — and therefore variant-specific images — still work for them.
 *
 * For SIMPLE products (one variant, no options), returns an empty array.
 */
function buildVariantGroups(
  variants: StorefrontProductRecord["variants"],
  variantsEnabled: boolean,
): ProductVariantGroup[] {
  if (!variantsEnabled || variants.length <= 1) {
    return [];
  }

  // Collect unique option keys and map each unique value to the first variant
  // that has it, so we can derive the per-option sku/price/inventory.
  const groupMap = new Map<string, Map<string, (typeof variants)[number]>>();
  const FALLBACK_GROUP = "Variant";

  variants.forEach((variant, variantIndex) => {
    const opts =
      variant.options && typeof variant.options === "object"
        ? (variant.options as Record<string, string>)
        : null;
    const hasUsableOptions =
      opts !== null &&
      Object.keys(opts).some((key) => key.trim().length > 0 && `${opts[key] ?? ""}`.trim().length > 0);

    if (hasUsableOptions) {
      for (const [key, value] of Object.entries(opts)) {
        const normalizedKey = key.trim();
        const normalizedValue = `${value}`.trim();

        if (!normalizedKey || !normalizedValue) {
          continue;
        }

        if (!groupMap.has(normalizedKey)) {
          groupMap.set(normalizedKey, new Map());
        }

        // First variant wins if multiple share the same option value
        if (!groupMap.get(normalizedKey)!.has(normalizedValue)) {
          groupMap.get(normalizedKey)!.set(normalizedValue, variant);
        }
      }
      return;
    }

    // Variant without options: fall back to the variant title so the picker
    // still renders and variant-specific media can be selected.
    const label = variant.title?.trim() || `Variant ${variantIndex + 1}`;
    if (!groupMap.has(FALLBACK_GROUP)) {
      groupMap.set(FALLBACK_GROUP, new Map());
    }
    if (!groupMap.get(FALLBACK_GROUP)!.has(label)) {
      groupMap.get(FALLBACK_GROUP)!.set(label, variant);
    }
  });

  return Array.from(groupMap.entries()).map(([groupName, valueMap]) => {
    const options: ProductVariantOption[] = Array.from(valueMap.entries()).map(
      ([label, variant]) => ({
        id: variant.id,
        label,
        sku: variant.sku ?? "",
        price: variant.price,
        ...(typeof variant.compareAtPrice === "number" &&
        variant.compareAtPrice > variant.price
          ? { compareAt: variant.compareAtPrice }
          : {}),
        inventoryQuantity: variant.inventory?.quantity ?? 0,
      }),
    );

    return {
      id: `group-${groupName.toLowerCase().replace(/\s+/g, "-")}`,
      name: groupName,
      options,
    } satisfies ProductVariantGroup;
  });
}

/**
 * Maps a DB product record to a CatalogProductCard (used in listing views).
 */
function mapProductToCard(record: StorefrontProductRecord): CatalogProductCard {
  const categorySlug = record.category?.slug ?? "";
  const { price, compareAt } = extractPricing(record.variants);
  const { averageRating, reviewCount } = computeReviewStats(record.reviews);
  // Variant order map (default variant first, matching the query layer's
  // `isDefault DESC, createdAt ASC` sort). Passing it lets `mapProductImages`
  // group variant images by that order, so the DEFAULT variant's image is the
  // card cover when the product has no product-level image.
  const variantLabels = new Map(record.variants.map((variant) => [variant.id, variantDisplayLabel(variant)]));
  const allImages = mapProductImages(record.images, record.name, categorySlug, record.slug, variantLabels);
  const primaryImage = allImages[0] ?? {
    id: `placeholder-${record.slug}`,
    label: record.name,
    tone: deriveTone(categorySlug, record.slug),
    isPrimary: true,
  };

  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    description: record.shortDescription ?? record.description ?? "",
    categorySlug,
    price,
    ...(compareAt !== undefined ? { compareAt } : {}),
    inventoryQuantity: computeTotalInventory(record.variants),
    averageRating,
    reviewCount,
    ...(primaryImage.url ? { imageUrl: primaryImage.url } : {}),
    imageLabel: primaryImage.label,
    imageTone: primaryImage.tone,
    attributeSummary: deriveAttributeSummary(record.specifications),
    href: routes.storefront.product(categorySlug, record.slug),
  };
}

/**
 * Maps a DB category record to a CatalogCategory.
 */
function mapCategoryRecord(record: StorefrontCategoryRecord): CatalogCategory {
  const cardImageUrl = normalizeCatalogImageUrl(record.cardImageUrl);

  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    description: record.description ?? "",
    ...(cardImageUrl ? { cardImageUrl } : {}),
    ...(record.seoTitle != null && { seoTitle: record.seoTitle }),
    ...(record.seoDescription != null && { seoDescription: record.seoDescription }),
    productCount: record._count.products,
    href: routes.storefront.category(record.slug),
  };
}

function isOneDollarEligibleProduct(product: Pick<CatalogProductCard, "price">): boolean {
  return product.price <= ONE_DOLLAR_MAX_PRICE_PKR;
}

// ---------------------------------------------------------------------------
// Filter / sort helpers
// ---------------------------------------------------------------------------

type CategoryListingInput = {
  slug: string;
  searchParams?: CatalogSearchParams;
};

function getDiscountPercent(product: Pick<CatalogProductCard, "price" | "compareAt">) {
  if (typeof product.compareAt !== "number" || product.compareAt <= product.price) {
    return 0;
  }

  return Math.round(((product.compareAt - product.price) / product.compareAt) * 100);
}

function sortProducts(
  products: CatalogProductCard[],
  sort: string,
): CatalogProductCard[] {
  return [...products].sort((left, right) => {
    switch (sort) {
      case "newest":
      case "featured":
        // DB already returns newest-first (createdAt DESC); preserve that order
        return 0;
      case "price-asc":
        return left.price - right.price;
      case "price-desc":
        return right.price - left.price;
      case "rating-desc":
        return (
          right.averageRating - left.averageRating ||
          right.reviewCount - left.reviewCount
        );
      case "discount-desc":
        return (
          getDiscountPercent(right) - getDiscountPercent(left) ||
          left.price - right.price
        );
      default:
        return 0;
    }
  });
}

function applyFilters(
  products: CatalogProductCard[],
  filters: ReturnType<typeof parseCatalogSearchParams>,
): CatalogProductCard[] {
  return products.filter((product) => {
    if (typeof filters.minPrice === "number" && product.price < filters.minPrice) {
      return false;
    }

    if (typeof filters.maxPrice === "number" && product.price > filters.maxPrice) {
      return false;
    }

    if (filters.availability === "in-stock" && product.inventoryQuantity <= 0) {
      return false;
    }

    if (
      filters.availability === "low-stock" &&
      (product.inventoryQuantity < 1 || product.inventoryQuantity > 5)
    ) {
      return false;
    }

    if (filters.availability === "out-of-stock" && product.inventoryQuantity > 0) {
      return false;
    }

    if (filters.rating === "4-up" && product.averageRating < 4) {
      return false;
    }

    if (filters.rating === "3-up" && product.averageRating < 3) {
      return false;
    }

    const discountPercent = getDiscountPercent(product);

    if (filters.discount === "on-sale" && discountPercent <= 0) {
      return false;
    }

    if (filters.discount === "20-up" && discountPercent < 20) {
      return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Review helpers (detail page only)
// ---------------------------------------------------------------------------

/**
 * Builds the full ProductReview array and summary from the detail record.
 * Only APPROVED reviews reach this function (enforced at DB query level).
 */
function buildReviewData(
  reviews: NonNullable<StorefrontProductDetailRecord>["reviews"],
): { reviews: ProductReview[]; summary: ProductReviewSummary } {
  if (reviews.length === 0) {
    return {
      reviews: [],
      summary: {
        averageRating: 0,
        totalCount: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      },
    };
  }

  const distribution: ProductReviewSummary["distribution"] = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  let totalRating = 0;

  const mapped: ProductReview[] = reviews.map((review) => {
    const clamped = Math.max(1, Math.min(5, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[clamped] += 1;
    totalRating += review.rating;

    return {
      id: review.id,
      author: review.user?.name ?? "Anonymous",
      rating: review.rating,
      comment: review.body ?? review.title ?? "",
      date: toIsoDateString(review.createdAt),
      verified: false,
      status: review.status as "APPROVED",
    };
  });

  return {
    reviews: mapped,
    summary: {
      averageRating: Number((totalRating / reviews.length).toFixed(1)),
      totalCount: reviews.length,
      distribution,
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns all published catalog categories with their published product counts.
 * Empty array if no categories have been published yet.
 */
export async function getCatalogCategories(): Promise<CatalogCategory[]> {
  const [categoryRecords, oneDollarProductCount] = await Promise.all([
    listPublishedCategories(),
    countPublishedOneDollarProducts(),
  ]);

  const hasReservedSlugCollision = categoryRecords.some((record) =>
    isOneDollarCategorySlug(record.slug),
  );

  if (hasReservedSlugCollision) {
    catalogServiceLogger.warn("reserved One Dollar slug found in published categories", {
      code: "CATALOG_RESERVED_ONE_DOLLAR_SLUG_COLLISION",
    });
  }

  const categories = categoryRecords
    .filter((record) => !isOneDollarCategorySlug(record.slug))
    .map(mapCategoryRecord);

  return [createOneDollarVirtualCategory(oneDollarProductCount), ...categories];
}

/**
 * Returns a single published category by slug, or `null` if not found.
 */
export async function getCatalogCategory(
  slug: string,
): Promise<CatalogCategory | null> {
  if (isOneDollarCategorySlug(slug)) {
    const oneDollarProductCount = await countPublishedOneDollarProducts();

    return createOneDollarVirtualCategory(oneDollarProductCount);
  }

  const record = await getPublishedCategoryBySlug(slug);
  return record ? mapCategoryRecord(record) : null;
}

/**
 * Returns slugs for all published categories.
 * Used by `generateStaticParams` in the category listing route.
 */
export async function getCatalogCategorySlugs(): Promise<string[]> {
  const records = await listPublishedCategories();

  const categorySlugs = records
    .map((record) => record.slug)
    .filter((slug) => !isOneDollarCategorySlug(slug));

  return [ONE_DOLLAR_CATEGORY_SLUG, ...categorySlugs];
}

/**
 * Returns the full category listing payload (products + filters + pagination)
 * for a given category slug and optional query string filters.
 *
 * Returns `null` if the category is not found or not published.
 */
export async function getCatalogCategoryListing({
  slug,
  searchParams,
}: CategoryListingInput): Promise<CatalogCategoryListing | null> {
  if (isOneDollarCategorySlug(slug)) {
    const filters = parseCatalogSearchParams(searchParams);
    const allCards = (await listAllPublishedProducts()).map(mapProductToCard);
    const oneDollarCards = allCards.filter(isOneDollarEligibleProduct);
    const filteredCards = sortProducts(applyFilters(oneDollarCards, filters), filters.sort);

    const paginatedResult = createPaginatedResult({
      items: filteredCards.slice(
        (filters.page - 1) * filters.pageSize,
        filters.page * filters.pageSize,
      ),
      totalItems: filteredCards.length,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
      },
    });

    return {
      category: createOneDollarVirtualCategory(oneDollarCards.length),
      products: paginatedResult.items,
      filteredProductCount: filteredCards.length,
      totalProductCount: oneDollarCards.length,
      filters,
      pagination: paginatedResult.meta,
    };
  }

  const [categoryRecord, productRecords] = await Promise.all([
    getPublishedCategoryBySlug(slug),
    listPublishedProductsByCategory(slug),
  ]);

  if (!categoryRecord) {
    return null;
  }

  const category = mapCategoryRecord(categoryRecord);
  const filters = parseCatalogSearchParams(searchParams);
  const allCards = productRecords.map(mapProductToCard);
  const filteredCards = sortProducts(applyFilters(allCards, filters), filters.sort);

  const paginatedResult = createPaginatedResult({
    items: filteredCards.slice(
      (filters.page - 1) * filters.pageSize,
      filters.page * filters.pageSize,
    ),
    totalItems: filteredCards.length,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
    },
  });

  return {
    category,
    products: paginatedResult.items,
    filteredProductCount: filteredCards.length,
    totalProductCount: allCards.length,
    filters,
    pagination: paginatedResult.meta,
  };
}

/**
 * Returns the full product detail record for a published product by slug.
 * Includes images, specifications, variant groups, and APPROVED reviews.
 *
 * Returns `null` if the product is not found or not published.
 */
export async function getProductBySlug(
  slug: string,
): Promise<CatalogProductDetail | null> {
  const record = await dbGetPublishedProductBySlug(slug);

  if (!record) {
    return null;
  }

  const categorySlug = record.category?.slug ?? "";
  const card = mapProductToCard(record);
  const variantsEnabled = parseVariantsEnabled(record.metadata);
  const variantGroups = buildVariantGroups(record.variants, variantsEnabled);
  const { reviews, summary } = buildReviewData(record.reviews);

  // Use the default variant SKU if present, otherwise fall back to the master SKU.
  // Cart and wishlist line items are keyed by variant SKU, so keeping the detail
  // SKU aligned with the default variant ensures PDP state (in-cart quantity
  // controls, wishlist toggle) matches the stored line items.
  const defaultVariant =
    record.variants.find((v) => v.isDefault) ?? record.variants[0] ?? null;
  const sku = defaultVariant?.sku ?? record.masterSku ?? "";

  // Variant id → display label, used to tag variant-specific images so the
  // gallery can show which variant each thumbnail belongs to.
  const variantLabels = new Map(record.variants.map((variant) => [variant.id, variantDisplayLabel(variant)]));

  return {
    ...card,
    sku,
    shortDescription: record.shortDescription ?? "",
    longDescription: record.description ?? "",
    images: mapProductImages(record.images, record.name, categorySlug, record.slug, variantLabels),
    specifications: record.specifications.map((spec) => ({
      label: spec.key,
      value: spec.value,
    })),
    variantGroups,
    reviews,
    reviewSummary: summary,
  };
}

export type CatalogProductMetadata = {
  name: string;
  shortDescription: string;
  categorySlug: string;
};

export async function getProductMetadataBySlug(
  slug: string,
): Promise<CatalogProductMetadata | null> {
  const record = await getPublishedProductContextBySlug(slug);

  if (!record) {
    return null;
  }

  return {
    name: record.name,
    shortDescription: record.shortDescription ?? "",
    categorySlug: record.category?.slug ?? "",
  };
}

/**
 * Returns up to 4 related published products in the same category,
 * excluding the current product.
 */
export async function getRelatedProducts(
  categorySlug: string,
  excludeSlug: string,
): Promise<CatalogProductCard[]> {
  try {
    const sourceProduct = await getPublishedProductContextBySlug(excludeSlug);
    const excludedProductId = sourceProduct?.id;
    const effectiveCategorySlug = sourceProduct?.category?.slug ?? categorySlug;
    const preferredIds = parseRelatedProductIds(sourceProduct?.metadata).filter(
      (id) => id !== excludedProductId,
    );
    const preferredIdRank = new Map(preferredIds.map((id, index) => [id, index]));

    const preferredRecords = await listPublishedProductsByIds(preferredIds);
    const curatedCards = preferredRecords
      .filter((record) => record.slug !== excludeSlug && record.id !== excludedProductId)
      .sort((left, right) => {
        const leftRank = preferredIdRank.get(left.id) ?? Number.MAX_SAFE_INTEGER;
        const rightRank = preferredIdRank.get(right.id) ?? Number.MAX_SAFE_INTEGER;
        return leftRank - rightRank;
      })
      .map(mapProductToCard)
      .slice(0, RELATED_PRODUCTS_LIMIT);

    if (curatedCards.length >= RELATED_PRODUCTS_LIMIT) {
      return curatedCards;
    }

    const slotsRemaining = RELATED_PRODUCTS_LIMIT - curatedCards.length;
    const excludedSlugs = new Set([excludeSlug, ...curatedCards.map((item) => item.slug)]);
    const excludedIds = new Set<string>(
      [excludedProductId, ...curatedCards.map((item) => item.id)].filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      ),
    );
    const fallbackRecords = await getRelatedPublishedProducts(
      effectiveCategorySlug,
      excludeSlug,
      RELATED_FALLBACK_FETCH_SIZE,
    );
    const fallbackCards = fallbackRecords
      .filter((record) => !excludedSlugs.has(record.slug) && !excludedIds.has(record.id))
      .map(mapProductToCard)
      .slice(0, slotsRemaining);

    return [...curatedCards, ...fallbackCards];
  } catch (error) {
    catalogServiceLogger.error("related products lookup failed", {
      categorySlug,
      excludeSlug,
      error,
    });

    return [];
  }
}

/**
 * Returns slug + categorySlug pairs for all published products.
 * Used by `generateStaticParams` in the product detail route.
 */
export async function getProductSlugsWithCategory(): Promise<
  { slug: string; categorySlug: string }[]
> {
  const records = await getAllPublishedProductSlugsWithCategories();
  return records
    .filter((r) => r.category !== null)
    .map((r) => ({
      slug: r.slug,
      categorySlug: r.category!.slug,
    }));
}

type CatalogProductSearchOptions = {
  limit?: number;
};

/**
 * Searches published products by keyword.
 * Delegates to the catalog search adapter (DB-backed by default).
 */
export async function searchCatalogProducts(
  query: string,
  options: CatalogProductSearchOptions = {},
) {
  const adapter = getCatalogSearchAdapter();

  return adapter.searchProducts({
    query,
    ...(typeof options.limit === "number" ? { limit: options.limit } : {}),
  });
}
