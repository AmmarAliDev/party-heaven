/**
 * Storefront catalog Prisma query layer.
 *
 * All queries enforce publish-state visibility rules:
 *   - Only PUBLISHED categories are returned
 *   - Only PUBLISHED products belonging to PUBLISHED categories are returned
 *   - Only APPROVED reviews are returned on the product detail
 *
 * Consumed by:
 *   - src/features/catalog/service.ts   — listing, detail, and related products
 *   - src/features/catalog/search-adapter.ts — DB-backed keyword search
 *
 * Build-time caching:
 *   - `listPublishedCategories` and `listAllPublishedProducts` are wrapped with
 *     `unstable_cache` (revalidate: 900 s) to deduplicate the many concurrent
 *     Prisma calls that Next.js fires during static generation.  Without this
 *     cache every page that renders <AppHeader /> issues independent DB queries
 *     and exhausts the connection pool (Prisma P2024).
 *   - Admin server actions MUST call `revalidateTag(CATALOG_CACHE_TAGS.*)` after
 *     any create/update/delete so the cache is invalidated immediately.
 */

import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";

import { expandSearchQuery } from "@/features/catalog/lib/search-text";
import { createLogger } from "@/lib/logger";
import { getPrismaClient } from "@/server/db";

const CATALOG_CACHE_REVALIDATE_SECONDS = 900;
const PRISMA_POOL_TIMEOUT_ERROR_CODE = "P2024";
const PRISMA_POOL_TIMEOUT_MAX_ATTEMPTS = 2;
const ONE_DOLLAR_MAX_PRICE_PKR = 280;
const catalogQueriesLogger = createLogger("catalog-queries");

// Search candidate pooling: the DB query intentionally fetches a larger
// candidate pool than the final result limit so the search adapter can rank by
// relevance (name/category matches above description matches) before slicing
// down to the requested limit.
const SEARCH_CANDIDATE_POOL_MULTIPLIER = 4;
const SEARCH_CANDIDATE_POOL_MIN = 24;
const SEARCH_CANDIDATE_POOL_CAP = 60;

function isPrismaPoolTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  return (
    "code" in error &&
    (error as { code?: unknown }).code === PRISMA_POOL_TIMEOUT_ERROR_CODE
  );
}

async function withPrismaPoolTimeoutRetry<T>(operation: () => Promise<T>): Promise<T> {
  let attempt = 1;

  while (attempt <= PRISMA_POOL_TIMEOUT_MAX_ATTEMPTS) {
    try {
      return await operation();
    } catch (error) {
      if (!isPrismaPoolTimeoutError(error) || attempt >= PRISMA_POOL_TIMEOUT_MAX_ATTEMPTS) {
        throw error;
      }

      // Retry once for transient pool contention spikes during concurrent prerender.
      attempt += 1;
    }
  }

  throw new Error("unreachable: prisma pool-timeout retry loop exited unexpectedly");
}

// ---------------------------------------------------------------------------
// Cache tags — imported by admin server actions for on-demand revalidation
// ---------------------------------------------------------------------------

/**
 * Stable string tags used with Next.js `unstable_cache` / `revalidateTag`.
 *
 * Admin actions that mutate catalog data must call `revalidateTag` with the
 * appropriate tag so storefront pages reflect changes without waiting for the
 * 15-minute ISR window to expire.
 */
export const CATALOG_CACHE_TAGS = {
  /** Tag covering all published-category list queries. */
  categories: "catalog:categories",
  /** Tag covering all published-product list queries. */
  products: "catalog:products",
} as const;

// ---------------------------------------------------------------------------
// Shared product field selection
// ---------------------------------------------------------------------------

/**
 * Standard fields fetched for any published product.
 * Used in listings, related-products queries, and the detail page.
 */
const storefrontProductSelect = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  description: true,
  masterSku: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  images: {
    orderBy: { position: "asc" as const },
    select: {
      id: true,
      url: true,
      alt: true,
      position: true,
      // Lets the storefront know which variant an image belongs to so the
      // gallery can switch variants when a thumbnail is tapped.
      productVariantId: true,
    },
  },
  specifications: {
    orderBy: { position: "asc" as const },
    select: {
      id: true,
      key: true,
      value: true,
    },
  },
  variants: {
    orderBy: [{ isDefault: "desc" as const }, { createdAt: "asc" as const }],
    select: {
      id: true,
      title: true,
      sku: true,
      options: true,
      price: true,
      compareAtPrice: true,
      isDefault: true,
      inventory: {
        select: {
          quantity: true,
        },
      },
    },
  },
  // Include APPROVED review ratings for computing averageRating / reviewCount
  // on the listing cards. Only fetch rating to keep payloads small.
  reviews: {
    where: { status: "APPROVED" as const },
    select: {
      rating: true,
    },
  },
} satisfies Prisma.ProductSelect;

/** Inferred type for a product row returned by storefrontProductSelect. */
export type StorefrontProductRecord = Prisma.ProductGetPayload<{
  select: typeof storefrontProductSelect;
}>;

// ---------------------------------------------------------------------------
// Variant image merge helper
// ---------------------------------------------------------------------------

/**
 * Merges variant-level images into a batch of storefront product records.
 *
 * Prisma's `Product.images` relation only returns product-level rows
 * (`productId` set). Variant products store their media on the variant rows
 * (`productVariantId` set, `productId` null), so those images are invisible to
 * `product.images` and must be fetched separately. This helper performs ONE
 * batched query for the whole product set and appends each product's variant
 * images (ordered by `position`) after its product-level images.
 *
 * This is what lets listing cards, search results, related products, and
 * homepage sections show the real cover image for variant-only media instead
 * of the placeholder gradient — without an N+1 fetch per product.
 */
async function mergeVariantImagesIntoProducts(
  products: StorefrontProductRecord[],
): Promise<StorefrontProductRecord[]> {
  const productIds = products.map((product) => product.id);

  if (productIds.length === 0) {
    return products;
  }

  const db = getPrismaClient();
  const variantImages = await db.productImage.findMany({
    where: {
      productVariant: {
        productId: { in: productIds },
      },
    },
    orderBy: { position: "asc" },
    select: {
      id: true,
      url: true,
      alt: true,
      position: true,
      productVariantId: true,
      // Used only to group the fetched rows back to their owning product.
      productVariant: {
        select: { productId: true },
      },
    },
  });

  if (variantImages.length === 0) {
    return products;
  }

  const imagesByProductId = new Map<string, StorefrontProductRecord["images"]>();
  for (const image of variantImages) {
    const productId = image.productVariant?.productId;
    if (!productId) {
      continue;
    }
    const group = imagesByProductId.get(productId) ?? [];
    group.push({
      id: image.id,
      url: image.url,
      alt: image.alt,
      position: image.position,
      productVariantId: image.productVariantId,
    });
    imagesByProductId.set(productId, group);
  }

  return products.map((product) => {
    const extraImages = imagesByProductId.get(product.id);
    return extraImages && extraImages.length > 0
      ? { ...product, images: [...product.images, ...extraImages] }
      : product;
  });
}

// ---------------------------------------------------------------------------
// Category queries
// ---------------------------------------------------------------------------

/**
 * Implementation (not exported directly — callers use the cached wrapper below).
 */
async function _listPublishedCategoriesImpl() {
  const db = getPrismaClient();
  return db.category.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      cardImageUrl: true,
      seoTitle: true,
      seoDescription: true,
      _count: {
        select: {
          products: {
            where: { status: "PUBLISHED" },
          },
        },
      },
    },
  });
}

/**
 * Returns all PUBLISHED categories, ordered by name.
 * The `productCount` field reflects the count of PUBLISHED products only.
 *
 * Wrapped with `unstable_cache` (TTL 900 s) so concurrent static-generation
 * renders during `next build` share a single DB round-trip instead of each
 * opening a new Prisma connection — prevents P2024 connection-pool exhaustion.
 *
 * Bust this cache via `revalidateTag(CATALOG_CACHE_TAGS.categories)` after any
 * admin category create/update/delete.
 */
export const listPublishedCategories = unstable_cache(
  _listPublishedCategoriesImpl,
  ["storefront:published-categories"],
  {
    revalidate: CATALOG_CACHE_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.categories],
  },
);

/** Inferred record type for a category row from listPublishedCategories. */
export type StorefrontCategoryRecord = Awaited<
  ReturnType<typeof _listPublishedCategoriesImpl>
>[number];

/**
 * Returns a single PUBLISHED category by slug.
 * Returns `null` if the category does not exist or is not published.
 */
async function _getPublishedCategoryBySlugImpl(slug: string) {
  const db = getPrismaClient();
  return withPrismaPoolTimeoutRetry(() =>
    db.category.findFirst({
      where: { slug, status: "PUBLISHED" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        cardImageUrl: true,
        seoTitle: true,
        seoDescription: true,
        _count: {
          select: {
            products: {
              where: { status: "PUBLISHED" },
            },
          },
        },
      },
    }),
  );
}

const _getPublishedCategoryBySlugCached = unstable_cache(
  _getPublishedCategoryBySlugImpl,
  ["storefront:published-category-by-slug"],
  {
    revalidate: CATALOG_CACHE_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.categories],
  },
);

/**
 * Returns a single PUBLISHED category by slug.
 * Returns `null` if the category does not exist or is not published.
 */
export async function getPublishedCategoryBySlug(slug: string) {
  return _getPublishedCategoryBySlugCached(slug);
}

// ---------------------------------------------------------------------------
// Product listing and detail queries
// ---------------------------------------------------------------------------

/**
 * Returns all PUBLISHED products within a PUBLISHED category identified by slug.
 * Ordered by `createdAt DESC` (newest first) as the base for client-side sort.
 *
 * Filtering (price, availability, ratings, discount) and final sort/pagination
 * are applied in the service layer after this fetch.
 */
export async function listPublishedProductsByCategory(categorySlug: string) {
  const db = getPrismaClient();
  const products = await db.product.findMany({
    where: {
      status: "PUBLISHED",
      category: { slug: categorySlug, status: "PUBLISHED" },
    },
    orderBy: { createdAt: "desc" },
    select: storefrontProductSelect,
  });

  return mergeVariantImagesIntoProducts(products);
}

/**
 * Implementation (not exported directly — callers use the cached wrapper below).
 */
async function _listAllPublishedProductsImpl() {
  const db = getPrismaClient();
  const products = await db.product.findMany({
    where: {
      status: "PUBLISHED",
      category: { status: "PUBLISHED" },
    },
    orderBy: { createdAt: "desc" },
    select: storefrontProductSelect,
  });

  return mergeVariantImagesIntoProducts(products);
}

/**
 * Returns all PUBLISHED products whose category is also PUBLISHED.
 * Ordered by `createdAt DESC` (newest first).
 *
 * Used by virtual/system storefront collections that derive membership
 * from product attributes instead of direct category relations.
 *
 * Wrapped with `unstable_cache` (TTL 900 s) for the same reason as
 * `listPublishedCategories` — prevents P2024 during concurrent builds.
 *
 * Bust this cache via `revalidateTag(CATALOG_CACHE_TAGS.products)` after any
 * admin product create/update/delete.
 */
export const listAllPublishedProducts = unstable_cache(
  _listAllPublishedProductsImpl,
  ["storefront:published-products-all"],
  {
    revalidate: CATALOG_CACHE_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.products],
  },
);

/**
 * Counts One Dollar eligible published products using only one selected
 * variant per product (default variant first, then oldest variant fallback).
 *
 * This avoids loading full product cards just to compute the virtual
 * category count used by global navigation and category badges.
 */
async function _countPublishedOneDollarProductsImpl() {
  const db = getPrismaClient();
  try {
    const result = await db.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*)::int AS "count"
      FROM "Product" AS p
      INNER JOIN "Category" AS c ON c."id" = p."category_id"
      INNER JOIN LATERAL (
        SELECT pv."price"
        FROM "ProductVariant" AS pv
        WHERE pv."product_id" = p."id"
        ORDER BY pv."is_default" DESC, pv."created_at" ASC
        LIMIT 1
      ) AS selected_variant ON TRUE
      WHERE p."status" = 'PUBLISHED'
        AND c."status" = 'PUBLISHED'
        AND selected_variant."price" <= ${ONE_DOLLAR_MAX_PRICE_PKR}
    `;

    const countValue = result[0]?.count;

    if (typeof countValue === "number") {
      return Number.isFinite(countValue) && countValue >= 0 ? countValue : 0;
    }

    if (typeof countValue === "bigint") {
      return countValue >= BigInt(0) ? Number(countValue) : 0;
    }

    return 0;
  } catch (error) {
    catalogQueriesLogger.warn("raw one-dollar count failed; using fallback query", {
      code: "CATALOG_ONE_DOLLAR_COUNT_RAW_QUERY_FAILED",
      error,
    });

    // Fallback preserves storefront behavior even if raw SQL fails in a
    // constrained runtime while still keeping this path safe.
    const products = await db.product.findMany({
      where: {
        status: "PUBLISHED",
        category: {
          status: "PUBLISHED",
        },
        variants: {
          some: {},
        },
      },
      select: {
        variants: {
          orderBy: [{ isDefault: "desc" as const }, { createdAt: "asc" as const }],
          take: 1,
          select: {
            price: true,
          },
        },
      },
    });

    return products.reduce((total, product) => {
      const price = product.variants[0]?.price;

      if (typeof price !== "number") {
        return total;
      }

      return price <= ONE_DOLLAR_MAX_PRICE_PKR ? total + 1 : total;
    }, 0);
  }
}

export const countPublishedOneDollarProducts = unstable_cache(
  _countPublishedOneDollarProductsImpl,
  ["storefront:published-products-one-dollar-count"],
  {
    revalidate: CATALOG_CACHE_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.products],
  },
);

/**
 * Lightweight published-product context used by render paths that do not need
 * full PDP payloads (for example metadata assembly and related-product routing).
 */
async function _getPublishedProductContextBySlugImpl(slug: string) {
  const db = getPrismaClient();
  return withPrismaPoolTimeoutRetry(() =>
    db.product.findFirst({
      where: {
        slug,
        status: "PUBLISHED",
        category: { status: "PUBLISHED" },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        shortDescription: true,
        metadata: true,
        category: {
          select: {
            slug: true,
          },
        },
      },
    }),
  );
}

const _getPublishedProductContextBySlugCached = unstable_cache(
  _getPublishedProductContextBySlugImpl,
  ["storefront:published-product-context-by-slug"],
  {
    revalidate: CATALOG_CACHE_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.products],
  },
);

export async function getPublishedProductContextBySlug(slug: string) {
  return _getPublishedProductContextBySlugCached(slug);
}

export type StorefrontPublishedProductContextRecord = Awaited<
  ReturnType<typeof getPublishedProductContextBySlug>
>;

/**
 * Returns the full detail record for a single PUBLISHED product identified by slug.
 * Includes APPROVED review body text (for PDP review section).
 *
 * Returns `null` if the product does not exist, is not published, or belongs
 * to a category that is not published.
 */
async function _getPublishedProductBySlugImpl(slug: string) {
  const db = getPrismaClient();
  return withPrismaPoolTimeoutRetry(async () => {
    const product = await db.product.findFirst({
      where: {
        slug,
        status: "PUBLISHED",
        category: { status: "PUBLISHED" },
      },
      select: {
        ...storefrontProductSelect,
        // For the detail page, also fetch full review text (APPROVED only)
        reviews: {
          where: { status: "APPROVED" },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            rating: true,
            title: true,
            body: true,
            status: true,
            createdAt: true,
            user: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!product) {
      return null;
    }

    // `Product.images` only returns product-level rows (productId set).
    // Variant-level images (productVariantId set, productId null) are attached
    // to the product's variants, so they are fetched separately and merged —
    // otherwise the PDP gallery would never see variant-specific media.
    const variantImages = await db.productImage.findMany({
      where: {
        productVariant: {
          productId: product.id,
        },
      },
      orderBy: { position: "asc" },
      select: {
        id: true,
        url: true,
        alt: true,
        position: true,
        productVariantId: true,
      },
    });

    return { ...product, images: [...product.images, ...variantImages] };
  });
}

const _getPublishedProductBySlugCached = unstable_cache(
  _getPublishedProductBySlugImpl,
  ["storefront:published-product-by-slug"],
  {
    revalidate: CATALOG_CACHE_REVALIDATE_SECONDS,
    tags: [CATALOG_CACHE_TAGS.products],
  },
);

/**
 * Returns the full detail record for a single PUBLISHED product identified by slug.
 * Includes APPROVED review body text (for PDP review section).
 *
 * Returns `null` if the product does not exist, is not published, or belongs
 * to a category that is not published.
 */
export async function getPublishedProductBySlug(slug: string) {
  return _getPublishedProductBySlugCached(slug);
}

/** Inferred type for the product detail record. */
export type StorefrontProductDetailRecord = Awaited<
  ReturnType<typeof getPublishedProductBySlug>
>;

/**
 * Returns up to `limit` PUBLISHED products in a category (by category slug),
 * excluding the product with the given slug.
 * Used for "Related Products" on PDP.
 */
export async function getRelatedPublishedProducts(
  categorySlug: string,
  excludeProductSlug: string,
  limit: number = 4,
) {
  const db = getPrismaClient();
  const products = await db.product.findMany({
    where: {
      status: "PUBLISHED",
      category: { slug: categorySlug, status: "PUBLISHED" },
      slug: { not: excludeProductSlug },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
    select: storefrontProductSelect,
  });

  return mergeVariantImagesIntoProducts(products);
}

/**
 * Returns PUBLISHED products by explicit product IDs, preserving publish
 * visibility constraints (product + category must both be PUBLISHED).
 *
 * Callers are responsible for ordering results to match input IDs.
 */
export async function listPublishedProductsByIds(productIds: string[]) {
  if (productIds.length === 0) {
    return [];
  }

  const db = getPrismaClient();
  const products = await db.product.findMany({
    where: {
      id: {
        in: productIds,
      },
      status: "PUBLISHED",
      category: {
        status: "PUBLISHED",
      },
    },
    select: storefrontProductSelect,
  });

  return mergeVariantImagesIntoProducts(products);
}

/**
 * Returns slug + category slug pairs for all PUBLISHED products whose category
 * is also PUBLISHED. Used by `generateStaticParams` in the product detail route.
 */
export async function getAllPublishedProductSlugsWithCategories() {
  const db = getPrismaClient();
  return db.product.findMany({
    where: {
      status: "PUBLISHED",
      category: { status: "PUBLISHED" },
    },
    select: {
      slug: true,
      category: { select: { slug: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Search query
// ---------------------------------------------------------------------------

/**
 * Searches PUBLISHED products by keyword using case-insensitive substring
 * matching (PostgreSQL ILIKE).
 *
 * Matching strategy (see `src/features/catalog/lib/search-text.ts`):
 *  - The query is tokenized so multi-word input matches on ANY word.
 *  - Each token is expanded with plural/singular variants so "chains" matches
 *    "chain" and "candles" matches "candle".
 *  - Matches run across `name`, `shortDescription`, `description`, AND the
 *    product's `category.name`, so searching a category name surfaces the
 *    products living under that category even when the word is not in their
 *    own text.
 *
 * The query fetches a candidate pool larger than `limit` (up to
 * `SEARCH_CANDIDATE_POOL_CAP`) so the caller can rank by relevance before
 * applying the final limit. Raw rows are ordered by `createdAt` descending;
 * relevance ranking is the caller's responsibility.
 */
export async function searchPublishedProducts(query: string, limit: number = 12) {
  const db = getPrismaClient();
  const variants = expandSearchQuery(query);

  if (variants.length === 0) {
    return [];
  }

  const orConditions: Prisma.ProductWhereInput[] = variants.flatMap((variant) => [
    { name: { contains: variant, mode: "insensitive" } },
    { shortDescription: { contains: variant, mode: "insensitive" } },
    { description: { contains: variant, mode: "insensitive" } },
    {
      category: {
        // `category.status: "PUBLISHED"` is merged from the top-level filter.
        name: { contains: variant, mode: "insensitive" },
      },
    },
  ]);

  const poolSize = Math.min(
    Math.max(limit * SEARCH_CANDIDATE_POOL_MULTIPLIER, SEARCH_CANDIDATE_POOL_MIN),
    SEARCH_CANDIDATE_POOL_CAP,
  );

  const products = await db.product.findMany({
    where: {
      status: "PUBLISHED",
      category: { status: "PUBLISHED" },
      OR: orConditions,
    },
    take: poolSize,
    orderBy: { createdAt: "desc" },
    select: storefrontProductSelect,
  });

  return mergeVariantImagesIntoProducts(products);
}
