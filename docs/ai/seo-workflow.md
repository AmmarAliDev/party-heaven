# AI SEO Workflow

## Goal

Use one shared admin SEO pattern for categories, products, future blog posts, and future key pages.

## Required implementation pattern

For new admin content forms:

1. Reuse the shared component in `src/features/admin/components/admin-seo-section.tsx`
2. Reuse the shared validation helpers in `src/features/admin/seo/schema.ts`
3. Preserve user-friendly field labels and validation messages
4. Keep preview behavior live and readable for non-technical operators
5. Prefer extension over duplication

## Field rules

Support the following whenever the content model allows it:

- slug
- meta title
- meta description
- canonical URL override
- OG title
- OG description
- OG image
- noindex
- structured data notes

## Copy rules for AI-generated SEO suggestions

- Keep language natural and human-readable
- Avoid keyword stuffing
- Prefer benefit-led summaries
- Keep titles concise and descriptions scannable
- Treat canonical and noindex as advanced controls, not defaults

## Validation expectations

- reject malformed slugs
- reject reserved storefront slugs
- show clear duplicate-slug conflict copy
- keep canonical and OG image inputs restricted to valid paths or URLs

## Current repository note

Catalog storefront pages are still using seeded fallback data in this milestone.

The storefront blog foundation is now live with metadata and JSON-LD wiring, but admin blog CRUD and persistence-backed publishing remain deferred.

Reuse the same SEO field contract when admin blog editing is introduced.

## Storefront SEO operations (2026-09-01)

- `src/app/robots.ts` must keep `allow: "/"` first. A prior commit "cleaned up" the rules by commenting out the allow/disallow blocks and leaving `disallow: "/"`, which blocked ALL indexing. Verify `GET /robots.txt` serves `Allow: /`.
- Transactional/user pages (cart, checkout, checkout/confirmation, wishlist, preview, `/account/*`, `/auth/*`, `/unauthorized`, `/forbidden`) are marked `noIndex: true` via `buildMetadata`. Do not remove this — it matches the robots disallow list.
- Brand rename data migration: `prisma/migrations/20260901000000_rename_brand_in_catalog_seo` replaced remaining `One Dollar` in catalog `seo_title`/`seo_og_title`. Do NOT touch `seo_image_url` (the party-heaven blob key still contains `one-dollar-...`).
- Lighthouse audit runner + report summarizer: `scripts/lighthouse-audit.mjs` (audit) and `scripts/summarize-lighthouse.mjs` (summarize a report directory, e.g. `node scripts/summarize-lighthouse.mjs seo ./lighthouse-reports`). Reports under `lighthouse-reports/` are gitignored.

## Category SEO content generator

`src/features/catalog/seo/category-seo-content.ts` provides `generateCategorySeoContent(category, options?)`.

- Returns `CategorySeoContent`: title, description, introCopy, faqs, internalLinks, blogTopics, schemaNotes.
- Template-driven; no external API.  Per-slug templates for `home-care`, `grocery`, `personal-care`. Generic fallback for any other slug.
- Call with `allCategorySlugs` option to generate accurate sibling internal links.
- Deferred: dynamic content enrichment from live product data (price ranges, product counts) pending full DB-backed storefront data.
- Tests: `tests/features/catalog/category-seo-content.test.ts`.
