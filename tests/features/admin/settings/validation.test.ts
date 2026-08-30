import { describe, expect, it } from "vitest";

import { validateAdminStoreSettingsInput } from "@/features/admin/settings";

describe("admin store settings validation", () => {
  it("accepts practical first-pass settings payload", () => {
    const result = validateAdminStoreSettingsInput({
      storeName: "Party Heaven Karachi",
      storeTagline: "Daily essentials at practical prices",
      supportEmail: "support@partyheaven.co",
      supportPhone: "+92 300 1234567",
      supportWhatsapp: "+92 321 7654321",
      supportHours: "Mon-Sat, 9:00 AM to 6:00 PM",
      shippingOriginCity: "Karachi",
      shippingFlatRate: "250",
      shippingFreeThreshold: "5000",
      dispatchLeadTimeDays: "1",
      lowStockThreshold: "5",
      allowBackorders: "on",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.shippingFlatRate).toBe(250);
      expect(result.data.shippingFreeThreshold).toBe(5000);
      expect(result.data.allowBackorders).toBe(true);
    }
  });

  it("rejects invalid support email and inconsistent shipping threshold", () => {
    const result = validateAdminStoreSettingsInput({
      storeName: "Party Heaven",
      supportEmail: "bad-email",
      shippingOriginCity: "Karachi",
      shippingFlatRate: "500",
      shippingFreeThreshold: "250",
      dispatchLeadTimeDays: "1",
      lowStockThreshold: "5",
      allowBackorders: "false",
    });

    expect(result.success).toBe(false);
  });

  it("allows optional fields to stay empty", () => {
    const result = validateAdminStoreSettingsInput({
      storeName: "Party Heaven",
      storeTagline: "",
      supportEmail: "support@partyheaven.co",
      supportPhone: "",
      supportWhatsapp: "",
      supportHours: "",
      shippingOriginCity: "Karachi",
      shippingFlatRate: "250",
      shippingFreeThreshold: "",
      dispatchLeadTimeDays: "2",
      lowStockThreshold: "8",
      allowBackorders: "",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.storeTagline).toBeUndefined();
      expect(result.data.shippingFreeThreshold).toBeUndefined();
      expect(result.data.allowBackorders).toBe(false);
    }
  });
});
