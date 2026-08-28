# Admin Guide

This guide explains the admin panel available at `/admin`. It covers access control, each management section, and day-to-day operational workflows.

---

## Table of Contents

1. [Access control](#1-access-control)
2. [Admin dashboard](#2-admin-dashboard)
3. [Orders](#3-orders)
4. [Products](#4-products)
5. [Categories](#5-categories)
6. [Inventory](#6-inventory)
7. [Reviews moderation](#7-reviews-moderation)
8. [Blog management](#8-blog-management)
9. [Homepage CMS](#9-homepage-cms)
10. [Revenue reports](#10-revenue-reports)
11. [Activity log](#11-activity-log)
12. [Store settings](#12-store-settings)
13. [Technical implementation notes](#13-technical-implementation-notes)

---

## 1. Access control

### Roles

| Role key | Who | What they can do |
|----------|-----|-----------------|
| `SUPER_ADMIN` | Owner / technical lead | Everything |
| `PRODUCT_MANAGER` | Catalog team | Products, categories, inventory, blog, homepage CMS, SEO |
| `ORDER_MANAGER` | Operations team | Orders, reviews |
| `CUSTOMER` | Registered shoppers | No admin access |
| `GUEST` | Unauthenticated users | No admin access |

### How access is enforced

Two layers protect every admin route:

1. **`src/proxy.ts`** — an optimistic early redirect. If the request clearly has no admin session hint, it redirects to `/auth/sign-in?callbackUrl=/admin` before the page renders. This is a performance optimization, not the security boundary.

2. **`src/app/(admin)/layout.tsx`** — the authoritative server-side guard. It always calls `requireAdminAccess()` during rendering. If the session is missing or the role lacks admin privileges, the user is redirected to `/unauthorized`.

> **Rule:** if the proxy allows something that the layout denies, the layout wins.

### Granting a role to a user

Roles are assigned via the `User.roleId` field. There is currently no admin UI for role management. Assign roles directly:

**Via Prisma Studio:**

```bash
pnpm prisma:studio
# Navigate to the User model → find the user → set roleId to the UUID of the desired Role
```

**Via SQL:**

```sql
UPDATE "users"
SET role_id = (SELECT id FROM roles WHERE key = 'SUPER_ADMIN')
WHERE email = 'you@example.com';
```

### Role-aware navigation

The admin sidebar renders only items the current role can access. The filtering logic lives in `src/features/admin/navigation/` and is tested in `tests/features/admin/navigation/navigation.test.ts`.

---

## 2. Admin dashboard

**URL:** `/admin`

**Source:** `src/features/admin/dashboard/service.ts`

The dashboard shows live operational metrics:

| Card | Source | Notes |
|------|--------|-------|
| Pending orders | Count of `Order` with `status = PENDING` | Refreshes on page load |
| Revenue (delivered) | Sum of `Order.total` where `status = DELIVERED` and `refundStatus != COMPLETED` | COD only — no payment gateway |
| Low-stock alerts | Count of variants where `quantity <= safetyStock` | Tap to go to Inventory |
| Recent activity | Latest 5 `AuditLog` entries | Links to the full Activity log |

---

## 3. Orders

**URL:** `/admin/orders`

**Source:** `src/features/admin/orders/`

### Order lifecycle

```
PENDING → CONFIRMED → PACKED → SHIPPED → DELIVERED
               ↘
             CANCELLED (from PENDING or CONFIRMED)
```

Transitions are validated server-side. `canTransitionOrderStatus()` in `src/features/orders/status.ts` enforces the allowed state machine. Invalid transitions are rejected with a user-friendly error.

### Updating an order status

1. Click the order row to open the detail view.
2. Use the **Status** dropdown to select the next valid status.
3. Click **Save** — the server action validates the transition, updates the order, dispatches notifications, and writes an audit entry.

### Internal notes

Each order has an **Internal Notes** field visible only to admins. Notes are append-only (each save overwrites the current note). They are not shown to customers.

### Notifications on status change

- **Order confirmed** → email to customer + Telegram alert to admin group.
- **Order shipped** → email to customer.
- **Order delivered** → email to customer.
- **Order cancelled** → email to customer.

All notifications are non-blocking — a delivery failure never prevents the status update from saving.

### Filtering and sorting

The order list supports:
- Status filter (multi-select)
- Date range filter
- Search by order number or customer email
- Sort by date (default: newest first)

---

## 4. Products

**URL:** `/admin/products`

**Source:** `src/features/admin/products/`

### Product types

| Type | When to use |
|------|-------------|
| **Simple product** | One price, one SKU, no variants |
| **Variant-based product** | Multiple options (size, color) — each option is a `ProductVariant` |

### Creating a product

1. Go to `/admin/products/new`.
2. Fill in the **Content** tab: name, slug, description, images.
3. Fill in the **Pricing & Inventory** tab: add at least one variant with a SKU, price, and starting quantity.
4. (Optional) Fill in the **SEO** tab: `seoTitle`, `seoDescription`, canonical URL, Open Graph fields.
5. Set **Status** to `DRAFT` or `PUBLISHED`.
6. Click **Save**.

**After save:** the admin action calls `revalidatePath('/categories')` to immediately invalidate the ISR cache for storefront category/listing pages. Published products appear on the storefront within the next request.

### Product statuses

| Status | Visible on storefront |
|--------|-----------------------|
| `DRAFT` | No |
| `PUBLISHED` | Yes |
| `ARCHIVED` | No |

### SEO fields

Every product has a full set of SEO override fields. If left empty, storefront metadata falls back to the product `name` and `shortDescription`. Set these fields for priority products.

### Slugs

Slugs must be unique and URL-safe (`lowercase-with-hyphens`). The admin form validates slugs on save and rejects duplicates.

### Images

Images are stored as `ProductImage` records. How they are linked depends on the product type:

- **Simple products** — every image is linked to the product itself. All images appear in the storefront gallery exactly as before.
- **Variant products** — each image can be linked to a specific variant (the default), or left as **All variants (shared)**. When a shopper views a variant product on the storefront, the gallery shows the selected variant's images; tapping a thumbnail that belongs to another variant also selects that variant, so the price/SKU/stock stay in sync.

The primary image (the first image of the product, or of the selected variant) is used in listings and cart thumbnails. Cart thumbnails prefer the variant image when one exists.

> **Note:** image upload is currently handled by storing a URL. A media upload integration is deferred.

---

## 5. Categories

**URL:** `/admin/categories`

**Source:** `src/features/admin/categories/`

Categories are flat (no nesting). Each category has:
- `name`, `slug`, `description`
- `status` (`DRAFT`, `PUBLISHED`, `ARCHIVED`)
- Full SEO field set

Products are assigned to one category via `Product.categoryId`. The storefront shows only `PUBLISHED` categories.

**After any category save:** `revalidatePath('/categories')` invalidates the storefront ISR cache.

---

## 6. Inventory

**URL:** `/admin/inventory`

**Source:** `src/features/admin/inventory/`

The inventory workspace shows all product variants where `quantity <= safetyStock` (low-stock view). It supports manual stock adjustments.

### Manual adjustment

1. Click **Adjust** on a low-stock row.
2. Enter the new `quantity` value.
3. Click **Save** — the server validates:
   - Resulting quantity ≥ 0
   - Resulting quantity ≥ `reserved` (prevents adjusting below committed stock)
   - `updatedAt` matches (optimistic concurrency — stale writes are rejected)
4. An `AuditLog` entry is written with `action = "inventory.adjusted"` and a diff payload.

**Required permissions:** `admin:access` + `catalog:write` (available to `SUPER_ADMIN` and `PRODUCT_MANAGER`).

---

## 7. Reviews moderation

**URL:** `/admin/reviews`

**Source:** `src/features/admin/reviews/`

Customer product reviews go through a moderation queue before appearing on the storefront.

### Review lifecycle

```
PENDING → APPROVED  (visible on storefront)
       ↘ REJECTED  (not visible; customer can see rejection reason in /account/reviews)
       ↘ HIDDEN    (was approved, now suppressed without deletion)
```

### Moderation workflow

1. Open `/admin/reviews` — the default view shows `PENDING` reviews.
2. Read the review content and check the associated product.
3. Choose **Approve**, **Reject**, or **Hide**.
4. Optionally enter a `moderationReason` (displayed to the customer in their account).
5. Click **Save** — the action requires `admin:access` + `catalog:write`.

An `AuditLog` entry is written for each moderation action.

### Storefront visibility

Only `APPROVED` reviews appear on product detail pages. Moderating a review is immediately reflected on the storefront (no ISR delay — moderation changes query fresh from DB on next storefront request).

---

## 8. Blog management

**URL:** `/admin/blog`

**Source:** `src/features/admin/blog/`

### Creating a blog post

1. Go to `/admin/blog/new`.
2. Fill in: `title`, `slug`, `excerpt`.
3. Add `contentJson` — an array of content blocks in structured JSON format (see below).
4. Upload/link a cover image and fill in the alt text.
5. Set `status` (`DRAFT` or `PUBLISHED`) and optionally set `publishedAt` for scheduling.
6. Fill in SEO fields if needed.
7. Click **Save**.

### Content JSON block format

Posts use a structured block model. Each block is an object with a `type` and type-specific fields. Current supported types:

```json
[
  { "type": "paragraph", "text": "Opening paragraph text." },
  { "type": "heading", "level": 2, "text": "Section Heading" },
  { "type": "image", "url": "https://...", "alt": "Image description", "width": 1200, "height": 630 },
  { "type": "list", "style": "unordered", "items": ["Item one", "Item two"] }
]
```

> The admin UI currently accepts content JSON as a textarea. A rich-text/block editor UI is deferred.

### Publishing and scheduling

- **`PUBLISHED` + `publishedAt` in the past** → visible on storefront immediately.
- **`PUBLISHED` + `publishedAt` in the future** → scheduled; hidden from storefront until that date/time.
- **`DRAFT`** → never visible on storefront regardless of `publishedAt`.
- **`ARCHIVED`** → hidden from storefront.

### Cache invalidation after save

Admin blog mutations call:
- `revalidatePath('/blog')` — refreshes the blog listing page
- `revalidatePath('/blog/[slug]', 'page')` — refreshes the individual post page
- `revalidatePath('/admin/blog')` — refreshes the admin list

Changes are reflected on the storefront within the next request.

---

## 9. Homepage CMS

**URL:** `/admin/homepage`

**Source:** `src/features/admin/homepage/`

The homepage CMS manages three types of content blocks:

| Section type | Purpose |
|---|---|
| `HomePageSection` | Generic content sections (hero, feature callouts, etc.) |
| `Banner` | Promotional banners (image + link + CTA) |
| `DealCampaign` | Timed deal or campaign blocks |

Each block has a `status` field (`ACTIVE` / `INACTIVE`) and a `sortOrder` for controlling display order.

The storefront homepage service (`src/features/homepage/service.ts`) reads these records and maps them to typed section payloads. Only `ACTIVE` blocks are shown.

---

## 10. Revenue reports

**URL:** `/admin/revenue`

**Source:** `src/features/admin/revenue/service.ts`

The revenue report shows:

- **Total recognized revenue** — sum of `Order.total` for `DELIVERED` orders where `refundStatus != COMPLETED`
- **Last 7 days** — same filter within the last 7 days
- **Last 30 days** — same filter within the last 30 days
- **Recent order summary** — recent order totals table

### Revenue recognition assumptions

- Only `DELIVERED` orders are counted as recognized revenue.
- Orders with `refundStatus = COMPLETED` are excluded (refunded orders are not revenue).
- `PENDING`, `CONFIRMED`, `PACKED`, `SHIPPED`, and `CANCELLED` orders are not included.
- Because checkout is COD-only, `paymentStatus` is not used as a recognition gate.

These are intentionally simple assumptions for the current COD-only phase. Update the service logic when a payment gateway is integrated.

---

## 11. Activity log

**URL:** `/admin/activity`

**Source:** `src/features/admin/activity/service.ts`

The activity log shows a reverse-chronological feed of admin actions recorded in the `AuditLog` table. Each entry includes:

- A human-readable event summary (non-technical)
- The actor (admin user name/email when available)
- Timestamp

### What is logged

| Action | Where triggered |
|--------|----------------|
| `order.status_updated` | Order status change |
| `review.moderated` | Review approve/reject/hide |
| `inventory.adjusted` | Manual stock adjustment |
| Admin product/category create/update/delete | Various admin server actions |

### Adding a new audit event

Use `logAdminAction()` from `src/lib/audit/admin-actions.ts` inside any server action:

```ts
import { logAdminAction } from "@/lib/audit/admin-actions";

await logAdminAction({
  action: "your_feature.action_name",
  actorId: session.user.id,
  resourceId: entity.id,
  resourceType: "EntityName",
  diff: { before: previousState, after: newState },
});
```

---

## 12. Store settings

**URL:** `/admin/settings`

**Source:** `src/features/admin/settings/`

Store settings is a singleton record (`StoreSettings` with `id = "default"`). It controls:

| Setting group | Fields |
|---|---|
| Store identity | Store name, tagline, logo URL |
| Support contacts | Support email, phone, WhatsApp link |
| Shipping defaults | Default shipping fee, free-shipping threshold, estimated delivery days |
| Operations | Order prefix, invoice prefix |

Changes are applied via a CSRF-protected server action. Only `SUPER_ADMIN` can modify settings.

> Settings fields are intentionally minimal for launch. Add new fields to the `StoreSettings` Prisma model and the settings form as operational needs grow.

---

## 13. Technical implementation notes

### Server actions vs. route handlers

Admin mutations use **Next.js Server Actions** (not API route handlers). This means:

- Form submissions call server functions directly — no separate API endpoint needed.
- CSRF protection is via `assertTrustedOrigin()` in `src/lib/security/csrf.ts`.
- Server actions are not publicly callable via HTTP `fetch` from external origins (trusted-origin check enforces this).

### Form system

Admin forms use the shared `DynamicForm` + `useAppForm` hook from `src/components/forms/`. This means:

- All fields are declared as a typed schema.
- Validation runs on the client (Zod) before submission.
- Errors are displayed inline using `FormErrorSummary`.
- The server action independently re-validates all inputs — client-side validation is a UX convenience only.

### RBAC in server actions

Every admin server action starts with permission checks:

```ts
const session = await requireAdminAccess();           // blocks if no admin session
assertHasPermission(session, "catalog:write");        // blocks if role lacks permission
assertTrustedOrigin(requestHeaders);                  // blocks cross-origin requests
```

If any check fails, the action throws or returns an error state — it never proceeds to DB writes.

### Audit logging

All state-changing admin actions write to `AuditLog`. The pattern is:

```
1. Validate input
2. Perform DB mutation (in a transaction if multiple writes)
3. Write AuditLog entry (in the same transaction or immediately after)
4. Revalidate affected ISR paths
5. Return success state
```

Audit entries are append-only and never deleted.
