# Content Operations

This guide documents operational and developer workflows for all database-backed storefront content: blog posts, homepage CMS sections, and the newsletter subscriber list.

---

## Table of Contents

1. [Blog posts](#1-blog-posts)
2. [Homepage CMS sections](#2-homepage-cms-sections)
3. [Email subscribers](#3-email-subscribers)
4. [Deferred / future](#4-deferred--future)

---

## 1. Blog posts

### Source of truth

- Blog content lives in the `BlogPost` Prisma model (`blog_post` table).
- Storefront routes (`/blog`, `/blog/[slug]`) read exclusively from the database.
- Legacy hardcoded seed content is no longer used at runtime.

### Admin workflow

- **List:** `/admin/blog`
- **Create:** `/admin/blog/new`
- **Edit:** `/admin/blog/[postId]/edit`

**Supported fields:**

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | Required |
| `slug` | string | URL-safe, unique per locale; auto-derived from title if empty |
| `excerpt` | string | Short description shown in listing |
| `contentJson` | JSON array | Structured content blocks (see below) |
| `coverImageUrl` | string | Public URL to the cover image |
| `coverImageAlt` | string | Required for accessibility when `coverImageUrl` is set |
| `coverImageWidth` / `Height` | integer | Intrinsic dimensions for `<Image>` |
| `status` | enum | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `publishedAt` | datetime | Controls scheduling; must be in the past for immediate visibility |
| `seoTitle`, `seoDescription` | string | Override site-level SEO meta |
| `seoCanonicalUrl` | string | Set if the canonical URL differs from the default |
| `seoOgTitle`, `seoOgDescription`, `seoImageUrl` | string | Open Graph overrides |
| `seoNoIndex` | boolean | Exclude from search engines |

### Content JSON block format

```json
[
  { "type": "paragraph", "text": "Opening paragraph." },
  { "type": "heading", "level": 2, "text": "Section Heading" },
  { "type": "image", "url": "https://...", "alt": "Image description", "width": 1200, "height": 630 },
  { "type": "list", "style": "unordered", "items": ["First item", "Second item"] }
]
```

> The admin textarea currently accepts raw JSON. A block editor UI is deferred. Validate JSON before saving to avoid a runtime parse error on the storefront.

### Publish visibility rules

| Status | `publishedAt` | Visible on storefront |
|--------|---------------|-----------------------|
| `PUBLISHED` | Past | ✅ Yes |
| `PUBLISHED` | Future | ❌ No (scheduled) |
| `DRAFT` | Any | ❌ No |
| `ARCHIVED` | Any | ❌ No |

`includeDrafts` can be passed to the service layer for internal preview tooling — this is never passed from public storefront routes.

### Error handling

- Slug collisions produce a user-friendly admin form error (not a 500).
- Validation rejects malformed slugs, invalid content JSON, invalid publish dates, and malformed URL fields.
- Admin mutations enforce `assertTrustedOrigin()` + RBAC (`admin:access` + `catalog:write`).

### Cache invalidation

After any blog create/update/delete mutation, the server action calls:

- `revalidatePath('/blog')` — refreshes the listing
- `revalidatePath('/blog/[slug]', 'page')` — refreshes the individual post
- `revalidatePath('/admin/blog')` — refreshes the admin list

Changes appear on the storefront within the next request (no stale cache window).

---

## 2. Homepage CMS sections

### Source of truth

- `HomePageSection`, `Banner`, and `DealCampaign` Prisma models.
- The homepage service (`src/features/homepage/service.ts`) reads all active records and assembles the typed section payload used by the storefront.

### Admin workflow

- **Manage:** `/admin/homepage`

Operational pages:

- **Sections:** `/admin/homepage/sections` (hero banner, deal spotlight, featured categories/products, announcement, blog highlights, party-heaven shell)
- **Banners:** `/admin/homepage/banners` (announcement-style promos)
- **Deal campaigns:** `/admin/homepage/campaigns` (scheduled campaign overlays)

Each section supports:

- active/inactive (`active`)
- ordering (`position`)
- optional schedule window (`startAt` / `endAt` in section meta)
- typed JSON content validated on save and revalidated on storefront reads

Deal spotlight is managed as a section type (`deal-spotlight`) under sections. It supports an optional media payload:

```json
{
  "image": {
    "url": "https://store.public.blob.vercel-storage.com/admin/content/deal.png",
    "alt": "Descriptive image alt text"
  }
}
```

Image URL safety rules match storefront constraints: root-relative paths or configured hosts only.

### Adding new section types

1. Add a new enum value or discriminated-union block type to the section payload type in `src/features/homepage/types.ts`.
2. Register a rendering component in `src/features/homepage/components/` and export it through the section registry.
3. Add the new type to `SECTION_RENDER_ORDER` in `src/features/homepage/section-registry.ts`.
4. Add admin form fields and validation schema for the new type.

The `resolveHomepageSections` and `hasRegisteredSectionComponent` utilities enforce that only registered section types are rendered. Unregistered types are silently dropped — this prevents a bad DB record from crashing the homepage.

---

## 3. Email subscribers

### Source of truth

- `EmailSubscriber` Prisma model.
- Managed via the subscriber service at `src/features/email-marketing/service.ts`.

### Subscriber statuses

| Status | Meaning |
|--------|---------|
| `PENDING` | Double opt-in email sent but not confirmed (double opt-in flow deferred) |
| `ACTIVE` | Confirmed subscriber; receives future campaigns |
| `UNSUBSCRIBED` | Opted out via unsubscribe link; must not be re-subscribed without explicit consent |
| `BOUNCED` | Hard bounce from sending provider; must not be emailed again |

### Unsubscribe flow

Each marketing email should include a one-click unsubscribe link using the token stored in `EmailSubscriber.unsubscribeToken`. The route handler `POST /api/email/unsubscribe` processes these requests.

### Viewing subscribers

There is no admin UI for the subscriber list in this release. Query directly via Prisma Studio (`pnpm prisma:studio`) or SQL for now.

### Deferred: campaign sending

The `SubscriberStatus` enum and service scaffolding are in place. Connecting a live campaign delivery integration (Mailchimp, Brevo, Klaviyo) is deferred. See `src/features/email-marketing/` for the current stub.

---

## 4. Deferred / future

| Feature | Status | Notes |
|---------|--------|-------|
| Rich-text / block editor | Deferred | Blog content is raw JSON in a textarea |
| Media upload | Deferred | Images are stored as URLs; no CDN upload |
| Localized blog routes (Urdu) | Deferred | Locale column exists on `BlogPost` |
| Email campaign sending | Deferred | Subscriber list exists; delivery integration pending |
| Double opt-in for newsletter | Deferred | `PENDING` status exists; confirmation flow not wired |

