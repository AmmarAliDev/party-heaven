import type { Prisma } from "@prisma/client";

import { routes } from "@/config/routes";
import { normalizeCatalogImageUrl } from "@/features/catalog/lib/product-image-url";
import { createLogger } from "@/lib/logger";
import { getDisplayVariantLabel } from "@/lib/variant-label";
import { getPrismaClient } from "@/server/db";

import type { StorefrontDeal, StorefrontDealImage, StorefrontDealProduct, StorefrontDealSpec } from "./types";

const logger = createLogger("deals.service");

/**
 * When a deal's effective (least-available) included product has at most this
 * many units left the deal is flagged as low stock in admin forms and on the
 * storefront.
 */
export const DEAL_LOW_STOCK_THRESHOLD = 5;

const dealWithProductsSelect = {
  id: true,
  title: true,
  slug: true,
  shortDescription: true,
  description: true,
  status: true,
  price: true,
  compareAtPrice: true,
  seoTitle: true,
  seoDescription: true,
  seoCanonicalUrl: true,
  seoOgTitle: true,
  seoOgDescription: true,
  seoImageUrl: true,
  seoKeywords: true,
  seoNoIndex: true,
  images: {
    orderBy: { position: "asc" as const },
    select: {
      url: true,
      alt: true,
    },
  },
  category: {
    select: {
      slug: true,
    },
  },
  products: {
    orderBy: { position: "asc" as const },
    select: {
      id: true,
      quantity: true,
      productVariantId: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          category: {
            select: {
              slug: true,
            },
          },
          variants: {
            orderBy: [{ isDefault: "desc" as const }, { createdAt: "asc" as const }],
            select: {
              id: true,
              title: true,
              sku: true,
              isDefault: true,
              inventory: {
                select: {
                  quantity: true,
                },
              },
            },
          },
        },
      },
    },
  },
  specifications: {
    orderBy: { position: "asc" as const },
    select: {
      key: true,
      value: true,
    },
  },
  metadata: true,
} satisfies Prisma.DealSelect;

type DealWithProductsRow = Prisma.DealGetPayload<{ select: typeof dealWithProductsSelect }>;

type DealProductRow = DealWithProductsRow["products"][number];

function normalizeDealImages(
  images: Array<{ url: string; alt: string | null }>,
  fallbackAlt: string,
): StorefrontDealImage[] {
  return images.flatMap((image) => {
    const url = normalizeCatalogImageUrl(image.url);
    if (!url) {
      return [];
    }

    return [
      {
        url,
        alt: image.alt?.trim() || fallbackAlt,
      },
    ];
  });
}

/**
 * Resolves the effective variant for an included product: the explicitly linked
 * variant, or the product's default variant (falling back to the first).
 */
function resolveEffectiveVariant(row: DealProductRow) {
  const linkedVariantId = row.productVariantId ?? null;
  const defaultVariant =
    row.product.variants.find((variant) => variant.isDefault) ?? row.product.variants[0] ?? null;

  if (linkedVariantId) {
    return row.product.variants.find((variant) => variant.id === linkedVariantId) ?? defaultVariant;
  }

  return defaultVariant;
}

function mapIncludedProduct(row: DealProductRow): StorefrontDealProduct | null {
  // Storefront never surfaces deals on hidden/archived catalog items.
  if (row.product.status !== "PUBLISHED") {
    return null;
  }

  const effectiveVariant = resolveEffectiveVariant(row);
  const availableStock = effectiveVariant?.inventory?.quantity ?? 0;

  return {
    id: row.product.id,
    name: row.product.name,
    slug: row.product.slug,
    href: row.product.category?.slug
      ? routes.storefront.product(row.product.category.slug, row.product.slug)
      : routes.storefront.categories,
    variantTitle: effectiveVariant ? getDisplayVariantLabel(effectiveVariant.title) : null,
    variantId: effectiveVariant?.id ?? null,
    sku: effectiveVariant?.sku ?? null,
    quantity: row.quantity,
    availableStock,
    isAvailable: availableStock > 0,
  };
}

function mapSpecifications(
  specifications: Array<{ key: string; value: string }>,
): StorefrontDealSpec[] {
  return specifications.flatMap((specification) => {
    const label = specification.key.trim();
    const value = specification.value.trim();
    return label && value ? [{ label, value }] : [];
  });
}

function parseRelatedDealIds(metadata: Prisma.JsonValue | null | undefined): string[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const raw = (metadata as Record<string, unknown>).relatedDealIds;
  return Array.isArray(raw) ? raw.map((item) => `${item}`).filter(Boolean) : [];
}

function mapDealRecord(record: DealWithProductsRow): StorefrontDeal {
  const products = record.products.flatMap((row) => {
    const mapped = mapIncludedProduct(row);
    return mapped ? [mapped] : [];
  });
  const availableStock = products.length === 0 ? 0 : Math.min(...products.map((product) => product.availableStock));
  const price = record.price;
  const compareAt = record.compareAtPrice;
  const seo = {
    ...(record.seoTitle?.trim() ? { title: record.seoTitle } : {}),
    ...(record.seoDescription?.trim() ? { description: record.seoDescription } : {}),
    ...(record.seoCanonicalUrl?.trim() ? { canonicalUrl: record.seoCanonicalUrl } : {}),
    ...(record.seoOgTitle?.trim() ? { ogTitle: record.seoOgTitle } : {}),
    ...(record.seoOgDescription?.trim() ? { ogDescription: record.seoOgDescription } : {}),
    ...(record.seoImageUrl?.trim() ? { imageUrl: record.seoImageUrl } : {}),
    ...(record.seoKeywords?.trim() ? { keywords: record.seoKeywords } : {}),
    noIndex: record.seoNoIndex,
  };

  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    ...(record.shortDescription?.trim() ? { shortDescription: record.shortDescription } : {}),
    ...(record.description ? { description: record.description } : {}),
    status: record.status,
    categorySlug: record.category?.slug ?? null,
    ...(Object.keys(seo).length > 0 ? { seo } : {}),
    price,
    ...(typeof compareAt === "number" && compareAt > price ? { compareAt } : {}),
    images: normalizeDealImages(record.images, record.title),
    products,
    specifications: mapSpecifications(record.specifications),
    relatedDealIds: parseRelatedDealIds(record.metadata),
    availableStock,
    isAvailable: products.length > 0 && availableStock > 0,
    isLowStock: products.length > 0 && availableStock > 0 && availableStock <= DEAL_LOW_STOCK_THRESHOLD,
  };
}

/**
 * Lists published deals for the storefront (homepage + deals listing). Deals
 * are included when they are PUBLISHED and contain at least one PUBLISHED
 * product; hidden/archived products are filtered out of each deal.
 */
export async function listPublishedDeals(): Promise<StorefrontDeal[]> {
  const db = getPrismaClient();

  try {
    const records = await db.deal.findMany({
      where: {
        status: "PUBLISHED",
        products: {
          some: {
            product: {
              status: "PUBLISHED",
            },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      select: dealWithProductsSelect,
    });

    return records.flatMap((record) => {
      const deal = mapDealRecord(record);
      return deal.products.length > 0 ? [deal] : [];
    });
  } catch (error) {
    logger.error("Failed to list published deals.", error);
    return [];
  }
}

/**
 * Returns slugs for all published deals (containing a published product).
 * Used by `generateStaticParams` in the deal detail route.
 */
export async function getPublishedDealSlugs(): Promise<string[]> {
  const db = getPrismaClient();

  try {
    const records = await db.deal.findMany({
      where: {
        status: "PUBLISHED",
        products: {
          some: {
            product: {
              status: "PUBLISHED",
            },
          },
        },
      },
      select: {
        slug: true,
      },
    });

    return records.map((record) => record.slug);
  } catch (error) {
    logger.error("Failed to list published deal slugs.", error);
    return [];
  }
}

/**
 * Returns a single published deal by slug for the deal detail page, or `null`
 * when the deal does not exist, is not published, or contains no published
 * products.
 */
export async function getDealBySlug(slug: string): Promise<StorefrontDeal | null> {
  const db = getPrismaClient();

  const record = await db.deal.findUnique({
    where: { slug },
    select: dealWithProductsSelect,
  });

  if (!record || record.status !== "PUBLISHED") {
    return null;
  }

  const deal = mapDealRecord(record);
  return deal.products.length > 0 ? deal : null;
}

/**
 * Returns published deals by id, ordered by the input order. Used to hydrate
 * the "Related deals" cross-sell from the deal's stored `relatedDealIds`.
 * Unpublished/missing deals are skipped.
 */
export async function listPublishedDealsByIds(ids: string[]): Promise<StorefrontDeal[]> {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];

  if (uniqueIds.length === 0) {
    return [];
  }

  const db = getPrismaClient();

  try {
    const records = await db.deal.findMany({
      where: {
        id: { in: uniqueIds },
        status: "PUBLISHED",
        products: {
          some: {
            product: {
              status: "PUBLISHED",
            },
          },
        },
      },
      select: dealWithProductsSelect,
    });

    const recordById = new Map(records.map((record) => [record.id, record]));
    const ordered = uniqueIds
      .map((id) => recordById.get(id))
      .filter((record): record is DealWithProductsRow => Boolean(record));

    return ordered.flatMap((record) => {
      const deal = mapDealRecord(record);
      return deal.products.length > 0 ? [deal] : [];
    });
  } catch (error) {
    logger.error("Failed to list related deals by ids.", error);
    return [];
  }
}
