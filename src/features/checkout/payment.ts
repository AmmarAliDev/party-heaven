/**
 * Payment provider abstraction for the Party Heaven checkout.
 *
 * ## Architecture
 *
 * Every payment method — current (COD) and future (online gateways) — must
 * implement the `CheckoutPaymentProvider` contract and be registered in
 * `providerRegistry`. The checkout API and UI are decoupled from any specific
 * gateway; they only interact with this module.
 *
 * ## Adding a new gateway (step-by-step)
 *
 * 1. Move the gateway code from `FUTURE_PAYMENT_GATEWAY_CODES` in `constants.ts`
 *    into `CHECKOUT_PAYMENT_METHODS` (both the object and the type).
 * 2. Create `src/features/checkout/providers/<name>.ts` implementing
 *    `CheckoutPaymentProvider` (see the COD provider below as a reference).
 * 3. Register the new provider in `providerRegistry` in this file.
 * 4. Update the Zod `paymentMethod` enum in `validation.ts`.
 * 5. Add a `PaymentTransaction` Prisma migration (see `PaymentTransactionRecord`
 *    in `types.ts` for the suggested schema).
 * 6. Never return `status: "authorized"` from `authorize()` without verifying
 *    a signed webhook callback from the gateway — see `handleWebhook` below.
 *
 * ## Webhook flow (online gateways)
 *
 * 1. `authorize()` returns `status: "requires_redirect"` plus a `redirectUrl`.
 * 2. Customer completes payment on the gateway's hosted page.
 * 3. Gateway POSTs a signed callback to `/api/webhooks/payments/<provider>`.
 * 4. The webhook route calls `provider.handleWebhook(rawBody, signature)`.
 * 5. If the returned `PaymentWebhookEvent.type === "payment.captured"`, the
 *    order service transitions the order to CONFIRMED and sends notifications.
 * 6. Persist the `rawPayload` in `PaymentTransaction.webhookPayload` for audit.
 *
 * COD has no webhook — its `handleWebhook` is undefined.
 */

import { AppError } from "@/lib/errors/app-error";

import { CHECKOUT_PAYMENT_METHODS, type CheckoutPaymentMethodCode } from "./constants";
import type {
  CheckoutPayload,
  CheckoutPaymentMethodDefinition,
  CheckoutPaymentResult,
  CheckoutTotals,
  PaymentWebhookEvent,
} from "./types";

// ---------------------------------------------------------------------------
// Provider contract
// ---------------------------------------------------------------------------

export type AuthorizePaymentContext = {
  payload: CheckoutPayload;
  totals: CheckoutTotals;
};

/**
 * The contract every payment provider must satisfy.
 *
 * `authorize` — Initiate a payment attempt.
 *   - Offline providers (COD): returns immediately with `status: "pending"`.
 *   - Online providers: returns `status: "requires_redirect"` plus a
 *     `redirectUrl`. Do NOT return `"authorized"` without a verified webhook.
 *
 * `handleWebhook` (optional) — Verify and normalize a gateway callback.
 *   - Called by `/api/webhooks/payments/<provider>` with the raw request body
 *     and the gateway's HMAC signature header.
 *   - Must throw an `AppError` if signature verification fails.
 *   - Returns a `PaymentWebhookEvent` that the order service acts on.
 *   - Undefined for offline providers.
 */
export type CheckoutPaymentProvider = {
  method: CheckoutPaymentMethodDefinition;
  authorize: (context: AuthorizePaymentContext) => CheckoutPaymentResult;
  handleWebhook?: (rawBody: string, signature: string) => Promise<PaymentWebhookEvent>;
};

// ---------------------------------------------------------------------------
// COD provider — the only active provider
// ---------------------------------------------------------------------------

const codPaymentProvider: CheckoutPaymentProvider = {
  method: {
    code: CHECKOUT_PAYMENT_METHODS.COD,
    label: "Cash on Delivery",
    description: "Pay cash when your order is delivered in Karachi.",
    type: "offline",
    enabled: true,
  },
  // COD authorization is always immediate; no gateway interaction.
  // The order is placed in PENDING status and payment is collected at delivery.
  authorize: ({ totals }) => ({
    provider: CHECKOUT_PAYMENT_METHODS.COD,
    status: "pending",
    message: "Cash on Delivery selected. Please keep exact change ready on delivery.",
    metadata: {
      payableAmount: `${totals.total}`,
    },
  }),
  // COD has no webhook — the field is intentionally absent.
};

// ---------------------------------------------------------------------------
// Provider registry — add new providers here (see module JSDoc above)
// ---------------------------------------------------------------------------

const providerRegistry: Record<CheckoutPaymentMethodCode, CheckoutPaymentProvider> = {
  [CHECKOUT_PAYMENT_METHODS.COD]: codPaymentProvider,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns all currently enabled payment methods (for the checkout form). */
export function listCheckoutPaymentMethods() {
  return Object.values(providerRegistry)
    .map((provider) => provider.method)
    .filter((method) => method.enabled);
}

/**
 * Resolves the active provider for the given payment method code.
 * Throws `CHECKOUT_PAYMENT_METHOD_UNAVAILABLE` if the code is unknown or disabled.
 */
export function getCheckoutPaymentProvider(code: CheckoutPaymentMethodCode): CheckoutPaymentProvider {
  const provider = providerRegistry[code];

  if (!provider || !provider.method.enabled) {
    throw new AppError(`Payment method is unavailable: ${code}`, "CHECKOUT_PAYMENT_METHOD_UNAVAILABLE", {
      statusCode: 400,
      userMessage: "The selected payment method is not available right now.",
    });
  }

  return provider;
}
