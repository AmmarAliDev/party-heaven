# Local Setup

## Prerequisites

- Node.js 20+
- `pnpm` 10+ (workspace configuration in `pnpm-workspace.yaml` enables `allowBuilds` for `@prisma/client`, `@prisma/engines`, `prisma`, `sharp`, and `unrs-resolver`)
- PostgreSQL 14+ (local instance **or** a hosted dev database such as Supabase)

## First-time checklist

```bash
# 1. Install dependencies
pnpm install

# 2. Create your local env file and fill in at minimum DATABASE_URL and AUTH_SECRET
cp .env.example .env.local

# 3. Validate the Prisma schema
pnpm prisma:validate

# 4. Apply migrations to your local database
pnpm prisma:migrate:dev --name init

# 5. Seed roles and the default category
pnpm prisma:seed

# 6. Populate realistic local/dev demo catalog data (optional but recommended)
pnpm prisma:seed:dev-catalog

# 7. Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

The admin panel is at [http://localhost:3000/admin](http://localhost:3000/admin). Access requires an account with an admin role (`SUPER_ADMIN`, `PRODUCT_MANAGER`, or `ORDER_MANAGER`). Assign a role directly in the database via Prisma Studio (`pnpm prisma:studio`) or SQL.

## Run the app

```bash
pnpm dev
```

Open `http://localhost:3000`.

## Environment Variables

Validation is centralized in `src/config/env.ts`, and the safe shared config snapshot is exposed from `src/config/app-config.ts`.

| Variable                   | Required                        | Purpose                                                                                                 |
| -------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`      | Yes for non-default deployments | Public base URL used by metadata and preview surfaces                                                   |
| `NEXT_PUBLIC_DEFAULT_CITY` | No                              | Launch-city label for the current Karachi-first storefront scaffold                                     |
| `NEXT_PUBLIC_ENABLE_ADMIN` | No                              | Enables or disables the admin preview placeholder                                                       |
| `NEXT_PUBLIC_ENABLE_AUTH`  | No                              | Enables or disables the auth preview placeholder                                                        |
| `NEXT_PUBLIC_GA_ID`         | No                              | GA4 Measurement ID (`G-...`); enables GA script loading and the matching CSP allowlist entry           |
| `NEXT_PUBLIC_META_PIXEL_ID` | No                              | Meta Pixel ID used by the analytics provider                                                            |
| `DATABASE_URL`             | Yes for Prisma workflows        | Main PostgreSQL connection string for local development, Prisma CLI commands, and server-side DB access |
| `POSTGRES_URL_NON_POOLING` | Recommended for Prisma Migrate  | Direct non-pooling PostgreSQL URL for Prisma migrations; for local Postgres this can match `DATABASE_URL` |
| `SHADOW_DATABASE_URL`      | Optional                        | Separate shadow database used only when `prisma migrate dev` needs one for a hosted dev setup           |
| `PRISMA_ALLOW_HOSTED_MIGRATE_DEV` | No                       | Break-glass override to allow `prisma migrate dev` against hosted DBs in disposable dev environments     |
| `PRISMA_ALLOW_LOCAL_DEPLOY_BUILD` | No                       | Break-glass override to run `pnpm build:deploy` locally for pipeline rehearsal                            |
| `PRISMA_ALLOW_POOLED_MIGRATE_DEPLOY` | No                    | Break-glass override to permit deploy migrations without pooled/direct URL separation                      |
| `APP_SECRET`               | Conditionally required          | Add before enabling a sensitive server-side integration that calls `getRequiredServerEnv("APP_SECRET")` |
| `AUTH_SECRET`              | Yes outside development         | Auth.js secret for any non-development environment                                                      |
| `BLOB_READ_WRITE_TOKEN`    | Yes for admin image uploads     | Vercel Blob token used by the guarded admin upload route to store banner, blog, SEO, and future content images |

If a required or invalid value is detected, the app throws a readable `CONFIG_ERROR` with guidance for updating `.env.local`.

Analytics + CSP note:

- GA script loading is conditional on `NEXT_PUBLIC_GA_ID`.
- The global CSP allowlist adds `https://www.googletagmanager.com` to `script-src` only when `NEXT_PUBLIC_GA_ID` is set.

The Prisma scripts in this repo read local environment files and fall back to `DATABASE_URL` when `POSTGRES_URL_NON_POOLING` is omitted during local development.

### Local/dev demo catalog population

Use the dedicated local/dev catalog script when you want realistic storefront/admin test data:

```bash
pnpm prisma:seed:dev-catalog
```

What it does:

- upserts the demo categories used by local/dev flows (including HomeDecor, HomeLiving, KitchenDining, HealthBeauty, CleaningEss, Tumbler, StorageOrg, Electronics, Gadgets, Cosmetics, PersonalCare, ToysHobbies, BedroomBath, LadiesCorner)
- creates deterministic product sets (4 to 8 products per category)
- creates one default variant per product with mixed pricing and inventory
- writes category/product SEO fields and demo image URLs
- guarantees Party Heaven-eligible products (`<= Rs. 280`) inside every category so the virtual Party Heaven storefront category can be verified

Safety behavior:

- the script is intentionally blocked in production/deployment-like runtime (`NODE_ENV=production`, `CI=true`, or `VERCEL=1`)
- hosted database URLs are blocked by default; use `PRISMA_ALLOW_HOSTED_DEV_SEED=true` only for intentional disposable remote dev databases

This script is for local/dev verification only and should not be used as a production data workflow.

### Production catalog population

Use the dedicated production catalog script when you need to populate a real hosted catalog with non-demo storefront data:

```bash
pnpm prisma:seed
pnpm prisma:seed:production-catalog
```

What it does:

- upserts production-ready categories with SEO titles, descriptions, OG fields, canonical URLs, and category card images
- upserts published products with real merchandising copy, dimensions, metadata, image URLs, default variant pricing, and stock
- replaces product-level image and specification rows so reruns stay deterministic instead of duplicating catalog content
- preserves Party Heaven virtual-category eligibility by keeping a mix of products priced at `<= Rs. 280` alongside higher-ticket catalog items

Safety behavior:

- `pnpm prisma:seed:production-catalog` requires `PRODUCTION_CATALOG_SEED_CONFIRM=LIVE_CATALOG_APPROVED`
- the script expects a hosted `DATABASE_URL`; for local rehearsal only, add `PRISMA_ALLOW_LOCAL_PRODUCTION_CATALOG_SEED=true`
- both `pnpm prisma:seed` and the production catalog script now load `.env` and `.env.local` automatically before creating Prisma connections

PowerShell example for a hosted production or staging database:

```powershell
$env:PRODUCTION_CATALOG_SEED_CONFIRM='LIVE_CATALOG_APPROVED'
pnpm prisma:seed
pnpm prisma:seed:production-catalog
```

## Admin Image Upload Setup

The current admin image uploader uses server-side Vercel Blob uploads because it is simple for non-technical admins, inexpensive to start with, and keeps the storage backend isolated behind one feature module.

1. Create a public Vercel Blob store for admin/content media.
2. Add the generated `BLOB_READ_WRITE_TOKEN` to `.env.local`.
3. Restart `pnpm dev` after changing the token.
4. Upload through the admin form fields instead of pasting raw URLs manually.

Current operational constraints:

- uploads are limited to JPG, PNG, WEBP, AVIF, and GIF
- the server-upload budget is capped at 4 MB per image to stay below the common Vercel server-upload limit and keep the workflow predictable
- the uploader writes the final public URL back into the existing form field value, so no database migration is required for this step
- SVG uploads are intentionally rejected to avoid inline-script/security issues in admin-managed content

Future admin fields should reuse the shared upload control in `src/features/admin/uploads/components/admin-image-upload-input.tsx` and store only the returned URL in their existing string field.

## Database Workflow

### Local development

1. Point `DATABASE_URL` at your local PostgreSQL database.
2. Set `POSTGRES_URL_NON_POOLING` to the same local value, or leave it unset and let the local-safe script fall back automatically.
3. Run the local migration workflow:

```bash
pnpm prisma:validate
pnpm prisma:migrate:dev --name your_change
pnpm prisma:generate
```

### Production / deployment

- Do **not** run `prisma migrate dev` in Vercel or other hosted deployment environments.
- Use `pnpm prisma:migrate:deploy` for deployment-safe schema application.
- Use `pnpm build` for a local-safe app build.
- Use `pnpm build:deploy` when the deployment pipeline should apply Prisma migrations before the production build.

### Command policy (safe by default)

- `pnpm build` is the default local build command.
- `pnpm build:deploy` is now guarded and only runs in deploy-like contexts (`NODE_ENV=production`, `CI=true`, or `VERCEL=1`).
- For intentional local rehearsal of the deploy pipeline, set `PRISMA_ALLOW_LOCAL_DEPLOY_BUILD=true` for that shell session.

```bash
# local build (recommended)
pnpm build

# deployment/CI build path
pnpm build:deploy

# intentional local deploy-pipeline rehearsal (temporary, POSIX shells)
PRISMA_ALLOW_LOCAL_DEPLOY_BUILD=true pnpm build:deploy

# intentional local deploy-pipeline rehearsal (temporary, PowerShell)
$env:PRISMA_ALLOW_LOCAL_DEPLOY_BUILD='true'; pnpm build:deploy
```

### Migration recovery (failed migration history)

If deployment fails with Prisma `P3009` (failed migration recorded in `_prisma_migrations`), resolve the broken migration state before retrying deploy.

```bash
# inspect state
pnpm prisma:migrate:status

# mark a failed migration as rolled back (example)
pnpm prisma:migrate:resolve -- --rolled-back 20260426_admin_blog_db

# re-run deployment-safe migration
pnpm prisma:migrate:deploy
```

Use `pnpm prisma:migrate:resolve` only with a known migration incident and a verified DBA/developer remediation plan.

Keep application queries behind `src/server/db` and feature-level repositories instead of importing Prisma directly into route handlers. See `docs/dev/database-access.md` for the repository/service/transaction pattern.

### Prisma troubleshooting

- If `prisma migrate dev` is blocked, check whether `DATABASE_URL` points to a hosted Supabase or pooled production-like URL.
- If you intentionally use a remote development database, set `PRISMA_ALLOW_HOSTED_MIGRATE_DEV=true` for that shell session and ensure you understand the risk.
- If a hosted development database cannot create the shadow database automatically, provide `SHADOW_DATABASE_URL`.
- If you only want to verify the app build locally, use `pnpm build`; it does not run deployment migrations.
- If `prisma migrate deploy` is blocked for hosted DB safety, ensure:
	- `DATABASE_URL` points to the pooled URL
	- `POSTGRES_URL_NON_POOLING` points to the direct (non-pooling) URL
	- the two values are not identical in hosted environments
	- hosted `DATABASE_URL` includes `pgbouncer=true` (and preferably `connection_limit=1`)

- If deployment build is blocked by runtime DB safety checks, confirm:
	- `DATABASE_URL` is pooled/runtime-safe (Supabase pooler host, `pgbouncer=true`; `connection_limit=1` is recommended)
	- `POSTGRES_URL_NON_POOLING` is direct/non-pooled for migrations only
	- `DATABASE_URL` and `POSTGRES_URL_NON_POOLING` are different values in hosted environments

- If you see Prisma `P2024` (`Timed out fetching a new connection from the connection pool`), first verify:
	- runtime URL strategy above is correct
	- catalog/product render paths are using lightweight query helpers where available (`getPublishedProductContextBySlug`, `countPublishedPartyHeavenProducts`)

## Code Quality Workflow

Run these commands before opening or merging work:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Use `pnpm test:watch` during local iteration.

## UI Foundation Checks

During local development, verify these manual flows:
- app always renders the fixed light theme regardless of the device color preference
- storefront shell loads at `/` and `/preview`
- admin shell placeholder loads at `/admin`
- toast preview button on `/preview` (Storefront Preview page header) renders a frontend notification

See `docs/dev/ui-conventions.md` for the current design-system usage rules.
