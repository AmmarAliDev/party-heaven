/**
 * Meta Conversion API (CAPI) event model.
 *
 * This is the server-to-server event shape sent to
 * `POST https://graph.facebook.com/{version}/{pixel_id}/events`.
 *
 * Reference: https://developers.facebook.com/docs/meta-pixel/guides/server-side-api/
 *
 * The module is intentionally server-only (imported by route handlers and
 * server services). It must NOT be re-exported from the client-facing
 * `src/features/analytics` barrel.
 */

/** Meta standard events this app knows how to send via CAPI. */
export type MetaCapiStandardEvent =
  | "PageView"
  | "ViewContent"
  | "AddToCart"
  | "InitiateCheckout"
  | "Purchase"
  | "Search"
  | "AddToWishlist"
  | "CompleteRegistration";

/** Where the event happened. "website" is correct for storefront events. */
export type MetaCapiActionSource =
  | "website"
  | "email"
  | "app"
  | "phone_call"
  | "chat"
  | "physical_store"
  | "system_generated"
  | "business_messaging"
  | "other";

/**
 * `user_data` sent to Meta. PII must be SHA-256 hashed (lowercase for email,
 * digits for phone, lowercase for names). `fbp`/`fbc` come from the Meta Pixel
 * cookies and are passed through un-hashed.
 */
export type MetaCapiUserData = {
  /** SHA-256 hashed, lowercase email addresses. */
  em?: string[];
  /** SHA-256 hashed phone numbers (digits, international format, no `+`). */
  ph?: string[];
  /** SHA-256 hashed first names (lowercase). */
  fn?: string[];
  /** SHA-256 hashed last names (lowercase). */
  ln?: string[];
  /** `_fbp` cookie value (Meta Pixel browser ID). */
  fbp?: string;
  /** `_fbc` cookie value (Meta click ID from a paid ad click). */
  fbc?: string;
  /** Best-effort client IP for matching. Never logged. */
  client_ip_address?: string;
  /** Best-effort client User-Agent for matching. Never logged. */
  client_user_agent?: string;
  /** SHA-256 hashed stable identifier (e.g. user id). */
  external_id?: string[];
};

/** A line in the `contents` array of an ecommerce event. */
export type MetaCapiContentItem = {
  /** `content_id` — the product/variant SKU (fallback: product id/name). */
  id: string;
  quantity: number;
  /** Unit price in the event currency. */
  item_price?: number;
  content_name?: string;
  content_category?: string;
  content_type?: "product" | "product_group";
};

/** Free-form event parameters (`custom_data`). */
export type MetaCapiCustomData = {
  /** ISO currency code, e.g. "PKR". */
  currency: string;
  /** Total value of the event in the currency. */
  value?: number;
  contents?: MetaCapiContentItem[];
  content_ids?: string[];
  content_type?: "product" | "product_group";
  num_items?: number;
  order_id?: string;
  search_string?: string;
  status?: string;
  /** Allow future/provider-specific fields without blocking type evolution. */
  [key: string]: unknown;
};

/** A single CAPI event envelope. */
export type MetaCapiEvent = {
  event_name: MetaCapiStandardEvent;
  /** Unix timestamp (seconds) when the event happened. */
  event_time: number;
  /**
   * Deduplication key. Set to the same value as the Meta Pixel `eventID` for
   * the same browser event so Meta only counts it once.
   */
  event_id?: string;
  /** The page URL the event occurred on. */
  event_source_url?: string;
  action_source: MetaCapiActionSource;
  user_data: MetaCapiUserData;
  custom_data?: MetaCapiCustomData;
};

/** Normalized outcome of a CAPI send attempt (never throws). */
export type MetaCapiSendResult = {
  /** `true` when Meta acknowledged receiving the event(s). */
  sent: boolean;
  /** Number of events included in the request. */
  eventCount: number;
  /** Meta `events_received` counter when available. */
  eventsReceived?: number;
  /** Safe, non-PII failure description (null on success). */
  error?: string;
};

/** Input needed to build the server-side Purchase event. */
export type MetaCapiPurchaseInput = {
  orderId: string;
  orderNumber: string;
  placedAt: Date;
  customer: {
    email?: string | null;
    phone?: string | null;
    fullName?: string | null;
  };
  totals: {
    subtotal: number;
    shipping: number;
    total: number;
  };
  paymentMethod: string;
  lines: Array<{
    productName: string;
    sku?: string | null;
    quantity: number;
    unitPrice: number;
  }>;
  /** `_fbp` Meta Pixel cookie (optional; read server-side when available). */
  fbp?: string;
  /** `_fbc` Meta click cookie (optional; read server-side when available). */
  fbc?: string;
  /** Best-effort client IP for matching. */
  clientIp?: string;
  /** Best-effort client User-Agent for matching. */
  userAgent?: string;
  /** The URL the event should be attributed to. */
  eventSourceUrl?: string;
  /**
   * Stable person identifier (e.g. the signed-in user id) hashed into
   * `external_id` so Meta can link the server event to a known visitor.
   * Omit for guest checkouts.
   */
  externalId?: string | null;
};
