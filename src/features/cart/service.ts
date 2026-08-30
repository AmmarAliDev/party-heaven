import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { Currency, ProductStatus } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import { routes } from "@/config/routes";
import { catalogCategorySeeds, catalogProductDetailSeeds, catalogProductSeeds } from "@/features/catalog/data";
import { AppError } from "@/lib/errors/app-error";
import type { DatabaseExecutor } from "@/server/db";
import { getPrismaClient, runWithTransaction } from "@/server/db";

import type {
  AddCartItemInput,
  AddDealCartItemInput,
  CartItemSummary,
  CartSummary,
  DealCartItemSummary,
  RemoveCartItemInput,
  RemoveDealCartItemInput,
  ResolveCartContextInput,
  UpdateCartItemInput,
  UpdateDealCartItemInput,
} from "./types";

type ResolveCartSelectionInput = {
  productSlug: string;
  optionId?: string | undefined;
};

type ResolvedCartSelection = {
  selection: CartSeedSelection;
  variantId: string;
};

type CartSeedSelection = {
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

type CartIncludePayload = Prisma.CartGetPayload<{
  include: {
    items: {
      include: {
        productVariant: {
          include: {
            inventory: true;
            images: {
              orderBy: { position: "asc" };
              select: { url: true; alt: true };
            };
            product: {
              include: {
                category: true;
                images: {
                  orderBy: { position: "asc" };
                  select: { url: true; alt: true };
                };
              };
            };
          };
        };
      };
    };
    dealItems: {
      include: {
        deal: {
          include: {
            images: {
              orderBy: { position: "asc" };
              select: { url: true; alt: true };
            };
            products: {
              orderBy: { position: "asc" };
              select: {
                productVariantId: true;
                quantity: true;
                product: {
                  select: {
                    id: true;
                    name: true;
                    slug: true;
                    status: true;
                    variants: {
                      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }];
                      select: {
                        id: true;
                        title: true;
                        sku: true;
                        isDefault: true;
                        inventory: {
                          select: {
                            quantity: true;
                            reserved: true;
                            safetyStock: true;
                          };
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
  };
}>;

/**
 * Structural shape of a Deal (as loaded for cart lines) — used both by the cart
 * include (`CartIncludePayload.dealItems.deal`) and by the deal lookup for
 * add-to-cart, so availability can be computed from either source.
 */
type DealCartLookupPayload = {
  id: string;
  title: string;
  slug: string;
  price: number;
  compareAtPrice: number | null;
  // Accepts Prisma enum types from both the cart include and the deal lookup.
  status: unknown;
  images: Array<{ url: string; alt: string | null }>;
  products: Array<{
    productVariantId: string | null;
    quantity: number;
    product: {
      id: string;
      name: string;
      slug: string;
      status: unknown;
      variants: Array<{
        id: string;
        title: string | null;
        sku: string | null;
        isDefault: boolean;
        inventory: { quantity: number; reserved: number; safetyStock: number } | null;
      }>;
    };
  }>;
};

type DealCartDealPayload = DealCartLookupPayload;
type DealCartProductRow = DealCartLookupPayload["products"][number];

const MAX_CART_ITEM_QUANTITY = 99;

function normalizeQuantity(quantity: number | undefined) {
  if (typeof quantity !== "number" || Number.isNaN(quantity)) {
    return 1;
  }

  return Math.max(1, Math.min(MAX_CART_ITEM_QUANTITY, Math.trunc(quantity)));
}

function getAvailableInventoryQuantity(inventory: { quantity: number; reserved: number; safetyStock: number } | null) {
  if (!inventory) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, inventory.quantity - inventory.reserved - inventory.safetyStock);
}

function generateCartToken() {
  return randomUUID().replace(/-/g, "");
}

function isCartTokenConflict(error: unknown) {
  if (!(error instanceof PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const rawTarget = error.meta?.target;
  const targets = Array.isArray(rawTarget)
    ? rawTarget.map((value) => `${value}`.toLowerCase())
    : typeof rawTarget === "string"
      ? [rawTarget.toLowerCase()]
      : [];

  return targets.some((target) => target.includes("token"));
}

async function createActiveCartWithUniqueToken(
  input: {
    userId?: string | null;
  },
  db: DatabaseExecutor,
) {
  // Validate user exists if userId is provided
  let validatedUserId: string | null = null;
  if (input.userId) {
    const userExists = await db.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });
    validatedUserId = userExists ? input.userId : null;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.cart.create({
        data: {
          userId: validatedUserId,
          token: generateCartToken(),
          status: "ACTIVE",
        },
      });
    } catch (error) {
      if (isCartTokenConflict(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new AppError("Unable to generate a unique cart token.", "CART_TOKEN_CONFLICT", {
    statusCode: 500,
    userMessage: "We could not create your cart right now. Please try again.",
  });
}

async function ensureCartHasUniqueToken(cartId: string, db: DatabaseExecutor) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.cart.update({
        where: { id: cartId },
        data: {
          token: generateCartToken(),
        },
      });
    } catch (error) {
      if (isCartTokenConflict(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new AppError("Unable to restore a cart token.", "CART_TOKEN_CONFLICT", {
    statusCode: 500,
    userMessage: "We could not restore your cart right now. Please try again.",
  });
}

async function findGuestCartByToken(token: string, db: DatabaseExecutor) {
  return db.cart.findFirst({
    where: {
      token,
      userId: null,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

function toMissingProductError(slug: string) {
  return new AppError(`Cart product not found for slug: ${slug}`, "CART_PRODUCT_NOT_FOUND", {
    statusCode: 404,
    userMessage: "This product is not available right now.",
  });
}

function toMissingVariantError(optionId: string) {
  return new AppError(`Cart variant not found for option: ${optionId}`, "CART_VARIANT_NOT_FOUND", {
    statusCode: 404,
    userMessage: "The selected option is no longer available.",
  });
}

function toOutOfStockError(productName: string) {
  return new AppError(`Cart stock unavailable for product: ${productName}`, "CART_OUT_OF_STOCK", {
    statusCode: 409,
    userMessage: "This item is currently out of stock.",
  });
}

function toInsufficientStockError(productName: string, available: number) {
  return new AppError(`Cart stock insufficient for product: ${productName}`, "CART_STOCK_INSUFFICIENT", {
    statusCode: 409,
    userMessage: `Only ${available} units of ${productName} are available right now.`,
  });
}

export function resolveCartSeedSelection(input: ResolveCartSelectionInput): CartSeedSelection {
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
    selectedOption = firstVariantGroup?.options.find((option) => option.inventoryQuantity > 0) ?? firstVariantGroup?.options[0] ?? null;
  }

  const resolvedSku = selectedOption?.sku ?? productDetail.sku;
  if (!resolvedSku) {
    throw new AppError(`Cart SKU missing for product: ${input.productSlug}`, "CART_SKU_MISSING", {
      statusCode: 500,
      userMessage: "This product cannot be added right now. Please try again.",
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

async function resolveCartSelection(
  input: ResolveCartSelectionInput,
  db: DatabaseExecutor,
): Promise<ResolvedCartSelection> {
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
    const selection = resolveCartSeedSelection(input);
    const variant = await ensureSeedCatalogVariant(selection, db);

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
    : product.variants.find((variant) => variant.isDefault) ??
      product.variants.find((variant) => getAvailableInventoryQuantity(variant.inventory) > 0) ??
      product.variants[0];

  if (!selectedVariant) {
    if (input.optionId) {
      throw toMissingVariantError(input.optionId);
    }

    throw toMissingProductError(input.productSlug);
  }

  const resolvedSku = selectedVariant.sku ?? product.masterSku ?? "";
  if (!resolvedSku) {
    throw new AppError(`Cart SKU missing for product: ${input.productSlug}`, "CART_SKU_MISSING", {
      statusCode: 500,
      userMessage: "This product cannot be added right now. Please try again.",
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

async function ensureSeedCatalogVariant(selection: CartSeedSelection, db: DatabaseExecutor) {
  const existingVariant = await db.productVariant.findUnique({
    where: {
      sku: selection.sku,
    },
    include: {
      inventory: true,
    },
  });

  if (existingVariant) {
    if (!existingVariant.inventory) {
      await db.inventory.create({
        data: {
          productVariantId: existingVariant.id,
          quantity: selection.inventoryQuantity,
          reserved: 0,
          safetyStock: 0,
        },
      });
    }

    return existingVariant;
  }

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

  const variant = await db.productVariant.upsert({
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

  await db.inventory.upsert({
    where: {
      productVariantId: variant.id,
    },
    update: {
      quantity: selection.inventoryQuantity,
      safetyStock: 0,
    },
    create: {
      productVariantId: variant.id,
      quantity: selection.inventoryQuantity,
      reserved: 0,
      safetyStock: 0,
    },
  });

  return variant;
}

async function getOrCreateActiveCartForUser(userId: string, db: DatabaseExecutor) {
  // Validate user exists
  const userExists = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!userExists) {
    // User doesn't exist - return a guest cart instead
    // This can happen if sessions persist after DB reset
    return createActiveCartWithUniqueToken({}, db);
  }

  const existing = await db.cart.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (existing) {
    if (existing.token) {
      return existing;
    }

    return ensureCartHasUniqueToken(existing.id, db);
  }

  return createActiveCartWithUniqueToken({ userId }, db);
}

async function getOrCreateActiveCartForGuest(token: string, db: DatabaseExecutor) {
  const existing = await findGuestCartByToken(token, db);

  if (existing?.status === "ACTIVE") {
    return existing;
  }

  if (existing) {
    return createActiveCartWithUniqueToken({}, db);
  }

  try {
    return await db.cart.create({
      data: {
        token,
        status: "ACTIVE",
      },
    });
  } catch (error) {
    if (!isCartTokenConflict(error)) {
      throw error;
    }

    const conflicted = await findGuestCartByToken(token, db);
    if (conflicted?.status === "ACTIVE") {
      return conflicted;
    }

    return createActiveCartWithUniqueToken({}, db);
  }
}

async function getCartWithItemsById(cartId: string, db: DatabaseExecutor) {
  return db.cart.findUnique({
    where: { id: cartId },
    include: {
      items: {
        orderBy: {
          createdAt: "desc",
        },
        include: {
          productVariant: {
            include: {
              inventory: true,
              images: {
                orderBy: { position: "asc" },
                select: { url: true, alt: true },
              },
              product: {
                include: {
                  category: true,
                  images: {
                    orderBy: { position: "asc" },
                    select: { url: true, alt: true },
                  },
                },
              },
            },
          },
        },
      },
      dealItems: {
        orderBy: {
          createdAt: "desc",
        },
        include: {
          deal: {
            include: {
              images: {
                orderBy: { position: "asc" },
                select: { url: true, alt: true },
              },
              products: {
                orderBy: { position: "asc" },
                select: {
                  productVariantId: true,
                  quantity: true,
                  product: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                      status: true,
                      variants: {
                        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
                        select: {
                          id: true,
                          title: true,
                          sku: true,
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
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

function mapCartItem(item: CartIncludePayload["items"][number]): CartItemSummary {
  const availableQuantity = getAvailableInventoryQuantity(item.productVariant.inventory);
  const normalizedAvailableQuantity = Number.isFinite(availableQuantity) ? availableQuantity : MAX_CART_ITEM_QUANTITY;
  const productSlug = item.productVariant.product.slug;
  const categorySlug = item.productVariant.product.category?.slug ?? "categories";
  const primaryImage =
    item.productVariant.images[0] ?? item.productVariant.product.images[0] ?? null;

  return {
    id: item.id,
    productName: item.productVariant.product.name,
    productSlug,
    categorySlug,
    sku: item.productVariant.sku ?? "",
    optionLabel: item.productVariant.title,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    compareAtPrice: item.productVariant.compareAtPrice,
    lineSubtotal: item.unitPrice * item.quantity,
    availableQuantity: normalizedAvailableQuantity,
    href: routes.storefront.product(categorySlug, productSlug),
    imageUrl: primaryImage?.url ?? null,
    imageAlt: primaryImage?.alt ?? null,
  };
}

export function calculateCartSubtotal(items: ReadonlyArray<{ quantity: number; unitPrice: number }>) {
  return items.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
}

/**
 * Resolves the effective variant for a deal's included product: the explicitly
 * linked variant, or the product's default variant (falling back to the first).
 */
function resolveDealCartEffectiveVariant(row: DealCartProductRow) {
  const linkedVariantId = row.productVariantId ?? null;
  const defaultVariant =
    row.product.variants.find((variant) => variant.isDefault) ?? row.product.variants[0] ?? null;

  if (linkedVariantId) {
    return row.product.variants.find((variant) => variant.id === linkedVariantId) ?? defaultVariant;
  }

  return defaultVariant;
}

/**
 * How many copies of the whole deal can still be fulfilled: the minimum across
 * included published products of floor(available stock / per-deal quantity).
 * Unpublished products, missing variants, or zero stock make the whole deal
 * unavailable (0).
 */
function computeDealCartAvailableQuantity(deal: DealCartDealPayload) {
  const quantities = deal.products.flatMap((row) => {
    if (row.product.status !== "PUBLISHED" || row.quantity <= 0) {
      return [0];
    }

    const variant = resolveDealCartEffectiveVariant(row);
    if (!variant) {
      return [0];
    }

    const stock = getAvailableInventoryQuantity(variant.inventory);
    return [Number.isFinite(stock) ? Math.floor(stock / row.quantity) : stock];
  });

  return quantities.length === 0 ? 0 : Math.min(...quantities);
}

function buildDealCartProductSummary(deal: DealCartDealPayload) {
  const names = deal.products
    .filter((row) => row.product.status === "PUBLISHED")
    .map((row) => row.product.name);

  if (names.length === 0) {
    return "Bundle deal";
  }

  if (names.length === 1) {
    return names[0] ?? "Bundle deal";
  }

  if (names.length === 2) {
    return `${names[0] ?? ""} + ${names[1] ?? ""}`;
  }

  return `${names.slice(0, 2).join(" + ")} +${names.length - 2} more`;
}

function mapDealCartItem(item: CartIncludePayload["dealItems"][number]): DealCartItemSummary {
  const deal = item.deal;
  const availableQuantity = computeDealCartAvailableQuantity(deal);
  const normalizedAvailableQuantity = Number.isFinite(availableQuantity)
    ? availableQuantity
    : MAX_CART_ITEM_QUANTITY;
  const primaryImage = deal.images[0] ?? null;

  return {
    id: item.id,
    dealId: deal.id,
    dealSlug: deal.slug,
    title: deal.title,
    productSummary: buildDealCartProductSummary(deal),
    itemCount: deal.products.filter((row) => row.product.status === "PUBLISHED").length,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    compareAtPrice: deal.compareAtPrice,
    lineSubtotal: item.unitPrice * item.quantity,
    availableQuantity: normalizedAvailableQuantity,
    href: routes.storefront.deal(deal.slug),
    imageUrl: primaryImage?.url ?? null,
    imageAlt: primaryImage?.alt ?? null,
    sku: `deal:${deal.slug}`,
  };
}

function toCartSummary(cart: CartIncludePayload): CartSummary {
  const items = cart.items.map(mapCartItem);
  const dealItems = cart.dealItems.map(mapDealCartItem);
  const itemCount =
    items.reduce((total, item) => total + item.quantity, 0) +
    dealItems.reduce((total, item) => total + item.quantity, 0);

  return {
    id: cart.id,
    token: cart.token ?? "",
    items,
    dealItems,
    itemCount,
    subtotal: calculateCartSubtotal(items) + calculateCartSubtotal(dealItems),
  };
}

async function resolveActiveCartId(input: ResolveCartContextInput, db: DatabaseExecutor): Promise<string | null> {
  if (input.userId) {
    const userCart = await getOrCreateActiveCartForUser(input.userId, db);

    if (input.guestToken && input.mergeGuestIntoUser) {
      await mergeGuestCartIntoUserCart({
        userId: input.userId,
        guestToken: input.guestToken,
      }, db);

      const refreshed = await getOrCreateActiveCartForUser(input.userId, db);
      return refreshed.id;
    }

    return userCart.id;
  }

  if (!input.guestToken) {
    return null;
  }

  const guestCart = await getOrCreateActiveCartForGuest(input.guestToken, db);
  return guestCart.id;
}

export async function getOrCreateGuestCartToken(inputToken?: string | undefined) {
  return inputToken && inputToken.length > 0 ? inputToken : generateCartToken();
}

export async function getCartSummaryForContext(input: ResolveCartContextInput): Promise<CartSummary | null> {
  const db = getPrismaClient();
  const cartId = await resolveActiveCartId(input, db);

  if (!cartId) {
    return null;
  }

  const cart = await getCartWithItemsById(cartId, db);
  if (!cart) {
    return null;
  }

  return toCartSummary(cart);
}

export async function mergeGuestCartIntoUserCart(
  input: {
    userId: string;
    guestToken: string;
  },
  db: DatabaseExecutor = getPrismaClient(),
) {
  return runWithTransaction(async (transaction) => {
    const guestCart = await transaction.cart.findFirst({
      where: {
        token: input.guestToken,
        userId: null,
        status: "ACTIVE",
      },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                inventory: true,
              },
            },
          },
        },
        dealItems: {
          include: {
            deal: {
              include: {
                images: {
                  orderBy: { position: "asc" },
                  select: { url: true, alt: true },
                },
                products: {
                  orderBy: { position: "asc" },
                  select: {
                    productVariantId: true,
                    quantity: true,
                    product: {
                      select: {
                        id: true,
                        name: true,
                        slug: true,
                        status: true,
                        variants: {
                          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
                          select: {
                            id: true,
                            title: true,
                            sku: true,
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
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!guestCart || (guestCart.items.length === 0 && guestCart.dealItems.length === 0)) {
      return getOrCreateActiveCartForUser(input.userId, transaction);
    }

    const userCart = await getOrCreateActiveCartForUser(input.userId, transaction);

    for (const guestItem of guestCart.items) {
      const availableQuantity = getAvailableInventoryQuantity(guestItem.productVariant.inventory);
      if (availableQuantity < 1) {
        continue;
      }

      const existing = await transaction.cartItem.findUnique({
        where: {
          cartId_productVariantId: {
            cartId: userCart.id,
            productVariantId: guestItem.productVariantId,
          },
        },
      });

      const requestedQuantity = (existing?.quantity ?? 0) + guestItem.quantity;
      const nextQuantity = Math.min(
        Math.max(1, requestedQuantity),
        Number.isFinite(availableQuantity) ? availableQuantity : MAX_CART_ITEM_QUANTITY,
        MAX_CART_ITEM_QUANTITY,
      );

      await transaction.cartItem.upsert({
        where: {
          cartId_productVariantId: {
            cartId: userCart.id,
            productVariantId: guestItem.productVariantId,
          },
        },
        update: {
          quantity: nextQuantity,
          unitPrice: guestItem.unitPrice,
        },
        create: {
          cartId: userCart.id,
          productVariantId: guestItem.productVariantId,
          quantity: Math.min(guestItem.quantity, nextQuantity),
          unitPrice: guestItem.unitPrice,
        },
      });
    }

    for (const guestDealItem of guestCart.dealItems) {
      const availableQuantity = computeDealCartAvailableQuantity(guestDealItem.deal);
      if (availableQuantity < 1) {
        continue;
      }

      const existing = await transaction.dealCartItem.findUnique({
        where: {
          cartId_dealId: {
            cartId: userCart.id,
            dealId: guestDealItem.dealId,
          },
        },
      });

      const requestedQuantity = (existing?.quantity ?? 0) + guestDealItem.quantity;
      const nextQuantity = Math.min(
        Math.max(1, requestedQuantity),
        Number.isFinite(availableQuantity) ? availableQuantity : MAX_CART_ITEM_QUANTITY,
        MAX_CART_ITEM_QUANTITY,
      );

      await transaction.dealCartItem.upsert({
        where: {
          cartId_dealId: {
            cartId: userCart.id,
            dealId: guestDealItem.dealId,
          },
        },
        update: {
          quantity: nextQuantity,
          unitPrice: guestDealItem.unitPrice,
        },
        create: {
          cartId: userCart.id,
          dealId: guestDealItem.dealId,
          quantity: Math.min(guestDealItem.quantity, nextQuantity),
          unitPrice: guestDealItem.unitPrice,
        },
      });
    }

    await transaction.cart.update({
      where: { id: guestCart.id },
      data: {
        status: "ABANDONED",
        token: null,
      },
    });

    await transaction.cartItem.deleteMany({
      where: {
        cartId: guestCart.id,
      },
    });

    await transaction.dealCartItem.deleteMany({
      where: {
        cartId: guestCart.id,
      },
    });

    return userCart;
  }, db);
}

async function requireActiveCartForMutation(input: ResolveCartContextInput, db: DatabaseExecutor) {
  const cartId = await resolveActiveCartId(
    {
      ...input,
      mergeGuestIntoUser: input.mergeGuestIntoUser ?? true,
    },
    db,
  );

  if (!cartId) {
    throw new AppError("Cart context missing for mutation.", "CART_CONTEXT_MISSING", {
      statusCode: 400,
      userMessage: "We could not identify your cart. Please refresh and try again.",
    });
  }

  const cart = await db.cart.findUnique({
    where: { id: cartId },
  });

  if (!cart) {
    throw new AppError("Cart missing for mutation.", "CART_NOT_FOUND", {
      statusCode: 404,
      userMessage: "Your cart could not be found. Please refresh and retry.",
    });
  }

  return cart;
}

export async function addCartItemForContext(context: ResolveCartContextInput, input: AddCartItemInput) {
  const db = getPrismaClient();
  const resolvedSelection = await resolveCartSelection(input, db);
  const { selection } = resolvedSelection;
  const quantity = normalizeQuantity(input.quantity);

  return runWithTransaction(async (transaction) => {
    const cart = await requireActiveCartForMutation(context, transaction);

    const inventory = await transaction.inventory.findUnique({
      where: {
        productVariantId: resolvedSelection.variantId,
      },
    });

    const availableQuantity = getAvailableInventoryQuantity(inventory);

    if (availableQuantity < 1) {
      throw toOutOfStockError(selection.productName);
    }

    const existing = await transaction.cartItem.findUnique({
      where: {
        cartId_productVariantId: {
          cartId: cart.id,
          productVariantId: resolvedSelection.variantId,
        },
      },
    });

    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    if (nextQuantity > availableQuantity) {
      throw toInsufficientStockError(selection.productName, availableQuantity);
    }

    await transaction.cartItem.upsert({
      where: {
        cartId_productVariantId: {
          cartId: cart.id,
          productVariantId: resolvedSelection.variantId,
        },
      },
      update: {
        quantity: nextQuantity,
        unitPrice: selection.price,
      },
      create: {
        cartId: cart.id,
        productVariantId: resolvedSelection.variantId,
        quantity,
        unitPrice: selection.price,
      },
    });

    const snapshot = await getCartWithItemsById(cart.id, transaction);
    if (!snapshot) {
      throw new AppError("Cart not found after add mutation.", "CART_SNAPSHOT_MISSING", {
        statusCode: 500,
      });
    }

    return toCartSummary(snapshot);
  }, db);
}

export async function updateCartItemQuantityForContext(context: ResolveCartContextInput, input: UpdateCartItemInput) {
  const db = getPrismaClient();

  return runWithTransaction(async (transaction) => {
    const cart = await requireActiveCartForMutation(context, transaction);

    const item = await transaction.cartItem.findFirst({
      where: {
        id: input.cartItemId,
        cartId: cart.id,
      },
      include: {
        productVariant: {
          include: {
            inventory: true,
            product: true,
          },
        },
      },
    });

    if (!item) {
      throw new AppError("Cart item not found for update.", "CART_ITEM_NOT_FOUND", {
        statusCode: 404,
        userMessage: "This cart item no longer exists.",
      });
    }

    if (input.quantity < 1) {
      await transaction.cartItem.delete({
        where: {
          id: item.id,
        },
      });
    } else {
      const nextQuantity = Math.min(MAX_CART_ITEM_QUANTITY, Math.trunc(input.quantity));
      const availableQuantity = getAvailableInventoryQuantity(item.productVariant.inventory);

      if (availableQuantity < 1) {
        throw toOutOfStockError(item.productVariant.product.name);
      }

      if (nextQuantity > availableQuantity) {
        throw toInsufficientStockError(item.productVariant.product.name, availableQuantity);
      }

      await transaction.cartItem.update({
        where: {
          id: item.id,
        },
        data: {
          quantity: nextQuantity,
        },
      });
    }

    const snapshot = await getCartWithItemsById(cart.id, transaction);
    if (!snapshot) {
      throw new AppError("Cart not found after update mutation.", "CART_SNAPSHOT_MISSING", {
        statusCode: 500,
      });
    }

    return toCartSummary(snapshot);
  }, db);
}

export async function removeCartItemForContext(context: ResolveCartContextInput, input: RemoveCartItemInput) {
  const db = getPrismaClient();

  return runWithTransaction(async (transaction) => {
    const cart = await requireActiveCartForMutation(context, transaction);

    await transaction.cartItem.deleteMany({
      where: {
        id: input.cartItemId,
        cartId: cart.id,
      },
    });

    const snapshot = await getCartWithItemsById(cart.id, transaction);
    if (!snapshot) {
      throw new AppError("Cart not found after remove mutation.", "CART_SNAPSHOT_MISSING", {
        statusCode: 500,
      });
    }

    return toCartSummary(snapshot);
  }, db);
}

/**
 * Loads a published deal (with included products + variants + inventory) for
 * adding it to the cart as a single line.
 */
async function loadDealCartLookup(dealSlug: string, db: DatabaseExecutor) {
  return db.deal.findUnique({
    where: { slug: dealSlug },
    select: {
      id: true,
      title: true,
      slug: true,
      price: true,
      compareAtPrice: true,
      status: true,
      images: {
        orderBy: { position: "asc" },
        select: { url: true, alt: true },
      },
      products: {
        orderBy: { position: "asc" },
        select: {
          productVariantId: true,
          quantity: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              variants: {
                orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
                select: {
                  id: true,
                  title: true,
                  sku: true,
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
          },
        },
      },
    },
  });
}

async function snapshotCartSummary(cartId: string, transaction: DatabaseExecutor) {
  const snapshot = await getCartWithItemsById(cartId, transaction);
  if (!snapshot) {
    throw new AppError("Cart not found after mutation.", "CART_SNAPSHOT_MISSING", {
      statusCode: 500,
    });
  }

  return toCartSummary(snapshot);
}

/**
 * Adds a whole deal to the cart as a SINGLE line item (quantity controls the
 * bundle, not its individual products). Availability is the deal-level
 * available quantity (min across included products of floor(stock / qty)).
 */
export async function addDealCartItemForContext(
  context: ResolveCartContextInput,
  input: AddDealCartItemInput,
) {
  const db = getPrismaClient();
  const deal = await loadDealCartLookup(input.dealSlug.trim(), db);

  if (!deal || deal.status !== "PUBLISHED") {
    throw new AppError("Deal not found for cart add.", "CART_DEAL_NOT_FOUND", {
      statusCode: 404,
      userMessage: "This deal is no longer available.",
    });
  }

  const availableQuantity = computeDealCartAvailableQuantity(deal);

  if (availableQuantity < 1) {
    throw toOutOfStockError(deal.title);
  }

  const quantity = normalizeQuantity(input.quantity);

  return runWithTransaction(async (transaction) => {
    const cart = await requireActiveCartForMutation(context, transaction);

    const existing = await transaction.dealCartItem.findUnique({
      where: {
        cartId_dealId: {
          cartId: cart.id,
          dealId: deal.id,
        },
      },
    });

    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    if (nextQuantity > availableQuantity) {
      throw toInsufficientStockError(deal.title, availableQuantity);
    }

    await transaction.dealCartItem.upsert({
      where: {
        cartId_dealId: {
          cartId: cart.id,
          dealId: deal.id,
        },
      },
      update: {
        quantity: nextQuantity,
        unitPrice: deal.price,
      },
      create: {
        cartId: cart.id,
        dealId: deal.id,
        quantity,
        unitPrice: deal.price,
      },
    });

    return snapshotCartSummary(cart.id, transaction);
  }, db);
}

/**
 * Updates the quantity of a deal cart line (0 or negative removes the line).
 */
export async function updateDealCartItemQuantityForContext(
  context: ResolveCartContextInput,
  input: UpdateDealCartItemInput,
) {
  const db = getPrismaClient();

  return runWithTransaction(async (transaction) => {
    const cart = await requireActiveCartForMutation(context, transaction);

    const item = await transaction.dealCartItem.findFirst({
      where: {
        id: input.dealCartItemId,
        cartId: cart.id,
      },
      include: {
        deal: {
          select: {
            id: true,
            title: true,
            slug: true,
            price: true,
            compareAtPrice: true,
            status: true,
            images: {
              orderBy: { position: "asc" },
              select: { url: true, alt: true },
            },
            products: {
              orderBy: { position: "asc" },
              select: {
                productVariantId: true,
                quantity: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    status: true,
                    variants: {
                      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
                      select: {
                        id: true,
                        title: true,
                        sku: true,
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
                },
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new AppError("Deal cart item not found for update.", "CART_DEAL_ITEM_NOT_FOUND", {
        statusCode: 404,
        userMessage: "This deal line no longer exists.",
      });
    }

    if (input.quantity < 1) {
      await transaction.dealCartItem.delete({
        where: {
          id: item.id,
        },
      });
    } else {
      const nextQuantity = Math.min(MAX_CART_ITEM_QUANTITY, Math.trunc(input.quantity));
      const availableQuantity = computeDealCartAvailableQuantity(item.deal);

      if (availableQuantity < 1) {
        throw toOutOfStockError(item.deal.title);
      }

      if (nextQuantity > availableQuantity) {
        throw toInsufficientStockError(item.deal.title, availableQuantity);
      }

      await transaction.dealCartItem.update({
        where: {
          id: item.id,
        },
        data: {
          quantity: nextQuantity,
        },
      });
    }

    return snapshotCartSummary(cart.id, transaction);
  }, db);
}

/**
 * Removes a deal line from the cart.
 */
export async function removeDealCartItemForContext(
  context: ResolveCartContextInput,
  input: RemoveDealCartItemInput,
) {
  const db = getPrismaClient();

  return runWithTransaction(async (transaction) => {
    const cart = await requireActiveCartForMutation(context, transaction);

    await transaction.dealCartItem.deleteMany({
      where: {
        id: input.dealCartItemId,
        cartId: cart.id,
      },
    });

    return snapshotCartSummary(cart.id, transaction);
  }, db);
}
