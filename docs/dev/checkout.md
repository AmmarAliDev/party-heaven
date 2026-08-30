# Checkout And Orders (Prompts 4.2 and 4.3)

This document describes the Checkout flow and the transactional order lifecycle implemented in Phase 4.

## Scope implemented

- Checkout UI at `/checkout`
- guest and authenticated checkout supported
- Karachi-only shipping validation (client and server)
- fixed shipping fee of Rs. 250
- payment method abstraction with COD implementation
- checkout API validation and retry-safe UX handling
- transactional order placement from checkout
- inventory deduction on successful order placement
- order item and address snapshots persisted in Prisma
- customer order confirmation page at `/checkout/confirmation/[orderNumber]`
- customer account order history at `/account/orders`
- customer account order detail page at `/account/orders/[orderNumber]`
- PDF invoice download route at `/api/orders/[orderNumber]/invoice`
- re-order action that rehydrates the active cart from a prior order with stock-aware adjustments
- persisted `AuditLog` entries for order creation and lifecycle status changes
- order lifecycle helpers for `pending`, `confirmed`, `packed`, `shipped`, `delivered`, and `cancelled`

## Current assumptions

- payment methods include only COD right now
- invoice PDFs are generated on demand from the stored order snapshot rather than persisted as blobs
- guest order confirmation and invoice access use a per-order confirmation token in the order metadata

### Confirmation Token Security

The "confirmation token" is stored in "order metadata" and protects guest order access:

**Token Generation & Storage:**
- Token must be generated using a cryptographically secure RNG (e.g., `randomBytes()`)
- Minimum entropy: ≥128 bits or 32+ URL-safe characters
- Store only SHA-256 hashed token with a strong salt in order metadata (never plaintext)
- Protect order metadata at rest (encrypted database) and in transit (HTTPS only)

**Token Expiration & Lifecycle:**
- Token expiration policy: 30 days after order creation, or configurable TTL
- Token invalidation: Tokens should be treated as single-use per confirmation link or set a limit on use count
- Token rotation: Issue a new token on successful confirmation; old token becomes invalid
- Revocation: Provide admin/customer action to revoke token (e.g., on account recovery, fraud suspected)

**Default Implementation Details:**
- Token stored in `Order.metadata.confirmationAccessToken` (hashed)
- Comparison: Hash incoming token from request and compare with stored hash (constant-time comparison)
- No user account required; token is the sole access control for guest orders

## Architecture

### Shared contracts

Checkout contracts are centralized under `src/features/checkout`:

- `validation.ts`: `checkoutPayloadSchema` (server and client safe parse)
- `service.ts`: totals and checkout attempt result shaping
- `payment.ts`: provider registry and payment method contract
- `constants.ts`: shipping fee, city restriction, payment method codes

### Payment abstraction

`payment.ts` exports a `CheckoutPaymentProvider` contract and a `providerRegistry` keyed by payment method code.

#### Provider contract

```typescript
type CheckoutPaymentProvider = {
  method: CheckoutPaymentMethodDefinition;

  // Initiate a payment attempt.
  // - Offline (COD): returns immediately with status "pending".
  // - Online gateway: returns status "requires_redirect" + a redirectUrl.
  //   Do NOT return "authorized" without a verified webhook.
  authorize: (context: AuthorizePaymentContext) => CheckoutPaymentResult;

  // Optional — online providers only.
  // Verify and normalize a signed POST callback from the gateway.
  handleWebhook?: (rawBody: string, signature: string) => Promise<PaymentWebhookEvent>;
};
```

#### PaymentInitStatus values

| Status | Meaning |
|---|---|
| `"pending"` | Payment deferred (COD). Order created; money collected at delivery. |
| `"authorized"` | Gateway pre-authorized funds. Not used by any current provider. |
| `"requires_redirect"` | Customer must complete payment on the gateway's hosted page. |

#### Webhook flow (future online providers)

1. `authorize()` returns `status: "requires_redirect"` and a `redirectUrl`.
2. Customer pays on the gateway page.
3. Gateway POSTs a signed callback to `/api/webhooks/payments/<provider>`.
4. The route calls `provider.handleWebhook(rawBody, signature)`.
5. If `event.type === "payment.captured"` the order service transitions the order to CONFIRMED.
6. Persist `rawPayload` in `PaymentTransaction.webhookPayload` (future DB column — see `PaymentTransactionRecord` in `types.ts`).

Current provider:

- `COD`: offline, enabled, no webhook

#### Registering a future provider

1. Move the gateway code from `FUTURE_PAYMENT_GATEWAY_CODES` in `constants.ts` into `CHECKOUT_PAYMENT_METHODS`.
2. Create `src/features/checkout/providers/<name>.ts` implementing `CheckoutPaymentProvider`.
3. Register the new provider in `providerRegistry` inside `payment.ts`.
4. Update `validation.ts` to include the new code in the Zod enum.
5. Add environment variables (API keys, webhook secrets) to `.env.example`.
6. Add a `PaymentTransaction` Prisma migration (schema suggested in `types.ts`).

Reserved gateway codes (not yet active): `JAZZCASH`, `EASYPAISA`, `HBL_OMNI`.

#### PaymentTransactionRecord (future DB entity)

`types.ts` defines `PaymentTransactionRecord` as a TypeScript type documenting the shape of a future `payment_transaction` table. The Prisma model and migration should be added when the first online gateway is integrated. The suggested schema is embedded in the JSDoc of `PaymentTransactionRecord`.

### Order placement flow

Order lifecycle logic lives under `src/features/orders`:

- `service.ts`: transactional order placement, access checks, and status updates
- `status.ts`: lifecycle transition helpers and presentation labels
- `invoice.ts`: order number strategy, invoice number strategy, confirmation/invoice URLs, and minimal PDF generation

Placement flow:

1. Validate trusted origin and checkout payload
2. Resolve active cart for guest or signed-in user
3. Re-check stock inside a serializable transaction
4. Atomically decrement inventory rows
5. Create order-address snapshots and order-item snapshots
6. Create the order with `PENDING` status
7. Mark the cart as `COMPLETED`
8. Persist `AuditLog` entry for order creation
9. Return confirmation and invoice URLs

### Status lifecycle

Supported transitions:

- `pending -> confirmed`
- `pending -> cancelled`
- `confirmed -> packed`
- `confirmed -> cancelled`
- `packed -> shipped`
- `packed -> cancelled`
- `shipped -> delivered`

`delivered` and `cancelled` are terminal states.

Note: `SHIPPED` orders cannot be directly cancelled via a status transition. Cancellations after shipment are handled through the returns/refunds process (create a return request, receive the item, then issue a refund); the lifecycle treats `SHIPPED` as irreversible in the transition table and only allows `SHIPPED -> DELIVERED`. The enforcement for allowed transitions lives in `src/features/orders/status.ts`.

## Karachi-only behavior

City is locked to Karachi in the UI and enforced server-side.

Validation behavior:

- if city is not Karachi, payload is rejected with user-safe error
- API returns friendly error messages through central error handlers

Shipping address fields: only `addressLine1` is required (there is no address line 2 field at checkout); `postcode` is optional — an empty or missing postal code is accepted and normalized away, and a provided one must be 4–10 numeric characters. `city`/`province`/`country` are fixed (Karachi / Sindh / Pakistan).

## Totals

Totals are calculated from cart subtotal with fixed shipping:

- subtotal: from active cart
- shipping: 250
- total: `subtotal + 250`

## Retry handling

The checkout form keeps the last payload on failed submit and exposes a "Retry last attempt" action. This gives users a direct recovery path for transient failures.

## Saved addresses

Signed-in customers can save a delivery address from checkout and manage it from their profile:

- The Shipping address card header shows a **Save** button (signed-in only) wrapped in a tooltip — "Save the address to use for later orders, You can change your address from addresses inside profile" — plus a **Manage saved addresses** link to `/account/addresses`.
- Saving validates the address fields first, then POSTs to `/api/addresses` (phone is taken from the customer phone field). Saving upserts by `street1`, so clicking Save again never duplicates.
- Pre-fill: the checkout page loads the signed-in user's default saved address (`listSavedAddresses` on the server) and passes it to `CheckoutPageClient` as `initialShippingAddress`; the address fields and the customer phone (taken from the saved address's phone) are pre-populated. Guests get empty fields.
- Saved addresses live in the existing Prisma `Address` model (`userId`, `label`, `street1/street2`, `city`/`province`/`country` enums, `postcode`, `phone`, `isDefault`).
- The profile **Addresses** page (`/account/addresses`) renders a client address book (`AddressBook`) with Add / Edit / Remove / Make-default, hosting the shared `AddressForm` in a dialog. City is locked to Karachi (disabled field); province/country/label are hidden for now but stored with their region defaults. The first saved address automatically becomes the default, and setting a default clears all others transactionally.
- Feature code: `src/features/addresses/` (types, `savedAddressInputSchema` validation, service CRUD, client fetch helpers, `AddressBook`/`AddressForm`/`AddressFormDialog` components).
- API routes: `GET|POST /api/addresses` (list / save-upsert) and `PATCH|DELETE /api/addresses/[addressId]` (update / remove; PATCH accepts a full address payload or `{ isDefault: true }` for make-default). Both are protected by `guardRouteHandlerAccess`; mutations also run the trusted-origin CSRF check.

## API

Route: `POST /api/checkout`

Server flow:

1. Trusted-origin check
2. Payload validation with Zod
3. Resolve cart context (guest/auth) with guest-token isolation (`userId=null` for guest lookup)
4. Place order transactionally with stock protection and snapshot persistence
5. Return order number, totals, payment message, confirmation URL, and invoice URL

Cart merge behavior during checkout context resolution:

- Guest-to-user merge is only attempted when the caller explicitly enables merge and both auth user + guest token context are present
- Merge is guest-scoped and does not use authenticated cart tokens as guest cart identifiers
- If no active guest cart exists for the token, checkout continues with the authenticated active cart without forced merge

### Cart quantity pre-check UX alignment

- Cart quantity controls normalize direct input on commit (blur/Enter): non-integer values are ignored (previous quantity kept), and out-of-range integers are clamped into `[1, effectiveMax]` before being committed; no inline validation errors are shown.
- Effective max in cart controls follows cart update constraints: `min(item.availableQuantity, 99)`.
- Checkout still enforces stock server-side inside order placement transactions; cart-side clamping is an early UX convenience only, not a security boundary.

Invoice route: `GET /api/orders/[orderNumber]/invoice`

Access rules:

- signed-in customers can access their own orders without a token
- guest customers use the confirmation token returned after checkout

## Account order history and re-order

- `/account/orders` now renders a signed-in user's recent orders with status badges, totals, detail links, invoice links, and a re-order action.
- `/account/orders/[orderNumber]` provides customer-visible order detail (items, shipping address, payment summary) plus invoice download and re-order controls.
- Re-order behavior is stock aware:
	- unavailable products are reported as unavailable and skipped
	- out-of-stock products are skipped with clear feedback
	- partially available products are added with adjusted quantity and a clear adjustment message
	- successful lines are added into the customer's active cart (creating one if needed)

## Admin order management

Admin order operations now live under `src/features/admin/orders` and are designed for non-technical staff.

Routes:

- `/admin/orders`: searchable order queue with status filtering and clear payment / customer summaries
- `/admin/orders/[orderNumber]`: order detail view with customer snapshot, delivery address, item breakdown, totals, audit history, invoice download, and internal notes

Role behavior:

- `SUPER_ADMIN` and `ORDER_MANAGER` can update fulfillment statuses and save internal notes
- `PRODUCT_MANAGER` can view orders in read-only mode for cross-team visibility

Audit and notes behavior:

- order status changes continue to persist `order.status.changed` entries in `AuditLog`
 - order status changes continue to persist `order.status.changed` entries in `AuditLog`
 - internal staff notes are stored in `Order.metadata.adminInternalNote` (this field holds only the latest internal staff note; it does not accumulate a list of past notes).
 - every save of `Order.metadata.adminInternalNote` also writes an `order.internal_note.updated` entry into `AuditLog` containing the previous and new values for historical records (see the `order.internal_note.updated` audit entries for the history of internal-note changes).
 - concurrent edits follow a last-write-wins model: the most recent successful save overwrites `Order.metadata.adminInternalNote`. Use `AuditLog` (the `order.internal_note.updated` entries) to inspect prior versions. The update of `Order.metadata.adminInternalNote` and the corresponding `order.internal_note.updated` audit entry are written together in a single database transaction so the metadata change and its audit record succeed or fail atomically.

## Next expansion path

Prompt 4.4 should add:

- email and Telegram notifications triggered from order events
- notification failure isolation around the placement service
- template-ready email payload builders that can use the stored order snapshot

### Future payment gateway integration

The payment abstraction is ready to accept online Pakistan gateways (JazzCash, EasyPaisa, HBL Omni).
See the provider registration steps in the **Payment abstraction** section above and the reserved codes in `constants.ts`.

When integrating the first online gateway also:
- Add a `PaymentTransaction` Prisma model (schema provided in `types.ts` JSDoc).
- Add `/api/webhooks/payments/[provider]` route with HMAC signature verification.
- Ensure the order service does NOT confirm an order until a verified `payment.captured` webhook is received.
- Store raw webhook payloads in `PaymentTransaction.webhookPayload` for audit / idempotent replay.
