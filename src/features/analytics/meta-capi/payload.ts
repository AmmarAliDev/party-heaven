import { hashUserData } from "./hash";
import type {
  MetaCapiContentItem,
  MetaCapiCustomData,
  MetaCapiEvent,
  MetaCapiPurchaseInput,
  MetaCapiStandardEvent,
  MetaCapiUserData,
} from "./types";

/**
 * Builds the Meta Conversion API request payloads for this app.
 *
 * All amounts are in PKR main units (same values used by the checkout/order
 * services) and the `value` on the Purchase event is the grand total the
 * customer actually pays, matching the analytics "purchase" value convention.
 */

export const META_CAPI_CURRENCY = "PKR";

/** Maps order lines to CAPI `contents` items. */
export function toMetaCapiContentItems(
  lines: MetaCapiPurchaseInput["lines"],
): MetaCapiContentItem[] {
  return lines.map((line) => ({
    id: line.sku ?? line.productName,
    quantity: line.quantity,
    ...(typeof line.unitPrice === "number" && Number.isFinite(line.unitPrice)
      ? { item_price: line.unitPrice }
      : {}),
    content_name: line.productName,
    content_type: "product",
  }));
}

/**
 * Builds the server-side `Purchase` CAPI event.
 *
 * `event_id` is the unique order number so Meta can deduplicate against the
 * browser Pixel purchase (the Pixel tag should set its Event ID to the same
 * `ecommerce.transaction_id` value).
 */
export function buildPurchaseEvent(input: MetaCapiPurchaseInput): MetaCapiEvent {
  const userData: MetaCapiUserData = {
    ...hashUserData({
      email: input.customer.email ?? null,
      phone: input.customer.phone ?? null,
      fullName: input.customer.fullName ?? null,
      externalId: input.externalId ?? null,
    }),
    ...(input.fbp ? { fbp: input.fbp } : {}),
    ...(input.fbc ? { fbc: input.fbc } : {}),
    ...(input.clientIp ? { client_ip_address: input.clientIp } : {}),
    ...(input.userAgent ? { client_user_agent: input.userAgent } : {}),
  };

  const contents = toMetaCapiContentItems(input.lines);

  const customData: MetaCapiCustomData = {
    currency: META_CAPI_CURRENCY,
    value: input.totals.total,
    contents,
    content_ids: contents.map((content) => content.id),
    content_type: "product",
    num_items: contents.reduce((sum, content) => sum + content.quantity, 0),
    order_id: input.orderNumber,
    ...(input.paymentMethod ? { status: input.paymentMethod } : {}),
    // Breakdown for reporting (grand total already includes these).
    subtotal: input.totals.subtotal,
    shipping: input.totals.shipping,
  };

  return {
    event_name: "Purchase",
    event_time: Math.floor(input.placedAt.getTime() / 1000),
    event_id: input.orderNumber,
    ...(input.eventSourceUrl ? { event_source_url: input.eventSourceUrl } : {}),
    action_source: "website",
    user_data: userData,
    custom_data: customData,
  };
}

export type MetaCapiSupplementalInput = {
  eventName: MetaCapiStandardEvent;
  /** Optional deduplication key shared with the Pixel `eventID`. */
  eventId?: string;
  eventSourceUrl?: string;
  fbp?: string;
  fbc?: string;
  clientIp?: string;
  userAgent?: string;
  customData?: MetaCapiCustomData;
};

/**
 * Builds a non-Purchase CAPI event (used by the optional client-to-server
 * bridge for events such as `ViewContent`/`AddToCart`/`InitiateCheckout`).
 * The browser bridge must never supply PII — the only identity fields here are
 * the `fbp`/`fbc` cookies and request metadata, read server-side.
 */
export function buildSupplementalEvent(input: MetaCapiSupplementalInput): MetaCapiEvent {
  return {
    event_name: input.eventName,
    event_time: Math.floor(Date.now() / 1000),
    ...(input.eventId ? { event_id: input.eventId } : {}),
    ...(input.eventSourceUrl ? { event_source_url: input.eventSourceUrl } : {}),
    action_source: "website",
    user_data: {
      ...(input.fbp ? { fbp: input.fbp } : {}),
      ...(input.fbc ? { fbc: input.fbc } : {}),
      ...(input.clientIp ? { client_ip_address: input.clientIp } : {}),
      ...(input.userAgent ? { client_user_agent: input.userAgent } : {}),
    },
    ...(input.customData ? { custom_data: input.customData } : {}),
  };
}
