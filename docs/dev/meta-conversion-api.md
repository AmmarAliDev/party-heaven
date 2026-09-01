# Meta Conversion API (CAPI)

The **Meta Conversion API** is Meta's server-to-server event API. Events are
sent directly from our servers to Meta's Graph API (`graph.facebook.com`)
instead of (or in addition to) the browser-side Meta Pixel. This makes
conversion tracking reliable even when browser-side tracking is blocked by ad
blockers, privacy settings, or tracking protection.

The app **does not** call the Conversion API from the browser. All CAPI calls
are server-side, and the access token never leaves the server.

## Can CAPI be done through GTM? — Short answer

- **Client-side GTM cannot implement the Conversion API.** CAPI is a
  server-to-server API. A client GTM container can only run the browser Meta
  Pixel (which is already configured inside this app's GTM container).
- **GTM Server-Side container *can* forward to Meta CAPI**, but it requires a
  separate server container hosted on Cloud Run / App Engine / Heroku. This
  project deploys to Vercel only, so that extra hosting does not fit. The
  server-side CAPI is therefore implemented **in this app's own server code**,
  hosted on the same Vercel functions, which keeps the access token server-side
  and adds no extra infrastructure.

### GTM Server-Side container steps (for completeness / reference)

If you ever want the GTM-based path instead, the steps are:

1. Create a **Server-Side** GTM container (`tagmanager.google.com` → Admin →
   Create Container → Container type **Server**).
2. Deploy the server container to Cloud Run / App Engine / Heroku (not Vercel).
3. In the server container, add the **Conversion API Tag** (Meta CAPI tag
   template) using your Pixel ID and a server access token stored as container
   variables.
4. In the **web** container, forward events to the server container URL (e.g.
   via the "GA4/SGTM" or a Data Layer to server-side forwarding), then create
   triggers matching each event.
5. Configure `eventID` mapping in both the Pixel and CAPI tags for
   deduplication.

This repo instead implements the equivalent server-side sender directly, which
is simpler to operate and test on the existing Vercel deployment.

## Environment Setup

Add these **server-only** variables (never `NEXT_PUBLIC_`):

```env
# Meta Pixel ID (found in Meta Events Manager)
META_PIXEL_ID="123456789012345"

# Server-side access token generated in Events Manager → Settings → Conversion API
META_CAPI_ACCESS_TOKEN="EAAG..."

# Optional: "Test Events" code for validation (Events Manager → Test Events)
# META_CAPI_TEST_EVENT_CODE="TESTCODE123"

# Optional: Graph API version override (defaults to v21.0)
# META_CAPI_GRAPH_VERSION="v21.0"
```

- CAPI is enabled **only when both** `META_PIXEL_ID` and
  `META_CAPI_ACCESS_TOKEN` are set. If only one is set, the env schema throws a
  readable `CONFIG_ERROR`.
- If CAPI is not configured, everything degrades gracefully: order placement
  is unaffected, and the optional bridge route returns a no-op success.

## How it works

### 1. Server-side Purchase event (automatic)

When an order is placed (`placeOrderFromCheckout` in
`src/features/orders/service.ts`), the app fires a CAPI `Purchase` event after
the transaction commits:

- **Source of truth** — the event is built from the real order payload
  (customer email/phone/name, order lines, totals, order number), not from the
  browser.
- **Hashed PII** — email, phone, and name are SHA-256 hashed server-side
  (`src/features/analytics/meta-capi/hash.ts`) using Meta's normalization rules
  (lowercase email, digit-only phone, lowercase names). Raw PII is never sent
  and never logged.
- **Request context** — the `_fbp` / `_fbc` Meta Pixel cookies plus
  best-effort client IP / User-Agent are read server-side and included for
  matching.
- **Deduplication** — `event_id` is the unique order number. For the browser
  Pixel to deduplicate against it, the GTM Meta Pixel `Purchase` tag should set
  its **Event ID** from the dataLayer's `ecommerce.transaction_id` (the same
  order number). See [Deduplication](#deduplication).
- **Non-blocking** — failures are logged and never affect the placed order.

### 2. Optional client-to-server bridge (other events)

`POST /api/analytics/meta-capi` lets the store forward funnel events
(`ViewContent`, `AddToCart`, `InitiateCheckout`, `Search`, `AddToWishlist`,
`CompleteRegistration`, `PageView`) through CAPI if desired.

This endpoint is **not wired into the client by default** — enabling it for an
event that the Meta Pixel also fires will double-count unless you set a shared
`event_id` (deduplication). See [Deduplication](#deduplication) before enabling
it.

Security model:

- CSRF / trusted-origin enforced (same helper as checkout).
- Rate-limited per IP (60/min).
- **No PII is accepted from the client.** Identity comes only from the `_fbp` /
  `_fbc` cookies and request headers, both read server-side.
- Returns a no-op success when CAPI is not configured, so client callers never
  need to know about configuration.

## Event mapping

| CAPI event | Source | Trigger |
|---|---|---|
| `Purchase` | Server-side (automatic) | Order placed |
| `ViewContent` / `AddToCart` / `InitiateCheckout` / `Search` / `AddToWishlist` / `CompleteRegistration` / `PageView` | Optional bridge (`POST /api/analytics/meta-capi`) | Client integration (opt-in) |

All ecommerce amounts are in PKR main units. For `Purchase`, `value` is the
grand total (subtotal + shipping), matching the analytics "purchase" value
convention; `custom_data` also includes `subtotal`, `shipping`, and `status`
(payment method) for reporting.

## Deduplication

When the same event is sent by both the browser Pixel (via GTM) and CAPI, Meta
deduplicates them **only if the `event_id` matches**:

- **Purchase** — CAPI sends `event_id = orderNumber`. Set the GTM Meta Pixel
  `Purchase` tag's Event ID to the dataLayer variable for
  `ecommerce.transaction_id` so both use the same value.
- **Bridge events** — send the same `event_id` from the client that the Pixel
  tag uses for that event. If you don't set matching IDs, only enable the
  bridge for events the Pixel is not already firing.

## Code layout

```
src/features/analytics/meta-capi/
  types.ts      CAPI event model (event, user_data, custom_data, contents)
  hash.ts       PII normalization + SHA-256 hashing
  config.ts     env resolution + enabled check
  payload.ts    event builders (Purchase + supplemental)
  sender.ts     HTTP POST to graph.facebook.com (never throws)
  purchase.ts   server-side Purchase orchestrator (reads cookies/headers)
  index.ts      barrel — server-only, keep out of the client analytics barrel
src/app/api/analytics/meta-capi/route.ts   optional client bridge (guarded)
```

> Note: `src/features/analytics/meta-capi` is server-only and must **not** be
> re-exported from the client-facing `src/features/analytics` barrel (it uses
> `node:crypto` / `next/headers`).

## How to test

1. **Meta Events Manager → Test Events** — set `META_CAPI_TEST_EVENT_CODE` from
   Events Manager (Settings → Test Events) and place a test order. Events
   should appear in the test view with the CAPI/Server badge.
2. **Events Manager → Data Sources → Pixel → Activity** — confirm real
   `Purchase` events land with the order number as the event ID.
3. **`_fbp` matching** — after a normal browse, a purchase should show a
   matched user (`_fbp` cookie is included server-side).
4. **Failure resilience** — with an invalid token, order placement still
   succeeds; the failure is only logged by the `analytics.meta-capi` logger.
5. **Unit tests** — `tests/features/analytics/meta-capi/*` cover hashing,
   payload building, sender, config, and the purchase orchestrator; the orders
   service test asserts the Purchase event fires after order placement.

## Deferred / notes

- No CAPI forwarding is enabled for non-Purchase events by default; enabling
  them requires setting matching `event_id`s for deduplication (documented
  above).
- `login` is intentionally not tracked (same as the browser analytics layer).
- Online payment gateway webhook purchases (future) should reuse
  `sendMetaCapiEvents` with the same `Purchase` builder once a
  `PaymentTransaction` model exists.
