import { OrderStatus } from "@prisma/client";

import { routes } from "@/config/routes";
import { createLogger } from "@/lib/logger";
import { getPrismaClient } from "@/server/db";
import type { StorefrontProductRecord } from "@/server/db/catalog-queries";
import { listAllPublishedProducts, listPublishedProductsByIds } from "@/server/db/catalog-queries";

import type { FeaturedProductItem } from "./types";

const logger = createLogger("homepage.featured-products");

export const HOMEPAGE_FEATURED_PRODUCTS_LIMIT = 4;
const HOMEPAGE_SALES_CANDIDATE_FETCH_LIMIT = 24;

export const HOMEPAGE_MOST_SOLD_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PACKED,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

function extractPricing(product: StorefrontProductRecord): {
  price: number;
  compareAt?: number;
} {
  const defaultVariant = product.variants.find((variant) => variant.isDefault) ?? product.variants[0] ?? null;

  if (!defaultVariant) {
    return { price: 0 };
  }

  return {
    price: defaultVariant.price,
    ...(typeof defaultVariant.compareAtPrice === "number" && defaultVariant.compareAtPrice > defaultVariant.price
      ? { compareAt: defaultVariant.compareAtPrice }
      : {}),
  };
}

function toFeaturedProductItem(
  product: StorefrontProductRecord,
  variantImage?: { url: string; alt: string | null } | null,
): FeaturedProductItem {
  const pricing = extractPricing(product);
  const categorySlug = product.category?.slug;
  const description = product.shortDescription ?? product.description;
  const inventoryQuantity = product.variants.reduce(
    (total, variant) => total + (variant.inventory?.quantity ?? 0),
    0,
  );

  // Variant products may store images per variant. When the product has no
  // product-level image, fall back to the first (default) variant's image so
  // homepage cards keep showing a real thumbnail.
  const images =
    product.images.length > 0
      ? product.images
      : variantImage
        ? [variantImage]
        : [];

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    ...(description ? { description } : {}),
    href: categorySlug ? routes.storefront.product(categorySlug, product.slug) : routes.storefront.categories,
    price: pricing.price,
    ...(typeof pricing.compareAt === "number" ? { compareAt: pricing.compareAt } : {}),
    badge: "Best seller",
    inventoryQuantity,
    ...(images.length > 0
      ? {
          images: images.map((image, index) => ({
            url: image.url,
            ...(image.alt ? { alt: image.alt } : {}),
            isPrimary: index === 0,
          })),
        }
      : {}),
  };
}

/**
 * Fetches the primary image of the default (first) variant for products that
 * have no product-level images. Variant products store their media per variant,
 * so this keeps homepage cards thumbnailed without bloating the shared
 * catalog select with nested variant images on every listing query.
 */
async function backfillVariantPrimaryImages(
  products: StorefrontProductRecord[],
): Promise<Map<string, { url: string; alt: string | null } | null>> {
  const productsWithoutImages = products.filter((product) => product.images.length === 0);

  if (productsWithoutImages.length === 0) {
    return new Map();
  }

  const db = getPrismaClient();
  const variantRows = await db.productVariant.findMany({
    where: {
      productId: {
        in: productsWithoutImages.map((product) => product.id),
      },
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      productId: true,
      images: {
        orderBy: { position: "asc" },
        take: 1,
        select: {
          url: true,
          alt: true,
        },
      },
    },
  });

  const imageByProduct = new Map<string, { url: string; alt: string | null } | null>();

  for (const row of variantRows) {
    if (!imageByProduct.has(row.productId) && row.images[0]) {
      imageByProduct.set(row.productId, row.images[0]);
    }
  }

  return imageByProduct;
}

function appendUniqueProducts(
  existing: FeaturedProductItem[],
  candidates: FeaturedProductItem[],
  limit: number = HOMEPAGE_FEATURED_PRODUCTS_LIMIT,
): FeaturedProductItem[] {
  const seenIds = new Set(existing.map((item) => item.id));
  const merged = [...existing];

  for (const candidate of candidates) {
    if (merged.length >= limit) {
      break;
    }

    if (seenIds.has(candidate.id)) {
      continue;
    }

    seenIds.add(candidate.id);
    merged.push(candidate);
  }

  return merged;
}

async function getMostSoldPublishedProducts(): Promise<FeaturedProductItem[]> {
  const db = getPrismaClient();
  const groupedSales = await db.orderItem.groupBy({
    by: ["productId"],
    where: {
      productId: {
        not: null,
      },
      order: {
        status: {
          in: HOMEPAGE_MOST_SOLD_ORDER_STATUSES,
        },
      },
    },
    _sum: {
      quantity: true,
    },
    _count: {
      productId: true,
    },
    orderBy: [
      {
        _sum: {
          quantity: "desc",
        },
      },
      {
        _count: {
          productId: "desc",
        },
      },
      {
        productId: "asc",
      },
    ],
    take: HOMEPAGE_SALES_CANDIDATE_FETCH_LIMIT,
  });

  const rankedProductIds = groupedSales
    .map((entry) => ({
      productId: entry.productId,
      unitsSold: entry._sum.quantity ?? 0,
    }))
    .filter((entry): entry is { productId: string; unitsSold: number } => Boolean(entry.productId) && entry.unitsSold > 0)
    .map((entry) => entry.productId);

  if (rankedProductIds.length === 0) {
    return [];
  }

  const publishedProducts = await listPublishedProductsByIds(rankedProductIds);
  const publishedProductsById = new Map(publishedProducts.map((product) => [product.id, product]));
  const variantImages = await backfillVariantPrimaryImages(publishedProducts);

  return rankedProductIds
    .map((productId) => publishedProductsById.get(productId))
    .filter((product): product is StorefrontProductRecord => Boolean(product))
    .map((product) => toFeaturedProductItem(product, variantImages.get(product.id)));
}

async function getRecentPublishedProducts(): Promise<FeaturedProductItem[]> {
  const products = await listAllPublishedProducts();
  const variantImages = await backfillVariantPrimaryImages(products);
  return products.map((product) => toFeaturedProductItem(product, variantImages.get(product.id)));
}

export async function resolveHomepageFeaturedProducts(
  fallbackProducts: FeaturedProductItem[] = [],
): Promise<FeaturedProductItem[]> {
  let featuredProducts: FeaturedProductItem[] = [];

  try {
    featuredProducts = appendUniqueProducts(featuredProducts, await getMostSoldPublishedProducts());
  } catch (error) {
    logger.error("Failed to rank homepage featured products from order sales data.", error);
  }

  // Prefer real catalog products over placeholder fallback content so cards
  // keep their add-to-cart affordance (fallback items carry no product slug).
  if (featuredProducts.length < HOMEPAGE_FEATURED_PRODUCTS_LIMIT) {
    try {
      featuredProducts = appendUniqueProducts(
        featuredProducts,
        await getRecentPublishedProducts(),
      );
    } catch (error) {
      logger.error("Failed to backfill homepage featured products from the published catalog.", error);
    }
  }

  if (featuredProducts.length < HOMEPAGE_FEATURED_PRODUCTS_LIMIT) {
    featuredProducts = appendUniqueProducts(featuredProducts, fallbackProducts);
  }

  return featuredProducts;
}