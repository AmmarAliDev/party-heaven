import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock)),
  storeSettings: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({
  getPrismaClient: () => prismaMock,
}));

import { loadAdminStoreSettings, saveAdminStoreSettings } from "@/features/admin/settings";

describe("admin store settings service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns safe defaults when settings row is missing", async () => {
    prismaMock.storeSettings.findUnique.mockResolvedValue(null);

    const result = await loadAdminStoreSettings();

    expect(result.hasPersistedSettings).toBe(false);
    expect(result.settings.storeName).toBe("Party Heaven");
    expect(result.settings.supportEmail).toBe("support@partyheaven.co");
  });

  it("returns persisted settings when singleton row exists", async () => {
    prismaMock.storeSettings.findUnique.mockResolvedValue({
      id: "default",
      storeName: "Party Heaven Express",
      storeTagline: "Fast city delivery",
      supportEmail: "care@partyheaven.co",
      supportPhone: "+92 300 0000000",
      supportWhatsapp: null,
      supportHours: "Mon-Sat, 9:00 AM to 6:00 PM",
      shippingOriginCity: "Karachi",
      shippingFlatRate: 250,
      shippingFreeThreshold: 4000,
      dispatchLeadTimeDays: 1,
      lowStockThreshold: 4,
      allowBackorders: false,
      updatedAt: new Date("2026-04-27T09:00:00.000Z"),
    });

    const result = await loadAdminStoreSettings();

    expect(result.hasPersistedSettings).toBe(true);
    expect(result.settings.storeName).toBe("Party Heaven Express");
    expect(result.settings.shippingFreeThreshold).toBe(4000);
  });

  it("persists singleton settings and writes audit log", async () => {
    prismaMock.storeSettings.upsert.mockResolvedValue({
      id: "default",
      storeName: "Party Heaven",
      storeTagline: null,
      supportEmail: "support@partyheaven.co",
      supportPhone: null,
      supportWhatsapp: null,
      supportHours: "Mon-Sat, 9:00 AM to 6:00 PM",
      shippingOriginCity: "Karachi",
      shippingFlatRate: 250,
      shippingFreeThreshold: null,
      dispatchLeadTimeDays: 1,
      lowStockThreshold: 5,
      allowBackorders: false,
      updatedAt: new Date("2026-04-27T10:00:00.000Z"),
    });

    const saved = await saveAdminStoreSettings({
      data: {
        storeName: "Party Heaven",
        storeTagline: undefined,
        supportEmail: "support@partyheaven.co",
        supportPhone: undefined,
        supportWhatsapp: undefined,
        supportHours: "Mon-Sat, 9:00 AM to 6:00 PM",
        shippingOriginCity: "Karachi",
        shippingFlatRate: 250,
        shippingFreeThreshold: undefined,
        dispatchLeadTimeDays: 1,
        lowStockThreshold: 5,
        allowBackorders: false,
      },
      actor: {
        actorId: "admin-1",
        actorRole: "SUPER_ADMIN",
      },
    });

    expect(prismaMock.storeSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "default" },
      }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "settings.updated",
          model: "StoreSettings",
          modelId: "default",
        }),
      }),
    );
    expect(saved.storeName).toBe("Party Heaven");
  });
});
