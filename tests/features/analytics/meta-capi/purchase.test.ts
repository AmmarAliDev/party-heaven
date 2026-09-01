import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieGet = vi.hoisted(() => vi.fn());
const headerGet = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet }),
  headers: async () => ({ get: headerGet }),
}));

import { fireMetaCapiPurchaseSafely } from "@/features/analytics/meta-capi";

const enabledEnv = {
  META_PIXEL_ID: "123456789",
  META_CAPI_ACCESS_TOKEN: "EAAG-test-token",
};

const purchaseInput = {
  orderId: "order-1",
  orderNumber: "OD-20260901-0001",
  placedAt: new Date("2026-09-01T10:00:00Z"),
  customer: { email: "ammar@example.com", phone: "+92 300 1112233", fullName: "Ammar Ali" },
  totals: { subtotal: 2000, shipping: 150, total: 2150 },
  paymentMethod: "COD",
  lines: [{ productName: "Ultra Wash Detergent", sku: "UWD-1", quantity: 2, unitPrice: 1000 }],
  externalId: "user-123",
};

describe("meta-capi purchase orchestrator", () => {
  beforeEach(() => {
    cookieGet.mockReset();
    headerGet.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);

    cookieGet.mockImplementation((name: string) =>
      name === "_fbp" ? { value: "fb.1.1.abcdef" } : undefined,
    );
    headerGet.mockImplementation((name: string) =>
      name === "user-agent" ? "Mozilla/5.0 test" : undefined,
    );
  });

  it("returns false and never calls Meta when CAPI is disabled", async () => {
    const sent = await fireMetaCapiPurchaseSafely(purchaseInput, {});

    expect(sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the purchase event with hashed PII and fbp cookie and returns true", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events_received: 1 }),
    });

    const sent = await fireMetaCapiPurchaseSafely(purchaseInput, enabledEnv);

    expect(sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      data: Array<{
        event_name: string;
        event_id: string;
        user_data: { fbp?: string; em?: string[] };
        custom_data?: { value?: number };
      }>;
    };
    const event = body.data[0]!;

    expect(event.event_name).toBe("Purchase");
    expect(event.event_id).toBe("OD-20260901-0001");
    expect(event.user_data.fbp).toBe("fb.1.1.abcdef");
    expect(event.user_data.em?.[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(event.custom_data?.value).toBe(2150);

    // Raw PII must never be transmitted.
    expect(String(init.body)).not.toContain("ammar@example.com");
    expect(String(init.body)).not.toContain("+92");
  });

  it("returns false without throwing when Meta rejects the event", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ error: { message: "Invalid token" } }),
    });

    const sent = await fireMetaCapiPurchaseSafely(purchaseInput, enabledEnv);

    expect(sent).toBe(false);
  });

  it("returns false without throwing when the request context is unavailable", async () => {
    // Simulate next/headers throwing outside a request scope.
    cookieGet.mockImplementation(() => {
      throw new Error("Missing request context");
    });
    headerGet.mockImplementation(() => {
      throw new Error("Missing request context");
    });
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events_received: 1 }),
    });

    const sent = await fireMetaCapiPurchaseSafely(purchaseInput, enabledEnv);

    // Cookies are read inside readRequestContext; a throw there returns {} and
    // the send should still succeed (or not break) — never reject.
    expect(sent).toBe(true);
  });
});
