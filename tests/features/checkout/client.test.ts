import { describe, expect, it } from "vitest";

import { CHECKOUT_PAYMENT_METHODS } from "@/features/checkout";
import { submitCheckoutRequest } from "@/features/checkout/client";

const basePayload = {
  cartId: "cart-1",
  customer: {
    fullName: "Ammar Khan",
    email: "ammar@example.com",
    phone: "03001234567",
  },
  shippingAddress: {
    addressLine1: "123 Main Street",
    city: "Karachi",
    province: "Sindh",
    country: "Pakistan",
    postcode: "75500",
  },
  paymentMethod: CHECKOUT_PAYMENT_METHODS.COD,
  notes: "",
} as const;

describe("submitCheckoutRequest", () => {
  it("returns parsed order details for a successful API response", async () => {
    const mockFetch: typeof fetch = (async () =>
      new Response(
        JSON.stringify({
          ok: true,
          order: {
            orderNumber: "OD-1001",
            confirmationUrl: "/checkout/confirmation/OD-1001",
            payment: {
              message: "Cash on delivery confirmed.",
            },
            totals: {
              total: 1350,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;

    const result = await submitCheckoutRequest(basePayload, mockFetch);

    expect(result.orderNumber).toBe("OD-1001");
    expect(result.confirmationUrl).toBe("/checkout/confirmation/OD-1001");
    expect(result.payment.message).toBe("Cash on delivery confirmed.");
    expect(result.totals.total).toBe(1350);
  });

  it("returns user-safe API messages when checkout submit fails", async () => {
    const mockFetch: typeof fetch = (async () =>
      new Response(
        JSON.stringify({
          error: "Cart has changed. Please review and retry.",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;

    await expect(submitCheckoutRequest(basePayload, mockFetch)).rejects.toMatchObject({
      code: "CHECKOUT_SUBMIT_FAILED",
      userMessage: "Cart has changed. Please review and retry.",
    });
  });

  it("throws a safe fallback error when success payload is malformed", async () => {
    const mockFetch: typeof fetch = (async () =>
      new Response(
        JSON.stringify({
          ok: true,
          order: {
            orderNumber: "OD-1001",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch;

    await expect(submitCheckoutRequest(basePayload, mockFetch)).rejects.toMatchObject({
      code: "CHECKOUT_RESPONSE_INVALID",
    });
  });
});
