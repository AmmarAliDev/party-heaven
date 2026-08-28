# Architecture Notes

## Table of Contents

1. [Goal](#goal)
2. [Layering Pattern](#layering-pattern)
3. [Mobile-Readiness Boundary Rule](#mobile-readiness-boundary-rule)
4. [Database Access Strategy](#database-access-strategy)
5. [Route Groups](#route-groups)
6. [UI Foundation Strategy](#ui-foundation-strategy)
7. [Shared Table Strategy](#shared-table-strategy)
8. [Config and Environment Strategy](#config-and-environment-strategy)
9. [RBAC Foundation Strategy](#rbac-foundation-strategy)
10. [Catalog Data Strategy](#catalog-data-strategy)
11. [Blog Data Strategy](#blog-data-strategy)
12. [Cache Strategy](#cache-strategy)
13. [Search Strategy](#search-strategy)
14. [Error Handling Strategy](#error-handling-strategy)
15. [Analytics Strategy](#analytics-strategy)
16. [Admin Form Performance Strategy](#admin-form-performance-strategy)

---

## Goal

Create a scalable foundation for a single-vendor e-commerce app using one shared codebase for storefront, admin, and auth experiences.

## Layering Pattern

1. **`src/app`** — routing, layouts, metadata, boundaries
2. **`src/components`** — shared UI and layout primitives
3. **`src/features`** — future business modules (catalog, cart, checkout, admin tools)
4. **`src/server`** — future repositories, services, auth, and integrations
5. **`src/config`** — app-wide constants, env validation, and safe config loading
6. **`src/lib`** — low-level helpers and shared error utilities

## Mobile-Readiness Boundary Rule

- Keep UI components thin and route all business operations through feature services and typed feature contracts so future mobile clients can reuse the same behavior.
- Route handlers in `src/app/api/*` are the transport seam; they should validate and delegate instead of embedding domain logic.
- Feature-owned transport helpers (for example checkout submit in `src/features/checkout/client.ts`) should centralize API parsing and user-safe error normalization.
- See `docs/dev/mobile-readiness.md` for the current boundary map and deferred items.

## Database Access Strategy

- `src/server/db/client.ts` owns the lazy Prisma singleton for Next.js server execution.
- `src/server/db/repository.ts` standardizes how repositories and services receive a `db` executor.
- `src/server/db/transaction.ts` provides shared transaction helpers so nested services can reuse an open transaction instead of opening another one.
- `src/server/db/pagination.ts` and `src/server/db/query-result.ts` keep list and result contracts consistent across feature modules.
- `src/lib/prisma.ts` remains only as a compatibility re-export and should not grow new logic.

## Route Groups

- `(storefront)` now uses a polished shared shell via `AppHeader` + `AppFooter` + `MobileBottomNav` (mobile-only fixed bottom bar with Collections / Search / Cart / Home / Profile)
- `(storefront)/categories` provides category discovery and listing routes through clean slugs (`/categories/[slug]`)
- `(storefront)/categories/[slug]/[productSlug]` now provides PDP rendering with gallery, variant interactions, specifications, reviews, and related products
- `(storefront)/wishlist` now renders authenticated wishlist entries and guest sign-in prompts
- `(storefront)/account/*` now provides customer account routes for profile, addresses, order history, order detail, and reviews
- `(storefront)` now uses the shared `SignOutButton` convention for authenticated logout controls across the header dropdown, mobile drawer, and account profile surface; the button is client-enhanced to call Auth.js client `signOut()` after server-side sign-out preparation so `useSession`-driven header controls switch to signed-out state immediately without a manual reload
- `(admin)` now uses `AdminShell` with a responsive sidebar, topbar, breadcrumb, and user menu, plus the same form-based sign-out pattern and role-aware navigation filtering protected by the RBAC proxy/layout guards
- Admin navigation UI is standardized through shared shadcn-style sidebar primitives in `src/components/ui/sidebar.tsx`; `AdminShell` composes these primitives while `src/features/admin/navigation.ts` remains the source of truth for permission-aware link visibility.
- `(admin)/admin` dashboard now reads live operational metrics through `src/features/admin/dashboard/service.ts` (pending orders, delivered-order revenue summary, low-stock count, and recent audit activity preview)
- `(admin)/admin/activity` now reads a dedicated AuditLog-backed feed through `src/features/admin/activity/service.ts`, with non-technical event summaries and actor context when available
- `(admin)/admin/revenue` now reads a dedicated DB-backed report through `src/features/admin/revenue/service.ts`, showing recognized revenue, recent period summaries, order totals, and explicit inclusion assumptions
- `(admin)/admin/categories` now provides category CRUD with shared typed create/edit/filter forms and SEO field controls
- Category deletion now detaches linked products (`Product.categoryId -> null`) before removing the category, so catalog admins can clean up obsolete categories without a manual reassignment pass.
- Admin category create/edit now includes a dedicated category card image field wired to the shared admin upload foundation (`purpose: category`), persisting a URL into `Category.cardImageUrl`.
- `(admin)/admin/products` now provides product CRUD with reusable RHF + Zod form composition for simple and variant-based catalog entries
- Admin products now support destructive delete from list/edit surfaces, and variant-row removal during product updates clears dependent cart/wishlist rows before deleting removed variants to avoid relational-save failures.
- `(admin)/admin/blog` now provides blog post CRUD with structured content JSON, publish scheduling, and SEO controls
- `(admin)/admin/inventory` now supports low-stock monitoring plus inline manual stock adjustments for authorized catalog admins
- `(admin)/admin/settings` now provides practical store settings management (identity, support contacts, shipping basics, and operational defaults) backed by a singleton persistence record and CSRF/RBAC-protected server action writes
- `(auth)` now uses the same shared form foundation for sign-in and sign-up while preserving the existing server-action flows
- `(auth)` now performs server-side authenticated-user entry-page redirects for `/auth/sign-in` and `/auth/sign-up` to `/account/profile`; token/error recovery routes (`/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, `/auth/error`) remain intentionally accessible for valid recovery and callback scenarios

## UI Foundation Strategy

- Global design tokens live in `src/app/globals.css` and define semantic colors, spacing rhythm, radii, and shadow presets.
- `src/components/ui` now contains reusable UI-state and presentation primitives like `Badge`, `PriceDisplay`, `SectionHeader`, `EmptyState`, `LoadingState`, `ErrorState`, `Skeleton`, and shared form controls (`Input`, `Textarea`, `Select`, `Checkbox`, `Switch`).
- Storefront category filtering uses a responsive composition in `src/features/catalog/components/category-listing-filters.tsx`: mobile uses shadcn `Sheet` with explicit open/close controls, while desktop keeps the existing sticky sidebar card.
- `src/components/forms` is the app-wide client form seam. It combines React Hook Form, Zod, shared field renderers, and a small server-action submit bridge so feature modules can choose schema-driven forms or explicit composition without duplicating validation wiring. `DynamicForm` and `SchemaForm` support a `resetOnSuccess` prop; forms that redirect on success via server action do not need it — navigation discards the component tree automatically. Forms using `useActionState` that must clear after success should call `form.reset()` inside a `useEffect` keyed on the success flag.
- Current reset-after-success baseline: `ForgotPasswordForm`, `SignUpForm`, and `ResetPasswordForm` clear form state via success-keyed `useEffect` resets, while redirect-first admin CRUD/checkout and filter/search forms intentionally retain their existing behavior.
- `src/features/admin/uploads` is the shared admin/content media-upload seam. It owns client upload orchestration, file validation, provider abstraction, and the reusable image-upload input used by product image rows, banner, blog, and SEO image fields.
- The upload UI keeps current data-model assumptions intact by writing the final public image URL back into the same string fields already used by product, category, blog, banner, and SEO flows.
- `PageContainer` and `PageShell` should be reused for page spacing instead of duplicating wrapper classes.
- Shared section intros now support explicit heading levels through `SectionHeader.titleAs`/`titleId` so route pages can declare a clear primary `h1` while nested modules continue using lower heading levels.
- Shared frontend feedback uses `sonner` through `src/components/providers/app-toaster.tsx` and `src/lib/notify.ts`.
- Storefront image rendering is standardized on `next/image` with a surface-based loading policy: only true above-the-fold media uses eager/high fetch priority, while cards/carousels/thumbnails remain lazy; responsive surfaces must provide explicit `sizes` so image candidates match actual card widths and reduce transfer cost.
- Catalog listing UI lives in `src/features/catalog/components`; keep product-grid and filter scaffolds there instead of placing listing-specific markup directly in route files.
- PDP UI also lives in `src/features/catalog/components` (gallery, product panel, variants, specs, reviews, related products, and skeleton states); route files should compose these primitives instead of duplicating product-detail markup.
- PDP variant images: for variant products each `ProductImage` can be linked to a specific variant (`productVariantId`) or left product-level (shared). `src/features/catalog/components/product-overview.tsx` is the client wrapper that owns the PDP variant-selection state and keeps `ProductImageGallery` + `ProductPanel` in sync: tapping a variant-specific thumbnail also selects that variant, and changing the variant in the picker switches the gallery to that variant's images. `getProductBySlug` tags each mapped image with `variantId`/`variantLabel` so the gallery can group and label thumbnails by variant.
- Product images are stored via `ProductImage` (`productId` and/or `productVariantId`, enforced by a DB CHECK constraint). The admin product form shows a per-image variant selector when variant mode is enabled; simple products keep product-level images. Cart thumbnails and homepage cards prefer variant images when no product-level image exists.
- Detail-page and listing image loading: Prisma's `Product.images` relation only returns product-level rows (`productId` set). Variant-level images (`productVariantId` set) are fetched separately and merged into the record: the detail query (`_getPublishedProductBySlugImpl` in `src/server/db/catalog-queries.ts`) does this for a single product, and `mergeVariantImagesIntoProducts` batches the same merge across all listing queries (`listPublishedProductsByCategory`, `listAllPublishedProducts`, `getRelatedPublishedProducts`, `listPublishedProductsByIds`, `searchPublishedProducts`) so product cards, search results, related products, and homepage sections show the real variant cover instead of the placeholder. Merged variant images are ordered by variant order (default variant first, then `position`), and `mapProductToCard` passes that same variant order to the image mapper, so the DEFAULT variant's image is used as the card cover when no product-level image exists. The admin edit form (`getAdminProductById` in `src/features/admin/products/service.ts`) applies the same merge so variant images reappear when editing a product.
- Variant groups without options: `buildVariantGroups` (in `src/features/catalog/service.ts`) groups variants under a generic `Variant` picker group using the variant title when a variant has no `options` JSON, so the storefront picker (and variant-specific images) still work for legacy products whose admin never filled the options field.
- Storefront image host allowlist: `src/config/image-hosts.ts` is the single source of truth for hosts `next/image` is allowed to render (Vercel Blob, placehold.co, picsum.photos). `next.config.ts` maps it into `images.remotePatterns`, and `normalizeCatalogImageUrl` rejects unconfigured hosts so product/category/homepage images fall back to the placeholder instead of crashing the page with a next/image "unconfigured host" error.
- Desktop storefront navigation in `AppHeader` renders live catalog categories directly in the navbar (capped by `NAVBAR_DIRECT_CATEGORY_LIMIT`) plus a `More` dropdown as the last navbar item. The `More` dropdown holds the remaining categories and always ends with `All Categories` linking to `/categories`. The split is produced by `buildStorefrontNavbarCategoryMenu`, which reuses the canonical `buildStorefrontCategoryMenu` ordering so the navigation contract stays explicit and testable.
- `Home`, `About`, `Blog`, and `Contact` no longer render as standalone desktop navbar links; they now live inside the shared `<UserMenu />` dropdown (`StorefrontHeaderAuthControls` → `UserMenu`). The mobile drawer keeps them alongside the full category list so mobile behavior is preserved.
- The category menu contract is stable: `One Dollar` pinned first, other categories sorted by name, and `All Categories` pinned last (in the `More` dropdown) to preserve SEO-friendly listing discoverability at `/categories`.
- Header category load failures are non-fatal: errors are logged server-side, and both desktop/mobile navigation continue rendering with user-safe fallback messaging.
- Customer account shell UI lives in `src/features/account/components/account-shell.tsx` and should be reused for future account sections.
- Wishlist client controls live in `src/features/wishlist/components` and call the dedicated wishlist API route.
- PDP cart interaction is state-driven in `src/features/catalog/components/product-add-to-cart.tsx`: the component subscribes to `cart:changed` and maintains local cart-summary truth for the currently viewed item, then switches UI between add CTA and `CartItemQuantityControls` based on a variant-aware cart-line match (`productSlug` + `sku`).
- PDP cart badge/count rendering intentionally reuses the same cart-summary derived count semantics as header cart surfaces (`cart.itemCount`) to keep user-visible cart totals synchronized across page-local and global cart UI.
- PDP in-cart "view cart" affordance is intentionally icon-first; accessible labeling comes from the sr-only cart-count text (for example `1 item in cart`) rather than a visible `In cart` caption.

## Shared Table Strategy

- `src/components/data-table` is the shared abstraction for reusable, typed TanStack-powered tables.
- `data-table.tsx` is the composable UI layer that integrates app-standard loading, empty, and error-compatible states with shadcn-style table wrappers.
- `use-data-table.ts` centralizes TanStack state wiring (sorting, global filter seam, and pagination-ready behavior) so feature modules avoid repeated table plumbing.
- `types.ts` defines stable shared contracts (`DataTablePaginationOptions`, empty/error state shapes) that make future feature integrations predictable.
- `src/components/ui/table.tsx` provides the low-level table primitives for consistent styling and responsive overflow behavior.
- Integration seams:
	- search/filter: feature-owned controls passed through `toolbar`
	- row actions: `rowActions(row)` slot
	- pagination: local by default, server-ready through controlled `pagination`
	- error handling: `errorState` or custom `renderErrorState`
- **Standardized tables in production:**
	- `src/features/admin/products/components/admin-products-table.tsx` — admin product listing with status, category, pricing, stock, and SEO display
	- `src/features/admin/categories/components/admin-categories-table.tsx` — admin category listing with status, SEO, and edit/delete actions
	- `src/features/admin/orders/components/admin-orders-table.tsx` — admin order queue with customer, status, payment, and total display; preserves pagination
	- `src/features/admin/inventory/components/admin-inventory-table.tsx` — low-stock alert listing with product, SKU, on-hand, safety threshold, location, and permission-aware inline adjustment controls
- All feature-specific table components follow the pattern: typed columns definition, cell rendering logic with feature-specific formatting (badges, links, price displays), row actions/callbacks, and integration with the shared `DataTable` component.
- **Tables intentionally not migrated:** admin review moderation (kept as card-based UI for better moderation workflow) and storefront order history (kept as cards for customer-facing readability).

## Migration Pattern for Feature Tables

- Define typed columns using `createDataTableColumnHelper<T>()` in a dedicated feature table component file
- Keep columns definition stable and exported for possible reuse or testing
- Implement cell rendering inline with feature-specific formatting (badges, status variants, links, price displays)
- Pass row actions through the table component, not inline in cells
- Wrap the shared `DataTable` component in a feature-specific component that accepts only the data and optional override messages
- Keep feature-specific filtering/searching controls outside the table; they feed into the shared table through existing page-level state management
- Preserve existing business logic: all filters, sorting, pagination, permissions, and row action handlers stay in the feature module

## Config and Environment Strategy

- `src/config/env.ts` validates public env input with a typed schema and throws readable `CONFIG_ERROR` messages.
- `src/config/app-config.ts` builds a safe application config snapshot for future server and feature modules.
- `src/config/feature-flags.ts` derives preview flags from validated env values instead of raw `process.env` access.
- `src/config/production-visibility.ts` is the centralized guard map for development-only preview/placeholder surfaces. Any customer-facing placeholder or incomplete shell should be wired through `shouldRenderGuardedSurface()` instead of scattered `NODE_ENV` checks.
- Admin image uploads currently use a server-side Vercel Blob integration behind `createAdminImageStorageProvider()`. The provider can be replaced later without rewriting form integrations because forms only depend on the shared upload route and final URL contract.
- `BLOB_READ_WRITE_TOKEN` is the only required secret for the current upload provider. When it is missing, the upload route returns a user-safe configuration message instead of a raw storage error.
- Admin-managed homepage `deal-spotlight` section images are validated against safe storefront image URL patterns (root-relative paths or configured hosts) so optional marketing media cannot break homepage rendering.
- The homepage no longer includes `hero-banner` or `blog-highlights` sections. Both section kinds were removed from the homepage type system, resolver order, fallback content, section registry/components, and admin homepage section management (validation, seeding, storefront mapping, and section form guidance). Existing DB records of those types are skipped safely and logged during storefront mapping, and `/blog` remains the single source of blog content.
- Homepage resolver composition is additive by section kind: enabled CMS sections are always included, fallback fills only kinds not configured in CMS, and explicitly configured-but-disabled kinds are not reintroduced from fallback.
- Admin homepage banners now support explicit deletion via a CSRF/RBAC-protected server action (`deleteAdminBannerAction`) with confirmation UX in `/admin/homepage/banners`, path revalidation, and audit-log persistence (`homepage.banner.deleted`).
- Admin homepage sections now support explicit deletion for all section types in `/admin/homepage/sections` through `deleteAdminHomepageSectionAction` (`homepage.section.deleted`) with confirmation UX, path revalidation, and audit-log persistence.
- Campaign-generated spotlight overlays can be removed from `/admin/homepage/campaigns` through `deleteAdminDealCampaignAction` (`homepage.campaign.deleted`).
- Campaign-generated deal spotlights now support optional explicit `targetHref` and `imageUrl`/`imageAlt` fields in the admin campaign flow. Validation enforces safe link/image formats and requires alt text when image URL is set; storefront mapping falls back to linked campaign-product URL/image when these optional fields are absent.
- Campaign-generated deal spotlight pricing is now DB-backed from the first linked campaign product variant (`price` + optional `compareAtPrice`) and no longer uses inline hardcoded mapper defaults. When linked variant pricing is missing, storefront mapping falls back to the canonical homepage fallback deal pricing so rendering remains stable.
- Spotlight CTA rendering is safety-aware: relative URLs use standard internal navigation, external URLs open with `noopener noreferrer`, and malformed legacy hrefs degrade to a non-clickable CTA state.
- Storefront banner mapping is defensive for legacy data quality: empty banner titles are skipped and invalid banner href values are omitted, preventing malformed admin records from breaking homepage rendering.
- Resolver composition avoids duplicate deal spotlights by omitting fallback `deal-spotlight` when an active campaign overlay is present.
- Homepage fallback preview-only artifacts should be gated by validated runtime env (`env.nodeEnv !== "production"`) so development helpers never leak into production storefront UI.
- Guard behavior is intentionally conservative:
	- `production`: guarded surfaces are hidden from customers.
	- `development` and `test`: guarded surfaces stay visible for staging/debug workflows.
- Current guarded surfaces include: homepage fallback indicator, `/preview` route, footer preview/newsletter placeholder artifacts, return-policy placeholder route, interim about-page note, and not-found admin placeholder action.
- Storefront homepage `featured-categories` is rendered through the shared shadcn-compatible carousel primitives and is now hydrated from live Prisma-backed catalog categories while preserving the existing section registry architecture (`renderHomepageSection` + typed section contracts).
- `getRequiredServerEnv()` should be used when a future integration needs a non-public secret at runtime.
- `DATABASE_URL` must be available anywhere Prisma queries or CLI workflows run.
- Prisma CLI commands are routed through `scripts/prisma-cli.mjs`, which respects local env files, falls back `POSTGRES_URL_NON_POOLING` to `DATABASE_URL` for local use, blocks obvious hosted `migrate dev` mistakes, and validates hosted `migrate deploy` URL safety (pooled vs direct URL separation).
- The build workflow is intentionally split: `pnpm build` stays local-safe, while `pnpm build:deploy` is the deploy-time path that runs `prisma migrate deploy` before the production build.
- `scripts/guard-deploy-workflow.mjs` prevents accidental local `build:deploy` runs unless explicitly allowed (`PRISMA_ALLOW_LOCAL_DEPLOY_BUILD=true`) or running in deployment context (`NODE_ENV=production`, `CI=true`, `VERCEL=1`).

## RBAC Foundation Strategy

- `src/lib/auth/rbac.ts` is the single source of truth for admin roles and permission grants.
- `src/lib/auth/guards.ts` keeps server-component and route-handler authorization checks consistent.
- `src/proxy.ts` is a lightweight, early request-time layer that performs an **optimistic pre-render redirect**. In plain language, that means it uses the request path and available session hints to redirect obviously blocked `/admin` requests before the full page renders.
- `src/app/(admin)/layout.tsx` is the **authoritative** server-side guard. It always makes the final access-control decision during rendering through `requireAdminAccess()`.
- **Conflict resolution rule:** if `src/proxy.ts` allows a request but the layout denies it, the layout wins and the user is redirected.
- **Why both layers exist:** the proxy fast-path improves performance and user experience for clearly blocked requests, while the layout deep check preserves security and consistency for every render.
- **Sequence:** `src/proxy.ts` → request reaches the server/render pipeline → `(admin)` layout guard runs → final admin render or redirect to `/unauthorized` / `/forbidden`.
- If these layers cannot be kept consistent over time, prefer consolidating to a single authoritative server-side guard rather than maintaining conflicting rules.
- `src/app/unauthorized/page.tsx` and `src/app/forbidden/page.tsx` provide explicit recovery screens instead of raw auth errors.
- `src/lib/audit/admin-actions.ts` prepares structured admin action records for future `AuditLog` persistence.
- `src/features/admin/inventory/actions.ts` applies trusted-origin validation and requires both `admin:access` and `catalog:write` for stock mutations.

## Catalog Data Strategy

- `src/features/catalog` is the storefront catalog feature module. It reads exclusively from the PostgreSQL database via Prisma.
- `src/server/db/catalog-queries.ts` is the Prisma query layer for the storefront. It enforces all publish-state visibility rules: only PUBLISHED categories and products are returned, and only APPROVED reviews reach the storefront.
- `src/server/db/catalog-queries.ts` now separates heavyweight PDP reads from lightweight context reads: `getPublishedProductBySlug` remains the full PDP payload, while `getPublishedProductContextBySlug` is the slim path for metadata/related-product orchestration.
- One Dollar category count for shared storefront surfaces now uses `countPublishedOneDollarProducts` (single-variant-per-product read) instead of loading full product payloads.
- `countPublishedOneDollarProducts` now executes the count in SQL (LATERAL selected variant: default first, then oldest fallback) and returns only a scalar, avoiding large JS-side payload scans on `/categories` and header renders.
- The One Dollar count query keeps a guarded Prisma fallback path if raw SQL fails in constrained runtimes, preserving storefront correctness over hard failure.
- `src/features/catalog/service.ts` owns listing + PDP assembly (`getCatalogCategoryListing`, `getProductBySlug`, `getRelatedProducts`) by calling the query layer and mapping DB records to storefront types.
- Homepage `featured-categories` now consumes the same catalog-category source of truth (`getCatalogCategories`) as storefront category navigation and `/categories`, then normalizes the result into the homepage section contract so category naming/media fields stay consistent across surfaces.
- The canonical homepage category media field is `cardImageUrl`. Legacy/manual homepage payloads that still store `imageUrl` are normalized to `cardImageUrl` during homepage content validation so the featured-categories section can preserve imagery when live catalog hydration is unavailable.
- Homepage `featured-products` is storefront-data-driven through `src/features/homepage/featured-products.ts`. The primary ranking metric is `SUM(OrderItem.quantity)` grouped by `productId` for parent orders in `CONFIRMED`, `PACKED`, `SHIPPED`, or `DELIVERED` status.
- Most-sold homepage products always reuse storefront visibility rules before rendering: after the sales aggregation, product ids are resolved through the published-catalog query layer, so unpublished products or products inside unpublished categories are automatically excluded.
- Sparse-sales fallback is intentionally layered to keep the homepage stable while the order history matures: first use the real most-sold results, then backfill from recent published catalog products (so homepage cards keep their add-to-cart affordance — fallback/placeholder items carry no product slug), and finally fill any remaining slots from `featured-products.content.products` (temporary admin-managed/manual fallback data).
- Storefront category cards (`src/features/catalog/components/category-overview-card.tsx`) render category-specific background media when `cardImageUrl` is available; when absent, they intentionally fall back to a stable gradient preview so cards remain readable and layout-safe.
- Storefront category-card images now include explicit responsive `sizes` hints so Next image optimization serves smaller assets on mobile/tablet, reducing `/categories` visual-load cost without changing SEO markup.
- `One Dollar` is implemented as a virtual/system storefront category (`slug: one-dollar`) in `src/features/catalog/one-dollar.ts`; it is not persisted as a `Category` row and does not alter product-to-category relationships.
- One Dollar membership is derived at read-time from published products: include when default selling price is `<= Rs. 280`; products stay assigned to their original categories while also appearing in this special listing.
- The `one-dollar` slug is reserved for the virtual category. If a published DB category collides with this slug, storefront category surfaces suppress the physical duplicate and log a warning for operator follow-up.
- Related products on PDP follow a two-stage strategy in `getRelatedProducts`: (1) explicit admin-curated metadata (`relatedProductIds`, plus legacy `relatedProducts` entries with `id`) in saved order, then (2) same-category published fallback recommendations to fill remaining slots.
- Related products always exclude the current product by slug and id, deduplicate curated/fallback overlap, and cap at 4 cards.
- Related product failures are treated as non-fatal: lookup errors are logged server-side and the PDP renders with an explicit empty-state related section instead of failing the route.
- `filters.ts` owns query-string parsing and href rebuilding for sorting, filtering, and pagination (unchanged).
- Category listing now uses an SSR-first + client-continuation pattern: first render includes page 1 (6 products) from `getCatalogCategoryListing`, then `CategoryInfiniteProductGrid` progressively loads next pages via `GET /api/catalog/categories/[slug]/products`.
- Infinite loading preserves existing filter/sort semantics by reusing the same query-param contract from `filters.ts` (`buildCategoryListingSearchParams` + `parseCatalogSearchParams`) for both route rendering and API page fetches.
- Category listing client state is URL-resync-safe: when filter/sort query params change and a new listing payload is streamed, `CategoryListingFilters` resets control state from incoming filters and `CategoryInfiniteProductGrid` resets local product/pagination state so subsequent infinite requests always use the active query context.
- The old button-based next/previous listing controls are replaced by scroll-triggered loading states with explicit progress, retry, and end-of-list messaging so users can understand when more products exist and when the list is complete.
- The mobile filter/sort sheet intentionally reuses the same listing filter schema and URL builder flow as desktop to keep sorting/filtering semantics and query-string state stable across viewport sizes.
- The admin mutation layer (`src/features/admin/products/actions.ts`, `src/features/admin/categories/actions.ts`) now calls `revalidatePath('/categories')` after any create/update/delete so the storefront ISR cache is invalidated and reflects changes within the next request.
- `src/app/(storefront)/categories/page.tsx` is the category index (ISR: 900s). `src/app/(storefront)/categories/[slug]/page.tsx` is the SEO-friendly category listing route. `src/app/(storefront)/categories/[slug]/[productSlug]/page.tsx` is the SEO-friendly PDP route.
- `generateStaticParams` in both listing and PDP routes fetches from the DB so newly published products are picked up on next ISR/build cycle.
- `data.ts` (legacy seed file) still exists for local reference but is no longer used by the storefront service.

## Blog Data Strategy

- `src/features/blog/service.ts` is now database-backed and reads from `BlogPost` rows through `src/server/db/blog-queries.ts`.
- Storefront blog visibility is enforced in the service layer: only `PUBLISHED` posts with `publishedAt <= now` are shown by default; drafts/archived/future posts stay hidden unless `includeDrafts` is explicitly requested.
- `src/app/(storefront)/blog/page.tsx` and `src/app/(storefront)/blog/[slug]/page.tsx` continue to generate metadata and JSON-LD using the same helper contracts, but now consume async DB reads.
- Storefront SEO markup now standardizes crawler-friendly structure across key surfaces: route-level primary headings (`h1`), list semantics (`ul`/`li`) for card grids, and single-target canonical links in blog cards to reduce duplicate-link ambiguity.
- The homepage `blog-highlights` section was removed; the `/blog` route and blog functionality remain intact and are the single source of blog content. The `blog-highlights` and `hero-banner` section kinds were removed from the homepage type system, resolver, fallback content, section registry/components, and admin homepage section management so they can no longer render on the homepage.
- Admin blog mutations (`src/features/admin/blog/actions.ts`) revalidate `/blog`, dynamic blog detail pages, and `/admin/blog` so published/unpublished changes are reflected promptly.

## Cache Strategy

- SEO-sensitive storefront content routes now share one ISR policy (`revalidate = 900`).
- Static generation / ISR is now active for:
	- `/blog` (ISR)
	- `/blog/[slug]` (SSG + ISR with `generateStaticParams` from published blog slugs)
	- `/categories` (ISR)
	- `/categories/[slug]/[productSlug]` (SSG + ISR with `generateStaticParams` from published product+category slugs)
- `/categories/[slug]` intentionally remains dynamic because listing filters/sort/pagination are request query driven (`searchParams`) and can vary combinatorially; this route still uses published-category static-param enumeration for canonical slug coverage and keeps route-level revalidation enabled for freshness.
- `generateStaticParams` mapping is centralized into typed helpers (`toBlogStaticParams`, `toCategoryStaticParams`, `toProductStaticParams`) so page files stay small and behavior is testable, while route segment config exports stay literal (required by current Next segment-config validation).
- Shared storefront shell no longer performs request-time auth in `AppHeader`; auth state for user controls is resolved client-side (`StorefrontHeaderAuthControls` + `useSession`) so SEO pages are not forced dynamic by header personalization.
- Product-review personalization on PDP was moved to a client/API island (`ProductReviewComposer` + `GET /api/reviews/composer-context`) so product HTML can remain cacheable while review eligibility stays user-specific.
- **Build-time connection-pool protection:** `listPublishedCategories` and `listAllPublishedProducts` in `src/server/db/catalog-queries.ts` are wrapped with `unstable_cache` (TTL 900 s, tags `catalog:categories` / `catalog:products`). During `next build`, Next.js pre-renders many pages concurrently — each including `<AppHeader />` which calls `getCatalogCategories()`. Without caching, every concurrent static render fires independent Prisma queries, exhausting the 3-connection pool (Prisma error P2024). With `unstable_cache`, all renders share the first DB result for the build window.
- Additional pool-pressure reduction: route metadata and related-product context now use slim cached product context queries instead of full detail payload fetches, reducing connection hold time and repeated heavy reads during prerender/runtime.
- On-demand ISR is triggered by admin mutations:
	- Blog mutations revalidate `/blog` and `/blog/[slug]`.
	- Category and product mutations revalidate `/categories`, `/categories/[slug]`, and `/categories/[slug]/[productSlug]`, and also call `revalidateTag(CATALOG_CACHE_TAGS.categories, "max")` / `revalidateTag(CATALOG_CACHE_TAGS.products, "max")` to bust the `unstable_cache` entries immediately.
	- Admin list pages are still revalidated for operator freshness.
- Dynamic rendering remains intentional for truly personalized/request-bound routes (account, cart, checkout, wishlist, order confirmation, and admin surfaces).

## Admin Form Performance Strategy

- Admin list routes that include forms should avoid reusing edit-level DB selectors for table/list reads. Keep list queries summary-focused and defer full records to edit routes.
- Current optimized list-query examples:
	- `src/features/admin/products/service.ts#listAdminProducts` selects list-only fields plus lightweight variant inventory/price data.
	- `src/features/admin/categories/service.ts#listAdminCategories` selects table fields only.
	- `src/features/admin/blog/service.ts#listAdminBlogPosts` excludes heavy article content JSON from list reads.
- Form-heavy admin pages that render many editable records now prefer demand-loaded editors:
	- `/admin/homepage/banners`
	- `/admin/homepage/campaigns`
	- `/admin/homepage/sections`
- The shared pattern is: render a lightweight server list, show an explicit "Edit" control per record, and mount the client editor only when requested. This lowers initial hydration cost and keeps input responsiveness stable as record counts grow.
- RBAC checks, action guards, server-side validation, and mutation/audit behavior remain unchanged by these optimizations.

## Search Strategy

- Search is a shadcn command dialog, not a separate page: `CatalogSearchCommandDialog` (`src/features/catalog/components/catalog-search-command-dialog.tsx`) is mounted once in the storefront layout and the root homepage, and opened from the header on desktop and mobile through the shared `search-dialog-state` store (`openSearchDialog` / `closeSearchDialog` / `useSearchDialogState`). The old `/search` page and `routes.storefront.search` route were removed.
- The dialog uses `CommandDialog` with `shouldFilter={false}` because live results come from the server; cmdk must not client-filter them.
- Landing view (empty query) shows "Recent searches" and "Popular searches" quick-entry groups; popular searches are desktop-only (CSS `hidden md:block`). Once the user types a valid query, the landing groups hide and live results render.
- Debounced client requests call `GET /api/catalog/search` for fast perceived responsiveness without hammering the server on every keypress.
- Route-handler validation happens in `src/app/api/catalog/search/route.ts` and delegates to feature-level service logic.
- `searchCatalogProducts()` in `src/features/catalog/service.ts` is the stable entrypoint used by API/UI layers.
- `src/features/catalog/search-adapter.ts` is the upgrade seam. The current DB-backed search can be replaced by a dedicated search provider (Algolia, Typesense) while preserving API and UI contracts.
- Matching is tokenized and forgiving: `src/features/catalog/lib/search-text.ts` splits queries into words, widens each token with plural/singular variants (`chains → chain`, `candles → candle`), and matches against `name`, `shortDescription`, `description`, and `category.name` — so searching a category name surfaces all products under it, and `"chains"` matches a `Gold Chain` product.
- Relevance ranking lives in the search adapter: the DB query returns a candidate pool (larger than the final limit), the adapter scores each candidate (name > category > shortDescription > description) and returns the top `limit` matches. Literal name/category matches outrank incidental description hits, so `"candles"` shows candle products rather than balloons that merely mention candles.
- Search result rows follow the same media contract as catalog cards: adapters pass a normalized `imageUrl` only when it is a safe renderable URL; otherwise it is omitted so the row falls back to a deterministic placeholder.
- Recent searches are implemented as a local-first client seam in `src/features/catalog/recent-searches.ts` with typed helper functions for normalization, case-insensitive deduplication, max-size limits, single-item removal, and clear-all behavior. Queries are recorded on Enter submit and on result selection.
- Popular searches are a curated static list in `src/features/catalog/popular-searches.ts` (single seam; can later be replaced by analytics-driven suggestions).
- Recent-search persistence is intentionally browser-scoped (`localStorage`) and failure-tolerant: storage parse/write failures never block search results and are surfaced as user-safe non-fatal messaging.
- See `docs/dev/search-architecture.md` for flow details and phased upgrade guidance.

## Wishlist + Account Strategy

- `src/features/wishlist/service.ts` owns wishlist seed-resolution logic, persistence, and user-scoped queries.
- `src/app/api/wishlist/items/route.ts` is the only mutation entrypoint for add/remove operations and enforces authenticated access.
- Wishlist persistence currently uses a seed-bridge approach: seed catalog slugs/options are resolved to stable SKU-backed ProductVariant rows if missing, so wishlist can work before full catalog DB integration.
- `src/app/(storefront)/account/layout.tsx` is the authoritative customer-account route guard and redirects unauthenticated users to sign-in with a safe return path.
- `src/app/(auth)/auth/sign-in/page.tsx` and `src/features/auth/actions/sign-in.ts` support safe `from` path handling to return users after authentication.
- `src/features/orders/service.ts` now owns customer order-history retrieval plus stock-aware re-order logic that rehydrates active cart items while reporting unavailable/out-of-stock lines.

## Cart Context Separation Strategy

- Guest and authenticated cart contexts are intentionally isolated even inside the same browser session.
- Guest cart resolution is token-based and must be scoped to `userId = null` (guest-only cart ownership).
- Authenticated cart resolution is user-based (`userId + ACTIVE`) and does not rely on guest token identity.
- Guest-to-user merge is explicit (`mergeGuestIntoUser`) and only applies when the token resolves to an ACTIVE guest cart.
- Authenticated cart APIs preserve a guest-context cookie token to avoid leaking authenticated cart identity into post-sign-out guest browsing.
- Sign-out rotates to a fresh guest token before session clear so the next anonymous request starts from a clean guest cart context.

## Cart Client Count State Strategy

- `src/features/cart/cart-count-state.ts` is the global client-side count state seam for cart badge surfaces.
- The store is intentionally minimal and derived: it keeps only `itemCount` and sync status, while full cart details remain owned by existing cart APIs and feature components.
- Synchronization contract:
	- bootstrap from `GET /api/cart` (`no-store`) on first subscriber
	- subscribe once to `cart:changed` and update immediately when cart detail is provided
	- fallback to API refresh when an event omits cart detail
- The mobile cart button (`src/features/cart/components/mobile-cart-button.tsx`) consumes this shared state so cart count remains consistent across mobile and desktop entry points without changing cart business logic.

## Cart Drawer Strategy

- The cart drawer is a shadcn `Drawer` (vaul-based, right side) mounted once in the storefront layout (`src/app/(storefront)/layout.tsx`) so it is available from every storefront page; the homepage (`src/app/page.tsx`) lives outside the `(storefront)` route group and duplicates the storefront shell, so it ALSO mounts `<CartDrawer />` and `<MobileBottomNav />` (otherwise the drawer and the mobile bottom nav are missing on `/`).
- A tiny global store (`src/features/cart/cart-drawer-state.ts`) exposes `openCartDrawer()` / `closeCartDrawer()` / `useCartDrawerState()`, mirroring the `cart-count-state` seam so any component (header trigger, mobile cart button, product card buttons) can open the drawer without prop drilling.
- `src/features/cart/components/cart-drawer.tsx` renders the panel: header (title + close), scrollable line items with `CartItemThumbnail` + `CartItemQuantityControls` (adjust/remove), and a footer with subtotal, `View full cart`, and `Checkout`. It loads from `GET /api/cart`, stays in sync via `cart:changed`, and disables checkout when any line exceeds available stock.
- Cart line items (drawer + cart page) show a product thumbnail on the left via `CartItemThumbnail` (`src/features/cart/components/cart-item-thumbnail.tsx`); `CartItemSummary` carries `imageUrl`/`imageAlt` populated by the cart service (variant image first, then product image, both ordered by `position`; `null` when none exist).
- Product cards (`ProductGridCard`, `ProductRelatedGrid`, homepage `featured-products`/`one-dollar` carousels) render `ProductCardAddToCart` as an absolutely positioned sibling (`z-10`) of the card's wrapping `Link`, so the card remains a single link while the button is independently clickable; clicking it posts to `POST /api/cart` (quantity 1, product slug) and opens the drawer. Homepage cards render the button only when the product has a slug (fallback/placeholder items have none).
- The old `CartMiniCart` header dropdown was removed; the desktop `CartDrawerTrigger`, the mobile `MobileCartButton`, and the mobile bottom nav Cart action all open the drawer.
- Cart success mutations are silent app-wide (no success toast on add, quantity update, or remove); only failed mutations show a user-friendly error toast. Visual feedback comes from the count badge, line-item state, and the drawer opening.
- The PDP `ProductAddToCart` does not show a success toast on add (silent add-to-cart); `getProductBySlug` resolves the detail `sku` from the default variant first (then master SKU) so the PDP's `effectiveSku` matches cart/wishlist line items keyed by variant SKU.

## Review Workflow Strategy

- `src/features/reviews/service.ts` is the customer review service layer for submission eligibility, account listing, and safe status mapping.
- `submitCustomerReview()` enforces review ownership and practical abuse safeguards: authenticated user id, published product existence, delivered-order ownership for first-time submissions, and rate limiting (`review:submit`).
- Customer edits to an existing review are allowed and intentionally reset moderation fields to `PENDING`/`approved=false` so updated content is re-reviewed.
- `src/features/reviews/actions.ts` owns CSRF-safe server action handling, auth redirects, validation, flash codes, and route revalidation for storefront PDP/account pages plus admin moderation.
- `src/app/(storefront)/categories/[slug]/[productSlug]/page.tsx` now composes `CustomerReviewForm` above `ProductReviews`, with user-friendly notice/error banners and eligibility messaging.
- `src/features/reviews/components/customer-review-form.tsx` now follows the shared shadcn dynamic form architecture (`useAppForm` + `DynamicForm` + `useServerActionSubmit`) so validation, error summary rendering, and reset conventions stay aligned with other feature forms.
- Review submit contract compatibility is preserved: field names and payload shape (`productId`, `returnTo`, `rating`, `title`, `body`) remain unchanged for moderation and server-action flow safety.
- `src/app/(storefront)/account/reviews/page.tsx` now renders live user-scoped review history (status badge, storefront visibility state, customer-facing `moderationReason`, product deep link) instead of an empty placeholder.
- Storefront visibility remains strictly moderation-driven: only `APPROVED` reviews are queried by `src/server/db/catalog-queries.ts` and rendered in PDP review sections.

## Error Handling Strategy

- `src/app/error.tsx` and `src/app/global-error.tsx` now share `PageErrorFallback` so boundary copy stays consistent and user-safe.
- `SectionErrorState` and `FormErrorSummary` handle localized module failures and future form validation without leaking raw internals.
- `src/app/not-found.tsx` provides a safe placeholder for unbuilt routes.
- `src/lib/errors` centralizes reusable error abstractions and user-facing messaging through `toUserMessage()` and `getFormErrorMessages()`.
- `src/lib/logger.ts` offers a client/server-safe logger with sensitive field redaction for operational diagnostics.
- Admin dashboard metric queries are wrapped with an `AppError` code (`ADMIN_DASHBOARD_METRICS_QUERY_FAILED`) so the UI can keep rendering with user-safe fallback messaging when the database is temporarily unavailable.
- Admin image uploads follow the same user-safe error policy: route-handler validation rejects unsupported types and oversize files early, storage configuration failures resolve to a clear admin-facing message, and form fields always preserve manual URL entry as a fallback.

## Analytics Strategy

- Client analytics wiring is centralized in `src/features/analytics/components/analytics-provider.tsx` and mounted once in `src/app/layout.tsx`.
- GA4 script loading uses the standard gtag loader (`https://www.googletagmanager.com/gtag/js?id=...`) and is enabled only when `NEXT_PUBLIC_GA_ID` is present.
- CSP generation in `src/config/security.ts` keeps analytics script policy narrow by adding `https://www.googletagmanager.com` to `script-src` only when GA is configured.
- This avoids broad script-source weakening while keeping analytics opt-in per environment.

## Admin Dashboard Metrics Strategy

- Metric query orchestration lives in `src/features/admin/dashboard/service.ts` to keep route files thin and typed.
- Low-stock detection is shared with admin inventory through `src/features/admin/inventory/service.ts` (`listAdminLowStockInventoryItems`, `isInventoryLowStock`) so dashboard and inventory surfaces cannot drift.
- Current cards intentionally remain simple (no charts yet):
	- Pending orders: `Order.status == PENDING`
	- Revenue summary: sum of `Order.total` where `status == DELIVERED` and `refundStatus` is not completed
	- Low stock: inventory rows where `onHand = (quantity - reserved)` and `onHand <= effectiveThreshold`
	- Effective threshold rule: if `Inventory.safetyStock > 0`, use it; otherwise fall back to `StoreSettings.lowStockThreshold` (default `5`)
	- Recent activity: latest `AuditLog` records mapped into non-technical labels and summaries
- Revenue assumptions are explicit in code via `AdminDashboardRevenueSummary.assumptions` so UI and docs stay aligned while payment workflows evolve.

## Admin Revenue Reporting Strategy

- Revenue reporting query orchestration lives in `src/features/admin/revenue/service.ts` so the route file remains presentation-focused and extensible.
- Date-window logic for practical reporting periods (last 7 and last 30 days) is isolated in `src/features/admin/revenue/date-ranges.ts`.
- Current report intentionally prioritizes simple operational summaries over heavy analytics:
	- recognized revenue total (delivered orders with completed refunds excluded)
	- recent period snapshots (last 7/30 days revenue, included order counts, average order value)
	- order totals summary (total, pending, delivered, cancelled, and gross order value)
- The `/admin/revenue` route includes clear empty, loading, and error states for non-technical admin users.
- Revenue inclusion assumptions are surfaced in both service contract and UI copy so future payment/refund workflow changes can evolve transparently.

## Admin Activity Feed Strategy

- Activity feed query orchestration lives in `src/features/admin/activity/service.ts` to keep route files thin and focused on rendering.
- Feed entries are sourced directly from `AuditLog`, ordered by newest first (`createdAt`, then `id`) with a `take + 1` approach so the contract is pagination-ready.
- Event mapping logic is isolated in `src/features/admin/activity/audit-log-feed.ts` so title/summary formatting can evolve independently from query logic.
- Actor context is resolved in a second query from `User` records using `actorId` when available; missing/deleted actors gracefully fall back to neutral labels.
- UI remains intentionally simple for non-technical admins: readable titles, plain-language summaries, timestamp, and actor/model context.
- Inventory adjustments now emit `inventory.adjusted` records with before/after quantities, adjustment mode, and reason so operational stock changes are traceable in the same feed.

## Admin Inventory Adjustment Strategy

- Stock mutation and low-stock read logic are isolated in `src/features/admin/inventory/service.ts` so read/write inventory behavior follows one shared contract.
- Server-side validation in `src/features/admin/inventory/validation.ts` enforces mode, amount, reason, and version timestamp integrity.
- Concurrency is handled via `updateMany` matching on `id + updatedAt`; stale writes fail with a user-safe conflict error.
- Quantity safeguards prevent manual updates from producing negative stock or quantities below `reserved`.
- Successful adjustments write `AuditLog` events (`inventory.adjusted`) and revalidate `/admin/inventory` + `/admin`.
- `/admin/inventory` now uses the shared low-stock query and shows an explicit `Alert at` threshold column so fallback-threshold alerts remain transparent to admins.

## Admin Store Settings Strategy

- Store settings logic is isolated in `src/features/admin/settings` with clear module boundaries: `validation.ts`, `service.ts`, `actions.ts`, and `flash.ts`.
- Persistence uses a singleton `StoreSettings` row (`id = "default"`) so this first-pass scope remains simple while still supporting future expansion.
- Validation uses Zod and rejects invalid contact/shipping values before mutation; optional fields normalize to `undefined`/`null` consistently.
- Server-action writes are protected by trusted-origin checks and require both `admin:access` and `settings:manage` permissions.
- Save operations write `AuditLog` entries (`settings.updated`) and revalidate `/admin/settings`.
- The page intentionally focuses on operationally useful present-day settings:
	- store identity basics
	- support contact info
	- shipping-related basic defaults
	- operational defaults
- Advanced enterprise settings (multi-warehouse rules, tax engines, payment-provider controls, SLA matrices) remain deferred by design.

## Engineering Quality Gates

- ESLint enforces consistent import ordering and type-only import style.
- Prettier formats code and keeps Tailwind utility order consistent.
- TypeScript runs in strict mode with stronger safety checks and shared path aliases.
- Vitest smoke tests now cover config loading and invalid env handling.

## AI Documentation Continuity

- `docs/ai/project-overview.md` is the AI entrypoint and should remain concise.
- `docs/ai/implemented-features.md` is the implementation index for completed capability buckets.
- `docs/ai/open-tasks.md` is the prioritized deferred/next-work list.
- `docs/ai/architecture-decisions.md` records stable design decisions and tradeoffs.
- `docs/ai/testing-status.md` records current test posture and update rules.
- `docs/ai/task-status.md` should stay brief and point to the focused files above.
- Any prompt that adds, changes, or defers behavior should update both:
	- relevant `docs/dev/*` implementation guides
	- the matching `docs/ai/*` continuity files listed here

## Rewards Phase-2 Placeholder Strategy

- `src/features/rewards/contracts.ts` defines contract-first interfaces for:
	- referral tracking (`ReferralTrackingService`)
	- loyalty points (`LoyaltyPointsService`)
	- wallet ledger (`WalletLedgerService`)
- Runtime parse helpers (`parseReferralVisitInput`, `parseReferralConversionInput`, `parseLoyaltyPointsMutationInput`, `parseWalletLedgerEntryInput`) provide a shared, user-safe validation/error baseline for future route handlers and server actions.
- Contract response shape is standardized by `RewardsServiceResult<T>` so future modules can return typed success/failure payloads without leaking internals.
- This seam is intentionally isolated and not wired into checkout/order modules in this phase.
- Detailed rollout and schema plan is documented in `docs/dev/referral-loyalty-wallet.md`.

## Deferred on Purpose

This phase already includes the RBAC foundation (`src/lib/auth/rbac.ts`, `src/lib/auth/guards.ts`, `src/proxy.ts`, the unauthorized/forbidden pages, and the audit-ready helper). Feature-specific repositories, richer auth/business integrations, and real admin workflows should still be added in later prompts on top of the shared `src/server/db` structure.
