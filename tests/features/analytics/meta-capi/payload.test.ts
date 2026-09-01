import { describe, expect, it } from "vitest";

import {
  buildPurchaseEvent,
  buildSupplementalEvent,
  hashValue,
  META_CAPI_CURRENCY,
  toMetaCapiContentItems,
} from "@/features/analytics/meta-capi";

const baseInput = {
  orderId: "order-1",
  orderNumber: "OD-20260901-0001",
  placedAt: new Date("2026-09-01T10:00:00Z"),
  customer: {
    email: "ammar@example.com",
    phone: "+92 300 1112233",
    fullName: "Ammar Ali",
  },
  totals: {
    subtotal: 2000,
    shipping: 150,
    total: 2150,
  },
  paymentMethod: "COD",
  lines: [
    { productName: "Ultra Wash Detergent", sku: "UWD-2KG-001", quantity: 2, unitPrice: 1000 },
    { productName: "Fresh Candle", sku: null, quantity: 1, unitPrice: 0 },
  ],
  fbp: "fb.1.1234567890.abcdef",
  fbc: "fb.1.1234567890",
  clientIp: "203.0.113.10",
  userAgent: "Mozilla/5.0 test",
  eventSourceUrl: "https://partyheaven.co/checkout/confirmation/OD-20260901-0001",
  externalId: "user-123",
};

describe("meta-capi payload builders", () => {
  describe("toMetaCapiContentItems", () => {
    it("maps lines to contents using sku as id and includes price when present", () => {
      const contents = toMetaCapiContentItems(baseInput.lines);

      expect(contents).toEqual([
        {
          id: "UWD-2KG-001",
          quantity: 2,
          item_price: 1000,
          content_name: "Ultra Wash Detergent",
          content_type: "product",
        },
        {
          id: "Fresh Candle",
          quantity: 1,
          item_price: 0,
          content_name: "Fresh Candle",
          content_type: "product",
        },
      ]);
    });
  });

  describe("buildPurchaseEvent", () => {
    it("builds a well-formed Purchase event", () => {
      const event = buildPurchaseEvent(baseInput);

      expect(event.event_name).toBe("Purchase");
      expect(event.action_source).toBe("website");
      expect(event.event_id).toBe(baseInput.orderNumber);
      expect(event.event_time).toBe(Math.floor(baseInput.placedAt.getTime() / 1000));
      expect(event.event_source_url).toBe(baseInput.eventSourceUrl);

      expect(event.custom_data).toMatchObject({
        currency: META_CAPI_CURRENCY,
        value: 2150,
        order_id: baseInput.orderNumber,
        content_type: "product",
        num_items: 3,
        status: "COD",
        subtotal: 2000,
        shipping: 150,
      });
      expect(event.custom_data?.content_ids).toEqual(["UWD-2KG-001", "Fresh Candle"]);

      // PII is hashed; raw values never appear.
      expect(event.user_data.em).toEqual([hashValue("ammar@example.com")]);
      expect(event.user_data.ph).toEqual([hashValue("923001112233")]);
      expect(event.user_data.fn).toEqual([hashValue("ammar")]);
      expect(event.user_data.ln).toEqual([hashValue("ali")]);
      expect(event.user_data.external_id).toEqual([hashValue("user-123")]);
      expect(JSON.stringify(event)).not.toContain("ammar@example.com");
      expect(JSON.stringify(event)).not.toContain("+92");

      // fbp/fbc + request metadata pass through un-hashed.
      expect(event.user_data.fbp).toBe(baseInput.fbp);
      expect(event.user_data.fbc).toBe(baseInput.fbc);
      expect(event.user_data.client_ip_address).toBe(baseInput.clientIp);
      expect(event.user_data.client_user_agent).toBe(baseInput.userAgent);
    });

    it("omits optional fields when absent", () => {
      const event = buildPurchaseEvent({
        orderId: "order-1",
        orderNumber: "OD-20260901-0001",
        placedAt: new Date("2026-09-01T10:00:00Z"),
        customer: { email: null, phone: null, fullName: null },
        totals: { subtotal: 0, shipping: 0, total: 0 },
        paymentMethod: "COD",
        lines: [],
      });

      expect(event.user_data).toEqual({});
      expect(event.event_source_url).toBeUndefined();
      expect(event.event_id).toBe("OD-20260901-0001");
      expect(event.custom_data?.contents).toEqual([]);
      expect(event.custom_data?.num_items).toBe(0);
    });
  });

  describe("buildSupplementalEvent", () => {
    it("builds a supplemental event with request metadata only", () => {
      const event = buildSupplementalEvent({
        eventName: "AddToCart",
        eventId: "atc-1",
        eventSourceUrl: "https://partyheaven.co/products/x",
        fbp: "fb.1.1.abc",
        clientIp: "203.0.113.10",
        customData: { currency: "PKR", value: 1000, content_ids: ["SKU-1"] },
      });

      expect(event.event_name).toBe("AddToCart");
      expect(event.action_source).toBe("website");
      expect(event.event_id).toBe("atc-1");
      expect(event.user_data.fbp).toBe("fb.1.1.abc");
      expect(event.user_data.client_ip_address).toBe("203.0.113.10");
      expect(event.user_data.em).toBeUndefined();
      expect(event.custom_data?.value).toBe(1000);
    });
  });
});
