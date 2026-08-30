import type { CartSummary } from "@/features/cart";

import type { CheckoutPaymentMethodCode } from "./constants";

export type CheckoutCustomerInfo = {
  fullName: string;
  email: string;
  phone: string;
};

export type CheckoutShippingAddress = {
  addressLine1: string;
  city: string;
  province: string;
  country: string;
  postcode?: string | undefined;
};

export type CheckoutPayload = {
  cartId: string;
  customer: CheckoutCustomerInfo;
  shippingAddress: CheckoutShippingAddress;
  paymentMethod: CheckoutPaymentMethodCode;
  notes?: string | undefined;
};

export type CheckoutTotals = {
  subtotal: number;
  shipping: number;
  total: number;
};

/**
 * Possible payment initialization outcomes.
 *
 * - `"pending"`           — Payment deferred; money collected at delivery (COD).
 *                           Order is created immediately. No gateway interaction.
 * - `"authorized"`        — Gateway has pre-authorized funds; capture happens later.
 *                           Not used by any current provider.
 * - `"requires_redirect"` — Online gateway returned a redirect URL; the customer
 *                           must leave the site to complete payment (e.g. JazzCash, EasyPaisa).
 *                           Order should only be confirmed after a verified webhook callback.
 */
export type PaymentInitStatus = "pending" | "authorized" | "requires_redirect";

export type CheckoutPaymentResult = {
  provider: CheckoutPaymentMethodCode;
  /** Initialization outcome — see PaymentInitStatus for semantics. */
  status: PaymentInitStatus;
  /** Human-readable message shown to the customer on the confirmation page. */
  message: string;
  /**
   * For online providers: the URL to redirect the customer to in order to
   * complete payment on the gateway's hosted page.
   * Null / undefined for offline providers such as COD.
   */
  redirectUrl?: string | undefined;
  /** Arbitrary string-keyed metadata (e.g. payableAmount, transactionRef). */
  metadata?: Record<string, string>;
};

export type CheckoutPaymentMethodDefinition = {
  code: CheckoutPaymentMethodCode;
  label: string;
  description: string;
  /** "offline" = no gateway (COD); "online" = gateway redirect or API call required. */
  type: "offline" | "online";
  enabled: boolean;
};

export type CheckoutAttemptResult = {
  cart: Pick<CartSummary, "id" | "itemCount" | "subtotal">;
  totals: CheckoutTotals;
  payment: CheckoutPaymentResult;
};

// ---------------------------------------------------------------------------
// Webhook-ready structures (reserved for future online gateway integrations)
// ---------------------------------------------------------------------------

/**
 * Normalized payment webhook event type.
 *
 * Pakistan gateways (JazzCash, EasyPaisa, HBL Omni, etc.) POST a callback to
 * a webhook endpoint after a payment attempt. This enum defines the normalized
 * event vocabulary — each provider adapter maps its raw event to one of these.
 */
export type PaymentWebhookEventType =
  | "payment.authorized" // gateway pre-authorized the funds
  | "payment.captured" // funds settled / deducted
  | "payment.failed" // customer failed to pay or bank declined
  | "payment.cancelled" // customer cancelled on gateway page
  | "refund.initiated" // refund has been requested
  | "refund.completed"; // refund settled to customer's account

/**
 * Normalized webhook event envelope emitted by a `PaymentProvider.handleWebhook`
 * implementation. Consumers (e.g. the order service) should react to this type
 * rather than to raw gateway payloads.
 *
 * Storage: persist `rawPayload` as-is in `PaymentTransaction.webhookPayload`
 * (a future DB column) for auditability and idempotent replay.
 */
export type PaymentWebhookEvent = {
  /** Opaque event ID from the gateway — use for deduplication before processing. */
  id: string;
  /** Identifies the gateway (e.g. "JAZZCASH"). Must match a provider registry key. */
  provider: string;
  /** Normalized event category. */
  type: PaymentWebhookEventType;
  /** Order number the payment is linked to. */
  orderNumber: string;
  /**
   * Amount in PKR stored as integer paisa (smallest unit).
   * Validate this against the order total before confirming.
   */
  amount: number;
  /** Full raw payload from the gateway POST — stored for audit / replay. */
  rawPayload: Record<string, unknown>;
  /** Server-side timestamp when the webhook was received. */
  receivedAt: Date;
};

/**
 * Full lifecycle status of a persisted `PaymentTransaction` row.
 *
 * `PaymentInitStatus` only covers what the provider returns at initiation time.
 * Once a transaction is stored and later updated by webhook callbacks, it needs
 * to express terminal and post-capture states as well.
 *
 * Init states (set when the transaction row is first created):
 * - `"pending"`           — COD or gateway redirect not yet completed.
 * - `"authorized"`        — Gateway pre-authorized funds; capture pending.
 * - `"requires_redirect"` — Customer has been sent to the gateway page.
 *
 * Terminal / webhook-driven states (set by the webhook processor):
 * - `"captured"`          — Payment settled; funds deducted from customer.
 * - `"failed"`            — Gateway declined or customer failed to pay.
 * - `"cancelled"`         — Customer cancelled on the gateway page.
 * - `"refund_initiated"`  — A refund has been requested.
 * - `"refund_completed"`  — Refund settled to customer's account.
 */
export type PaymentTransactionStatus =
  | PaymentInitStatus
  | "captured"
  | "failed"
  | "cancelled"
  | "refund_initiated"
  | "refund_completed";

/**
 * TypeScript representation of a future `PaymentTransaction` database row.
 *
 * A Prisma `PaymentTransaction` model and migration should be added when the
 * first online gateway is integrated. Each payment attempt (including retries)
 * gets its own row so the full audit trail is preserved.
 *
 * Suggested Prisma model (add to schema.prisma when ready):
 *
 * ```prisma
 * model PaymentTransaction {
 *   id               String   @id @default(uuid())
 *   orderNumber      String   @map("order_number")
 *   provider         String                             // e.g. "COD", "JAZZCASH"
 *   amount           Int                                // PKR paisa
 *   currency         Currency @default(PKR)
 *   status           String   @map("status")            // PaymentTransactionStatus value
 *   gatewayReference String?  @map("gateway_reference") // provider tx ID
 *   gatewayResponse  Json?    @map("gateway_response")  // raw init response
 *   webhookPayload   Json?    @map("webhook_payload")   // raw webhook body
 *   createdAt        DateTime @default(now()) @map("created_at")
 *   updatedAt        DateTime @updatedAt     @map("updated_at")
 *
 *   @@index([orderNumber])
 *   @@map("payment_transaction")
 * }
 * ```
 */
export type PaymentTransactionRecord = {
  id: string;
  orderNumber: string;
  /** Provider code — must be a registered gateway key. */
  provider: string;
  /** Payment amount in PKR (integer, smallest currency unit). */
  amount: number;
  currency: "Rs.";
  /** Current lifecycle status — covers both init and post-webhook terminal states. */
  status: PaymentTransactionStatus;
  /** Gateway-issued transaction / authorization reference. Null for COD. */
  gatewayReference: string | null;
  /** Raw response envelope from the gateway init call. Null for COD. */
  gatewayResponse: Record<string, unknown> | null;
  /** Last webhook payload received for this transaction. Null until a webhook arrives. */
  webhookPayload: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};
