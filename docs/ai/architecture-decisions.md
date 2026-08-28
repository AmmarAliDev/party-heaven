# Architecture Decisions

## Purpose

Record stable design choices so future prompts can extend the system without breaking existing boundaries.

## Decision 1: Feature-first domain layering

- Decision: Keep business logic in `src/features/*` and server composition in `src/server/*`; keep `src/app/*` thin.
- Why: Improves maintainability, testing, and mobile-client reuse.
- Consequence: Route handlers/pages should delegate to services/contracts instead of embedding domain rules.

## Decision 2: Database access conventions

- Decision: Use shared server/db patterns for Prisma client, repository context, transactions, pagination, and query result contracts.
- Why: Prevents duplicated transaction/pagination behavior and inconsistent query semantics.
- Consequence: New data operations should follow existing repository/service patterns.

## Decision 3: Publish-state visibility enforcement

- Decision: Storefront catalog/blog visibility is controlled centrally in service/query layers.
- Why: Keeps storefront exposure rules consistent across pages, APIs, and future clients.
- Consequence: Do not bypass service/query visibility filters in route files.

## Decision 4: Contract-first checkout transport seam

- Decision: Checkout client/API uses explicit contract parsing and normalized error handling.
- Why: Improves resilience and keeps transport behavior reusable for future mobile clients.
- Consequence: New checkout transport behavior should extend existing contract files, not ad-hoc inline parsing.

## Decision 5: Payment provider abstraction with COD-first rollout

- Decision: COD remains active while gateway interfaces/types are prepared for future integrations.
- Why: Allows safe incremental gateway rollout without rewriting checkout.
- Consequence: Gateway-specific code must implement the provider contract and webhook model when activated.

## Decision 6: Shared UX reliability primitives

- Decision: Use shared error/loading/empty states, safe user messaging, and redacted logging patterns.
- Why: Consistent and non-technical user experience across storefront and admin surfaces.
- Consequence: New interactive flows should map failures through shared error utilities and fallback components.

## Decision 7: Shared table and form foundations

- Decision: Reuse app-wide table and form abstractions across admin and auth/checkout forms.
- Why: Reduces drift, improves consistency, and centralizes validation/interaction patterns.
- Consequence: New admin lists/forms should integrate with shared foundations unless there is a clear workflow exception.

## Decision 8: Auditability as a cross-cutting concern

- Decision: High-impact admin mutations and inventory/order transitions are captured in AuditLog.
- Why: Supports operational traceability and compliance-readiness.
- Consequence: New privileged mutations should define explicit audit event names and include actor/context metadata.

## Decision 9: Explicit deferment over hidden partial work

- Decision: Major non-trivial flows (payments, advanced inventory/revenue, email automation) are deferred with documented seams.
- Why: Prevents risky half-implementations while preserving future extension paths.
- Consequence: Deferred features must be documented in `docs/ai/open-tasks.md` and relevant dev docs.

## Decision 10: Forgiving tokenized catalog search with relevance ranking

- Decision: Storefront keyword search widens the query before hitting the DB (tokenize into words, expand each token with plural/singular variants, match across `name`, `shortDescription`, `description`, and `category.name`) and ranks a candidate pool by relevance (name > category > shortDescription > description) before applying the final limit.
- Why: The previous whole-phrase `ILIKE` over three fields missed category searches, plural forms (`"chains"` vs `"chain"`), and multi-word queries, and `createdAt` ordering let incidental description matches crowd out literal name/category matches (e.g. `"candles"` returning balloons that merely mention candles).
- Consequence: Query widening + scoring helpers live in `src/features/catalog/lib/search-text.ts` (shared by the DB query layer and the search adapter); the DB query returns a candidate pool and the adapter owns relevance ordering. Swapping in a dedicated search engine still only requires replacing the adapter internals — the widened matching contract is preserved by the seam.

## Decision 11: Batch variant-image merge in the catalog query layer

- Decision: Because Prisma's `Product.images` relation only returns product-level rows, the storefront query layer merges variant-level images into every published-product listing (`listPublishedProductsByCategory`, `listAllPublishedProducts`, `getRelatedPublishedProducts`, `listPublishedProductsByIds`, `searchPublishedProducts`) via a single batched `productImage.findMany` per listing (`mergeVariantImagesIntoProducts`), and the admin edit form applies the same single-product merge in `getAdminProductById`. The PDP detail query already merged variant images for a single product.
- Why: Variant products store media on `ProductVariant.images` (`productVariantId` set, `productId` null), so `Product.images` returns nothing for variant-only products. Without the merge, product cards, search results, related products, and homepage sections showed the placeholder gradient, and the admin edit form showed an empty image list.
- Consequence: Cards and the admin form now reflect the real variant cover while keeping one batched query per listing (no N+1 per product). Merged variant images are ordered by the product's variant order (default variant first), and `mapProductToCard` passes that same order to `mapProductImages`, so the DEFAULT variant's image is used as the card cover when no product-level image exists. The homepage `backfillVariantPrimaryImages` workaround became redundant and was removed. `mapProductImages`/`mapAdminProduct` consume the already-merged `images` array.