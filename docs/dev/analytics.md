# Analytics Setup

All client-side analytics flow through a **single pipeline: Google Tag Manager (GTM)**. GA4 and Meta Pixel are configured **inside the GTM container** — the app does **not** load or call GA4 / Meta Pixel directly anymore. The code only pushes GA4-standard events onto the GTM `dataLayer`; GTM forwards them to GA4 and Meta.

## Environment Setup

```env
# Google Tag Manager container ID
NEXT_PUBLIC_GTM_ID="GTM-XXXXXXX"
```

- GTM is loaded in the root layout via `@next/third-parties` (`GoogleTagManager`) whenever `NEXT_PUBLIC_GTM_ID` is set.
- `NEXT_PUBLIC_GA_ID` and `NEXT_PUBLIC_META_PIXEL_ID` were **removed** — GA4/Meta are no longer installed directly.
- If `NEXT_PUBLIC_GTM_ID` is missing, no tracking scripts load and nothing forwards events (the dataLayer receives events harmlessly, but no tags listen).

## How it works

1. Client components call the unified dispatcher `trackEvent(...)` from `src/features/analytics`.
2. The dispatcher pushes a GA4-standard event to the GTM `dataLayer` via `sendGTMEvent`.
3. Inside GTM, tags with matching triggers forward each event:
   - **GA4** — a GA4 Event tag (same Measurement ID) with a Custom Event trigger per event name.
   - **Meta Pixel** — a Meta Pixel tag whose event name is mapped to Meta's standard event (e.g. `view_item` → `ViewContent`) and reads parameters from the dataLayer.

> Because every event uses GA4 naming (`view_item`, `add_to_cart`, …), the GTM **Meta Pixel tag must map event names** to Meta's standard events (`ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase`, …) and read `content_ids` / `value` / `currency` from the dataLayer.

## Events

### Core funnel (was already tracked)

| Code event | GA4 name | Meta name | Fired when |
|---|---|---|---|
| `PAGE_VIEW` | `page_view` | `PageView` | SPA route changes (the GTM container's own page-view trigger handles initial load) |
| `PRODUCT_VIEW` | `view_item` | `ViewContent` | Product detail page mount |
| `ADD_TO_CART` | `add_to_cart` | `AddToCart` | Add to cart (PDP, product cards, deals) |
| `BEGIN_CHECKOUT` | `begin_checkout` | `InitiateCheckout` | Checkout page mount with a non-empty cart |
| `PURCHASE` | `purchase` | `Purchase` | Order confirmation page mount |

### Added (2026-09-01)

| Code event | GA4 name | Meta name | Fired when |
|---|---|---|---|
| `VIEW_ITEM_LIST` | `view_item_list` | `ViewContent` | Category listing grid, search results |
| `SELECT_ITEM` | `select_item` | `ViewContent` | Clicking a product card (category grid, related products, search results) |
| `VIEW_CART` | `view_cart` | — | Cart drawer opens / cart page loads |
| `REMOVE_FROM_CART` | `remove_from_cart` | — | Removing an item in the cart |
| `ADD_TO_WISHLIST` | `add_to_wishlist` | `AddToWishlist` | Saving a product or deal to the wishlist |
| `SEARCH` | `search` | `Search` | Search dialog submit / result selection |
| `SIGN_UP` | `sign_up` | `CompleteRegistration` | Successful account registration |

## Payload notes

- All ecommerce payloads use the GA4 `ecommerce` schema (`items[]` with `item_id`, `item_name`, `price`, `item_category`, `quantity`).
- Meta-only mapping: `view_item_list` / `select_item` / `view_item` → `ViewContent`; `add_to_cart` → `AddToCart`; `begin_checkout` → `InitiateCheckout`; `purchase` → `Purchase`; `add_to_wishlist` → `AddToWishlist`; `search` → `Search`; `sign_up` → `CompleteRegistration`.
- `login` is intentionally **not** tracked yet: sign-in redirects server-side, so there is no clean client-side success hook. Add it later via a post-login page or a `login` push before the redirect if needed.

## Page View Tracking

The `PageViewTracker` component skips tracking on initial mount to avoid duplicating the page view fired by the GTM container's page-view trigger. It only fires `PAGE_VIEW` events for subsequent SPA route changes.

## Purchase Event Value Convention

For the `PURCHASE` event, the `value` field represents the **grand total** (subtotal + tax + shipping). The optional `tax` and `shipping` fields provide breakdown details for reporting but are already included in the total `value`.

## CSP note

The global CSP in `src/config/security.ts` allowlists `https://www.googletagmanager.com` (GTM loader) **and** `https://connect.facebook.net` (Meta Pixel loader injected by GTM) in `script-src` whenever `NEXT_PUBLIC_GTM_ID` is set. Note that the Meta Pixel sets a 3rd-party `fr` cookie, which can slightly lower a Lighthouse "Best Practices" score.

## Meta Conversion API (CAPI)

On top of the browser-side GTM pipeline, the app can send **server-side** Meta
Conversion API events. This is a separate, server-to-server channel (access
token stays server-side) used for reliable conversion tracking.

- **Purchase** is fired automatically, server-side, when an order is placed
  (non-blocking; failures never affect the order).
- **Other events** (`ViewContent`, `AddToCart`, `InitiateCheckout`, `Search`,
  `AddToWishlist`, `CompleteRegistration`, `PageView`) can optionally be sent
  through the guarded bridge route `POST /api/analytics/meta-capi` (opt-in).
- Enabled with `META_PIXEL_ID` + `META_CAPI_ACCESS_TOKEN`; no-op otherwise.

See **`docs/dev/meta-conversion-api.md`** for setup, event mapping,
deduplication (`event_id` vs. the Pixel), and testing.

## How to Test

1. **GTM Preview** — open GTM → Preview, navigate the store, and confirm each event appears in the dataLayer:
   - open a category → `view_item_list`; click a product → `select_item` then `view_item`
   - add to cart → `add_to_cart`; open the cart → `view_cart`; remove an item → `remove_from_cart`
   - search → `search`; save to wishlist → `add_to_wishlist`
   - start checkout → `begin_checkout`; complete an order → `purchase`; register → `sign_up`
2. **GA4 DebugView** — confirm GA4 receives the same events (after your GA4 event tags/triggers are set up in GTM).
3. **Meta Pixel Helper** — confirm Meta standard events fire (after your Meta tags map the event names).
4. **Local development** — with no `NEXT_PUBLIC_GTM_ID`, no tracking scripts load and the app runs exactly as before.
