import { describe, expect, it } from "vitest";

import type { CheckoutPaymentProvider } from "@/features/checkout";
import {
  CHECKOUT_PAYMENT_METHODS,
  FUTURE_PAYMENT_GATEWAY_CODES,
  getCheckoutPaymentProvider,
  listCheckoutPaymentMethods,
} from "@/features/checkout";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseTotals = { subtotal: 1000, shipping: 150, total: 1150 };
const basePayload = {
  cartId: "cart-1",
  customer: {
    fullName: "Ammar Ali",
    email: "ammar@example.com",
    phone: "+923001112233",
  },
  shippingAddress: {
    addressLine1: "House 1",
    city: "Karachi",
    province: "Sindh",
    country: "Pakistan",
    postcode: "75400",
  },
  paymentMethod: CHECKOUT_PAYMENT_METHODS.COD,
};

// ---------------------------------------------------------------------------
// Provider registry
// ---------------------------------------------------------------------------

describe("listCheckoutPaymentMethods", () => {
  it("returns exactly one enabled method (COD)", () => {
    const methods = listCheckoutPaymentMethods();

    expect(methods).toHaveLength(1);
    expect(methods[0]?.code).toBe(CHECKOUT_PAYMENT_METHODS.COD);
    expect(methods[0]?.enabled).toBe(true);
  });

  it("returns only enabled providers — disabled providers must not appear", () => {
    // This assertion acts as a guard: if a future provider is registered with
    // enabled:false, listCheckoutPaymentMethods() must still filter it out.
    const methods = listCheckoutPaymentMethods();

    for (const m of methods) {
      expect(m.enabled).toBe(true);
    }
  });
});

describe("getCheckoutPaymentProvider", () => {
  it("resolves the COD provider", () => {
    const provider = getCheckoutPaymentProvider(CHECKOUT_PAYMENT_METHODS.COD);

    expect(provider).toBeDefined();
    expect(provider.method.code).toBe(CHECKOUT_PAYMENT_METHODS.COD);
    expect(provider.method.type).toBe("offline");
    expect(provider.method.enabled).toBe(true);
  });

  it("throws CHECKOUT_PAYMENT_METHOD_UNAVAILABLE for an unknown code", () => {
    // Cast an invalid code to bypass TS — simulates a tampered API request.
    expect(() => getCheckoutPaymentProvider("UNKNOWN" as typeof CHECKOUT_PAYMENT_METHODS.COD)).toThrow(
      /payment method is unavailable/i,
    );
  });
});

// ---------------------------------------------------------------------------
// COD provider — authorize / payment result contract
// ---------------------------------------------------------------------------

describe("COD provider.authorize", () => {
  it("returns status=pending immediately (no gateway round-trip)", () => {
    const provider = getCheckoutPaymentProvider(CHECKOUT_PAYMENT_METHODS.COD);

    const result = provider.authorize({ payload: basePayload, totals: baseTotals });

    expect(result.provider).toBe(CHECKOUT_PAYMENT_METHODS.COD);
    expect(result.status).toBe("pending");
  });

  it("includes a customer-visible message", () => {
    const provider = getCheckoutPaymentProvider(CHECKOUT_PAYMENT_METHODS.COD);

    const result = provider.authorize({ payload: basePayload, totals: baseTotals });

    expect(typeof result.message).toBe("string");
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("includes the payable amount in metadata", () => {
    const provider = getCheckoutPaymentProvider(CHECKOUT_PAYMENT_METHODS.COD);

    const result = provider.authorize({ payload: basePayload, totals: baseTotals });

    expect(result.metadata?.payableAmount).toBe("1150");
  });

  it("does NOT include a redirectUrl (offline provider)", () => {
    const provider = getCheckoutPaymentProvider(CHECKOUT_PAYMENT_METHODS.COD);

    const result = provider.authorize({ payload: basePayload, totals: baseTotals });

    // redirectUrl must be absent or undefined for offline providers — the
    // checkout page must not attempt a redirect for COD orders.
    expect(result.redirectUrl).toBeUndefined();
  });

  it("does NOT expose a handleWebhook method (COD has no callbacks)", () => {
    const provider = getCheckoutPaymentProvider(CHECKOUT_PAYMENT_METHODS.COD);

    // Online providers will define handleWebhook; COD must not.
    expect(provider.handleWebhook).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Provider contract shape — ensures future providers can conform
// ---------------------------------------------------------------------------

describe("CheckoutPaymentProvider contract", () => {
  it("satisfies the interface with a minimal offline stub", () => {
    // This test documents the minimal shape required for a new provider.
    // A real implementation would live in src/features/checkout/providers/.
    const stubProvider: CheckoutPaymentProvider = {
      method: {
        code: CHECKOUT_PAYMENT_METHODS.COD, // reuse COD code for stub validity
        label: "Stub Provider",
        description: "Test stub",
        type: "offline",
        enabled: false, // disabled — not registered
      },
      authorize: () => ({
        provider: CHECKOUT_PAYMENT_METHODS.COD,
        status: "pending",
        message: "Stub",
      }),
    };

    expect(stubProvider.method.enabled).toBe(false);
    expect(typeof stubProvider.authorize).toBe("function");
    expect(stubProvider.handleWebhook).toBeUndefined();
  });

  it("satisfies the interface with an online provider stub (redirect flow)", () => {
    const onlineStub: CheckoutPaymentProvider = {
      method: {
        code: CHECKOUT_PAYMENT_METHODS.COD, // placeholder code; real provider would add its own
        label: "Online Gateway Stub",
        description: "Redirect-based gateway stub",
        type: "online",
        enabled: false, // disabled until real implementation exists
      },
      authorize: () => ({
        provider: CHECKOUT_PAYMENT_METHODS.COD,
        // Online providers must return requires_redirect — NOT "authorized" —
        // until a verified webhook confirms payment completion.
        status: "requires_redirect",
        message: "Redirecting to payment page…",
        redirectUrl: "https://gateway.example.com/pay/session-123",
      }),
      handleWebhook: async (_rawBody: string, _signature: string) => {
        // Real implementation: verify HMAC, parse body, return normalized event.
        void _rawBody;
        void _signature;
        throw new Error("Stub: not implemented");
      },
    };

    expect(onlineStub.method.type).toBe("online");
    expect(typeof onlineStub.handleWebhook).toBe("function");

    const result = onlineStub.authorize({ payload: basePayload, totals: baseTotals });

    expect(result.status).toBe("requires_redirect");
    expect(result.redirectUrl).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Future gateway codes — must remain separate from active registry
// ---------------------------------------------------------------------------

describe("FUTURE_PAYMENT_GATEWAY_CODES", () => {
  it("defines reserved codes for planned Pakistan gateways", () => {
    expect(FUTURE_PAYMENT_GATEWAY_CODES.JAZZCASH).toBe("JAZZCASH");
    expect(FUTURE_PAYMENT_GATEWAY_CODES.EASYPAISA).toBe("EASYPAISA");
    expect(FUTURE_PAYMENT_GATEWAY_CODES.HBL_OMNI).toBe("HBL_OMNI");
  });

  it("none of the future codes appear in the active methods list", () => {
    const activeCodes = new Set(listCheckoutPaymentMethods().map((m) => m.code));

    for (const code of Object.values(FUTURE_PAYMENT_GATEWAY_CODES)) {
      expect(activeCodes.has(code as never)).toBe(false);
    }
  });
});
