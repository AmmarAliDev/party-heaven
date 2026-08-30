# Coding Conventions

## General Rules

- Use TypeScript everywhere.
- Prefer server components by default; add client components only when interactivity is required.
- Keep modules small, typed, and feature-oriented.
- Do not leak raw internal errors to the UI; route them through `toUserMessage()` and only surface safe `AppError` messages.
- Use `createLogger()` / `logger` from `src/lib/logger.ts` instead of ad-hoc `console.*` calls when logging app failures or operational context.

## Engineering Quality Rules

- Use the shared scripts before considering a step complete: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` when relevant.
- Keep imports grouped and ordered consistently: framework/external first, `@/` aliases next, relative imports last.
- Prefer `import type` for type-only dependencies.
- Use Prettier defaults from `prettier.config.mjs`; do not hand-format around them.

## Architecture Conventions

- `src/app` owns routing and high-level composition only.
- `src/components` contains shared presentational and layout building blocks.
- `src/features/<feature>` should own feature-specific UI, validation, and orchestration.
- `src/server` is reserved for server-only services, repositories, and integrations.
- `src/server/db` is the shared database foundation; future repositories and services should build on it instead of instantiating Prisma directly.
- `src/config` is the source of truth for routes, env validation, metadata, feature flags, and safe app config loading.
- Avoid direct `process.env` reads outside `src/config/env.ts`; use `env`, `loadAppConfig()`, or `getRequiredServerEnv()` instead.

## Security Conventions

- Use the shared header strategy from `src/config/security.ts` via `next.config.ts`; do not add ad-hoc per-page security headers unless the route has a real special case.
- Protect sensitive Server Actions with `assertTrustedOrigin()` and custom mutation Route Handlers with `assertTrustedRouteHandlerRequest()`.
- Prefer the shared Zod helpers in `src/lib/security/validation.ts` (`emailAddressSchema`, `createPasswordSchema()`, `validateWithSchema()`) so validation rules and error copy stay consistent.
- Use `checkRateLimit()` for auth and other abuse-prone mutations; production should provide Upstash Redis credentials, while local/test can rely on the built-in memory fallback.
- Normalize unexpected server failures with `toAppError()` / `toActionErrorState()` / `createRouteHandlerErrorResponse()` instead of leaking raw exceptions to UI callers.

## Error Handling Standards

- User-facing copy must be friendly, actionable, and non-technical; never surface raw stacks, SQL errors, or internal exception details.
- Client catch blocks should map unknown errors through `toUserMessage()` and use `AppError` with `userMessage` when surfacing known-safe server responses.
- Route segment error boundaries should prefer `unstable_retry()` (with `reset()` fallback only when needed) for recoverable failures.
- Non-critical async side effects (notifications, analytics, post-submit callbacks) must be isolated so their failures do not fail the primary user flow.
- Every async UI surface should define one of the shared fallback states: `PageErrorFallback`, `SectionErrorState`, `FormErrorSummary`, or `EmptyState`.
- Retry UX should be idempotent and safe to repeat; avoid duplicate writes by guarding pending state and preserving retry payloads when practical.

## Database Access Conventions

- Use `getPrismaClient()` from `src/server/db` for the root Prisma singleton when a repository or service needs direct access.
- Repositories should accept a `db` executor and contain Prisma query details only.
- Services should compose repositories and own `runInTransaction()` / `runWithTransaction()` boundaries.
- Use `normalizePagination()` and `createPaginatedResult()` for list queries so pagination behavior stays consistent.
- Use `QueryResult` helpers when a caller needs an explicit success/failure return contract instead of exceptions.

## Styling Conventions

- Use Tailwind utilities with shared design tokens from `src/app/globals.css`; avoid hard-coded page-only color values when a semantic token already exists.
- Placeholder color: global placeholder color is centralized in `src/app/globals.css` as the `--placeholder` token and is set to `#17171769`. Prefer the token for placeholder styling and avoid per-component placeholder overrides so placeholder appearance stays consistent across surfaces.
- Follow shadcn/ui-compatible patterns for reusable primitives.
- Prefer the shared UI wrappers before creating one-off markup:
  - `PageContainer` / `PageShell`
  - `SectionHeader`
  - `PageErrorFallback`, `SectionErrorState`, `FormErrorSummary`
  - `EmptyState`, `LoadingState`, `InlineSpinner`
  - `Badge`, `PriceDisplay`, `Skeleton`, `CardSkeleton`, `PageSkeleton`, and `TableSkeleton`
  - `ConfirmationDialog` for destructive or high-impact confirmation flows
- Keep styles composable through `cn()` from `src/lib/utils`.
- Use `notify.*()` from `src/lib/notify.ts` for frontend toast feedback instead of ad-hoc alert patterns.

## Documentation Conventions

- Record deferred work explicitly with `TODO` markers or docs notes.
- Update `docs/ai/task-status.md` after each major step.
- Keep AI-facing docs concise and token-efficient.
