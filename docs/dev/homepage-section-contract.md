# Homepage Section Contract

This project now uses a section-based homepage foundation backed by admin-managed database content with fallback safety.

## Purpose

- Keep homepage composition modular.
- Allow future admin controls to reorder, enable/disable, and update section payloads without route rewrites.
- Ensure storefront still renders safely when CMS content is missing.

## Current Section Kinds

- `announcement-bar`
- `featured-categories`
- `one-dollar` *(hydrated at runtime from the live catalog)*
- `featured-products`
- `deal-spotlight`

> **Removed**: `hero-banner` and `blog-highlights` were removed from the homepage
> on 2026-08-18. The storefront no longer renders a hero section or blog
> highlights; `/blog` remains the single source of blog content. Both section
> kinds were removed from the homepage type system, resolver order, fallback
> content, section registry/components, and admin homepage section management
> (validation, seeding, storefront mapping, section form guidance). Legacy DB
> records of those types are skipped safely and logged during storefront mapping.

## Type Contracts

Source of truth lives in `src/features/homepage/types.ts`:

- `HomepageSectionKind`: discriminated keys for supported blocks.
- `HomepageSection`: union type for all section payloads.
- `HomepageContent`: container payload from CMS/service.
- `HomepageContentResult`: resolved result with `source` (`cms` or `fallback`).

Each section includes:

- `id`: stable identifier.
- `kind`: section discriminator.
- `enabled?`: optional admin toggle.
- `displayOrder?`: optional ordering hint.

Deal section media contract:

- `deal-spotlight.image?`: `{ url: string; alt: string }`
- `url` must be a root-relative path or a configured image host URL.
- image is optional; if omitted, storefront renders the section without media.

Campaign-generated `deal-spotlight` overlays now support optional explicit media/link fields from `/admin/homepage/campaigns`:

- `targetHref?`: explicit destination URL/path for spotlight CTA.
- `imageUrl?`: spotlight image URL (root-relative or configured host).
- `imageAlt?`: required when `imageUrl` is present.
- If `targetHref` is missing (or invalid legacy data is encountered), storefront falls back to the first linked campaign product URL.
- If `imageUrl` is missing, storefront falls back to the first linked campaign product image when available.
- Spotlight pricing for campaign-generated `deal-spotlight` is sourced from the first linked campaign product variant in the database, using the storefront pricing rule (`compareAtPrice` is shown only when it is greater than `price`).
- If linked campaign product pricing is missing or incomplete, storefront uses the canonical fallback `deal-spotlight` pricing contract so the homepage remains render-safe.

Featured item media contract (for card layouts):

- `FeaturedCategoryItem` now reuses the storefront catalog category card shape (`id`, `name`, `description`, `href`, optional `slug`, optional `cardImageUrl`) so homepage category cards and `/categories` cards render from one normalized contract.
- `FeaturedProductItem` supports optional `slug` and optional `images[]` (`url`, `alt?`, `isPrimary?`) for image-first product cards.
- All fields above are optional so existing CMS/fallback payloads remain backward-compatible and render safe placeholder cards when media is absent.

Admin management entrypoints now live under `/admin/homepage` with dedicated pages for:

- section content editing and ordering
- section deletion/removal for all homepage section types
- banners
- deal campaigns
- announcement-bar content via the section type or active banners

Deal spotlight content is managed through homepage sections (`/admin/homepage/sections`) using the `deal-spotlight` section type.

## Resolution Rules

Resolution logic is in `src/features/homepage/resolver.ts`.

- If CMS payload is `null`, `undefined`, or has no sections, fallback content is used.
- If all CMS sections are disabled (`enabled: false`), fallback content is used.
- Otherwise, enabled CMS sections render.

### Overlay vs Primary sections

Sections are classified as either **overlay** (additive, promotional) or **primary** (structural homepage content):

| Kind | Classification | Reason |
|---|---|---|
| `announcement-bar` | Overlay | Promotional bar; never the sole page structure |
| `deal-spotlight` | Overlay | Promotional deal block; additive regardless of how it was created (admin section or deal campaign) |
| `featured-categories` | Primary | Core homepage structure |
| `featured-products` | Primary | Core homepage structure |
| `one-dollar` | Primary | Core homepage structure |

**Rule**: resolver composition is additive by section kind. Enabled CMS records are always included, and fallback sections are merged only for kinds not explicitly configured in CMS.

**Incremental CRUD safety**: adding a single section in admin no longer collapses the homepage into a partial composition. Missing, unconfigured kinds continue to render from fallback.

**Explicit disable intent**: if CMS has a record for a section kind but it is disabled, fallback for that kind is not reintroduced.

**Deduplication**: if CMS already provides a `deal-spotlight` (regardless of whether it was created as an admin section record or an active campaign), the fallback `deal-spotlight` is omitted to avoid duplicate deal blocks.

**Historical note**: prior to 2026-05-05, homepage resolution still treated any enabled primary CMS set as a complete composition, so adding a single primary section could suppress other baseline sections unless a full seed had already happened. Resolver composition now fills missing, unconfigured kinds from fallback while preserving explicit disabled kinds.

- Sections are sorted by `displayOrder` first, then by static kind order:
  1. `announcement-bar`
  2. `one-dollar`
  3. `featured-categories`
  4. `featured-products`
  5. `deal-spotlight`
- Invalid content payloads are skipped safely and do not break storefront rendering.
- Scheduled records render only when the current time is inside their active window.
- Banner and deal-campaign records can contribute storefront-visible promotional blocks alongside directly managed homepage sections.
- If all admin-managed records are inactive or outside schedule windows, storefront falls back safely to static defaults.
- Malformed banner rows (for example empty title/message) are skipped safely and logged; malformed links are stripped so announcement text can still render without unsafe anchors.
- When a campaign overlay is active, fallback `deal-spotlight` is intentionally omitted to prevent duplicate deal spotlight blocks.
- Campaign spotlight CTA links are now normalized with safe intent: internal paths render as normal links, external URLs open in a new tab with `rel="noopener noreferrer"`, and invalid legacy hrefs degrade to a non-clickable CTA state instead of unsafe navigation.
- Campaign spotlight pricing selection is defensive: missing linked product variants do not break rendering, and compare-at values lower than or equal to the base price are normalized to non-discount presentation.

## Rendering Model

Rendering map is in `src/features/homepage/section-components.tsx`.

- `SECTION_COMPONENTS` maps each `kind` to a dedicated section block component.
- `renderHomepageSection()` renders blocks through the registry.
- `hasRegisteredSectionComponent()` supports test assertions for registry coverage.

Section components are located in `src/features/homepage/components/`.

### Carousel sections

Sections that render categories or products use a standardized carousel pattern.
Config lives in `src/features/homepage/components/homepage-carousel-config.ts`.

| Constant | Value | Purpose |
|---|---|---|
| `HOMEPAGE_CAROUSEL_MAX_ITEMS` | `8` | Hard cap on items shown in the carousel |
| `HOMEPAGE_CAROUSEL_ITEM_CLASS` | responsive basis classes | 1–5 visible cards across breakpoints (1 default / 2 sm / 3 md / 4 xl / 5 2xl) |
| `HOMEPAGE_CAROUSEL_OPTIONS` | `{ align: "start" }` | Shared Embla options |

**View All button logic**

- Shown automatically when `items.length > HOMEPAGE_CAROUSEL_MAX_ITEMS`.
- Shown when the section payload supplies an explicit `viewAllHref`.
- For `one-dollar` sections the CTA is always shown (links to the live One Dollar catalog).
- Hidden when items fit within the cap and no explicit link is configured.

**Navigation button behavior**

- Hidden on mobile (`hidden sm:flex`); swipe is the primary gesture.
- Hidden when scroll is not possible (`disabled:hidden` Tailwind class on `CarouselPrevious` / `CarouselNext`).

**Sections currently using the carousel**

| Section kind | Component | View All source |
|---|---|---|
| `featured-categories` | `FeaturedCategoriesSectionBlock` | `viewAllHref` prop or `routes.storefront.categories` |
| `featured-products` | `FeaturedProductsSectionBlock` | `viewAllHref` prop (optional) |
| `one-dollar` | `OneDollarSectionBlock` | `section.ctaHref` (rendered only when deals are available) |

## Service Layer

`src/features/homepage/service.ts` now resolves admin-managed content through the homepage admin module.

- `fetchHomepageContentFromCms()`: loads validated section records, active banners, and scheduled deal campaigns.
- `getHomepageContent()`: resolves those records through the fallback-aware rules.

### Runtime hydration

Some section kinds carry live data that is never stored in CMS:

- **`featured-categories`** — `categories[]` is now hydrated from the live Prisma-backed catalog via `getCatalogCategories()` and then normalized into the shared homepage/category card shape before render. The virtual `one-dollar` category is intentionally excluded here because it already has a dedicated homepage section. If the catalog read fails or returns no publishable categories, the storefront keeps the section shell and falls back to the stored/manual category array instead of rendering a broken homepage.
- **`featured-products`** — `products[]` is hydrated at runtime from live catalog data by `resolveHomepageFeaturedProducts()`: it ranks published products by summed order quantity across `CONFIRMED`/`PACKED`/`SHIPPED`/`DELIVERED` orders (most-sold first), backfills from recent published catalog products, then fills any remaining slots from the stored fallback array — resolving up to `HOMEPAGE_FEATURED_PRODUCTS_LIMIT = 5` cards so the carousel fills its widest 5-up `2xl` row (the extra item simply scrolls into view on smaller viewports).
- **`one-dollar`** — `products[]` is always `[]` when stored. `hydrateOneDollarSections()` in `service.ts` calls `getCatalogCategoryListing({ slug: "one-dollar", ... })` and populates up to 8 product cards before the final payload is passed to the page. Hydration now also maps optional `slug` and `images[]` for image-first card rendering. The section is **hidden entirely when no qualifying products (active deals) are available** — `OneDollarSectionBlock` renders `null` when its product list is empty, so the homepage never shows a deals section (or its placeholder copy) with nothing to offer. If the catalog fetch fails, the section is likewise hidden and the rest of the page renders normally.

Implementation notes:

- persistent admin records are managed from `src/features/admin/homepage`
- section config validation uses Zod before writes and again when records are read back for storefront use
- audit entries are written on section, banner, and campaign mutations
- fallback content still protects storefront availability if admin content is absent or fully disabled
