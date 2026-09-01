# Security Conventions — Developer Guide

## Quick reference

| Layer | Where it lives | What it does |
|-------|---------------|--------------|
| Security headers | `src/config/security.ts` + `next.config.ts` | CSP, HSTS, X-Frame-Options, etc. |
| CSRF — Server Actions | `src/lib/security/csrf.ts` → `assertTrustedOrigin()` | Validates request origin before any mutation |
| CSRF — Route Handlers | `src/lib/security/csrf.ts` → `assertTrustedRouteHandlerRequest()` | Same, for API handlers |
| Rate limiting | `src/lib/rate-limit/` | Redis-first, in-memory fallback |
| RBAC guards | `src/lib/auth/guards.ts` | `requireAdminAccess()`, `assertHasPermission()` |
| Admin proxy | `src/proxy.ts` | Early redirect for clearly blocked admin paths |
| Password hashing | `src/lib/auth/password.ts` | bcrypt, 12 rounds |
| PII redaction | `src/lib/security/pii.ts` | `maskEmail()`, `stripControlChars()` |
| Audit logging | `src/lib/audit/admin-actions.ts` | Append-only admin action log |

---

## Goal

Provide a baseline, production-minded security layer that future features can reuse without rewriting the auth or routing foundations.

## What is now in place

This review pass confirmed and tightened the current baseline in five areas:

- Authentication and session handling
- Admin authorization boundaries
- Input validation coverage
- Route handler and Server Action mutation safety
- Logging redaction for sensitive values

### 1. Global security headers

`next.config.ts` now applies a shared header strategy sourced from `src/config/security.ts`.

Included headers:

- `Content-Security-Policy`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Resource-Policy`
- `Strict-Transport-Security` in production only

### CSP analytics allowlist

GTM (the single analytics pipeline) and the Meta Pixel loader it injects are enforced through a narrow CSP source allowlist in `src/config/security.ts`:

- `script-src` includes `https://www.googletagmanager.com` (GTM loader) and `https://connect.facebook.net` (GTM-injected Meta Pixel) only when `NEXT_PUBLIC_GTM_ID` is configured.
- If `NEXT_PUBLIC_GTM_ID` is empty or unset, the tracking script sources are omitted from CSP.
- No wildcard analytics domains were added to `script-src`.

Why this matters:

- It resolves the GA script-blocking error without broadening script execution policy.
- It preserves baseline CSP behavior for environments where analytics is intentionally disabled.
- It keeps future tightening paths (for example nonce/hash-based script policies) compatible.

> The CSP is intentionally a **baseline-compatible** policy for the current Next.js App Router setup. It allows the app to function cleanly today while leaving room for a stricter nonce-based CSP later.

### 2. CSRF strategy

There are **two layers**:

1. **Auth.js built-in CSRF protection** continues to protect `/api/auth/*` endpoints.
2. **Custom sensitive mutations** should use request-origin validation through:
   - `assertTrustedOrigin()` for Server Actions
   - `assertTrustedRouteHandlerRequest()` for Route Handlers

These helpers live in `src/lib/security/csrf.ts` and validate that mutating requests come from a trusted first-party origin.

Implemented coverage in this pass:

- Auth Server Actions (`signInAction`, `signUpAction`, `signOutAction`)
- Password reset Server Actions (`forgotPasswordAction`, `resetPasswordAction`)
- Checkout, cart, and email subscribe route handlers
- Contact form Server Action
- Wishlist add/remove route handlers

This closes a gap where wishlist mutations were authenticated but not same-origin validated.

### 3. Rate limiting

`src/lib/rate-limit/index.ts` now supports a **Redis-first** foundation with a safe in-memory fallback:

- **Preferred production backend:** Upstash Redis via `@upstash/redis` + `@upstash/ratelimit`
- **Fallback:** in-memory store for local development, tests, and unconfigured environments

Required env vars for Redis mode:

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Optional extra trusted origins for reverse proxies or custom domains:

```env
APP_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
```

Implemented coverage in this pass:

- Sign-in: IP + email bucket
- Sign-up: IP bucket plus per-email bucket
- Forgot password request: IP bucket plus per-email bucket
- Reset password submit: IP bucket
- Email subscribe: per-IP bucket
- Contact form submission: IP + email bucket

### Password reset token safety model

- Tokens are generated from 32 bytes of cryptographically secure random data.
- Only a SHA-256 hash of the token is stored in the database (`PasswordResetToken.tokenHash`); raw tokens are sent only via email link.
- Tokens expire after 1 hour and are single-use.
- Expired tokens are treated as invalid and deleted when encountered.
- Successful reset consumes the submitted token and invalidates all other active reset tokens for that user.
- Forgot-password responses are enumeration-safe: known and unknown emails receive the same success message.

### Email verification safety model (credentials sign-up)

- Credentials sign-up now issues `EmailVerificationToken` records using 32-byte cryptographic randomness.
- Only SHA-256 token hashes are stored in the database (`EmailVerificationToken.tokenHash`); raw tokens exist only in email links.
- Tokens expire after 24 hours and are treated as single-use.
- Verification consumes the token and clears any remaining verification tokens for the same user.
- Credentials sign-in requires `User.emailVerified`; unverified users are blocked and receive a new verification link only after a matching password check.
- OAuth behavior remains unchanged and is not gated by the credentials verification flow.

### 4. Validation conventions

Use shared helpers from `src/lib/security/validation.ts`:

- `emailAddressSchema`
- `optionalDisplayNameSchema`
- `createPasswordSchema()`
- `validateWithSchema()`
- `getZodIssueMessages()`

These keep validation rules and error messages consistent across Server Actions, forms, and future APIs.

Implemented coverage in this pass:

- Auth inputs validate on both client and server
- Contact submission now uses the shared validation helper instead of raw schema parsing
- Cart, checkout, wishlist, and admin feature mutations continue to validate request payloads before side effects

### 5. Safe error handling

For new mutation code:

- Normalize unknown exceptions with `toAppError()`
- Log server-side failures with `captureServerError()`
- Return user-safe Server Action feedback with `toActionErrorState()`
- Return typed API errors with `createRouteHandlerErrorResponse()`

### 6. Session and admin authorization hardening

Auth.js still uses JWT sessions, but the JWT callback now refreshes the role snapshot from the database on a short interval.

Why this matters:

- A user whose admin role is downgraded no longer keeps stale admin privileges for the full JWT lifetime.
- The app keeps the performance benefits of JWT sessions while reducing the window for stale authorization.

Admin boundary review result:

- `/admin` preflight redirects remain optimistic only
- `src/app/(admin)/layout.tsx` remains the authoritative admin gate
- Permission-specific admin pages and Server Actions continue to require explicit RBAC permissions
- Route-handler helpers still return clean `401` / `403` responses for API callers

### 7. Logging redaction

`src/lib/logger.ts` already redacted common sensitive object keys. This pass tightened it further by:

- expanding key-based redaction to additional secret-bearing fields such as CSRF and code verifier values
- redacting standalone bearer tokens and JWT-like strings even when they are logged as plain strings rather than nested object properties

Operationally, this reduces the chance of leaking session or integration secrets through ad-hoc error logs.

### 8. Admin activity audit visibility

- The admin activity page now reads from persisted `AuditLog` records through a dedicated service layer (`src/features/admin/activity/service.ts`).
- Feed rendering uses plain-language summaries from `src/features/admin/activity/audit-log-feed.ts` so staff can review changes without raw payload inspection.
- Actor context is resolved with a minimal user projection (`id`, `name`, `email`) only when `actorId` exists.
- When actor records are missing (for example, deleted users), entries degrade safely to neutral labels instead of failing the feed.
- This page is read-only and remains behind existing admin authorization boundaries (`(admin)` layout guard + RBAC permissions).

## Recommended conventions for future mutations

### Server Actions

```ts
await assertTrustedOrigin({ action: "cart:update" });

const parsed = validateWithSchema(cartItemSchema, rawInput);
if (!parsed.success) {
  return { errors: parsed.errors };
}
```

### Route Handlers

```ts
assertTrustedRouteHandlerRequest(request, { action: "order:create" });
```

Wrap unexpected failures with:

```ts
return createRouteHandlerErrorResponse(error, "order:create");
```

## Operational recommendations

Use this checklist for production deployments and incident response:

1. Set a strong `AUTH_SECRET` and rotate it through your secret manager rather than committing or sharing it manually.
2. Configure `APP_ALLOWED_ORIGINS` only for first-party origins you control. Do not use wildcards.
3. Configure Upstash Redis in production so rate limits apply consistently across all instances.
4. Review logs for any custom `logger.*()` call sites that still pass raw request bodies or third-party payloads; prefer explicit allowlisted metadata.
5. Treat role changes for staff accounts as privileged operations and verify they propagate within the JWT role refresh window.
6. Keep admin actions behind the shared RBAC helpers instead of hand-rolled role checks.
7. Re-run focused auth, admin, and mutation tests after adding any new Route Handler or Server Action.

## Deferred on purpose

- **Reset email deliverability and branding hardening** (provider reputation, SPF/DKIM/DMARC verification, bounce/suppression handling, localized templates)
- **Nonce-based CSP** for even stricter script execution controls
- **Dedicated double-submit CSRF tokens** for any future embedded/cross-origin client integrations
- **Centralized route-handler request schema helpers** to reduce repeated inline `safeParse()` usage
- **WAF / bot mitigation / abuse analytics** above the application layer
- **Per-feature audit persistence** for every high-risk admin mutation path

These are intentionally deferred so the current baseline stays lightweight, compatible, and easy to extend.
