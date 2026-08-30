# Implemented Features

## How to Use This File

Use this as the quick implementation map for future AI prompts. Each section describes what is active in production-minded form today.

## Storefront and Catalog

- Homepage with section-based rendering and admin-manageable content resolution; featured categories section uses a responsive shadcn-compatible carousel with empty-state fallback
- Featured Deals (`featured-deals` homepage section + `/deals` + `/deals/[slug]`) are MULTI-PRODUCT bundles: each deal belongs to one category (like products), carries deal-level pricing (`price`/`compare_at_price`), a short description, specifications (`DealSpecification`), SEO fields (meta/OG/noindex), related-deal cross-sells (stored as `relatedDealIds` in `Deal.metadata`), and a list of included products (`DealProduct` join rows with optional variant + per-product quantity). Availability derives from the included products' inventory — a deal is available only when every included published product is in stock, and `availableStock` is the minimum across them. The deal detail page mirrors the PDP: gallery (`DealGallery`), info block (`DealInfoBlock`), a "What's included" list in place of the variant picker (`product name | x Pcs`), `DealSpecifications`, and a "Related Deals" grid (`DealRelatedGrid`). Admin deal form supports multiple product rows (product + variant + quantity with stock checks), specifications, related-deals picker, images, and the shared `AdminSeoSection` + a deal SEO content helper. Homepage `featured-deals` renders AFTER `featured-products` (render order + fallback displayOrder 35). Old single-product fields (`product_id`, `product_variant_id`, `quantity`, `show_product_cover`) were migrated into `DealProduct` rows by migration `20260830140000_deals_multi_product` and dropped.
- Mobile-only fixed bottom navigation bar (`MobileBottomNav`): Collections (`/categories`), Search (opens search dialog), Cart (opens cart drawer with live count badge), Home (`/`), and Profile (`/account/profile`) — icon-above-label, active-route highlighting, mounted in the `(storefront)` layout and root homepage
- Homepage featured item contracts now support optional media fields (`slug`, category `cardImageUrl`, product `images[]`) with backward-compatible fallbacks to placeholder cards when media is absent
- Homepage featured-products section is now sales-driven: it ranks products by summed `OrderItem.quantity` across `CONFIRMED`/`PACKED`/`SHIPPED`/`DELIVERED` orders, filters through published storefront visibility rules, and fills sparse-data gaps from recent published catalog products first (so cards keep add-to-cart), then stored fallback picks
- Category listing routes and product detail routes with SEO metadata support; related products grid (`ProductRelatedGrid`) renders product card images directly via `backgroundImage: url(${product.imageUrl})` cover style
- Product detail pages support variant-specific images: for variant products each image can be linked to a variant (or left product-level/shared); the `ProductOverview` wrapper keeps the gallery and variant picker in sync — tapping a variant thumbnail selects that variant, and changing the variant in the picker shows that variant's images; simple products keep the classic multi-image gallery; variant images are loaded via a dedicated query (the `Product.images` relation only returns product-level rows) and variants without `options` still get a title-based picker group
- Variant cover images on listing cards: storefront listing queries (`listPublishedProductsByCategory`, `listAllPublishedProducts`, `getRelatedPublishedProducts`, `listPublishedProductsByIds`, `searchPublishedProducts`) batch-fetch variant-level images and merge them into each product record, ordered by variant order (default variant first) so the DEFAULT variant's image is used as the card cover — category grids, search results, related-product cards, and homepage sections show the real default-variant cover for variant-only media instead of the placeholder gradient
- Storefront image URLs are validated against the allowlisted hosts in `src/config/image-hosts.ts` (shared with `next.config.ts` remotePatterns), so images from unconfigured hosts fall back to the placeholder instead of crashing the page
- Database-backed catalog visibility rules (published categories/products only; approved reviews only)
- Storefront search as a shadcn command dialog opened from the header (desktop + mobile) with live debounced results, local-first recent searches, desktop-only curated popular searches, and an API transport seam with adapter-ready backend integration point; matching is tokenized with plural widening and category-name support, and results are ranked by relevance (name/category matches first) rather than raw creation date
- Mobile header rework: three-zone layout (hamburger drawer left, centered logo, right-side actions with cart rightmost; mobile search trigger kept but hidden for now; no separate user-menu button); the hamburger drawer hosts the full menu with the same options as the desktop user menu — page links, `Admin Panel`, `Your Orders`, account, and sign out (catalog categories removed from the drawer); `Your Orders` appears before `Sign out` for signed-in users on both mobile (drawer) and desktop (`UserMenu`); category browsing on mobile is served by the mobile bottom nav **Collections** action
- Storefront footer is a four-column layout: **Quick Links** (up to six live catalog categories via `buildStorefrontNavbarCategoryMenu` plus a `View All` link to `/categories`), **Help** (About us, Contact us, Your Orders), **Policies** (Privacy Policy, Refund Policy, Shipping Policy, Terms of Service), and **Contact** (Email/Phone placeholder rows). On mobile each column collapses behind its heading as a row with a chevron toggle (`FooterColumn`), and from the `md` breakpoint up all four render as an expanded grid; headings are responsive (`text-sm md:text-xl`), column links use the muted footer palette (`text-muted hover:text-muted-foreground`), and the `View All` action is a ghost text-link (no border)
- Wishlist add/remove and authenticated wishlist page

## Cart, Checkout, and Orders

- Guest cart token persistence with guest-to-auth merge
- Live cart operations and stock validation endpoints
- Right-side cart drawer (shadcn `Drawer`/vaul) opened by header trigger, mobile cart button, and product-card add-to-cart buttons; line items show thumbnails (`CartItemThumbnail`) and quantity controls; mounted in the `(storefront)` layout and on the root homepage
- Product-card `Add to Cart` buttons on catalog grids, related products, and homepage featured-products/party-heaven carousels post to `POST /api/cart` and open the drawer; the PDP adds silently (no success toast)
- Cart success mutations are silent app-wide (add, quantity update, remove show no success toast); failed mutations still surface user-friendly error toasts
- Checkout flow with Karachi-only shipping validation and fixed shipping fee calculations
- COD payment provider active through pluggable checkout payment contract
- Transactional order placement with stock revalidation, snapshots, and audit logging
- Account order history/detail views, invoice route, and stock-aware reorder flow

## Auth, Access, and Security

- Auth.js credentials + Google auth
- Email verification flow and password reset flow
- RBAC for admin roles with route and layout guards
- Trusted-origin and CSRF protections for sensitive mutations
- Rate-limiting foundation with Redis-first and safe local fallback
- Safe error normalization and user-safe messaging conventions

## Admin Operations

- Dashboard metrics from live database (pending orders, recognized revenue, low stock, recent activity)
- AuditLog-based activity feed with actor and model context
- Revenue summary page with explicit inclusion assumptions
- Category and product admin CRUD with SEO controls and ISR revalidation
- Admin product images support per-variant attachment: in variant mode each image row has a variant selector (with an "All variants (shared)" option); `variantIndex` maps to the product's variant array, images are stored on `ProductImage` with `productVariantId` (or `productId` for shared/simple products), and the edit form restores the assignment on load — including variant-specific images, which are fetched and merged into the form record by `getAdminProductById`
- Related products picker in the product admin form: debounced client-side search (title/slug) and category-aware filtering backed by a guarded admin API route (`GET /api/admin/products/related-search`), with currently selected items always pinned at the top so they stay visible while browsing; results render as checkboxes and submit through the existing `relatedProductIds` payload
- Admin content image uploads via Vercel Blob: shared guarded route handler, provider abstraction (`src/features/admin/uploads/`), reusable `AdminImageUploadInput` component, and final-URL persistence into product image rows, banner, blog cover, and SEO image fields — no database migration required
- Product admin SEO content helper (deterministic generation for title suggestions, SEO title/description, short description, highlights, FAQ ideas, schema-oriented specs, internal linking suggestions, and slug)
- Storefront category SEO content generator (`src/features/catalog/seo/category-seo-content.ts`): deterministic, Pakistan-focused output — SEO title, meta description, introductory copy, FAQ items, internal link suggestions, blog topic ideas, and schema markup notes — for all category pages; per-slug templates for home-care, grocery, and personal-care with a generic fallback for any other slug
- Blog admin CRUD with publish scheduling and SEO fields
- Homepage admin controls for sections, banners, campaigns, and announcements
- Inventory monitoring plus inline manual stock adjustment with concurrency checks and audit events
- Admin review moderation with status workflow and storefront visibility control
- Admin settings workspace persisted via singleton settings record

## Content and Marketing

- Blog listing/detail pages from Prisma-backed content
- Structured data output for blog listing and detail pages
- Contact form persistence with non-blocking email/Telegram admin notifications
- Email subscriber lifecycle foundation and unsubscribe flows
- Abandoned cart event log foundation for future recovery automation

## Shared Foundations

- Shared UI primitives and fallback states; global design tokens enforce the light-only palette via semantic CSS classes (the app always renders light regardless of the device color preference); Admin workspace shell (`AdminShell`) and sidebar (`Sidebar`) explicitly bind to `bg-background`
- Shared carousel primitives (`src/components/ui/carousel.tsx`) used by homepage category surfaces; keyboard-accessible and touch-friendly
- Shared form system (React Hook Form + Zod + server-action bridge)
- Shared data-table foundation used by multiple admin pages
- Shared server/db repository and transaction utilities
- PNPM 10 workspace configuration (`pnpm-workspace.yaml`) with `allowBuilds` for `@prisma/client`, `@prisma/engines`, `prisma`, `sharp`, and `unrs-resolver`
- Deployment, operations, and release documentation foundation

## Intentionally Deferred (Implemented Seams Exist)

- Online payment gateways and payment webhooks (abstraction already in place)
- Rewards phase-2 integration (contract-first seam present, no live wiring)
- Advanced analytics/reporting UX beyond current operational summaries