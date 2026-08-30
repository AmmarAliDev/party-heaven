import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock)),
  inventory: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({
  getPrismaClient: () => prismaMock,
}));

import { adjustAdminInventory } from "@/features/admin/inventory/service";

describe("admin inventory service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates inventory quantity and records an audit event", async () => {
    prismaMock.inventory.findUnique
      .mockResolvedValueOnce({
        id: "inventory-1",
        productVariantId: "variant-1",
        quantity: 10,
        reserved: 2,
        safetyStock: 3,
        updatedAt: new Date("2026-04-24T10:00:00.000Z"),
        productVariant: {
          sku: "SKU-1",
          product: {
            name: "Daily Face Wash",
          },
        },
      })
      .mockResolvedValueOnce({
        id: "inventory-1",
        productVariantId: "variant-1",
        quantity: 14,
        reserved: 2,
        safetyStock: 3,
        updatedAt: new Date("2026-04-24T10:05:00.000Z"),
        productVariant: {
          sku: "SKU-1",
          product: {
            name: "Daily Face Wash",
          },
        },
      });

    prismaMock.inventory.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-1" });

    const result = await adjustAdminInventory({
      data: {
        inventoryId: "inventory-1",
        expectedUpdatedAt: new Date("2026-04-24T10:00:00.000Z"),
        adjustmentMode: "increase",
        amount: 4,
        reason: "Received replenishment",
      },
      actor: {
        actorId: "admin-1",
        actorRole: "PRODUCT_MANAGER",
      },
    });

    expect(prismaMock.inventory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "inventory-1",
          updatedAt: new Date("2026-04-24T10:00:00.000Z"),
        },
        data: {
          quantity: 14,
        },
      }),
    );

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "inventory.adjusted",
          model: "Inventory",
          modelId: "inventory-1",
          changes: expect.objectContaining({
            beforeQuantity: 10,
            afterQuantity: 14,
            adjustmentMode: "increase",
            reason: "Received replenishment",
          }),
        }),
      }),
    );

    expect(result.nextQuantity).toBe(14);
    expect(result.previousQuantity).toBe(10);
  });

  it("rejects adjustments that would drop quantity below reserved stock", async () => {
    prismaMock.inventory.findUnique.mockResolvedValueOnce({
      id: "inventory-1",
      productVariantId: "variant-1",
      quantity: 5,
      reserved: 4,
      safetyStock: 1,
      updatedAt: new Date("2026-04-24T10:00:00.000Z"),
      productVariant: {
        sku: "SKU-1",
        product: {
          name: "Daily Face Wash",
        },
      },
    });

    await expect(
      adjustAdminInventory({
        data: {
          inventoryId: "inventory-1",
          expectedUpdatedAt: new Date("2026-04-24T10:00:00.000Z"),
          adjustmentMode: "decrease",
          amount: 2,
          reason: "Manual correction",
        },
        actor: {
          actorId: "admin-1",
          actorRole: "SUPER_ADMIN",
        },
      }),
    ).rejects.toMatchObject({
      code: "INVENTORY_INVALID_QUANTITY",
    });

    expect(prismaMock.inventory.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it("surfaces optimistic concurrency conflicts safely", async () => {
    prismaMock.inventory.findUnique.mockResolvedValueOnce({
      id: "inventory-1",
      productVariantId: "variant-1",
      quantity: 10,
      reserved: 0,
      safetyStock: 3,
      updatedAt: new Date("2026-04-24T10:00:00.000Z"),
      productVariant: {
        sku: "SKU-1",
        product: {
          name: "Daily Face Wash",
        },
      },
    });

    prismaMock.inventory.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      adjustAdminInventory({
        data: {
          inventoryId: "inventory-1",
          expectedUpdatedAt: new Date("2026-04-24T10:00:00.000Z"),
          adjustmentMode: "set",
          amount: 12,
          reason: "Cycle count",
        },
        actor: {
          actorId: "admin-1",
          actorRole: "SUPER_ADMIN",
        },
      }),
    ).rejects.toMatchObject({
      code: "INVENTORY_UPDATE_CONFLICT",
    });

    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });
});
