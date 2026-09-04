import type { Prisma } from "@prisma/client";

import { routes } from "@/config/routes";
import { normalizeCatalogImageUrl } from "@/features/catalog/lib/product-image-url";
import { listCatalogProductsByIds } from "@/features/catalog/service";
import { listPublishedDealsByIds } from "@/features/deals/service";
import { createLogger } from "@/lib/logger";
import { getPrismaClient } from "@/server/db";

import type { StorefrontOccasionDetail, StorefrontOccasionSummary } from "./types";

const logger = createLogger("occasions.service");

// A published product renders on the occasion page only when both the product
// and its category are published.
const occasionProductVisibleFilter = {
  status: "PUBLISHED",
  category: { status: "PUBLISHED" },
} as const;

// A published deal renders on the occasion page when it is published and still
// has at least one published product to show.
const occasionDealVisibleFilter = {
  status: "PUBLISHED",
  products: {
    some: {
      product: {
        status: "PUBLISHED",
      },
    },
  },
} as const;

const occasionSummarySelect = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  coverImageUrl: true,
  coverImageAlt: true,
  isSpecial: true,
  _count: {
    select: {
      products: { where: { product: occasionProductVisibleFilter } },
      deals: { where: { deal: occasionDealVisibleFilter } },
    },
  },
} satisfies Prisma.OccasionSelect;

type SelectedOccasionSummary = Prisma.OccasionGetPayload<{ select: typeof occasionSummarySelect }>;

const occasionDetailSelect = {
  id: true,
  slug: true,
  name: true,
  status: true,
  shortDescription: true,
  description: true,
  coverImageUrl: true,
  coverImageAlt: true,
  isSpecial: true,
  seoTitle: true,
  seoDescription: true,
  seoCanonicalUrl: true,
  seoOgTitle: true,
  seoOgDescription: true,
  seoImageUrl: true,
  seoKeywords: true,
  seoNoIndex: true,
  products: {
    orderBy: { position: "asc" as const },
    select: {
      productId: true,
    },
  },
  deals: {
    orderBy: { position: "asc" as const },
    select: {
      dealId: true,
    },
  },
} satisfies Prisma.OccasionSelect;

type SelectedOccasionDetail = Prisma.OccasionGetPayload<{ select: typeof occasionDetailSelect }>;

function mapOccasionSummary(record: SelectedOccasionSummary): StorefrontOccasionSummary {
  const coverImageUrl = normalizeCatalogImageUrl(record.coverImageUrl);
  const productCount = record._count.products;
  const dealCount = record._count.deals;

  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    ...(record.shortDescription?.trim() ? { shortDescription: record.shortDescription } : {}),
    ...(coverImageUrl ? { coverImageUrl } : {}),
    ...(record.coverImageAlt?.trim() ? { coverImageAlt: record.coverImageAlt } : {}),
    isSpecial: record.isSpecial,
    productCount,
    dealCount,
    href: routes.storefront.occasion(record.slug),
  };
}

function buildOccasionSeo(record: SelectedOccasionDetail) {
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

  return seo;
}

/**
 * Lists published occasions that still surface at least one published product
 * or deal. Order is newest-first.
 */
export async function listPublishedOccasions(): Promise<StorefrontOccasionSummary[]> {
  const db = getPrismaClient();

  try {
    const records = await db.occasion.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          {
            products: {
              some: { product: occasionProductVisibleFilter },
            },
          },
          {
            deals: {
              some: { deal: occasionDealVisibleFilter },
            },
          },
        ],
      },
      orderBy: [{ updatedAt: "desc" }],
      select: occasionSummarySelect,
    });

    return records.flatMap((record) => {
      const summary = mapOccasionSummary(record);
      return summary.productCount > 0 || summary.dealCount > 0 ? [summary] : [];
    });
  } catch (error) {
    logger.error("Failed to list published occasions.", error);
    return [];
  }
}

/**
 * Returns slugs for all published occasions (with at least one published item).
 * Used by `generateStaticParams` in the occasion detail route.
 */
export async function getPublishedOccasionSlugs(): Promise<string[]> {
  const db = getPrismaClient();

  try {
    const records = await db.occasion.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          {
            products: {
              some: { product: occasionProductVisibleFilter },
            },
          },
          {
            deals: {
              some: { deal: occasionDealVisibleFilter },
            },
          },
        ],
      },
      select: {
        slug: true,
      },
    });

    return records.map((record) => record.slug);
  } catch (error) {
    logger.error("Failed to list published occasion slugs.", error);
    return [];
  }
}

/**
 * Returns a single published occasion by slug, hydrating the curated products
 * and deals into storefront card data. Returns `null` when the occasion does
 * not exist or is not published.
 */
export async function getOccasionBySlug(slug: string): Promise<StorefrontOccasionDetail | null> {
  const db = getPrismaClient();

  const record = await db.occasion.findUnique({
    where: { slug },
    select: occasionDetailSelect,
  });

  if (!record || record.status !== "PUBLISHED") {
    return null;
  }

  const productIds = record.products.map((row) => row.productId);
  const dealIds = record.deals.map((row) => row.dealId);

  const [products, deals] = await Promise.all([
    listCatalogProductsByIds(productIds),
    listPublishedDealsByIds(dealIds),
  ]);

  const coverImageUrl = normalizeCatalogImageUrl(record.coverImageUrl);
  const seo = buildOccasionSeo(record);

  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    ...(record.shortDescription?.trim() ? { shortDescription: record.shortDescription } : {}),
    ...(record.description ? { description: record.description } : {}),
    ...(coverImageUrl ? { coverImageUrl } : {}),
    ...(record.coverImageAlt?.trim() ? { coverImageAlt: record.coverImageAlt } : {}),
    isSpecial: record.isSpecial,
    ...(Object.keys(seo).length > 0 ? { seo } : {}),
    products,
    deals,
  };
}
