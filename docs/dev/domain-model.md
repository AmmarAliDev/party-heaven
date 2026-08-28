# Domain model — One Dollar

This document explains the Prisma-based domain model for the single-vendor One Dollar store.

## Quick reference

| Model | Table | Purpose |
|-------|-------|---------|
| `User` | `users` | Customers and staff accounts |
| `Role` | `roles` | Permission sets (`SUPER_ADMIN`, `PRODUCT_MANAGER`, `ORDER_MANAGER`, `CUSTOMER`, `GUEST`) |
| `Account` / `Session` | — | NextAuth adapter tables |
| `PasswordResetToken` | — | Short-lived password-reset tokens (hashed, single-use) |
| `EmailVerificationToken` | — | Short-lived email verification tokens (hashed, single-use) |
| `Address` | `addresses` | User addresses |
| `Category` | `categories` | Product categories with SEO fields |
| `Product` | `products` | Product master (simple + variant-based) |
| `ProductVariant` | `product_variants` | SKU-level record: inventory, pricing, options |
| `Inventory` | `inventories` | Quantity, reserved, safety stock per variant |
| `Review` | `reviews` | Customer product reviews with moderation state |
| `Wishlist` / `WishlistItem` | — | Per-user saved items |
| `Cart` / `CartItem` | — | Guest + authenticated cart |
| `Order` / `OrderItem` / `OrderAddress` | — | Immutable order snapshots |
| `AuditLog` | `audit_logs` | Append-only admin action log |
| `BlogPost` | `blog_posts` | CMS-style articles |
| `HomePageSection` | — | Storefront homepage CMS sections |
| `Banner` | — | Promotional banners |
| `DealCampaign` | — | Deal/campaign records |
| `StoreSettings` | — | Singleton store-identity and shipping defaults |
| `ContactFormSubmission` | — | Inbound contact form entries |
| `EmailSubscriber` | — | Newsletter subscribers with double opt-in lifecycle |
| `AbandonedCartEvent` | — | Append-only event log for cart recovery automation |

---

Goals
- Single-vendor commerce (no multi-tenant complexity).
- Pakistan-only scope; Karachi only initially.
- Inventory tracked at the ProductVariant level (required).
- Support guest checkout (orders may be placed without a registered user).
- Admins split by roles (super admin, product manager, order manager).

Key entities
- `User` — customers and staff accounts. Optional `roleId` links to `Role` for permissions. `email` and `phone` unique where present.
- `Role` — authoritative role records. `permissions` is a flexible JSON blob for feature flags and fine-grained permissions.
- `Account` / `Session` — NextAuth-compatible tables are included to make integration straightforward.
- `Address` — user addresses. Orders use `OrderAddress` snapshots so address changes do not mutate historic orders.
- `Category` — currently managed as simple categories in admin (no parent assignment), with `name`, `slug`, `description`, optional `cardImageUrl` (storefront category-card background media), `status`, and SEO fields.
- `One Dollar` storefront category is intentionally virtual/system-level (not persisted in `Category`). Membership is derived from published products priced at `<= Rs. 280`, and does not remove products from their original category assignments.
- `BlogPost` — CMS-style article record for storefront blog content with locale, title, slug, excerpt, structured content JSON blocks, cover-image metadata, publication status/date, and SEO fields.
- `Product` — product master record for both simple and variant-based products. Admin management covers content copy, related product links, images, specifications, status, an optional `masterSku`/`product_code` parent identifier, and shared SEO/metadata.
- Homepage most-sold ranking reads published `Product` records indirectly through `OrderItem.productId`; storefront rendering still applies the same published product + published category visibility rules as the main catalog.
- `ProductVariant` — SKU-level record used for inventory, pricing, fulfillment, and shopper options JSON such as color/size. `Inventory` is required per variant, and `ProductVariant.sku` is the authoritative SKU for orders and stock.
- `ProductImage` — product media record. It references the product (`productId`) and/or a specific variant (`productVariantId`); a DB CHECK constraint guarantees at least one is set. For simple products every image is product-level. For variant products images are attached to a specific variant (or kept product-level as a shared image), and the storefront gallery switches variants when a variant-specific thumbnail is tapped.
- `Inventory` — tracks `quantity`, `reserved`, `safetyStock` and `location` (Karachi by default). Admin inventory now supports manual adjustments in the low-stock workspace, with server-side validation and optimistic concurrency protection using `updatedAt`. Low-stock reporting uses `onHand = (quantity - reserved)` and compares against an effective alert threshold: `safetyStock` when it is greater than zero, otherwise the global `StoreSettings.lowStockThreshold` fallback.
- `Review` — customer product feedback now includes moderation-aware state (`PENDING`, `APPROVED`, `REJECTED`, `HIDDEN`) plus optional moderation reason/timestamps so admins can safely control storefront visibility without deleting the original text.
- `Wishlist`, `Cart` (and their items) support shopper intent and purchase flows.
- `Order` / `OrderItem` / `OrderAddress` — orders contain snapshot fields (productName, unitPrice, etc.) so historical data remains stable.
- Homepage featured-products uses `OrderItem.productId` as the aggregation key and sums `OrderItem.quantity` for orders in `CONFIRMED`, `PACKED`, `SHIPPED`, or `DELIVERED` status to derive a practical "most sold" ranking.
- `AuditLog` — simple auditing table to store actor, action and JSON diffs, including admin review moderation and admin inventory adjustment events (`inventory.adjusted`).
- `HomePageSection`, `Banner`, `DealCampaign` — lightweight CMS / marketing placeholders.
- `HomePageSection.content.products` for the `featured-products` section remains a temporary fallback seed list. Storefront homepage resolution prefers live most-sold data first, then uses this stored array only to fill gaps while real sales history is still sparse.
- `StoreSettings` — singleton-style operational settings record (`id = default`) for store identity, support contact channels, shipping baseline defaults, and simple operations defaults used by admin workflows.

Data and indexing strategy
- Timestamps: `createdAt` and `updatedAt` are present on most models (`@default(now())` and `@updatedAt`).
- Unique constraints for `slug`, `ProductVariant.sku`, and `orderNumber` support lookups and safe indexing. The product-level identifier is `masterSku` (optional) and not required to be unique.
- `BlogPost` enforces a composite unique constraint on `(locale, slug)` so the same slug can exist across locales while remaining unique per locale. Blog indexing includes `status`, `publishedAt`, and `(locale, status)` for listing/publish workflows.
- Indexes on foreign keys (`userId`, `productId`, `categoryId`) to support common queries.
- Price fields use integer in the smallest currency unit (PKR) to avoid floating point errors.
- Admin dashboard revenue metric currently treats recognized revenue as the sum of `Order.total` for `DELIVERED` orders where `refundStatus` is not `COMPLETED` (completed refunds are excluded from the aggregate).
- Because checkout currently supports COD only, `paymentStatus` is intentionally not used yet as a revenue-recognition gate for dashboard cards.
- Admin revenue reporting at `/admin/revenue` uses the same recognition assumptions and adds practical period windows (`last 7 days`, `last 30 days`) plus order totals summaries to support day-to-day admin decisions.
- Admin inventory adjustments enforce quantity-integrity rules server-side: resulting quantity cannot be negative and cannot be lower than `reserved`; stale writes are rejected when `updatedAt` no longer matches the submitted version.
- Admin settings are intentionally scoped to practical first-pass controls. The singleton record avoids over-modeling while allowing future additive fields and grouped settings sections.

Auth & permissions
- Users reference a `Role` record and roles are exposed as an enum `RoleKey` for convenience.
- `Role.permissions` is a JSON field that allows adding granular flags (e.g., `{"products.create": true}`).

Guest checkout
- `Order.userId` is nullable. Orders use `OrderAddress` snapshot models so guest emails/phones are stored on the Order record.

Internationalization & future features
- Country/City enums are intentionally small to start (`PAK`, `KARACHI`). Add more entries as the app expands.
- Design anticipates adding payment gateways, referrals, loyalty programs, and Urdu localization — use `metadata`/`Json` fields and campaign tables.

Seeding and migrations
- Minimal seed script `prisma/seed.js` creates roles and a default category. Keep seed data lightweight.
- Local/dev demo catalog populator `prisma/populate-dev-catalog.js` (run via `pnpm prisma:seed:dev-catalog`) upserts a deterministic multi-category dataset with SEO/image fields and mixed price bands so One Dollar eligibility (`<= Rs. 280`) can be tested without production data.
- The included `prisma/schema.prisma` is the source of truth. Run `npm run prisma:validate` and `npm run prisma:migrate:dev` locally to generate migrations and apply them.

Notes and next steps
- Add full-text search indices for product search (Postgres `GIN`/`tsvector`).
- Add reporting materialized views or analytics tables as traffic grows.
- Customer-facing review flows are now live:
	- PDP review submission requires an authenticated user and a delivered order containing the product before first submission.
	- Subsequent customer edits are allowed for owned reviews and reset moderation to `PENDING` to prevent unreviewed updates from staying visible.
	- Account review history (`/account/reviews`) is user-scoped and shows moderation status, storefront visibility, and a customer-facing `moderationReason` when reviewers need to see why a review is hidden or rejected.
	- Storefront review rendering remains moderation-gated (`APPROVED` only), so admin actions on `Review.status` directly control visibility.
- Add admin UI pages to manage `DealCampaign` and `HomePageSection` objects.
- Wishlist currently supports a seed-bridge write path: when a storefront item comes from the temporary catalog seed layer (`src/features/catalog/data`) rather than a fully persisted catalog record, the wishlist flow creates or reuses a `Wishlist` for the user, then upserts only the minimum relational shell needed for `WishlistItem` to stay valid. In practice this means `Category` gets `slug`, `name`, and a placeholder `description`; `Product` gets `slug`, `name`, `shortDescription`, `description`, `categoryId`, and `status`; `ProductVariant` gets `productId`, `sku`, `title`, `price`, `compareAtPrice`, `currency`, and `isDefault`; `Wishlist` stores `userId`; and `WishlistItem` stores `wishlistId`, `productVariantId`, and `quantity`. Fields outside that bridge path, such as richer product metadata/SEO, master identifiers, variant `options`, images, reviews, specifications, and `Inventory`, are left empty or absent until full catalog persistence exists. FIXME: this is technical debt. While it preserves foreign-key integrity for `WishlistItem`, consistency still depends on seed slugs/SKUs remaining stable and on the bridge rows not diverging from the eventual source of truth; until full catalog persistence is in place, `WishlistItem` relations point at catalog-lite records that may be incomplete for downstream flows that expect full `Product`/`ProductVariant` data.
