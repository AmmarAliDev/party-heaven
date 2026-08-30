import { describe, expect, it } from "vitest";

import { CHECKOUT_PAYMENT_METHODS, checkoutPayloadSchema } from "@/features/checkout";

const basePayload = {
  cartId: "cart-123",
  customer: {
    fullName: "Ammar Ali",
    email: "ammar@example.com",
    phone: "+923001112233",
  },
  shippingAddress: {
    addressLine1: "House 12, Street 5, Gulshan",
    city: "Karachi",
    province: "Sindh",
    country: "Pakistan",
    postcode: "75400",
  },
  paymentMethod: CHECKOUT_PAYMENT_METHODS.COD,
};

describe("checkout payload validation", () => {
  it("accepts a valid Karachi / Sindh checkout payload", () => {
    const parsed = checkoutPayloadSchema.safeParse({ ...basePayload, notes: "Call before delivery" });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.shippingAddress.city).toBe("Karachi");
      expect(parsed.data.shippingAddress.province).toBe("Sindh");
    }
  });

  it("rejects non-Karachi city values", () => {
    const parsed = checkoutPayloadSchema.safeParse({
      ...basePayload,
      shippingAddress: { ...basePayload.shippingAddress, city: "Lahore" },
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain("ship only to Karachi");
    }
  });

  it("rejects province values other than Sindh", () => {
    const parsed = checkoutPayloadSchema.safeParse({
      ...basePayload,
      shippingAddress: { ...basePayload.shippingAddress, province: "Punjab" },
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain("Sindh");
    }
  });

  it("rejects postcodes that contain non-numeric characters", () => {
    const parsed = checkoutPayloadSchema.safeParse({
      ...basePayload,
      shippingAddress: { ...basePayload.shippingAddress, postcode: "7540A" },
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain("numbers only");
    }
  });

  it("accepts a payload without a postal code", () => {
    const parsed = checkoutPayloadSchema.safeParse({
      ...basePayload,
      shippingAddress: {
        addressLine1: basePayload.shippingAddress.addressLine1,
        city: basePayload.shippingAddress.city,
        province: basePayload.shippingAddress.province,
        country: basePayload.shippingAddress.country,
      },
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.shippingAddress.postcode).toBeUndefined();
    }
  });

  it("accepts an empty postal code and normalizes it away", () => {
    const parsed = checkoutPayloadSchema.safeParse({
      ...basePayload,
      shippingAddress: { ...basePayload.shippingAddress, postcode: "" },
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.shippingAddress.postcode).toBeUndefined();
    }
  });

  it("rejects unsupported payment methods", () => {
    const parsed = checkoutPayloadSchema.safeParse({ ...basePayload, paymentMethod: "CARD" });

    expect(parsed.success).toBe(false);
  });
});
