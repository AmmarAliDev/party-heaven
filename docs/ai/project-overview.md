# Project Overview

## Purpose

`Party Heaven` is a production-minded, single-vendor e-commerce app for Pakistan (Karachi-first launch scope), implemented as one Next.js codebase for storefront, admin, and auth experiences.

This file is a continuity index for AI-assisted work. For implementation details, use the linked AI docs below as the source of truth.

## Read Order for Future AI Prompts

1. `docs/ai/project-overview.md` (this file)
2. `docs/ai/implemented-features.md`
3. `docs/ai/open-tasks.md`
4. `docs/ai/architecture-decisions.md`
5. `docs/ai/testing-status.md`
6. `docs/ai/task-status.md`

## Current Product Scope

- Storefront: homepage, category listing, PDP, search, cart, checkout, account, wishlist, blog, contact
- Admin: dashboard/activity/revenue, category/product/blog CRUD, inventory adjustment, order operations, review moderation, homepage content management, settings
- Auth and security: credentials + Google sign-in, email verification, password reset, RBAC guards, CSRF and trusted-origin enforcement, rate-limiting foundation

## Module Boundaries

- `src/app`: routes, layouts, metadata, route-level loading/error boundaries
- `src/features`: feature-level UI, validation, orchestration, service contracts
- `src/server`: server-only DB composition and query/repository helpers
- `src/components`: shared UI/layout/form/table primitives
- `src/config`: environment validation, route config, metadata and feature-flag helpers
- `src/lib`: cross-cutting utilities (errors, logger, security, notifications)

Do not move business logic into route/page files when a feature service seam exists.

## Key Services and Seams

- Catalog query visibility source: `src/server/db/catalog-queries.ts`
- Storefront catalog orchestration: `src/features/catalog/service.ts`
- Checkout transport contract seam: `src/features/checkout/api-contract.ts` + `src/features/checkout/client.ts`
- Checkout payment provider seam: `src/features/checkout/payment.ts` (COD active, online gateways deferred)
- Order placement and lifecycle service: `src/features/orders/service.ts`
- Admin activity feed service: `src/features/admin/activity/service.ts`
- Admin inventory adjustment service: `src/features/admin/inventory/service.ts`
- Blog storefront/admin service seam: `src/features/blog/service.ts`
- SEO content rendering seam: `src/features/rendering/seo-content-rendering.ts` (shared ISR window + static-param mappers)
- PDP/DDP personalized review seam: `src/features/reviews/components/review-composer.tsx` + `GET /api/reviews/composer-context` (supports product and deal targets)
- Storefront auth UI seam: `src/components/layout/storefront-header-auth-controls.tsx` (client-side session-aware header controls)

## Working Conventions for AI

- Extend existing feature modules instead of introducing parallel patterns.
- Preserve user-safe error handling (`AppError`, `toUserMessage`, shared fallback components).
- Preserve mobile-ready boundaries: route handlers validate and delegate; feature services own business rules.
- Keep Prisma access inside the established server/db patterns.
- Keep docs synchronized whenever capability, architecture, or test posture changes.

## Deferred Work (High-Level)

- Online payment gateway implementation and webhook flow
- Advanced inventory operations (batch import/transfer/approvals)
- Advanced admin settings (tax, multi-warehouse shipping matrix, automated notification policy)
- Email-marketing double opt-in and abandoned-cart recovery worker
- Activity feed filter UI and cursor-pagination UI
- Advanced revenue reporting (charts, custom ranges, exports)

See `docs/ai/open-tasks.md` for prioritized and detailed deferred work.
