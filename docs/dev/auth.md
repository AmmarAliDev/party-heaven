# Auth Setup — Developer Guide

## Overview

Authentication is implemented with [Auth.js v5 (next-auth)](https://authjs.dev/) using:

- **Email/password** via the Credentials provider
- **Google SSO** via the Google OAuth provider
- **JWT sessions** (no DB round-trip per request; OAuth accounts stored in DB)
- **Prisma adapter** to persist OAuth accounts and user records
- **Typed RBAC guards** for admin-only route protection and permission-aware server utilities

## Environment Variables

Add these to `.env.local` for local development and to your deployment secrets for production.

```env
# ── Auth.js ────────────────────────────────────────────────────────────────
# Required. Generate with: openssl rand -base64 32
AUTH_SECRET=

# Optional. Defaults to NEXT_PUBLIC_APP_URL if omitted.
AUTH_URL=http://localhost:3000

# ── Google OAuth ────────────────────────────────────────────────────────────
# Required for Google SSO. Create at: https://console.cloud.google.com/
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# ── Database (already used by Prisma) ───────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/party_heaven

# ── SMTP (required for email-based password reset) ─────────────────────────
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=no-reply@yourdomain.com
SMTP_FROM_NAME=Party Heaven
```

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)
4. Copy the Client ID and Secret into your env vars.

## Auth Flow

### Sign-up (credentials)

1. User fills the sign-up form at `/auth/sign-up`.
2. The client form uses the shared RHF + Zod layer for on-change validation and consistent field-level error placement.
3. `signUpAction` verifies trusted request origin, validates input with Zod again on the server, rate-limits the attempt, hashes the password, and creates the `User` with the `CUSTOMER` role.
4. Server creates a one-time verification token (raw token never stored), saves only its SHA-256 hash, and sends an email link to `/auth/verify-email?token=...`.
5. Action returns a generic success message to avoid leaking whether the email was already registered.

### Sign-in (credentials)

1. User fills the sign-in form at `/auth/sign-in`.
2. The client form uses the shared RHF + Zod layer for on-change validation and consistent field-level error placement.
3. `signInAction` verifies trusted request origin, validates input again on the server, and rate-limits the attempt.
4. For credentials users with a matching password but `emailVerified = null`, sign-in is blocked and a fresh verification email is issued.
5. Auth.js `authorize()` in `src/auth.ts` enforces the same rule server-side (`emailVerified` required) and verifies bcrypt hash.
6. On success → JWT cookie set → redirected to home.

### Auth entry-page access policy

- Authenticated users are redirected away from auth entry pages:
  - `/auth/sign-in`
  - `/auth/sign-up`
- Redirect destination is `routes.storefront.accountProfile` (`/account/profile`) for a consistent signed-in landing surface.
- This redirect is enforced in the server pages so authenticated users cannot render entry-form UI for login/registration.
- `from` query parameters are intentionally ignored for already-authenticated visits to entry pages because users are already signed in and should be routed to a stable account destination.

Intentional exemptions (still accessible while logged in):

- `/auth/forgot-password`
- `/auth/reset-password`
- `/auth/verify-email`
- `/auth/error`

Reasoning: these routes are recovery/diagnostic token flows and may still be opened from email links, old tabs, or provider callbacks. Keeping them accessible avoids breaking valid recovery and troubleshooting scenarios.

Unverified user rule:

- Credentials users must verify email before first sign-in.
- OAuth users continue to sign in via provider flow and are not blocked by credentials-only verification logic.

### Verify email

1. User opens `/auth/verify-email?token=...` from their email.
2. Server hashes the incoming token and looks up `EmailVerificationToken` by hash.
3. If token is missing, invalid, or expired, the page shows a safe recovery message.
4. If valid and unconsumed, server marks `User.emailVerified` and consumes verification tokens for that user.
5. User is prompted to continue to `/auth/sign-in`.

Session hardening note:

- The JWT keeps a cached role snapshot for fast RBAC checks.
- `src/auth.ts` now refreshes that role from the database on a short interval so admin role changes are applied without waiting for a full sign-out/sign-in cycle.

### Sign-in (Google)

1. User clicks "Continue with Google" at `/auth/sign-in` or `/auth/sign-up`.
2. Browser redirects to Google OAuth consent screen.
3. Auth.js callback at `/api/auth/callback/google` processes the token.
4. If the email matches an existing `User`, the `Account` is linked.
5. If new user → `User` created via the Prisma adapter.
6. JWT session created → redirected to home.

### Forgot password and reset

1. User submits email at `/auth/forgot-password`.
2. `forgotPasswordAction` verifies trusted origin, validates input, and applies rate limits.
3. Action always returns the same success message for known and unknown emails (anti-enumeration).
4. For an existing account, server creates a one-time reset token (secure random value), stores only its SHA-256 hash in DB, expires it in 1 hour, and sends an email link to `/auth/reset-password?token=...`.
5. User opens reset link, submits new password at `/auth/reset-password`.
6. `resetPasswordAction` validates token + password, checks expiry, hashes the new password with bcrypt, consumes the token, and invalidates any other active reset tokens for the same user.

### Sign-out

The app now uses one primary sign-out convention across storefront, account, and admin UI:

- Prefer the shared `SignOutButton` or a plain `<form action={signOutAction}>` submission for logout controls.
- `SignOutButton` is client-enhanced: it first calls `prepareSignOutAction` (trusted-origin check + guest-cart token rotation), then uses `signOut()` from `next-auth/react` with `redirectTo: routes.storefront.home` so `SessionProvider` updates header auth UI immediately after logout.
- `signOutAction` remains the progressive-enhancement fallback and preserves the same redirect target (`routes.storefront.home`) after clearing the Auth.js session cookie.
- This pattern is used in the storefront header dropdown, the mobile drawer, the account profile page, and the admin shell menu.
- Use client-side `signOut()` from `next-auth/react` only for an explicitly client-driven flow that genuinely cannot use a form submission.

This keeps logout behavior progressively enhanced, CSRF-aware, and consistent across desktop and mobile surfaces while preventing stale signed-in header UI after sign-out.

## Auth Form UI Standard

- `src/features/auth/components/sign-in-form.tsx` and `sign-up-form.tsx` should use the shared form primitives from `src/components/forms`.
- Validate on `onChange` with Zod on the client, then keep the server action as the authoritative second pass.
- Preserve the original field names and `FormData` payload shape so auth flows, redirects, and rate limiting continue to work without adapter code changes.
- Keep server-returned auth errors in a top-level alert, and client validation errors directly under each relevant field.

## RBAC and Route Protection

### Admin role matrix

| Role              | Admin access | Primary permissions                                 |
| ----------------- | ------------ | --------------------------------------------------- |
| `SUPER_ADMIN`     | ✅           | Full admin access, catalog, orders, users, settings |
| `PRODUCT_MANAGER` | ✅           | Catalog read/write, order read                      |
| `ORDER_MANAGER`   | ✅           | Order read/write, customer read                     |
| `CUSTOMER`        | ❌           | Storefront-only for now                             |
| `GUEST`           | ❌           | Anonymous browsing only                             |

### Guard flow

- `src/proxy.ts` performs a lightweight, best-effort pre-render redirect for `/admin` requests before the full page loads.
- `src/app/(admin)/layout.tsx` uses `requireAdminAccess()` as the authoritative server-side guard.
- `src/lib/auth/guards.ts` exposes a route-handler-safe `guardRouteHandlerAccess()` helper that returns a typed `NextResponse` for `401`/`403` API responses.
- `src/lib/auth/rbac.ts` owns the typed role/permission matrix and reusable permission helpers.
- `src/app/unauthorized/page.tsx` and `src/app/forbidden/page.tsx` provide the user-facing recovery screens.

Practical rule: layout gating alone is not sufficient for mutations. Admin Server Actions and route handlers should continue to require explicit RBAC permission checks even when their pages already sit under the admin layout.

## Session Access

### Server Components / Server Actions

```typescript
import { auth } from "@/auth";
// or use helpers:
import { getSession, requireSession, getCurrentUserId, hasPermission } from "@/lib/auth/session";
import { requireAdminAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";

const session = await auth(); // nullable (raw Auth.js call)
const session = await getSession(); // nullable (helper wrapper around auth())
const session = await requireSession(); // redirects if not logged in
const userId = await getCurrentUserId(); // nullable string
const canEdit = await hasPermission(rbacPermissions.catalogWrite); // boolean

await requireAdminAccess({ from: "/admin" });
```

### Client Components

```typescript
import { useSession } from "@/lib/auth/client";

const { data: session, status } = useSession();
// status: "loading" | "authenticated" | "unauthenticated"
```

## File Structure

```
src/
  auth.ts                              # Auth.js config (providers, callbacks, pages)
  proxy.ts                             # Lightweight /admin pre-render redirects using auth/session hints
  config/
    routes.ts                          # Site route definitions (exports `routes` with `routes.storefront.home`)
  types/next-auth.d.ts                 # Session/JWT type augmentation
  features/auth/
    validators.ts                      # Zod schemas: signIn, signUp, forgotPassword, resetPassword
    actions/
      sign-in.ts                       # Credentials sign-in server action
      sign-up.ts                       # New user creation server action
      sign-out.ts                      # Sign-out server action
      forgot-password.ts               # Password reset request server action
      reset-password.ts                # Password reset submit server action
    email-verification.ts              # Verification token issue + consume service
    components/
      sign-in-form.tsx                 # Email/password form (client component)
      sign-up-form.tsx                 # Registration form (client component)
      sign-out-button.tsx               # Shared `SignOutButton` form submit control (exports `SignOutButton`)
      google-sign-in-button.tsx        # Google SSO button (client component)
      forgot-password-form.tsx         # Forgot-password request form
      reset-password-form.tsx          # Password reset form (token + new password)
    password-reset-email.ts            # SMTP reset email sender
    email-verification-email.ts        # SMTP verification email sender
  lib/auth/
    session.ts                         # Server-side session helpers
    client.ts                          # Client-side auth re-exports
    guards.ts                          # Route guards for RSCs and route handlers
    rbac.ts                            # Typed role + permission model
    password.ts                        # bcrypt hash/compare utilities
    password-reset-token.ts            # Token generation/hash/expiry helpers
    email-verification-token.ts        # Verification token generation/hash/expiry helpers
  lib/audit/
    admin-actions.ts                   # Audit-log-ready helper for admin mutations
  lib/rate-limit/
    index.ts                           # Redis-first rate limiting with safe in-memory fallback
  lib/security/
    csrf.ts                            # Trusted-origin CSRF checks for sensitive mutations
    validation.ts                      # Shared Zod validation primitives and helpers
  components/providers/
    auth-provider.tsx                  # SessionProvider wrapper for root layout
  app/(auth)/auth/
    sign-in/page.tsx                   # /auth/sign-in
    sign-up/page.tsx                   # /auth/sign-up
    error/page.tsx                     # /auth/error (Auth.js error page)
    forgot-password/page.tsx           # /auth/forgot-password (request flow)
    reset-password/page.tsx            # /auth/reset-password (token submit flow)
    verify-email/page.tsx              # /auth/verify-email (token consume flow)
  app/unauthorized/page.tsx            # Friendly 401-style recovery page
  app/forbidden/page.tsx               # Friendly 403-style recovery page
  app/api/auth/[...nextauth]/route.ts  # Auth.js catch-all API route
```

## CSRF and Mutation Safety

The current baseline uses a **Next.js-compatible same-origin strategy**:

- **Auth.js** continues to protect `/api/auth/*` with its built-in CSRF handling.
- **Custom Server Actions** such as `signInAction`, `signUpAction`, and `signOutAction` call `assertTrustedOrigin()` from `src/lib/security/csrf.ts` before doing sensitive work.
- **Future Route Handlers** should use `assertTrustedRouteHandlerRequest()` together with `createRouteHandlerErrorResponse()` for consistent blocking and safe error payloads.
- `next.config.ts` now also sets `experimental.serverActions.allowedOrigins` so the app stays compatible behind trusted reverse proxies without weakening the default CSRF model.

### Allowed Origins Configuration

When the app runs behind a reverse proxy (e.g. Nginx, Cloudflare, Vercel Edge Network), the `Host` header seen by Next.js may differ from the browser's `Origin` header. Next.js rejects server-action requests when these don't match, so `experimental.serverActions.allowedOrigins` tells the framework which extra `host:port` values are legitimate.

The configuration key is:

```
experimental.serverActions.allowedOrigins
```

In this project the list is built at startup by `getServerActionAllowedOrigins()` in `src/config/security.ts`, which derives host values from:

| Source | Example entries |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `partyheaven.co`, `www.partyheaven.co` |
| `AUTH_URL` | `partyheaven.co` |
| `APP_ALLOWED_ORIGINS` | Comma-separated extra origins you control (e.g. a staging proxy) |
| Hard-coded dev origins | `localhost:3000`, `127.0.0.1:3000` |

Each value is normalised to `host` (or `host:port`) via `new URL(origin).host`.

> **Security warning:** Only add origins that you own and control. Never use wildcards, IP ranges, or untrusted third-party domains. A misconfigured list effectively tells Next.js to skip its built-in same-origin check for those hosts, which **weakens CSRF protection**. When configured correctly — listing only your production domain, its `www` variant, the local dev address, and any trusted proxy origin — the default same-origin CSRF model remains fully intact.

## Rate Limiting

Sensitive auth flows now use a **Redis-first** rate-limit helper:

- Sign-in: 10 attempts / minute / IP+email bucket
- Sign-up: 10 attempts / minute / IP (+ 3 attempts / minute / email)
- Forgot password: 10 attempts / minute / IP (+ 5 attempts / minute / email)
- Reset password submit: 10 attempts / minute / IP
- Verify-email resend-on-signin: covered by sign-in rate limits and credential password check before re-issuing

Implementation notes:

- `src/lib/rate-limit/index.ts` uses **Upstash Redis** when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured.
- Local development and CI fall back to the in-memory store automatically so the same helper still compiles and works without infrastructure.
- Call sites continue to use the stable `checkRateLimit()` API.

> For production, Redis credentials should still be configured so all instances share one central rate-limit state.

## Password Security

Passwords are hashed with **bcrypt** (12 salt rounds, ~300ms on modern hardware). The hash is stored in `User.password`. OAuth-only accounts have `null` in this field.

```typescript
import { hashPassword, comparePassword } from "@/lib/auth/password";

const hash = await hashPassword("mysecretpassword");
const valid = await comparePassword("mysecretpassword", hash); // true
```

## Deferred

- **Reset email deliverability and branding enhancements** — SPF/DKIM/DMARC hardening, provider-level bounce/suppression handling, branded templates, and localization are intentionally deferred.
- **Audit log persistence** — `src/lib/audit/admin-actions.ts` currently logs structured admin events and prepares `AuditLog`-ready payloads; DB writes will be added alongside real admin mutations.
- **Nonce-based CSP hardening** — the current CSP is intentionally baseline-compatible; tighten it later if inline/script needs are fully mapped.
- **Dedicated double-submit CSRF tokens for embedded clients** — current same-origin protection is correct for the app today, but future cross-origin embeds or native clients may need an explicit token layer.
