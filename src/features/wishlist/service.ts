import { Currency, ProductStatus } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import { routes } from "@/config/routes";
import { catalogCategorySeeds, catalogProductDetailSeeds, catalogProductSeeds } from "@/features/catalog/data";
import { AppError } from "@/lib/errors/app-error";
import type { DatabaseExecutor } from "@/server/db";
import { getPrismaClient } from "@/server/db";

type ResolveWishlistSelectionInput = {
  productSlug: string;
  optionId?: string | undefined;
};

type WishlistSeedSelection = {
  categorySlug: string;
  categoryName: string;
  productSlug: string;
  productName: string;
  shortDescription: string;
  longDescription: string;
  optionId: string | null;
  optionLabel: string | null;
  sku: string;
  price: number;
  compareAt: number | null;
  inventoryQuantity: number;
};

type ResolvedWishlistSelection = {
  selection: WishlistSeedSelection;
  variantId: string;
};

export type WishlistItemView = {
  id: string;
  productName: string;
  productSlug: string;
  categorySlug: string;
  categoryName: string;
  sku: string;
  optionLabel: string | null;
  price: number;
  compareAt: number | null;
  quantity: number;
  href: string;
  createdAt: string;
};

function toMissingProductError(slug: string) {
  return new AppError(`Wishlist product not found for slug: ${slug}`, "WISHLIST_PRODUCT_NOT_FOUND", {
    statusCode: 404,
    userMessage: "This product is not available for wishlist right now.",
  });
}

function toMissingVariantError(optionId: string) {
  return new AppError(`Wishlist variant not found for option: ${optionId}`, "WISHLIST_VARIANT_NOT_FOUND", {
    statusCode: 404,
    userMessage: "The selected product option is no longer available.",
  });
}

export function resolveWishlistSeedSelection(input: ResolveWishlistSelectionInput): WishlistSeedSelection {
  const product = catalogProductSeeds.find((item) => item.slug === input.productSlug);

  if (!product) {
    throw toMissingProductError(input.productSlug);
  }

  const productDetail = catalogProductDetailSeeds[input.productSlug];
  if (!productDetail) {
    throw toMissingProductError(input.productSlug);
  }

  const category = catalogCategorySeeds.find((item) => item.slug === product.categorySlug);
  if (!category) {
    throw toMissingProductError(input.productSlug);
  }

  const firstVariantGroup = productDetail.variantGroups[0];
  let selectedOption = null;
  if (input.optionId) {
    // Search all variant groups for the optionId
    for (const group of productDetail.variantGroups) {
      const found = group.options.find((option) => option.id === input.optionId);
      if (found) {
        selectedOption = found;
        break;
      }
    }
    if (!selectedOption) {
      throw toMissingVariantError(input.optionId);
    }
  } else {
    selectedOption = firstVariantGroup?.options[0] ?? null;
  }

  const resolvedSku = selectedOption?.sku ?? productDetail.sku;
  if (!resolvedSku) {
    throw new AppError(`Wishlist SKU missing for product: ${input.productSlug}`, "WISHLIST_SKU_MISSING", {
      statusCode: 500,
      userMessage: "This product cannot be wishlisted right now. Please try again.",
    });
  }

  return {
    categorySlug: category.slug,
    categoryName: category.name,
    productSlug: product.slug,
    productName: product.name,
    shortDescription: productDetail.shortDescription,
    longDescription: productDetail.longDescription,
    optionId: selectedOption?.id ?? null,
    optionLabel: selectedOption?.label ?? null,
    sku: resolvedSku,
    price: selectedOption?.price ?? product.price,
    compareAt: selectedOption?.compareAt ?? product.compareAt ?? null,
    inventoryQuantity: selectedOption?.inventoryQuantity ?? product.inventoryQuantity,
  };
}

async function getOrCreateWishlistForUser(userId: string) {
  const db = getPrismaClient();

  try {
    return await db.wishlist.create({
      data: { userId },
    });
  } catch (error) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existingWishlist = await db.wishlist.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });

      if (existingWishlist) {
        return existingWishlist;
      }
    }

    throw error;
  }
}

async function ensureSeedCatalogVariant(selection: WishlistSeedSelection) {
  const db = getPrismaClient();

  const category = await db.category.upsert({
    where: { slug: selection.categorySlug },
    update: {
      name: selection.categoryName,
    },
    create: {
      slug: selection.categorySlug,
      name: selection.categoryName,
      description: `Seed-backed category for ${selection.categoryName}`,
    },
  });

  const product = await db.product.upsert({
    where: { slug: selection.productSlug },
    update: {
      name: selection.productName,
      shortDescription: selection.shortDescription,
      description: selection.longDescription,
      categoryId: category.id,
    },
    create: {
      slug: selection.productSlug,
      name: selection.productName,
      shortDescription: selection.shortDescription,
      description: selection.longDescription,
      categoryId: category.id,
      status: ProductStatus.PUBLISHED,
    },
  });

  return db.productVariant.upsert({
    where: { sku: selection.sku },
    update: {
      productId: product.id,
      title: selection.optionLabel,
      price: selection.price,
      compareAtPrice: selection.compareAt,
      isDefault: selection.optionId === null,
    },
    create: {
      productId: product.id,
      sku: selection.sku,
      title: selection.optionLabel,
      price: selection.price,
      compareAtPrice: selection.compareAt,
      currency: Currency.PKR,
      isDefault: selection.optionId === null,
    },
  });
}

/**
 * Resolves a wishlist selection against the live catalog first, so the
 * `optionId` sent from the PDP (a real product-variant id from the database)
 * maps to the correct variant. Falls back to seed data only when the product
 * has not been created in the database yet.
 */
async function resolveWishlistSelection(
  input: ResolveWishlistSelectionInput,
  db: DatabaseExecutor,
): Promise<ResolvedWishlistSelection> {
  const product = await db.product.findFirst({
    where: {
      slug: input.productSlug,
      status: ProductStatus.PUBLISHED,
      category: {
        status: "PUBLISHED",
      },
    },
    select: {
      name: true,
      slug: true,
      shortDescription: true,
      description: true,
      masterSku: true,
      category: {
        select: {
          name: true,
          slug: true,
        },
      },
      variants: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          sku: true,
          price: true,
          compareAtPrice: true,
          isDefault: true,
          inventory: {
            select: {
              quantity: true,
              reserved: true,
              safetyStock: true,
            },
          },
        },
      },
    },
  });

  if (!product) {
    const selection = resolveWishlistSeedSelection(input);
    const variant = await ensureSeedCatalogVariant(selection);

    return {
      selection,
      variantId: variant.id,
    };
  }

  if (product.variants.length === 0) {
    throw toMissingProductError(input.productSlug);
  }

  const selectedVariant = input.optionId
    ? product.variants.find((variant) => variant.id === input.optionId)
    : product.variants.find((variant) => variant.isDefault) ?? product.variants[0];

  if (!selectedVariant) {
    if (input.optionId) {
      throw toMissingVariantError(input.optionId);
    }

    throw toMissingProductError(input.productSlug);
  }

  const resolvedSku = selectedVariant.sku ?? product.masterSku ?? "";
  if (!resolvedSku) {
    throw new AppError(`Wishlist SKU missing for product: ${input.productSlug}`, "WISHLIST_SKU_MISSING", {
      statusCode: 500,
      userMessage: "This product cannot be wishlisted right now. Please try again.",
    });
  }

  return {
    variantId: selectedVariant.id,
    selection: {
      categorySlug: product.category?.slug ?? "",
      categoryName: product.category?.name ?? "",
      productSlug: product.slug,
      productName: product.name,
      shortDescription: product.shortDescription ?? "",
      longDescription: product.description ?? "",
      optionId: selectedVariant.id,
      optionLabel: selectedVariant.title,
      sku: resolvedSku,
      price: selectedVariant.price,
      compareAt: selectedVariant.compareAtPrice,
      inventoryQuantity: Math.max(0, selectedVariant.inventory?.quantity ?? 0),
    },
  };
}

export async function addWishlistItemForUser(userId: string, input: ResolveWishlistSelectionInput) {
  const db = getPrismaClient();
  const { variantId } = await resolveWishlistSelection(input, db);

  const wishlist = await getOrCreateWishlistForUser(userId);

  return db.wishlistItem.upsert({
    where: {
      wishlistId_productVariantId: {
        wishlistId: wishlist.id,
        productVariantId: variantId,
      },
    },
    update: {
      quantity: 1,
    },
    create: {
      wishlistId: wishlist.id,
      productVariantId: variantId,
      quantity: 1,
    },
    include: {
      productVariant: {
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      },
    },
  });
}

export async function removeWishlistSelectionForUser(userId: string, input: ResolveWishlistSelectionInput) {
  const db = getPrismaClient();

  let variantId: string;
  try {
    const resolved = await resolveWishlistSelection(input, db);
    variantId = resolved.variantId;
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 404) {
      return false;
    }
    throw err;
  }

  const deleted = await db.wishlistItem.deleteMany({
    where: {
      productVariantId: variantId,
      wishlist: {
        userId,
      },
    },
  });

  return deleted.count > 0;
}

export async function removeWishlistSkuForUser(userId: string, sku: string) {
  const db = getPrismaClient();

  const deleted = await db.wishlistItem.deleteMany({
    where: {
      productVariant: {
        sku,
      },
      wishlist: {
        userId,
      },
    },
  });

  return deleted.count > 0;
}

export async function getWishlistSkusForUser(userId: string) {
  const db = getPrismaClient();

  const items = await db.wishlistItem.findMany({
    where: {
      wishlist: {
        userId,
      },
    },
    select: {
      productVariant: {
        select: {
          sku: true,
        },
      },
    },
  });

  return items
    .map((item) => item.productVariant.sku)
    .filter((sku): sku is string => Boolean(sku));
}

export async function getWishlistItemsForUser(userId: string): Promise<WishlistItemView[]> {
  const db = getPrismaClient();

  const items = await db.wishlistItem.findMany({
    where: {
      wishlist: {
        userId,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      productVariant: {
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      },
    },
  });

  return items.map((item) => {
    const categorySlug = item.productVariant.product.category?.slug;
    const categoryName = item.productVariant.product.category?.name;

    return {
      id: item.id,
      productName: item.productVariant.product.name,
      productSlug: item.productVariant.product.slug,
      categorySlug: categorySlug ?? "",
      categoryName: categoryName ?? "Category",
      sku: item.productVariant.sku ?? "",
      optionLabel: item.productVariant.title,
      price: item.productVariant.price,
      compareAt: item.productVariant.compareAtPrice,
      quantity: item.quantity,
      href:
        categorySlug && item.productVariant.product.slug
          ? routes.storefront.product(categorySlug, item.productVariant.product.slug)
          : routes.storefront.wishlist,
      createdAt: item.createdAt.toISOString(),
    };
  });
}