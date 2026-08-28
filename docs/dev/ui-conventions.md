# UI Conventions

## Design System Foundations

- Global design tokens live in `src/app/globals.css` and cover semantic colors, spacing, radii, and shadows.
- Reusable primitives should prefer `src/components/ui/*` instead of page-specific styling.
- Use `PageContainer` and `PageShell` for consistent horizontal rhythm and section spacing.

## Theme and Feedback

- Theme selection supports `system`, `light`, and `dark` through `next-themes`.
- Default initial theme is `light` (via `ThemeProvider.defaultTheme`) for first-time visits before a stored preference is present.
- System-following behavior remains available through the `system` option and should continue to be treated as an explicit user preference.
- Shared frontend notifications should use `notify.*()` from `src/lib/notify.ts`.
- `notify.*()` supports typed Sonner option passthrough as a third argument when a feature needs scoped behaviors like custom duration or toast actions.
- Keep theme-dependent visuals tied to semantic tokens like `bg-card`, `text-muted-foreground`, and `border-border`.
- Current palette baseline:
	- Light theme anchor colors: `--background: #ffffff`, `--primary: #431b52`
	- Dark theme anchor colors: `--background: #000000`, `--primary: #431b52`
- Avoid hardcoded one-off hex values in feature components. Prefer semantic tokens so palette updates remain centralized and safe.
- Keep overlays, menus, and dialogs on semantic surfaces (`bg-popover`, `bg-card`) and preserve readable foreground contrast.

## Image Optimization Conventions (Next 16)

- Use `next/image` for storefront and admin content imagery. Keep raw `<img>` for test mocks only.
- Do not use `priority`; in this codebase's Next version it is deprecated. Prefer one of:
	- `loading="eager"` + `fetchPriority="high"` for true above-the-fold/LCP images (for example homepage hero and blog article cover).
	- default lazy behavior for card grids, carousels, thumbnails, and below-the-fold media.
- Match layout mode to container behavior:
	- Use `fill` only when the parent has stable dimensions/aspect and `position: relative`.
	- Use explicit `width`/`height` when intrinsic media dimensions are known.
- Always provide `sizes` for responsive images so browsers choose the right `srcset` candidate and avoid oversized downloads.
- Keep `quality` unset unless a surface has a measured fidelity requirement. Default optimization quality is preferred for general cards and editorial imagery.
- Alt text rules:
	- Meaningful images: provide descriptive alt text that can replace the image meaningfully.
	- Decorative-only images: use empty alt (`alt=""`) when appropriate.
- Preserve layout stability by keeping fixed/aspect-constrained media containers (`aspect-*`, fixed thumbnail dimensions) and maintaining graceful placeholder fallbacks when image URLs are absent or fail.

### Storefront Cart Feedback Conventions

- Cart mutations are **silent by default**: add, update (quantity), and remove actions do NOT show success toasts anywhere in the app. Visual feedback comes from the cart count badge, the updated line-item state, and the cart drawer opening.
- The PDP `ProductAddToCart` and storefront `ProductCardAddToCart` never show a success toast on add; the cart drawer opens instead.
- `CartItemQuantityControls` (drawer + cart page) never shows a success toast on quantity updates or removal.
- Error toasts are still shown on failed cart mutations (user-friendly messages via `toUserMessage`).
- The `buildAddToCartToastPayload` helper in `src/features/catalog/lib/add-to-cart-toast.ts` remains available (and tested) for any future surface that intentionally opts back into a success toast, but no current app surface uses it.
- Sonner CTA buttons must inherit shared app button variants through `AppToaster` (`actionButton`/`cancelButton` classNames) instead of relying on Sonner defaults, so toast actions stay theme-aware across light and dark modes.

## Surface Consistency Rules

- Forms should rely on shared input controls (`Input`, `Textarea`, `Select`) that bind to semantic classes (`bg-background`, `text-foreground`, `border-input`, `focus:ring-ring`).
	- Placeholder color: placeholders across `Input`/`Textarea` are standardized via the `--placeholder` token in `src/app/globals.css` and should be `#17171769`. Do not set placeholder colors directly in feature components; prefer the shared token so updates remain centralized.
- Cards and table containers should keep semantic surface classes and shared elevation tokens (`--shadow-soft`, `--shadow-elevated`) for consistent depth across desktop and mobile.
- Navigation surfaces (sidebar and mobile nav) should use semantic hover/active states (`bg-muted`, `bg-accent`, `bg-primary/*`) instead of custom ad-hoc colors.
- Admin workspace shell layout (`AdminShell`) and navigation sidebar (`Sidebar`) explicitly bind to `bg-background` to guarantee consistent theme-aware surface coloring across light and dark modes.
- Related products grid (`ProductRelatedGrid`) renders product card image previews directly via `backgroundImage: url(${product.imageUrl})` cover style for accurate visual representations.
- Confirmation and high-impact dialogs should keep backdrop contrast strong enough for readability while preserving focus and keyboard behavior.

### Numeric Input Patterns

- When a component accepts direct numeric input (e.g., quantity fields), use `<Input type="number">` with appropriate `min` and `max` attributes.
- Validation should happen locally before commit:
  - Parse input as an integer
  - Reject non-numeric values by reverting to the previous value on blur
  - Enforce minimum and maximum bounds by clamping to allowed range
  - Skip mutations when input equals the current value to avoid unnecessary API calls
- Commit input on:
  - Blur event (when user leaves the field)
  - Enter key (for keyboard-first workflows; blur after commit to clear focus)
- Include descriptive `aria-label` that mentions the valid range (e.g., "Quantity for Product Name. Minimum 1, maximum 10").
- After successful mutation, sync the display value from the server response to ensure client/server alignment.
- On error, revert the input to the previous value and show user-friendly error messaging.

## UI State Patterns

- Use `SectionHeader` for page and section intros.
- Use `PageErrorFallback` for route-level or page-level failures and `SectionErrorState` for isolated modules that should fail without collapsing the whole screen.
- Use `FormErrorSummary` for validation feedback above forms; prefer friendly user-safe copy from `toUserMessage()` / `getFormErrorMessages()`.
- Use `EmptyState`, `LoadingState`, and `InlineSpinner` for predictable empty and loading feedback.
- Use `Skeleton`, `CardSkeleton`, `PageSkeleton`, and `TableSkeleton` while content is loading.
- Use `ConfirmationDialog` for destructive or high-impact actions instead of browser-native confirm prompts.
- Use `PriceDisplay` and `Badge` instead of ad-hoc inline styling for storefront metadata.

### Currency display convention

- Always display prices with the `Rs.` symbol (see `formatPrice` in `src/lib/currency.ts`).
- Keep the ISO code `PKR` only for data values: the Prisma `Currency` enum, DB seed rows, analytics/GA4 + Meta Pixel event payloads, and schema.org `priceCurrency` fields.
- Never use `PKR` in user-facing labels, copy, or price strings.

### Search Command Dialog Pattern

- Storefront search is a shadcn `CommandDialog` (no separate page). It is mounted once in the storefront layout + root homepage and opened from the header via the shared `search-dialog-state` store.
- Use `shouldFilter={false}` on `CommandDialog` for server-backed live search so cmdk does not client-filter results.
- Result rows: product image on the left, product name with the price underneath on the right; image-less rows fall back to a deterministic gradient placeholder.
- Landing view (empty query) shows "Recent searches" + "Popular searches" groups; popular searches are desktop-only via CSS (`hidden md:block`). The landing groups hide as soon as a valid query is typed.
- Storefront search recent history should be local-first (browser-scoped), not server-coupled.
- Persist only meaningful text queries: trim and collapse repeated whitespace before storage. Record a query on Enter submit or result selection, not on every keystroke.
- Deduplicate recent items case-insensitively and keep most recent items first.
- Keep recent-history controls lightweight and explicit:
	- click item to reuse query
	- remove a single item
	- clear all items
- Always render an explicit empty state when no recent items exist.
- Storage failures (private mode, blocked storage, parse errors) must be non-fatal and shown as user-safe helper text; never block search result rendering.

## Accessibility Notes

- Keep semantic landmarks in place: `header`, `nav`, `main`, `section`, and `footer`.
- Preserve visible focus states and `aria-label` support on interactive controls.
- Error summaries and page fallbacks should keep `role="alert"` / `aria-live` semantics so assistive tech announces important failures clearly.
- Prefer server components by default; only use client components for interactivity like theme switching, toast triggers, and confirmation dialogs.

## SEO Semantic HTML Conventions

- Key storefront content pages should expose exactly one clear primary heading (`h1`) near the top of `main` content (for example category listing, blog listing, and blog detail routes).
- Use `SectionHeader.titleAs` and `SectionHeader.titleId` instead of ad-hoc heading markup when a page needs to promote a section intro to `h1`.
- Card collections that represent sets of categories, products, or articles should use list semantics (`ul` + `li`) even when styled as responsive grids.
- Prefer one canonical link target per card. Avoid duplicate links that point to the same destination from multiple nested card regions.
- Blog/article publication metadata should use `<time datetime="...">` when a published date is available.
- Keep landmark and list semantics compatible with current visual design; semantic upgrades should not regress interaction, keyboard navigation, or loading/empty/error states.

## Mobile Interaction Guardrails

- Keep root viewport standards-compliant through a typed `viewport` export from `src/app/layout.tsx` via shared config in `src/config/viewport.ts`.
- Do not disable pinch zoom globally (`maximumScale=1`, `userScalable=false`) unless there is a strict legal/device requirement; prefer accessibility-safe defaults.
- Shared text entry controls (`Input`, `Textarea`) should keep mobile-safe readable sizing (`text-base`) to avoid iOS focus zoom, while preserving desktop density with responsive classes (`md:text-sm`).
- Global styles in `src/app/globals.css` apply `touch-action: manipulation` on interactive controls (`a`, `button`, form controls, and role-button patterns) to reduce accidental double-tap zoom without locking page zoom.
- Global styles also enforce `font-size: 16px` for native mobile touch form controls on WebKit touch devices to prevent iOS auto-zoom on focus for controls not using shared `Input`/`Textarea` primitives.
- For app-shell navigation on mobile, prefer larger touch targets over denser rows (for example, sidebar inputs/menu controls should be at least 40px high on mobile where practical).
- Platform tradeoff note: browser pinch zoom remains enabled by design for accessibility. The guardrails primarily target accidental interaction zoom (double-tap/focus). Browser behavior can still vary by engine/version, so avoid relying on CSS-only prevention for strict kiosk-like lockouts.

### Mobile Collapsible Form Sections

- Long forms that appear below the fold on mobile (e.g. the product-page review form) should default to **collapsed** on mobile and **expanded** on desktop.
- Use `useIsMobile()` (`src/hooks/use-mobile.ts`) to detect the viewport at runtime. Initialize state as `true` (expanded) for SSR safety, then collapse once in a `useEffect` when `isMobile` becomes `true`, guarded by a `ref` so user overrides are not clobbered on re-renders.
- The toggle control must have `aria-expanded` on the button and `aria-controls` pointing to the collapsible body element's `id`.
- The product-page review form now uses the shared form stack (`useAppForm` + `DynamicForm` + `useServerActionSubmit`) while preserving the same field contract (`productId`, `returnTo`, `rating`, `title`, `body`) expected by `submitCustomerReviewAction`.
- For non-redirect success paths, reset behavior is standardized via `useServerActionSubmit(..., { onSuccess })` and `form.reset()` so stale values are cleared consistently; redirect-driven success still unmounts naturally.
- The pattern lives in `src/features/reviews/components/customer-review-form.tsx` and its tests in `tests/features/reviews/customer-review-form.test.tsx`.

## Storefront Navigation (Prompt 3.1)

- `AppHeader` now provides required storefront actions: logo, search trigger (opens the shared search command dialog), account, wishlist, and cart links.
- Desktop and mobile navigation share the same `siteConfig.storefrontNav` source to avoid duplicated link logic.
- Desktop storefront navigation renders live catalog categories directly in the navbar (capped by `NAVBAR_DIRECT_CATEGORY_LIMIT`) with `More` as the last navbar item. The `More` dropdown holds the remaining categories and always ends with `All Categories` linking to `/categories`.
- `Home`, `About`, `Blog`, and `Contact` live inside the shared `<UserMenu />` dropdown on desktop; the mobile drawer keeps them plus the full category list for touch-first navigation.
- Category ordering is deterministic and must remain: `One Dollar` first, published categories in alphabetical order next, and `All Categories` last (inside the `More` dropdown).
- Desktop uses accessible dropdown menus (`DropdownMenuTrigger` + keyboard navigation), while mobile keeps category links grouped inside the drawer for touch-first navigation.
- Mobile navigation behavior lives in `src/components/layout/storefront-mobile-nav.tsx` and must keep `aria-expanded`, `aria-controls`, and a labeled toggle button.
- `AppFooter` now has three sections: company links, policy links, and a newsletter placeholder block.
- A mobile-only fixed bottom navigation bar (`src/components/layout/mobile-bottom-nav.tsx`) provides the five primary storefront actions on touch devices: **Collections** (`/categories`), **Search** (opens the shared search command dialog), **Cart** (opens the shared cart drawer, with a live item-count badge), **Home** (`/`), and **Profile** (`/account/profile`).
  - It renders on mobile viewports only (`md:hidden`) and is mounted wherever the storefront shell lives: `src/app/(storefront)/layout.tsx` and the root homepage `src/app/page.tsx`.
  - Layout is icon-on-top, label-under-icon across five equal columns; active link routes get `aria-current="page"` highlighting.
  - The desktop `AppFooter` adds mobile bottom padding (`pb-24 md:pb-0`) so its content clears the fixed bar.
  - Keep z-index below the cart drawer / search dialog (`z-40` vs `z-50`) so overlays always appear above the bar.
- Static storefront placeholders live under `src/app/(storefront)` for `/about`, `/contact`, `/privacy`, `/terms`, `/shipping-policy`, and `/return-policy`.

### Production Placeholder Visibility Rule

- Development-only or incomplete storefront surfaces must use `shouldRenderGuardedSurface()` from `src/config/production-visibility.ts`.
- In production, guarded surfaces are hidden (or route handlers resolve to `notFound()` for placeholder-only pages).
- In development and test, guarded surfaces remain visible for QA and iteration.
- Do not hide complete, functional sections just because they are empty. Prefer neutral empty-state copy (for example, "No featured products yet") over "coming soon" placeholder language.

## Homepage Carousel Conventions

- All homepage sections that render categories or products must use a shared carousel pattern (Embla via `src/components/ui/carousel.tsx`) — **not** a static grid.
- Shared carousel configuration lives in `src/features/homepage/components/homepage-carousel-config.ts`.
- `HOMEPAGE_CAROUSEL_MAX_ITEMS = 8`: sections slice their data at 8 before passing to the carousel. Items beyond the cap are not rendered.
- `HOMEPAGE_CAROUSEL_ITEM_CLASS`: responsive basis classes that show 1 card on mobile up to 6 cards on `2xl` (≥ 1536 px). The full breakpoint ladder is: `basis-[85%] sm:basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5 2xl:basis-1/6`.
- Featured categories may use a section-specific item class when readability requires lower density on large screens. Current rule for `featured-categories`: keep shared behavior through `lg`, then clamp to 4-up on `xl`/`2xl` using `FEATURED_CATEGORIES_CAROUSEL_ITEM_CLASS = "basis-[85%] sm:basis-1/2 md:basis-1/3 lg:basis-1/4 xl:!basis-1/4 2xl:!basis-1/4"`.
- `HOMEPAGE_CAROUSEL_OPTIONS.align = "start"` so scroll position anchors to the left edge.
- Navigation buttons (`CarouselPrevious`, `CarouselNext`) must include `disabled:hidden` in their `className` so they disappear when scroll is no longer possible, rather than remaining as visible-but-disabled controls.
- Buttons are hidden on mobile (`hidden sm:flex`) and only appear on `sm+` viewports; swipe/drag is the primary mobile interaction.
- **View All button rules**:
  - Always shown when the data was capped (`totalItems > HOMEPAGE_CAROUSEL_MAX_ITEMS`).
  - Optionally shown when the section payload includes an explicit `viewAllHref` (even if no cap was reached).
  - For `one-dollar` sections the CTA is always rendered because those products link to the live One Dollar catalog page.
  - Falls back to the relevant route (e.g. `routes.storefront.categories`) when no explicit href is supplied by the section payload.
- Storefront-facing category and product cards must be fully clickable with one semantic wrapping `Link` per card. Do not place additional nested anchors or buttons inside those linked cards.
- Keep card headings and key metadata inside the same wrapping link so keyboard users and crawlers get a single coherent navigation target.
- Product cards render a compact, icon-only `Add to Cart` button (`ProductCardAddToCart`, `size="icon"` with a `ShoppingCart` icon) as a sibling of the wrapping link, positioned with `absolute` + `z-10` so the full card stays a single link while the button remains independently clickable. Never nest the button inside the link. The accessible label is `Add to cart: {name}` when available and `Out of stock: {name}` (disabled button) when not.
- Empty category/product payloads must render a user-safe `EmptyState` instead of a blank section or an empty carousel.

## Homepage Blog Highlights

- The homepage `blog-highlights` section was removed on 2026-08-18. The storefront no longer renders blog highlights on the homepage; `/blog` remains the single source of blog content and its own cards/lists follow the single-link-per-card rule below.
- Storefront blog cards (listing/detail surfaces) use one semantic wrapping `Link` per card so the full card is keyboard and pointer clickable. Do not nest additional anchors or buttons inside a linked card.

## Product Listing Conventions (Prompt 3.3)

- Category discovery lives at `/categories`, while individual listing pages live at `/categories/[slug]` for clean, SEO-friendly storefront URLs.
- `src/features/catalog/components/product-grid-card.tsx` is the reusable catalog card; keep product price, compare price, stock badge, and review summary placeholder logic there.
- Product and category overview card descriptions are clamped to three lines with `line-clamp-2` so long copy stays uniform across grids/carousels without forcing equal-height cards.
- Product card media is image-first: when `CatalogProductCard.imageUrl` is present and valid, render the image in the card media area using `next/image` with responsive `sizes` and fixed aspect-ratio container sizing.
- Product card media must gracefully fall back to the existing gradient placeholder treatment (`imageLabel` + `imageTone`) when no valid image URL is available or image loading fails.
- Keep product card media height stable (`aspect-[4/3]`) across image and fallback modes to avoid layout shift in listings and carousels.
- The card `Add to Cart` button is positioned at the bottom-right of the card body (`absolute right-3 bottom-3 z-10`) so it never overlaps price text; the card wrapper uses `relative h-full`.
- Listing filter UI should remain query-string-based, but it should now use the shared form layer for consistent labels, validation, and reset/apply actions.
- On mobile category pages, filter/sort controls should be exposed through a `Sheet` panel triggered by a clear `Filter and sort` button; desktop should keep the persistent sidebar card.
- Mobile and desktop filter surfaces must share the same filter contract and URL behavior (`buildCategoryListingHref`), including resetting pagination to page 1 on apply.
- Use the shared empty and loading primitives for listing states instead of bespoke skeleton or empty-state markup.
- Treat variant-aware attributes as an additive scaffold for now; future implementation should extend the current filter contract instead of replacing it.

## Admin UX Conventions

- Keep admin copy plain-language and operational (for example: "Order queue" or "Low stock overview") so non-technical operators can understand screens quickly.
- Admin routes should use one shared shell with four predictable surfaces: sidebar navigation, topbar, breadcrumb, and user menu.
- Sidebar navigation must be role-aware. Only show destinations the signed-in role can access, instead of showing disabled or dead-end links.
- Every admin page should start with the shared page header pattern (`AdminPageHeader`) for consistent title, summary, and optional actions.
- Use `AdminTablePattern` for record-first screens (orders, inventory) and `AdminListPattern` for timeline/log-first screens (activity, summaries).
- Prefer explicit empty/loading/error states over blank placeholders:
	- Empty: `EmptyState`
	- Loading: `LoadingState` + `TableSkeleton` where tabular data is expected
	- Error: `PageErrorFallback` for route-level failures and `SectionErrorState` for module-level failures
- Keep admin actions discoverable in the top-right area (theme toggle, storefront shortcut, user menu) and avoid hidden critical controls.
- Use the shared shadcn-style sidebar primitives in `src/components/ui/sidebar.tsx` (`SidebarProvider`, `Sidebar`, `SidebarInset`, `SidebarTrigger`) for app-level admin navigation shells. This keeps desktop collapse and mobile drawer behavior consistent across future admin modules.
- Keep role-aware rendering in feature-level nav modules (for example `getVisibleAdminNavigation`) and pass only visible links into sidebar UI components.
- If a role resolves to zero sidebar links, render a user-friendly empty sidebar status instead of a blank panel.
- For form-heavy admin list pages, do not mount every edit form by default. Use a lightweight per-record panel with an explicit edit toggle, and mount the full editor on demand.
- Demand-loaded admin editors should use dynamic imports for heavy client form modules to reduce initial route hydration cost.

## Form System Conventions

- Shared app-wide form abstractions now live in `src/components/forms` and should be preferred for new client-side forms.
- Start new forms with `useAppForm()` so Zod + React Hook Form defaults stay consistent and validation runs on change.
- Prefer `DynamicForm` / `SchemaForm` for standard CRUD and settings forms; drop down to explicit field composition only when layout or behavior truly needs it.
- Use `useServerActionSubmit()` when a client-side RHF form still needs to submit through a Next server action and redirect safely afterward.
- Do not swallow redirect-style server action responses inside client submit helpers. Let Next handle the navigation, and use the helper's optional success callback when a dialog or drawer form needs to close and reset after a non-redirect save.
- Field-level errors should render under the relevant control, while top-level validation summaries should use `FormErrorSummary` for broader feedback.
- Reuse the shared shadcn-style form primitives in `src/components/ui` (`Input`, `Textarea`, `Select`, `Checkbox`, `Switch`) instead of raw ad-hoc control markup.
- Current baseline: auth forms, checkout, admin category/product forms, and query-string filter forms should all follow this shared pattern.
- Keep form copy short, task-focused, and user-safe. Do not expose raw backend or schema internals in validation messages.

### Form Success Behavior Standard

Choose the correct success strategy based on where the form lives:

| Pattern | When to use | Mechanism |
|---|---|---|
| **Server-side redirect** | Form submits to a server action that always navigates away on success (admin CRUD, checkout) | `redirect()` in the action; form unmounts naturally — no `form.reset()` needed |
| **Success state + unmount** | Form stays on the same page but shows a distinct success UI that replaces the form | Conditional render (e.g., `if (formState === "success") return <SuccessUI />`) — form remounts fresh when the user wants to submit again |
| **Inline reset** | Form stays mounted after success and should clear for the next submission (e.g., future "add comment" forms) | Pass `resetOnSuccess` prop to `DynamicForm`/`SchemaForm`, or call `form.reset()` in the `onSubmit` callback |
| **`useActionState` + reset** | Form uses `useActionState` and needs to clear after the action signals success | `useEffect(() => { if (state?.success) form.reset(); }, [state, form])` |
| **Modal/sheet/drawer close** | Form is inside an overlay that must dismiss on success | Call `onClose()` / `setOpen(false)` inside `useServerActionSubmit`'s `onSuccess` callback, or in the `onSubmit` handler after awaiting the action |

**Rules:**
- Never leave a successfully-submitted form both mounted and filled — it confuses the user and invites accidental re-submission.
- Do not call `form.reset()` on error — the user needs to see and correct their input.
- If a form redirects on success (server action), skip all client-side reset/close logic; the navigation discards the component tree.
- For modal/sheet/drawer forms that save without redirecting, always close the overlay in the `onSuccess` callback of `useServerActionSubmit` and optionally reset the form.

Current production applications of this rule:
- `ForgotPasswordForm`, `SignUpForm`, and `ResetPasswordForm` use `useActionState` + `useEffect` reset on `state.success` to clear sensitive and stale values after successful submission.
- `CustomerReviewForm` resets on successful non-redirect callback and also guards against stale hydrated values after redirect-return notice codes.

Intentional no-reset exceptions:
- Query/filter forms keep user-entered values until explicit reset by the user.
- Redirect-first admin CRUD and checkout submissions do not add client reset logic because navigation naturally unmounts and clears form state.

## Shared Data Table Conventions

- Use the shared TanStack table system in `src/components/data-table` for all new tabular UIs in admin and storefront-support tooling.
- Start with `DataTable` and `createDataTableColumnHelper<T>()` from `@/components/data-table` to keep column typing consistent.
- Keep feature-specific search/filter controls outside the table and pass them into the `toolbar` prop so query/filter concerns stay modular.
- Use built-in state patterns instead of custom table placeholders:
	- loading: `loading` + optional `loadingRows`/`loadingColumns`
	- empty: `emptyState`
	- module error: `errorState` or `renderErrorState`
- Use `rowActions` for per-row controls (edit/delete/view) and avoid embedding action buttons directly into every feature table body.
- Keep pagination architecture table-driven:
	- local pagination works by default
	- server pagination can be wired by providing `pagination` (`state`, `onPaginationChange`, `pageCount`)
	- custom pagination UI can be injected via `renderPagination`
- For responsive behavior, keep wide tables inside the default horizontal overflow wrapper provided by `src/components/ui/table.tsx`.
- Keep column headers descriptive and plain-language so sorting labels remain accessible.
- Feature-specific table components should wrap the shared `DataTable` with typed columns, cell rendering, and feature-specific actions (see `AdminProductsTable`, `AdminCategoriesTable`, `AdminOrdersTable`, `AdminInventoryTable` for reference patterns).
- Current standard tables now use the shared system: admin products, categories, orders, and inventory. Not all UIs benefit from tabular display; keep card-based layouts for moderation workflows (admin reviews) and storefront experiences (customer order history, wishlist) where readability and action density favor non-table patterns.

## Product Content Entry Guidelines

- Titles should be shopper-facing and specific. Prefer names like "Daily Face Wash" or "Classic Tee" over internal codes.
- Slugs must stay lowercase with single hyphens only. Keep them stable after publishing for SEO consistency.
- Short descriptions should answer "What is this and why should someone buy it?" in one or two lines.
- Use the full description for benefits, usage instructions, size details, or care notes.
- For simple products, fill the standard SKU, price, and stock fields and leave the variant rows empty. All images are product-level and appear in the storefront gallery as before.
- For variant-based products, turn on the variant toggle and enter one row per sellable option combination with its own SKU, price, and stock.
- Variant titles should be human-friendly, such as "Small / Blue" or "500ml / Lemon".
- For variant products, attach each image to the variant it shows using the per-image "Variant" selector, or choose "All variants (shared)" for an image that applies to every variant. The storefront gallery shows the selected variant's images, and shoppers can switch variants by tapping a thumbnail.
- Specifications should use plain labels customers recognize, such as Material, Size, or Fragrance.
- Product, banner, blog cover, and SEO image URL fields should use the shared `AdminImageUploadInput` so admins can upload directly while still retaining manual URL entry.
- Keep image form payload contracts stable by persisting final uploaded values back into the same string URL fields already used by server actions.
- Add alt text for important images so listings remain accessible and easier to manage later.
- Keep SEO titles under 70 characters and SEO descriptions under 160 characters. Reuse the strongest shopper-facing language instead of keyword stuffing.

## Deferred Items

- Non-image file uploads, multi-step wizards, and async remote field validation are still intentionally deferred.
- Future features should compose the current primitives instead of duplicating layout and state styling.
