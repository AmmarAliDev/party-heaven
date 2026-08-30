import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  cart: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  inventory: {
    updateMany: vi.fn(),
  },
  orderAddress: {
    create: vi.fn(),
  },
  order: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}));

const mergeGuestCartIntoUserCart = vi.hoisted(() => vi.fn());
const notifyOrderPlaced = vi.hoisted(() => vi.fn());
const notifyOrderConfirmed = vi.hoisted(() => vi.fn());

vi.mock("@/server/db", () => ({
  getPrismaClient: () => mockDb,
  runWithTransaction: async (callback: (db: typeof mockDb) => Promise<unknown>) => callback(mockDb),
}));

vi.mock("@/features/cart", () => ({
  mergeGuestCartIntoUserCart,
}));

vi.mock("@/features/notifications", () => ({
  notifyOrderPlaced,
  notifyOrderConfirmed,
}));

import { placeOrderFromCheckout, updateOrderStatus } from "@/features/orders";

describe("order service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockDb.orderAddress.create.mockResolvedValue({ id: "address-1" });
    mockDb.inventory.updateMany.mockResolvedValue({ count: 1 });
    mockDb.cart.update.mockResolvedValue({ id: "cart-1" });
    mockDb.auditLog.create.mockResolvedValue({ id: "audit-1" });
    notifyOrderPlaced.mockResolvedValue({ attempted: 0, delivered: 0, failures: [] });
    notifyOrderConfirmed.mockResolvedValue({ attempted: 0, delivered: 0, failures: [] });
  });

  it("places an order transactionally and writes an audit entry", async () => {
    mockDb.cart.findFirst.mockResolvedValue({
      id: "cart-1",
      items: [
        {
          id: "cart-item-1",
          quantity: 2,
          unitPrice: 1000,
          productVariant: {
            id: "variant-1",
            productId: "product-1",
            sku: "UWD-2KG-001",
            title: "2 kg",
            inventory: {
              id: "inventory-1",
              quantity: 10,
              reserved: 0,
              safetyStock: 0,
            },
            product: {
              id: "product-1",
              name: "Ultra Wash Detergent",
            },
          },
        },
      ],
      dealItems: [],
    });

    mockDb.order.create.mockImplementation(async ({ data }: { data: { orderNumber: string } }) => ({
      id: "order-1",
      orderNumber: data.orderNumber,
    }));

    const result = await placeOrderFromCheckout({
      payload: {
        cartId: "cart-1",
        customer: {
          fullName: "Ammar Ali",
          email: "ammar@example.com",
          phone: "+923001112233",
        },
        shippingAddress: {
          addressLine1: "House 1, Street 2",
          city: "Karachi",
          province: "Sindh",
          country: "Pakistan",
          postcode: "75400",
        },
        paymentMethod: "COD",
      },
      context: {
        guestToken: "guest-token-1",
      },
    });

    expect(result.orderNumber).toMatch(/^OD-/);
    expect(result.status).toBe("PENDING");
    expect(result.totals.total).toBe(2150);
    expect(mockDb.inventory.updateMany).toHaveBeenCalledTimes(1);
    expect(mockDb.cart.update).toHaveBeenCalledWith({
      where: { id: "cart-1" },
      data: { status: "COMPLETED", token: null },
    });
    expect(mockDb.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "order.created",
          model: "Order",
        }),
      }),
    );
    expect(notifyOrderPlaced).toHaveBeenCalledTimes(1);
  });

  it("does not fail order placement when notifications fail", async () => {
    mockDb.cart.findFirst.mockResolvedValue({
      id: "cart-1",
      items: [
        {
          id: "cart-item-1",
          quantity: 1,
          unitPrice: 1000,
          productVariant: {
            id: "variant-1",
            productId: "product-1",
            sku: "UWD-2KG-001",
            title: "2 kg",
            inventory: {
              id: "inventory-1",
              quantity: 10,
              reserved: 0,
              safetyStock: 0,
            },
            product: {
              id: "product-1",
              name: "Ultra Wash Detergent",
            },
          },
        },
      ],
      dealItems: [],
    });

    mockDb.order.create.mockImplementation(async ({ data }: { data: { orderNumber: string } }) => ({
      id: "order-1",
      orderNumber: data.orderNumber,
    }));

    notifyOrderPlaced.mockRejectedValueOnce(new Error("smtp down"));

    await expect(
      placeOrderFromCheckout({
        payload: {
          cartId: "cart-1",
          customer: {
            fullName: "Ammar Ali",
            email: "ammar@example.com",
            phone: "+923001112233",
          },
          shippingAddress: {
            addressLine1: "House 1, Street 2",
            city: "Karachi",
            province: "Sindh",
            country: "Pakistan",
            postcode: "75400",
          },
          paymentMethod: "COD",
        },
        context: {
          guestToken: "guest-token-1",
        },
      }),
    ).resolves.toMatchObject({
      orderId: "order-1",
      status: "PENDING",
    });
  });

  it("rejects order placement when stock is no longer available", async () => {
    mockDb.cart.findFirst.mockResolvedValue({
      id: "cart-1",
      items: [
        {
          id: "cart-item-1",
          quantity: 3,
          unitPrice: 1000,
          productVariant: {
            id: "variant-1",
            productId: "product-1",
            sku: "UWD-2KG-001",
            title: "2 kg",
            inventory: {
              id: "inventory-1",
              quantity: 2,
              reserved: 0,
              safetyStock: 0,
            },
            product: {
              id: "product-1",
              name: "Ultra Wash Detergent",
            },
          },
        },
      ],
      dealItems: [],
    });

    await expect(
      placeOrderFromCheckout({
        payload: {
          cartId: "cart-1",
          customer: {
            fullName: "Ammar Ali",
            email: "ammar@example.com",
            phone: "+923001112233",
          },
          shippingAddress: {
            addressLine1: "House 1, Street 2",
            city: "Karachi",
            province: "Sindh",
            country: "Pakistan",
            postcode: "75400",
          },
          paymentMethod: "COD",
        },
        context: {
          guestToken: "guest-token-1",
        },
      }),
    ).rejects.toMatchObject({ code: "ORDER_STOCK_INSUFFICIENT" });
  });

  it("updates order status and writes a status-change audit entry", async () => {
    mockDb.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderNumber: "OD-20260413-ABC123",
      status: "PENDING",
      subtotal: 2000,
      shipping: 150,
      total: 2150,
      paymentMethod: "COD",
      placedAt: new Date("2026-04-13T10:00:00.000Z"),
      metadata: {
        confirmationAccessToken: "token-1",
      },
      shippingAddress: {
        fullName: "Ammar Ali",
        email: "ammar@example.com",
        phone: "+923001112233",
      },
    });
    mockDb.order.update.mockResolvedValue({
      id: "order-1",
      orderNumber: "OD-20260413-ABC123",
      status: "CONFIRMED",
    });

    const result = await updateOrderStatus({
      orderId: "order-1",
      nextStatus: "CONFIRMED",
      actorId: "admin-1",
    });

    expect(result.previousStatus).toBe("PENDING");
    expect(result.nextStatus).toBe("CONFIRMED");
    expect(mockDb.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "order.status.changed",
          modelId: "order-1",
        }),
      }),
    );
    expect(notifyOrderConfirmed).toHaveBeenCalledTimes(1);
  });
});
