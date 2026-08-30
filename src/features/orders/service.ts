import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { CartStatus, City, Country, OrderStatus, ProductStatus } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import { mergeGuestCartIntoUserCart } from "@/features/cart";
import type { CheckoutPayload } from "@/features/checkout";
import { calculateCheckoutTotals, getCheckoutPaymentProvider } from "@/features/checkout";
import {
  notifyOrderConfirmed,
  notifyOrderPlaced,
  type OrderNotificationPayload,
} from "@/features/notifications";
import { AppError } from "@/lib/errors/app-error";
import { createLogger, sanitizeForLogging } from "@/lib/logger";
import type { DatabaseExecutor } from "@/server/db";
import { getPrismaClient, runWithTransaction } from "@/server/db";

import {
  buildOrderConfirmationUrl,
  buildOrderInvoiceUrl,
  createInvoiceNumber,
  createOrderNumber,
} from "./invoice";
import { resolveReorderLineDecision } from "./reorder";
import { assertOrderStatusTransition, formatOrderStatusLabel } from "./status";
import type {
  OrderDetails,
  OrderHistoryItem,
  PlaceOrderInput,
  PlaceOrderResult,
  ReorderFromOrderInput,
  ReorderFromOrderResult,
  ReorderIssue,
  ReorderIssueReason,
  UpdateOrderStatusInput,
  UpdateOrderStatusResult,
} from "./types";

type OrderCart = Prisma.CartGetPayload<{
  include: {
    items: {
      orderBy: {
        createdAt: "asc";
      };
      include: {
        productVariant: {
          include: {
            inventory: true;
            product: true;
          };
        };
      };
    };
    dealItems: {
      orderBy: {
        createdAt: "asc";
      };
      include: {
        deal: {
          include: {
            products: {
              orderBy: {
                position: "asc";
              };
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
                        price: true;
                        inventory: {
                          select: {
                            id: true;
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

type OrderDealProductRow = OrderCart["dealItems"][number]["deal"]["products"][number];

type OrderLookup = Prisma.OrderGetPayload<{
  include: {
    items: {
      orderBy: {
        createdAt: "asc";
      };
    };
    shippingAddress: true;
  };
}>;

type OrderHistoryLookup = Prisma.OrderGetPayload<{
  include: {
    _count: {
      select: {
        items: true;
      };
    };
  };
}>;

type ReorderOrderLookup = Prisma.OrderGetPayload<{
  include: {
    items: {
      orderBy: {
        createdAt: "asc";
      };
    };
  };
}>;

const ORDER_NUMBER_RETRY_LIMIT = 5;
const MAX_CART_ITEM_QUANTITY = 99;
const orderServiceLogger = createLogger("orders.service");

function getAvailableInventoryQuantity(
  inventory: { quantity: number; reserved: number; safetyStock: number } | null,
) {
  if (!inventory) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, inventory.quantity - inventory.reserved - inventory.safetyStock);
}

function createConfirmationAccessToken() {
  return randomUUID().replaceAll("-", "");
}

function getPaymentMethodLabel(value: string | null) {
  if (value === "COD") {
    return "Cash on Delivery";
  }

  return value ?? "Unknown";
}

function readMetadataString(value: Prisma.JsonValue | null | undefined, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value[key as keyof typeof value];
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

async function resolveCartForOrder(
  input: PlaceOrderInput,
  transaction: DatabaseExecutor,
): Promise<OrderCart> {
  if (input.context.userId && input.context.guestToken && input.context.mergeGuestIntoUser) {
    await mergeGuestCartIntoUserCart(
      {
        userId: input.context.userId,
        guestToken: input.context.guestToken,
      },
      transaction,
    );
  }

  const orderCartInclude = {
    items: {
      orderBy: {
        createdAt: "asc",
      },
      include: {
        productVariant: {
          include: {
            inventory: true,
            product: true,
          },
        },
      },
    },
    dealItems: {
      orderBy: {
        createdAt: "asc",
      },
      include: {
        deal: {
          include: {
            products: {
              orderBy: {
                position: "asc",
              },
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
                        price: true,
                        inventory: {
                          select: {
                            id: true,
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
  } satisfies Prisma.CartInclude;

  let cart: OrderCart | null;

  if (input.context.userId) {
    cart = await transaction.cart.findFirst({
      where: {
        userId: input.context.userId,
        status: CartStatus.ACTIVE,
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: orderCartInclude,
    });
  } else {
    if (!input.context.guestToken) {
      throw new AppError("Cart context missing for order placement.", "CART_CONTEXT_MISSING", {
        statusCode: 400,
        userMessage: "We could not identify your cart. Please refresh and try again.",
      });
    }

    cart = await transaction.cart.findFirst({
      where: {
        token: input.context.guestToken,
        userId: null,
        status: CartStatus.ACTIVE,
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: orderCartInclude,
    });
  }

  if (!cart || (cart.items.length === 0 && cart.dealItems.length === 0)) {
    throw new AppError("Checkout requested with empty cart.", "CHECKOUT_CART_EMPTY", {
      statusCode: 400,
      userMessage: "Your cart is empty. Add products before checkout.",
    });
  }

  if (cart.id !== input.payload.cartId) {
    throw new AppError("Checkout cart mismatch.", "CHECKOUT_CART_MISMATCH", {
      statusCode: 409,
      userMessage: "Your cart changed. Please refresh checkout and try again.",
    });
  }

  return cart;
}

/**
 * Resolves the effective variant for a deal's included product at order time
 * (linked variant, else the product's default/first variant).
 */
function resolveOrderDealVariant(row: OrderDealProductRow) {
  const linkedVariantId = row.productVariantId ?? null;
  const defaultVariant =
    row.product.variants.find((variant) => variant.isDefault) ?? row.product.variants[0] ?? null;

  if (linkedVariantId) {
    return row.product.variants.find((variant) => variant.id === linkedVariantId) ?? defaultVariant;
  }

  return defaultVariant;
}

type OrderLine = {
  productId: string;
  productName: string;
  variantTitle: string | null;
  sku: string | null;
  unitPrice: number;
  quantity: number;
  inventory: { id: string; quantity: number; reserved: number; safetyStock: number } | null;
};

/**
 * Expands a cart into order lines. Regular product lines map 1:1. Deal bundle
 * lines expand into one order line per included product (quantity = deal line
 * quantity × per-deal product quantity, unit price = the product's current
 * variant price). Returns:
 * - `subtotal`: product snapshot subtotal + deal snapshot subtotal (the amount
 *   the customer actually pays before shipping).
 * - `discount`: the difference between the expanded deal "regular" value and
 *   the deal snapshot subtotal, so order math stays consistent.
 */
function buildOrderLinesFromCart(cart: OrderCart) {
  const lines: OrderLine[] = [];
  let productSubtotal = 0;
  let dealSubtotal = 0;
  let dealRegularValue = 0;

  for (const item of cart.items) {
    lines.push({
      productId: item.productVariant.productId,
      productName: item.productVariant.product.name,
      variantTitle: item.productVariant.title,
      sku: item.productVariant.sku,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      inventory: item.productVariant.inventory,
    });
    productSubtotal += item.unitPrice * item.quantity;
  }

  for (const dealItem of cart.dealItems) {
    dealSubtotal += dealItem.unitPrice * dealItem.quantity;

    for (const row of dealItem.deal.products) {
      if (row.product.status !== "PUBLISHED") {
        continue;
      }

      const variant = resolveOrderDealVariant(row);
      if (!variant) {
        continue;
      }

      const quantity = dealItem.quantity * row.quantity;
      lines.push({
        productId: row.product.id,
        productName: row.product.name,
        variantTitle: variant.title,
        sku: variant.sku,
        unitPrice: variant.price,
        quantity,
        inventory: variant.inventory,
      });
      dealRegularValue += variant.price * quantity;
    }
  }

  const discount = Math.max(0, dealRegularValue - dealSubtotal);

  return {
    lines,
    subtotal: productSubtotal + dealSubtotal,
    discount,
  };
}

async function decrementInventoryForOrder(lines: OrderLine[], transaction: DatabaseExecutor) {
  for (const line of lines) {
    const inventory = line.inventory;

    if (!inventory) {
      continue;
    }

    const availableQuantity = getAvailableInventoryQuantity(inventory);
    if (availableQuantity < line.quantity) {
      throw new AppError(
        `Order placement blocked by stock for SKU ${line.sku ?? line.productId}.`,
        "ORDER_STOCK_INSUFFICIENT",
        {
          statusCode: 409,
          userMessage: `${line.productName} no longer has enough stock. Please update your cart and try again.`,
        },
      );
    }

    const updateResult = await transaction.inventory.updateMany({
      where: {
        id: inventory.id,
        reserved: inventory.reserved,
        safetyStock: inventory.safetyStock,
        quantity: {
          gte: line.quantity + inventory.reserved + inventory.safetyStock,
        },
      },
      data: {
        quantity: {
          decrement: line.quantity,
        },
      },
    });

    if (updateResult.count !== 1) {
      throw new AppError(
        `Inventory update lost race for SKU ${line.sku ?? line.productId}.`,
        "ORDER_STOCK_CONFLICT",
        {
          statusCode: 409,
          userMessage: `${line.productName} changed while your order was being placed. Please retry checkout.`,
        },
      );
    }
  }
}

function mapOrderDetails(order: OrderLookup): OrderDetails {
  if (!order.shippingAddress) {
    throw new AppError("Order shipping address missing.", "ORDER_ADDRESS_MISSING", {
      statusCode: 500,
    });
  }

  const confirmationAccessToken = readMetadataString(order.metadata, "confirmationAccessToken");
  const invoiceNumber =
    readMetadataString(order.metadata, "invoiceNumber") ?? createInvoiceNumber(order.orderNumber);

  return {
    id: order.id,
    userId: order.userId,
    orderNumber: order.orderNumber,
    invoiceNumber,
    status: order.status,
    statusLabel: formatOrderStatusLabel(order.status),
    placedAt: order.placedAt,
    subtotal: order.subtotal,
    shipping: order.shipping,
    total: order.total,
    paymentMethod: order.paymentMethod,
    paymentMethodLabel: getPaymentMethodLabel(order.paymentMethod),
    paymentStatus: order.paymentStatus,
    confirmationAccessToken,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      variantTitle: item.variantTitle,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    })),
    shippingAddress: {
      fullName: order.shippingAddress.fullName,
      phone: order.shippingAddress.phone,
      email: order.shippingAddress.email,
      street1: order.shippingAddress.street1,
      street2: order.shippingAddress.street2,
      city: order.shippingAddress.city === City.KARACHI ? "Karachi" : order.shippingAddress.city,
      province: order.shippingAddress.province,
      country:
        order.shippingAddress.country === Country.PAK ? "Pakistan" : order.shippingAddress.country,
      postcode: order.shippingAddress.postcode,
      notes: order.shippingAddress.notes,
    },
  };
}

function mapOrderHistoryItem(order: OrderHistoryLookup): OrderHistoryItem {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: formatOrderStatusLabel(order.status),
    placedAt: order.placedAt,
    total: order.total,
    itemCount: order._count.items,
  };
}

function createReorderIssue(input: {
  orderItemId: string;
  productName: string;
  sku: string | null;
  requestedQuantity: number;
  addedQuantity: number;
  availableQuantity: number;
  reason: ReorderIssueReason;
}): ReorderIssue {
  let message: string;

  if (input.reason === "UNAVAILABLE") {
    message = `${input.productName} is no longer available.`;
  } else if (input.reason === "OUT_OF_STOCK") {
    message = `${input.productName} is currently out of stock.`;
  } else {
    message = `${input.productName} quantity was adjusted to ${input.addedQuantity}.`;
  }

  return {
    orderItemId: input.orderItemId,
    productName: input.productName,
    sku: input.sku,
    requestedQuantity: input.requestedQuantity,
    addedQuantity: input.addedQuantity,
    availableQuantity: input.availableQuantity,
    reason: input.reason,
    message,
  };
}

async function getOrCreateActiveCartForUser(userId: string, transaction: DatabaseExecutor) {
  const existing = await transaction.cart.findFirst({
    where: {
      userId,
      status: CartStatus.ACTIVE,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (existing) {
    if (existing.token) {
      return existing;
    }

    return transaction.cart.update({
      where: {
        id: existing.id,
      },
      data: {
        token: randomUUID().replaceAll("-", ""),
      },
    });
  }

  return transaction.cart.create({
    data: {
      userId,
      token: randomUUID().replaceAll("-", ""),
      status: CartStatus.ACTIVE,
    },
  });
}

async function resolveVariantForReorderItem(
  orderItem: ReorderOrderLookup["items"][number],
  transaction: DatabaseExecutor,
) {
  if (orderItem.sku) {
    const variantBySku = await transaction.productVariant.findUnique({
      where: {
        sku: orderItem.sku,
      },
    });

    if (variantBySku) {
      return variantBySku;
    }
  }

  if (!orderItem.productId) {
    return null;
  }

  return transaction.productVariant.findFirst({
    where: {
      productId: orderItem.productId,
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

function hasOrderAccess(order: OrderLookup, userId?: string | null, accessToken?: string | null) {
  if (userId && order.userId === userId) {
    return true;
  }

  const expectedToken = readMetadataString(order.metadata, "confirmationAccessToken");
  return Boolean(accessToken && expectedToken && expectedToken === accessToken);
}

function isOrderNumberConflict(error: unknown) {
  return error instanceof PrismaClientKnownRequestError && error.code === "P2002";
}

function createOrderNotificationPayload(input: {
  orderId: string;
  orderNumber: string;
  placedAt: Date;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  itemCount: number;
  subtotal: number;
  shipping: number;
  total: number;
  paymentMethodLabel: string;
  confirmationUrl: string;
  invoiceUrl: string;
}): OrderNotificationPayload {
  return {
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    placedAt: input.placedAt,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    itemCount: input.itemCount,
    subtotal: input.subtotal,
    shipping: input.shipping,
    total: input.total,
    paymentMethodLabel: input.paymentMethodLabel,
    confirmationUrl: input.confirmationUrl,
    invoiceUrl: input.invoiceUrl,
  };
}

async function notifyOrderPlacedSafely(payload: OrderNotificationPayload) {
  try {
    await notifyOrderPlaced(payload);
  } catch (error) {
    orderServiceLogger.error("order placed notification crashed", {
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      error: sanitizeForLogging(error),
    });
  }
}

async function notifyOrderConfirmedSafely(payload: OrderNotificationPayload) {
  try {
    await notifyOrderConfirmed(payload);
  } catch (error) {
    orderServiceLogger.error("order confirmed notification crashed", {
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      error: sanitizeForLogging(error),
    });
  }
}

/**
 * Maps shipping address city string to City enum value.
 * Currently only supports Karachi as per business requirements.
 */
function mapCityStringToEnum(cityString: string): City {
  const normalized = cityString.trim().toLowerCase();
  if (normalized === "karachi") {
    return City.KARACHI;
  }
  // Fallback to KARACHI for now; expand enum and validation when supporting other cities
  throw new AppError(
    `City "${cityString}" is not currently supported. We only ship to Karachi.`,
    "CITY_NOT_SUPPORTED",
    {
      statusCode: 400,
      userMessage: "The city you selected is not currently supported. We only ship to Karachi.",
    },
  );
}

/**
 * Maps shipping address country string to Country enum value.
 * Currently only supports Pakistan as per business requirements.
 */
function mapCountryStringToEnum(countryString: string): Country {
  const normalized = countryString.trim().toLowerCase();
  // Match various forms of "Pakistan"
  if (normalized === "pakistan" || normalized === "pak" || normalized === "pk") {
    return Country.PAK;
  }
  // Fallback; expand enum and validation when supporting other countries
  throw new AppError(
    `Country "${countryString}" is not currently supported. We only ship within Pakistan.`,
    "COUNTRY_NOT_SUPPORTED",
    {
      statusCode: 400,
      userMessage:
        "The country you selected is not currently supported. We only ship within Pakistan.",
    },
  );
}

export async function placeOrderFromCheckout(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const db = getPrismaClient();

  for (let attempt = 0; attempt < ORDER_NUMBER_RETRY_LIMIT; attempt += 1) {
    const now = new Date();
    const orderNumber = createOrderNumber(now);
    const confirmationAccessToken = createConfirmationAccessToken();
    const invoiceNumber = createInvoiceNumber(orderNumber);
    let totalQuantity = 0;

    try {
      const result = await runWithTransaction(
        async (transaction) => {
          const cart = await resolveCartForOrder(input, transaction);
          const { lines, subtotal, discount } = buildOrderLinesFromCart(cart);
          totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
          const totals = calculateCheckoutTotals(subtotal);

          // Decrement inventory BEFORE payment authorization to avoid orphaned authorizations
          // If inventory decrement fails, payment won't be authorized
          await decrementInventoryForOrder(lines, transaction);

          const paymentProvider = getCheckoutPaymentProvider(input.payload.paymentMethod);
          const payment = paymentProvider.authorize({
            payload: input.payload,
            totals,
          });

          const shippingAddress = await transaction.orderAddress.create({
            data: {
              fullName: input.payload.customer.fullName.trim(),
              phone: input.payload.customer.phone.trim(),
              email: input.payload.customer.email.trim(),
              street1: input.payload.shippingAddress.addressLine1.trim(),
              city: mapCityStringToEnum(input.payload.shippingAddress.city),
              province: input.payload.shippingAddress.province.trim(),
              country: mapCountryStringToEnum(input.payload.shippingAddress.country),
              ...(input.payload.shippingAddress.postcode
                ? { postcode: input.payload.shippingAddress.postcode.trim() }
                : {}),
              ...(input.payload.notes ? { notes: input.payload.notes.trim() } : {}),
            },
          });

          const order = await transaction.order.create({
            data: {
              orderNumber,
              ...(input.context.userId ? { userId: input.context.userId } : {}),
              status: OrderStatus.PENDING,
              subtotal: totals.subtotal,
              shipping: totals.shipping,
              tax: 0,
              discount,
              total: totals.total,
              paymentMethod: input.payload.paymentMethod,
              paymentProvider: payment.provider,
              paymentStatus: payment.status,
              placedAt: now,
              shippingAddressId: shippingAddress.id,
              billingAddressId: shippingAddress.id,
              metadata: {
                confirmationAccessToken,
                invoiceNumber,
                cartId: cart.id,
                itemCount: lines.length,
                notes: input.payload.notes ?? null,
              },
              items: {
                create: lines.map((line) => ({
                  productId: line.productId,
                  productName: line.productName,
                  variantTitle: line.variantTitle,
                  sku: line.sku,
                  unitPrice: line.unitPrice,
                  quantity: line.quantity,
                  subtotal: line.quantity * line.unitPrice,
                  tax: 0,
                })),
              },
            },
          });

          await transaction.cart.update({
            where: {
              id: cart.id,
            },
            data: {
              status: CartStatus.COMPLETED,
              token: null,
            },
          });

          await transaction.auditLog.create({
            data: {
              ...(input.context.userId ? { actorId: input.context.userId } : {}),
              action: "order.created",
              model: "Order",
              modelId: order.id,
              changes: {
                orderNumber,
                status: OrderStatus.PENDING,
                paymentMethod: input.payload.paymentMethod,
                paymentStatus: payment.status,
                total: totals.total,
              },
            },
          });

          return {
            orderId: order.id,
            orderNumber,
            status: OrderStatus.PENDING,
            statusLabel: formatOrderStatusLabel(OrderStatus.PENDING),
            placedAt: now,
            totals,
            payment,
            confirmationAccessToken,
            confirmationUrl: buildOrderConfirmationUrl(orderNumber, confirmationAccessToken),
            invoiceUrl: buildOrderInvoiceUrl(orderNumber, confirmationAccessToken),
          } satisfies PlaceOrderResult;
        },
        db,
        {
          isolationLevel: "Serializable" as Prisma.TransactionIsolationLevel,
        },
      );

      await notifyOrderPlacedSafely(
        createOrderNotificationPayload({
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          placedAt: result.placedAt,
          customerName: input.payload.customer.fullName.trim(),
          customerEmail: input.payload.customer.email.trim(),
          customerPhone: input.payload.customer.phone.trim(),
          itemCount: totalQuantity,
          subtotal: result.totals.subtotal,
          shipping: result.totals.shipping,
          total: result.totals.total,
          paymentMethodLabel: getPaymentMethodLabel(input.payload.paymentMethod),
          confirmationUrl: result.confirmationUrl,
          invoiceUrl: result.invoiceUrl,
        }),
      );

      return result;
    } catch (error) {
      if (isOrderNumberConflict(error) && attempt < ORDER_NUMBER_RETRY_LIMIT - 1) {
        continue;
      }

      throw error;
    }
  }

  throw new AppError(
    "Order number generation exhausted retry budget.",
    "ORDER_NUMBER_GENERATION_FAILED",
    {
      statusCode: 500,
      userMessage: "We could not finalize your order number. Please retry checkout.",
    },
  );
}

export async function getOrderDetailsForAccess(input: {
  orderNumber: string;
  userId?: string | null;
  accessToken?: string | null;
  allowPrivilegedAccess?: boolean;
}) {
  const db = getPrismaClient();
  const order = await db.order.findUnique({
    where: {
      orderNumber: input.orderNumber,
    },
    include: {
      items: {
        orderBy: {
          createdAt: "asc",
        },
      },
      shippingAddress: true,
    },
  });

  if (!order) {
    return null;
  }

  if (!input.allowPrivilegedAccess && !hasOrderAccess(order, input.userId, input.accessToken)) {
    return null;
  }

  return mapOrderDetails(order);
}

export async function getOrderHistoryForUser(userId: string, limit = 20): Promise<OrderHistoryItem[]> {
  const db = getPrismaClient();
  const normalizedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));

  const orders = await db.order.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: normalizedLimit,
    include: {
      _count: {
        select: {
          items: true,
        },
      },
    },
  });

  return orders.map(mapOrderHistoryItem);
}

export async function getOrderDetailsForUser(input: { userId: string; orderNumber: string }) {
  return getOrderDetailsForAccess({
    orderNumber: input.orderNumber,
    userId: input.userId,
  });
}

export async function reorderFromOrder(input: ReorderFromOrderInput): Promise<ReorderFromOrderResult> {
  const db = getPrismaClient();

  return runWithTransaction(async (transaction) => {
    const order = await transaction.order.findFirst({
      where: {
        orderNumber: input.orderNumber,
        userId: input.userId,
      },
      include: {
        items: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!order) {
      throw new AppError("Order not found for reorder.", "ORDER_NOT_FOUND", {
        statusCode: 404,
        userMessage: "This order could not be found.",
      });
    }

    const cart = await getOrCreateActiveCartForUser(input.userId, transaction);
    const issues: ReorderIssue[] = [];
    let addedLineCount = 0;
    let addedQuantity = 0;

    for (const item of order.items) {
      const variant = await resolveVariantForReorderItem(item, transaction);

      if (!variant) {
        issues.push(
          createReorderIssue({
            orderItemId: item.id,
            productName: item.productName,
            sku: item.sku,
            requestedQuantity: item.quantity,
            addedQuantity: 0,
            availableQuantity: 0,
            reason: "UNAVAILABLE",
          }),
        );
        continue;
      }

      const product = await transaction.product.findUnique({
        where: {
          id: variant.productId,
        },
        select: {
          status: true,
        },
      });

      if (!product || product.status !== ProductStatus.PUBLISHED) {
        issues.push(
          createReorderIssue({
            orderItemId: item.id,
            productName: item.productName,
            sku: item.sku,
            requestedQuantity: item.quantity,
            addedQuantity: 0,
            availableQuantity: 0,
            reason: "UNAVAILABLE",
          }),
        );
        continue;
      }

      const existingCartItem = await transaction.cartItem.findUnique({
        where: {
          cartId_productVariantId: {
            cartId: cart.id,
            productVariantId: variant.id,
          },
        },
      });

      const inventory = await transaction.inventory.findUnique({
        where: {
          productVariantId: variant.id,
        },
      });

      const availableQuantity = getAvailableInventoryQuantity(inventory);
      const normalizedAvailableQuantity = Number.isFinite(availableQuantity)
        ? Math.trunc(availableQuantity)
        : MAX_CART_ITEM_QUANTITY;

      const decision = resolveReorderLineDecision({
        requestedQuantity: item.quantity,
        existingQuantity: existingCartItem?.quantity ?? 0,
        availableQuantity: normalizedAvailableQuantity,
        maxCartItemQuantity: MAX_CART_ITEM_QUANTITY,
      });

      if (decision.quantityToAdd < 1) {
        issues.push(
          createReorderIssue({
            orderItemId: item.id,
            productName: item.productName,
            sku: item.sku,
            requestedQuantity: item.quantity,
            addedQuantity: 0,
            availableQuantity: decision.availableToAdd,
            reason: "OUT_OF_STOCK",
          }),
        );
        continue;
      }

      const nextQuantity = (existingCartItem?.quantity ?? 0) + decision.quantityToAdd;

      await transaction.cartItem.upsert({
        where: {
          cartId_productVariantId: {
            cartId: cart.id,
            productVariantId: variant.id,
          },
        },
        update: {
          quantity: nextQuantity,
          unitPrice: variant.price,
        },
        create: {
          cartId: cart.id,
          productVariantId: variant.id,
          quantity: decision.quantityToAdd,
          unitPrice: variant.price,
        },
      });

      addedLineCount += 1;
      addedQuantity += decision.quantityToAdd;

      if (decision.reason === "ADJUSTED") {
        issues.push(
          createReorderIssue({
            orderItemId: item.id,
            productName: item.productName,
            sku: item.sku,
            requestedQuantity: item.quantity,
            addedQuantity: decision.quantityToAdd,
            availableQuantity: decision.availableToAdd,
            reason: "QUANTITY_ADJUSTED",
          }),
        );
      }
    }

    await transaction.auditLog.create({
      data: {
        actorId: input.userId,
        action: "order.reordered",
        model: "Order",
        modelId: order.id,
        changes: {
          orderNumber: order.orderNumber,
          cartId: cart.id,
          addedLineCount,
          addedQuantity,
          issueCount: issues.length,
        },
      },
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      cartId: cart.id,
      addedLineCount,
      addedQuantity,
      issues,
    };
  }, db);
}

export async function updateOrderStatus(
  input: UpdateOrderStatusInput,
): Promise<UpdateOrderStatusResult> {
  const db = getPrismaClient();

  const output = await runWithTransaction(async (transaction) => {
    const order = await transaction.order.findUnique({
      where: {
        id: input.orderId,
      },
      include: {
        shippingAddress: true,
      },
    });

    if (!order) {
      throw new AppError("Order not found for status update.", "ORDER_NOT_FOUND", {
        statusCode: 404,
        userMessage: "This order could not be found.",
      });
    }

    assertOrderStatusTransition(order.status, input.nextStatus);

    const updated = await transaction.order.update({
      where: {
        id: order.id,
      },
      data: {
        status: input.nextStatus,
      },
    });

    await transaction.auditLog.create({
      data: {
        ...(input.actorId ? { actorId: input.actorId } : {}),
        action: "order.status.changed",
        model: "Order",
        modelId: updated.id,
        changes: {
          from: order.status,
          to: input.nextStatus,
        },
      },
    });

    return {
      orderId: updated.id,
      orderNumber: updated.orderNumber,
      previousStatus: order.status,
      nextStatus: input.nextStatus,
    };
  }, db);

  if (output.nextStatus === OrderStatus.CONFIRMED) {
    const order = await db.order.findUnique({
      where: {
        id: output.orderId,
      },
      include: {
        shippingAddress: true,
        items: true,
      },
    });

    if (order?.shippingAddress) {
      const confirmationAccessToken = readMetadataString(order.metadata, "confirmationAccessToken");

      await notifyOrderConfirmedSafely(
        createOrderNotificationPayload({
          orderId: order.id,
          orderNumber: order.orderNumber,
          placedAt: order.placedAt,
          customerName: order.shippingAddress.fullName,
          customerEmail: order.shippingAddress.email,
          customerPhone: order.shippingAddress.phone,
          itemCount: order.items?.length ?? 0,
          subtotal: order.subtotal,
          shipping: order.shipping,
          total: order.total,
          paymentMethodLabel: getPaymentMethodLabel(order.paymentMethod),
          confirmationUrl: buildOrderConfirmationUrl(order.orderNumber, confirmationAccessToken),
          invoiceUrl: buildOrderInvoiceUrl(order.orderNumber, confirmationAccessToken),
        }),
      );
    }
  }

  return output;
}

export function buildOrderInvoiceFilename(orderNumber: string) {
  return `invoice-${orderNumber.toLowerCase()}.pdf`;
}

export function buildOrderLookupPayload(payload: CheckoutPayload) {
  return {
    customerEmail: payload.customer.email.trim().toLowerCase(),
    customerPhone: payload.customer.phone.trim(),
    shippingCity: payload.shippingAddress.city.trim(),
  };
}