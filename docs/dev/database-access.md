# Database Access Conventions

This project now treats Prisma as a server-only dependency behind the shared `src/server/db` layer.

## Goals

- keep route handlers and server actions thin
- make repository logic transaction-friendly
- standardize pagination and result shapes
- avoid scattered `new PrismaClient()` calls or direct `process.env` coupling

## Core entrypoints

- `getPrismaClient()` returns the app-wide lazy singleton for Next.js server usage
- `defineRepository()` returns a typed repository factory for building reusable DB access layers around a provided `db` executor
- `defineService()` returns a typed service factory for higher-level domain logic that composes repositories and transactions
- `runInTransaction()` always starts a new transaction from the root Prisma client
- `runWithTransaction()` reuses an existing transaction client when one is already in scope
- `normalizePagination()` and `createPaginatedResult()` standardize offset pagination behavior
- `createQuerySuccess()` / `createQueryFailure()` provide a shared typed result contract for explicit non-throw flows

## Layering rule

Use the database through three layers:

1. routes, server actions, and loaders call a service
2. services orchestrate business logic and transaction boundaries
3. repositories perform Prisma queries using the provided `db` executor

## Recommended repository pattern

```ts
import { defineRepository } from '@/server/db';

export const createProductRepository = defineRepository(({ db }) => ({
  findBySlug(slug: string) {
    return db.product.findUnique({ where: { slug } });
  },

  update(input: { id: string; name: string }) {
    return db.product.update({
      where: { id: input.id },
      data: { name: input.name },
    });
  },
}));
```

## Recommended service pattern

```ts
import { defineService, runWithTransaction } from '@/server/db';
import { createProductRepository } from '@/server/products/product.repository';

export const createProductService = defineService(({ db }) => {
  const products = createProductRepository(db);

  return {
    async updateProduct(input: { id: string; name: string }) {
      return runWithTransaction(async (transaction) => {
        const transactionalProducts = createProductRepository(transaction);
        return transactionalProducts.update(input);
      }, db);
    },
  };
});
```

## Practical rules for future features

- Do not instantiate Prisma clients inside features, route handlers, or tests.
- Prefer repository factories that accept `db` so they can run against either the root client or a transaction.
- Keep cross-entity workflows in services, not repositories.
- Use pagination helpers for list endpoints instead of ad-hoc `skip` / `take` parsing.
- Use explicit `QueryResult` helpers only when the caller benefits from a non-throw contract; otherwise throw typed errors.
- Keep Prisma imports inside `src/server` whenever possible.

## P2024 connection pool timeout hardening (2026-05-08)

Root cause in this codebase was not Prisma client duplication: singleton reuse in `src/server/db/client.ts` was already correct. Pool starvation came from repeated heavyweight catalog reads in hot render paths:

- related-products flow used full PDP lookup (`getPublishedProductBySlug`) only to read id/category/metadata
- category/navigation Party Heaven badge computation loaded full published product records just to count eligible products
- product-route metadata used full product detail lookup

Implemented fixes:

- Added lightweight cached product context query (`getPublishedProductContextBySlug`) for metadata/related-product routing paths
- Added lightweight cached Party Heaven count query (`countPublishedPartyHeavenProducts`) that reads only one ordered variant per product instead of full product detail payloads
- Updated catalog service and PDP metadata flow to consume these lightweight paths
- Added deployment/runtime safety checks for hosted URLs so pooled runtime configuration mistakes fail early with clear messages

Expected impact:

- fewer concurrent heavyweight Prisma operations during build and runtime
- shorter connection hold times per request
- lower risk of `P2024` on small hosted pools

## Prisma environment and migration workflow

The repository separates local schema development from deployment-time migration execution:

- `pnpm prisma:migrate:dev` is the default local workflow and now runs through a repo-level safety wrapper.
- `pnpm prisma:migrate:deploy` is the deployment-safe command for Vercel / production environments.
- `pnpm build` remains safe for local builds because it does **not** run production migrations.
- `pnpm build:deploy` exists for environments where migration deployment should happen before the application build and is now guarded to prevent accidental local usage.

### Expected Prisma variables

| Variable | Purpose | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Primary PostgreSQL connection | Required everywhere Prisma is used |
| `POSTGRES_URL_NON_POOLING` | Direct non-pooling connection | Recommended for Supabase / hosted Postgres; can match `DATABASE_URL` locally |
| `SHADOW_DATABASE_URL` | Optional shadow DB | Only needed when `prisma migrate dev` cannot create its own shadow database |
| `PRISMA_ALLOW_HOSTED_MIGRATE_DEV` | Break-glass override for hosted dev migrate | Use only for intentional remote dev DB workflows |
| `PRISMA_ALLOW_LOCAL_DEPLOY_BUILD` | Break-glass local deploy-build override | Allows `build:deploy` outside CI/production for rehearsals |
| `PRISMA_ALLOW_POOLED_MIGRATE_DEPLOY` | Break-glass deploy migration override | Allows deploy migrations when pooled/direct URL separation is unavailable |

### Safety behavior

- Obvious hosted Supabase / pooled URLs are blocked for `prisma migrate dev` by default.
- If `POSTGRES_URL_NON_POOLING` is missing locally, the Prisma wrapper falls back to `DATABASE_URL` for that command.
- To intentionally bypass the hosted-URL block for a remote development database, set `PRISMA_ALLOW_HOSTED_MIGRATE_DEV=true` for the current shell session.
- `prisma migrate deploy` now blocks hosted pooled-only setups where `POSTGRES_URL_NON_POOLING` is missing or equals `DATABASE_URL`, unless explicitly overridden.
- `build:deploy` is blocked outside deploy-like runtime context by default; use `pnpm build` for normal local builds.
- `build:deploy` now also validates deployment runtime DB strategy: hosted runtime URLs must be pooled (`pgbouncer=true`) and must not be the same value as `POSTGRES_URL_NON_POOLING`. `connection_limit=1` is strongly recommended and logged when missing.

### Troubleshooting

- `Environment variable not found: POSTGRES_URL_NON_POOLING` → add the variable or let the local wrapper fall back by using the repo scripts instead of raw Prisma commands.
- `prisma migrate dev` blocked against Supabase → switch to a local PostgreSQL database for development, or use `prisma migrate deploy` in deployment environments.
- Shadow database errors on a hosted development DB → add `SHADOW_DATABASE_URL` pointing to a dedicated shadow database.
- `prisma migrate deploy` blocked for hosted safety → set `POSTGRES_URL_NON_POOLING` to the provider's direct non-pooling URL and keep `DATABASE_URL` as pooled.
- `P3009` on deploy (failed migration recorded) → resolve the migration state (`pnpm prisma:migrate:resolve -- --rolled-back <migration_id>`) before re-running deploy.

## Deferred items

- model-specific repositories and services will be added with each feature module
- cursor-based pagination can be added later if catalog scale requires it
- test database factories and integration harnesses will come with feature-level server tests