# Cart Logic

This document describes the cart behavior introduced in Phase 4 / Prompt 4.1.

## Goals

- support guest and authenticated users with one consistent cart API
- support products with and without variants
- keep cart mutations stock-aware and transaction-safe
- keep UX resilient with loading, empty, and error states

## Data model usage

The Prisma schema already includes:

- `Cart` with optional `userId` and optional unique `token`
- `CartItem` linked to `Cart` and `ProductVariant`

How it is used now:

- Guest carts are resolved by `Cart.token` and persisted in an HTTP-only cookie (`party-heaven-cart`)
- Authenticated carts are resolved by `userId` + `status=ACTIVE`
- Guest cart token resolution is strictly guest-scoped (`userId=null`) so a token that belongs to an authenticated cart can never resolve into guest context
- ACTIVE carts are given a token so the frontend can keep continuity across guest/auth transitions; guest carts moving to `ABANDONED` have their token removed
- `CartItem.unitPrice` is kept as a snapshot at add/update time

## Guest to auth merge

When a signed-in user has a guest token cookie, cart resolution may perform a merge:

1. Load guest active cart by token (`userId=null`)
2. Resolve or create the user active cart
3. Merge line items by `productVariantId` across the guest and user carts, summing quantities; `cartId` scoping only applies to operations within a single cart
4. Clamp merged quantities to available stock
5. Mark guest cart as `ABANDONED`, null out token, remove guest line items

Merge runs inside a DB transaction to avoid partial state.

Merge guardrails:

- Merge only runs when `mergeGuestIntoUser` is explicitly enabled by the calling flow (cart/checkout context resolution)
- Merge only acts on a real guest cart (`token + userId=null + status=ACTIVE`)
- If the cookie token belongs to an authenticated cart or a non-active cart, merge is skipped
- After the guest cart is merged once, subsequent resolutions with the same stale token are no-ops because the guest cart token is removed during merge

## Add, update, remove API

Route: `src/app/api/cart/route.ts`

- `GET /api/cart` returns current cart summary for guest/auth context
- `POST /api/cart` adds by `productSlug` + optional `optionId` + optional `quantity`
- `PATCH /api/cart` updates `cartItemId` quantity
- `DELETE /api/cart` removes `cartItemId`

Mutation routes use trusted-origin CSRF checks via `assertTrustedRouteHandlerRequest()`.

## Variant and non-variant products

Cart mutations now resolve products from the live catalog database first:

- query product by slug with `status=PUBLISHED` and `category.status=PUBLISHED`
- resolve requested variant when `optionId` is provided
- otherwise select default variant (or first in-stock variant fallback)
- add cart line items directly against resolved `ProductVariant` rows

Legacy seed resolution is kept as a compatibility fallback only when a product
is not found in the database. In that fallback path, seed-backed upserts still
run to preserve local/dev behavior.

## Stock-aware validation

Stock is validated in two places:

- on mutations (add/update/merge), cart quantity cannot exceed available inventory
- before checkout via `validateCartStock()` helper and `GET /api/cart/validate`

`validateCartStock()` returns item-level issues (`requestedQuantity`, `availableQuantity`) and powers checkout gating on the cart page.

## UI surfaces

- PDP add-to-cart button now calls `POST /api/cart`
- PDP add-to-cart now conditionally switches between two states:
	- default CTA state: `Add to Cart` (or `Out of Stock`) when the active PDP variant is not in cart
	- in-cart state: `CartItemQuantityControls` when the active PDP variant is present in cart
- PDP in-cart state is variant-aware and keyed by (`productSlug`, `sku`) so switching selected variant on PDP reflects the correct in-cart line item.
- PDP in-cart state includes a cart icon + badge count using the same count source (`cart.itemCount`) pattern as header cart surfaces.
- PDP listens to global `cart:changed` events and reverts from quantity controls back to `Add to Cart` immediately when the active variant is removed or its quantity reaches zero.
- Cart page (`/cart`) now renders real line items and order summary
- Cart line items (drawer + cart page) show a product thumbnail on the left via `CartItemThumbnail` (`src/features/cart/components/cart-item-thumbnail.tsx`); it renders `next/image` when a safe URL exists, otherwise a placeholder, and links to the product page
- `CartItemSummary` carries `imageUrl`/`imageAlt` populated by the cart service (variant image first, then product image, both ordered by `position`; `null` when none exist)
- Header cart trigger (desktop) and mobile cart button both open the shared right-side cart drawer (shadcn `Drawer`) instead of the old mini-cart dropdown; the drawer contains line items with `CartItemQuantityControls` (adjust/remove) and a footer with subtotal, `View full cart`, and `Checkout`. The mobile-only bottom navigation bar (`src/components/layout/mobile-bottom-nav.tsx`) also opens the same drawer from its Cart action (with a live item-count badge).
- The homepage (`src/app/page.tsx`) lives OUTSIDE the `(storefront)` route group and duplicates the storefront shell (AppHeader/main/AppFooter), so it ALSO mounts `<CartDrawer />` and `<MobileBottomNav />` — without them the drawer state opens but no panel renders, and the mobile bottom nav is missing, until navigating to a `(storefront)` page
- Product card `Add to Cart` buttons (category grid, search results, related products, homepage featured-products/party-heaven carousels) call `POST /api/cart` with `productSlug` + quantity 1, then open the cart drawer; the PDP keeps its existing in-cart quantity-controls UX. No success toast is shown on add anywhere (silent add-to-cart).
- Homepage featured products prefer real catalog products (with slugs, so add-to-cart works) over placeholder fallback content — `resolveHomepageFeaturedProducts` backfills from recent published products BEFORE the CMS/fallback items
- The cart drawer refreshes from `GET /api/cart` when opened with no local cart data, and otherwise stays in sync via `cart:changed` events
- Header mobile cart button now shows the same total cart item count via shared client state
- Cart loading/error routes are implemented with dedicated states

### CartItemQuantityControls: Direct Input + Plus/Minus

The quantity control component (`src/features/cart/components/cart-item-quantity-controls.tsx`) supports both direct input editing and traditional plus/minus buttons:

- Quantity is displayed in an editable `<Input type="number">` field so users can type a value directly
- Plus and minus buttons remain functional alongside the input for quick adjustments
- Direct input normalizes on commit (blur/Enter); no inline validation errors are shown:
  - Must be a whole number; floats and any other non-integer values keep the previous quantity and are not committed
  - Negative integers (and `0`) are clamped up to `1` and committed
  - Effective allowed max is `min(availableQuantity, 99)` to align with server mutation rules; values above it are clamped down and committed
  - Input that equals the current quantity is not committed to avoid unnecessary API calls
- Commit paths:
  - Blur: triggers `commitDirectInput()` when user leaves the field
  - Enter key: validates and commits, then blurs to clear focus
  - Plus/Minus buttons: directly call `runMutation()` with the new quantity
- Post-mutation state always syncs from the server response (cart payload) via `dispatchCartChanged()` to ensure client and server truth align
- All mutations (input commit, plus, minus, remove) preserve existing optimistic UI and error recovery. Success mutations are **silent** (no success toast); failed mutations still show a user-friendly error toast.
- Server-side stock validation remains authoritative on `PATCH /api/cart`; client validation is a UX guardrail, not a security boundary

## Global cart count state

- `src/features/cart/cart-count-state.ts` is the client-side global state seam for cart item count.
- The state only stores derived count metadata (`itemCount`, loading, and user-safe error message) and does not duplicate full cart line-item truth.
- Initial synchronization happens via `GET /api/cart` with `cache: "no-store"`.
- Ongoing synchronization uses the existing `cart:changed` browser event:
	- when event detail includes a cart payload, count is updated immediately from `cart.itemCount`
	- when event detail is omitted, the state re-fetches from `/api/cart` as a safe fallback
- This keeps guest and authenticated behavior unchanged because `/api/cart` already resolves context using existing cookie/session rules.

## Persistence behavior

- Guests: cart token cookie persists for 30 days
- Auth users: active cart persists by user id, with guest cart merged only when explicitly requested by cart/checkout context rules
- Authenticated cart API responses keep the browser cookie tied to guest context, not user cart token, to prevent guest/auth cart leakage in the same browser session
- Sign-out rotates to a fresh guest cart token before clearing auth session so post-sign-out browsing starts with a clean guest cart context

This satisfies the expected flow:

- guest can add items
- quantity updates work
- cart persists across navigation and returning sessions
