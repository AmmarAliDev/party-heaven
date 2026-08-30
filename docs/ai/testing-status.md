# Testing Status

## Purpose

Provide a compact testing map for AI prompts so changes can target the right test layer quickly.

## Quality Gates

- Required for implementation prompts when relevant: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- For this docs-only step, required checks requested by task: `pnpm test` and `pnpm build`

## Test Layers in Repository

- `tests/smoke`: contract-level checks and cross-cutting behavior
- `tests/server/db`: db utility and transaction/pagination/query-result contracts
- `tests/lib`: shared utility behavior (auth, security, errors, seo, forms)
- `tests/features`: feature module behavior (admin, auth, cart, catalog, checkout, orders, reviews, etc.)
- `tests/e2e`: Playwright critical path flows
- `tests/prisma`: schema/workflow validation (live-db dependent)

## Current Strengths

- Broad feature-level unit/integration coverage across storefront and admin domains
- Focused tests on high-risk seams: checkout transport parsing, order placement, inventory adjustment safety, moderation behavior
- Shared foundation coverage for forms, tables, error handling, and security helpers
- Product admin SEO content generation coverage for output shape, schema/spec suggestion behavior, and missing-title failure messaging (`tests/features/admin/products/seo-content-generator.test.ts`)
- Admin image upload module covered at client orchestration and validation layers (`tests/features/admin/uploads/`)
- Homepage featured categories carousel covered with rendering, responsive card, and empty-state scenarios (`tests/features/homepage/featured-categories-section.test.tsx`)
- Homepage service coverage now includes featured-products most-sold ordering, published-product filtering, sparse-data fallback behavior, and recent-published-before-fallback backfill ordering (`tests/features/homepage/service.test.ts`)
- Product admin form upload integration covered with file selection, upload progress, and URL-write-back scenarios (`tests/features/admin/products/admin-product-form.test.tsx`)
- Smoke test suite extended with palette/token sanity checks for the fixed light theme (`tests/smoke/ui-foundation.test.ts`)

## Known Gaps (from current docs and coverage posture)

- Auth session/guard helper depth can be expanded
- Some admin action routes can use deeper action-level tests
- UI-heavy feature interactions still rely more on integration/E2E than component-level unit tests

## Test Update Rule for Future Prompts

1. Add or update tests in the closest existing layer to the changed logic.
2. Prefer feature tests for business behavior and smoke tests for contract-level expectations.
3. Keep user-safe error and fallback behavior covered when adding new async flows.
4. Update this file when testing posture or gaps materially change.