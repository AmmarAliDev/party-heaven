# Party Heaven

Production-ready **single-vendor e-commerce application** built with **Next.js 16 App Router**, **TypeScript**, **Tailwind CSS 4**, and **shadcn/ui-compatible patterns**. Targets the Pakistani market (Rs., Karachi-first).

---

## What is built

| Domain | Status | Key paths |
|--------|--------|-----------|
| Storefront shell | ✅ Live | `src/app/(storefront)/` |
| Auth (credentials + Google OAuth) | ✅ Live | `src/app/(auth)/`, `src/features/auth/` |
| Email verification + password reset | ✅ Live | `src/features/auth/` |
| Catalog (categories, products, PDP) | ✅ Live | `src/app/(storefront)/categories/` |
| Product search | ✅ Live | `src/features/catalog/components/catalog-search-command-dialog.tsx` |
| Product reviews | ✅ Live | PDP + `/account/reviews` |
| Cart (guest + authenticated) | ✅ Live | `src/app/(storefront)/cart/` |
| Wishlist | ✅ Live | `src/app/(storefront)/wishlist/` |
| Checkout (COD) | ✅ Live | `src/app/(storefront)/checkout/` |
| Orders + reorder | ✅ Live | `src/app/(storefront)/account/orders/` |
| Customer account (profile, addresses) | ✅ Live | `src/app/(storefront)/account/` |
| Blog | ✅ Live | `src/app/(storefront)/blog/` |
| Contact form | ✅ Live | `src/app/(storefront)/contact/` |
| Email marketing / newsletter | ✅ Live | `src/features/email-marketing/` |
| Admin dashboard | ✅ Live | `src/app/(admin)/admin/` |
| Admin: products, categories | ✅ Live | `/admin/products`, `/admin/categories` |
| Admin: orders, inventory | ✅ Live | `/admin/orders`, `/admin/inventory` |
| Admin: blog, homepage CMS | ✅ Live | `/admin/blog`, `/admin/homepage` |
| Admin: reviews moderation | ✅ Live | `/admin/reviews` |
| Admin: SEO management | ✅ Live | Per-entity SEO fields in admin forms |
| Admin: revenue reporting | ✅ Live | `/admin/revenue` |
| Admin: activity log | ✅ Live | `/admin/activity` |
| Admin: store settings | ✅ Live | `/admin/settings` |
| Notifications (email + Telegram) | ✅ Live | `src/features/notifications/` |
| RBAC (role-based access control) | ✅ Live | `src/lib/auth/rbac.ts` |
| Rate limiting (Redis + in-memory) | ✅ Live | `src/lib/rate-limit/` |
| SEO (metadata, JSON-LD, sitemap) | ✅ Live | `src/lib/seo/`, `src/app/sitemap.ts` |
| Analytics (GTM → GA4 + Meta Pixel) | ✅ Live | `src/features/analytics/` |
| Audit log | ✅ Live | `AuditLog` table + admin activity feed |

> **Payment gateways, referral/loyalty programmes, and multi-locale (Urdu) support are intentionally deferred.** COD is the only checkout payment method.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16, React 19 |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4, `class-variance-authority` |
| UI primitives | Radix UI, shadcn/ui-compatible |
| Database | PostgreSQL via Prisma 5 |
| Auth | Auth.js (NextAuth v5 beta) + `@auth/prisma-adapter` |
| Forms | React Hook Form + Zod v4 |
| Tables | TanStack Table v8 |
| Notifications | Nodemailer (SMTP) + Telegram Bot API |
| Rate limiting | Upstash Redis (`@upstash/ratelimit`) with in-memory fallback |
| Testing | Vitest (unit/integration), Playwright (E2E) |
| Package manager | pnpm |

---

## Quick start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy and fill in environment variables
cp .env.example .env.local
# Edit .env.local — at minimum set DATABASE_URL and AUTH_SECRET

# 3. Apply database migrations
pnpm prisma:migrate:dev --name init

# 4. Seed the database
pnpm prisma:seed

# 5. Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

See [docs/dev/setup.md](docs/dev/setup.md) for the full environment variable reference and database workflow.

---

## Available commands

```bash
pnpm dev                      # Start Next.js dev server
pnpm build                    # Local production build (no migrations)
pnpm build:deploy             # Deploy-safe build: generate + migrate deploy + build
pnpm start                    # Start the production server after build

pnpm lint                     # ESLint (zero warnings policy)
pnpm typecheck                # TypeScript strict check
pnpm format                   # Prettier write

pnpm test                     # Run all Vitest tests once
pnpm test:watch               # Vitest watch mode
pnpm test:ci                  # Vitest verbose (for CI logs)
pnpm test:coverage            # V8 coverage report → coverage/

pnpm test:e2e                 # Playwright E2E headless
pnpm test:e2e:headed          # Playwright with visible browser
pnpm test:e2e:install         # Install Playwright Chromium once

pnpm prisma:migrate:dev       # Apply + generate local migrations
pnpm prisma:migrate:deploy    # Apply pending migrations (production-safe)
pnpm prisma:generate          # Regenerate Prisma Client
pnpm prisma:studio            # Prisma Studio UI
pnpm prisma:seed              # Seed roles + default category
```

---

## Project layout

```text
src/
├── app/              # Next.js App Router: layouts, pages, API routes
│   ├── (storefront)/ # Public storefront routes
│   ├── (admin)/      # Protected admin routes (/admin/*)
│   ├── (auth)/       # Auth routes (/auth/*)
│   └── api/          # REST-style API route handlers
├── components/       # Shared UI primitives, forms, layout shells
├── config/           # Env validation, feature flags, routes, app config
├── features/         # Domain feature modules (one folder per domain)
├── hooks/            # Shared React hooks
├── lib/              # Low-level utilities: auth, errors, SEO, security…
├── server/           # Server-only DB repositories, services, transactions
└── types/            # Global TypeScript types

docs/
├── ai/               # AI-continuity docs (project state for Copilot prompts)
└── dev/              # Developer-facing documentation (you are here)

tests/
├── smoke/            # Import-level contract checks (no DB)
├── prisma/           # Schema + migration integrity (requires live DB)
├── server/           # DB layer utilities
├── lib/              # src/lib/* unit tests
├── features/         # Feature module tests
├── components/       # Component tests (jsdom)
├── helpers/          # Shared test utilities and factories
└── e2e/              # Playwright end-to-end tests
```

---

## Documentation index

| Doc | Purpose |
|-----|---------|
| [docs/dev/setup.md](docs/dev/setup.md) | Local setup, env vars, DB workflow |
| [docs/dev/architecture.md](docs/dev/architecture.md) | Layering, routing, RBAC, caching, search |
| [docs/dev/domain-model.md](docs/dev/domain-model.md) | Prisma schema walkthrough |
| [docs/dev/database-access.md](docs/dev/database-access.md) | Repository/service/transaction pattern |
| [docs/dev/testing.md](docs/dev/testing.md) | Test suite structure and conventions |
| [docs/dev/deployment.md](docs/dev/deployment.md) | Vercel + Supabase production deployment |
| [docs/dev/security.md](docs/dev/security.md) | Security conventions, headers, CSRF, rate limiting |
| [docs/dev/admin-guide.md](docs/dev/admin-guide.md) | Admin panel feature walkthrough |
| [docs/dev/content-operations.md](docs/dev/content-operations.md) | Blog and CMS content workflows |
| [docs/dev/ui-conventions.md](docs/dev/ui-conventions.md) | Design system and component usage rules |
| [docs/dev/search-architecture.md](docs/dev/search-architecture.md) | Search flow and upgrade seam |
| [docs/dev/auth.md](docs/dev/auth.md) | Auth flows, session, guards |
| [docs/dev/cart.md](docs/dev/cart.md) | Cart and guest continuity |
| [docs/dev/checkout.md](docs/dev/checkout.md) | Checkout flow and COD payment |
| [docs/dev/notifications.md](docs/dev/notifications.md) | Email and Telegram notification pipeline |
| [docs/ai/coding-conventions.md](docs/ai/coding-conventions.md) | Code style and module conventions |
