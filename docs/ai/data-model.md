# AI Data Model Reference — Party Heaven

This file provides a compact reference of the Prisma data model for AI tooling, generation, and prompt-context use.

Models (summary)
- `User`: { id, email?, phone?, name?, roleId?, createdAt, updatedAt }
- `Role`: { id, key, name, permissions: JSON }
  - RBAC foundation roles: `SUPER_ADMIN`, `PRODUCT_MANAGER`, `ORDER_MANAGER`, `CUSTOMER`, `GUEST`
  - Admin role matrix: `SUPER_ADMIN` = full admin access, `PRODUCT_MANAGER` = catalog-focused admin access, `ORDER_MANAGER` = order-focused admin access
  - Storefront role scope: `CUSTOMER` = authenticated shopper with storefront and order access, `GUEST` = unauthenticated browsing-only access
- `Category`: { id, name, slug, description?, status, parentId?, seoTitle?, seoDescription? }
-- `Product`: { id, masterSku?, name, slug, shortDescription?, description?, status, categoryId?, metadata?: JSON, seoTitle?, seoDescription?, seoImageUrl? }
	- Note: `masterSku` is a parent/master product code (optional). The actual SKU used for inventory, pricing, and fulfillment lives on `ProductVariant.sku`.
-- `ProductVariant`: { id, productId, sku?, title?, options?: JSON, price, compareAtPrice?, currency }
-- `Inventory`: { id, productVariantId, quantity, reserved, location }
-- `ProductImage`: { id, productId?, productVariantId?, url, alt, position }
	- Rule: A `ProductImage` must reference at least one of `productId` or `productVariantId`. This is enforced by a DB CHECK constraint (`product_id IS NOT NULL OR product_variant_id IS NOT NULL`).
	- Usage: simple products use product-level images (`productId`); variant products attach each image to a specific variant (`productVariantId`) or keep it product-level as a shared image. The admin product form submits `variantIndex` (index into the product's `variants` array) and the service resolves it to the variant id. The storefront PDP shows the selected variant's images and switches variants when a variant-specific thumbnail is tapped.
- `ProductSpecification`: { id, productId, key, value }
- `Review`: { id, productId, userId?, rating, title?, body?, approved (deprecated compatibility mirror), status (canonical, default `PENDING`), moderationReason?, moderatedAt?, moderatedById? }
  - Canonical source of truth: `status` is authoritative for moderation and storefront visibility. Keep the legacy `approved` boolean synced as `status = 'APPROVED'` for backward compatibility until all consumers migrate.
  - Moderation status is one of `PENDING`, `APPROVED`, `REJECTED`, or `HIDDEN`; storefront-visible reviews require `status = 'APPROVED'`. If a legacy reader still consumes `approved`, it should treat `approved = true` only as a compatibility mirror of the approved status.
  - Default and migration plan: new reviews default to `PENDING`. Backfill existing rows deterministically from the legacy boolean and moderation metadata: `approved = true -> APPROVED`; `approved = false` stays `PENDING` unless existing moderation evidence in `moderatedAt` or `moderatedById` indicates a staff rejection or hide action, in which case set `status` accordingly and populate `moderationReason` when needed.
  - Safe rollout steps: 1) deploy `status` with a default or a temporary nullable period if the table is large; 2) backfill rows in one pass by reading `approved`, `moderatedAt`, and `moderatedById`; 3) verify counts before switching readers and writers to `status`; 4) keep `approved` synced as a deprecated compatibility field until old consumers are retired. Example SQL/ORM backfill: `update Review set status = case when approved = true then 'APPROVED' when moderatedAt is not null or moderatedById is not null then 'REJECTED' else 'PENDING' end, moderationReason = coalesce(moderationReason, 'Backfilled during review status migration') where status = 'PENDING'` followed by verification comparing approved rows with `status = 'APPROVED'`.
- `Wishlist` / `WishlistItem`: wishlist per user, items reference variants
- `Cart` / `CartItem`: carts accept optional userId and a `token` for guest sessions
- `Order` / `OrderItem` / `OrderAddress`: order snapshots contain productName, unitPrice, quantity and address snapshot fields
- `PaymentTransactionRecord` (TypeScript type only — no DB table yet): shape of a future `payment_transaction` row. Will be backed by a Prisma migration when the first online gateway (JazzCash, EasyPaisa, HBL Omni) is integrated. Fields: id, orderNumber, provider, amount (PKR paisa), currency, status (`PaymentTransactionStatus` — init states plus terminal webhook-driven states: captured, failed, cancelled, refund_initiated, refund_completed), gatewayReference?, gatewayResponse?, webhookPayload?, createdAt, updatedAt. See `src/features/checkout/types.ts` for the Prisma model snippet.
- `AuditLog`: generic audit trail with JSON changes
- `HomePageSection` / `Banner` / `DealCampaign`: marketing placeholders with `content`/`meta` JSON
- `ContactSubmission`: { id, fullName, email, subject, message, createdAt }
- `EmailSubscriber`: { id, email (unique, lowercase), firstName?, source, status (PENDING/ACTIVE/UNSUBSCRIBED/BOUNCED), tags: string[], unsubscribeToken (unique, opaque), confirmedAt?, unsubscribedAt?, providerMeta?: JSON }
  - New subscribers land as PENDING. Double opt-in (confirmation email) is deferred.
  - `unsubscribeToken` is used in all unsubscribe URLs — never embed raw email.
  - `source` is a plain slug string (e.g. "checkout", "newsletter_popup") — no enum to avoid schema churn.
- `AbandonedCartEvent`: append-only event log for the recovery pipeline. { id, cartId, cartToken, userId?, email?, eventType (CART_CREATED/CART_UPDATED/REMINDER_QUEUED/REMINDER_SENT/CART_RECOVERED/CART_EXPIRED), metadata?: JSON, createdAt }
  - Denormalized by design — cartToken and email are stored alongside cartId so events remain useful after the Cart row is archived.
  - The background recovery job (cron/queue) that reads events and sends recovery emails is **deferred**.
- `Cart` model has three new fields: `abandonedAt` (DateTime?), `recoveryToken` (String? unique), `recoveryEmailSentAt` (DateTime?).

Phase-2 planned model extension (not migrated yet)
- Referral tracking:
  - `ReferralProgram`: { id, code (unique), ownerUserId?, status, createdAt, updatedAt }
  - `ReferralVisit`: { id, referralProgramId, visitorSessionId, landingPath, campaign?, occurredAt }
  - `ReferralConversion`: { id, referralProgramId, orderId (unique), orderNumber, orderTotalMinor, occurredAt }
- Loyalty points:
  - `LoyaltyAccount`: { id, userId (unique), pointsAvailable, pointsPending, tier?, updatedAt }
  - `LoyaltyTransaction`: { id, loyaltyAccountId, points (signed int), reason, reference, occurredAt }
- Wallet ledger:
  - `Wallet`: { id, userId, currency (PKR), availableMinor, holdMinor, updatedAt }
  - `WalletLedgerEntry`: { id, walletId, direction (credit/debit), amountMinor, source, reference, note?, occurredAt }
- Integration note: Phase-2 contracts are prepared in `src/features/rewards/contracts.ts`; schema migration is intentionally deferred to avoid affecting current checkout/order execution.

Field types notes
- Monetary values are integers in the smallest currency unit to keep calculations precise.
- Flexible JSON fields (`metadata`, `permissions`, `content`) are intentionally used to reduce schema churn for marketing and feature flags.

How AI assistants should use this
- Prefer read-only access: use `Product`, `ProductVariant`, `Inventory` to answer availability and pricing questions.
- When drafting content (product descriptions, banners), fill SEO fields (`seoTitle`, `seoDescription`, `seoImageUrl`).
- For admin recommendations (pricing, promotions), consult `DealCampaign` and `HomePageSection` `content` JSON for placement and scope.

Migration / Seeding
- Seed creates the minimal role set and `uncategorized` category. Developers should run the included CLI scripts to generate migrations and apply them.
