# Deployment Guide

This guide covers production deployment of **Party Heaven** on Vercel with a hosted PostgreSQL database (Supabase or Vercel Postgres), Upstash Redis, Google OAuth, SMTP email, Telegram alerts, and analytics.

> **Quick-start checklist** — things you must set before the first deployment:
> 1. `DATABASE_URL` (pooled) and `POSTGRES_URL_NON_POOLING` (direct)
> 2. `AUTH_SECRET` — minimum 32 random characters (`openssl rand -base64 32`)
> 3. `NEXT_PUBLIC_APP_URL` — your production domain, no trailing slash
> 4. Vercel build command set to `pnpm build:deploy`
> 5. Node.js version set to `20.x` in Vercel project settings

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [PostgreSQL Setup](#2-postgresql-setup)
3. [Vercel Project Setup](#3-vercel-project-setup)
4. [Environment Variables Reference](#4-environment-variables-reference)
5. [Auth Providers](#5-auth-providers)
6. [SMTP Email Provider](#6-smtp-email-provider)
7. [Upstash Redis](#7-upstash-redis)
8. [Telegram Bot Alerts](#8-telegram-bot-alerts)
9. [Analytics](#9-analytics)
10. [Build & Deploy Pipeline](#10-build--deploy-pipeline)
11. [Health Check](#11-health-check)
12. [Custom Domain & DNS](#12-custom-domain--dns)
13. [Security Checklist](#13-security-checklist)

---

## 1. Architecture Overview

```
Browser
  │
  ▼
Vercel CDN / Edge Network
  │   (static assets, ISR cache)
  ▼
Next.js App Router (Node.js runtime)
  │         │           │
  │    Auth.js JWT   API Routes
  │         │           │
  ▼         ▼           ▼
PostgreSQL (Supabase / Vercel Postgres)
              │
          Upstash Redis  ←  rate limiting
              │
         Nodemailer SMTP  ←  transactional email
              │
         Telegram Bot API ←  admin alerts
              │
        GA4 + Meta Pixel  ←  client-side analytics
```

- **No background workers** in the current release. All operations are request-driven.
- **COD only** — no payment gateway integration in this release.
- **Single region** deployment recommended at first launch (Rs.-focused, Karachi).

---

## 2. PostgreSQL Setup

### Recommended providers

| Provider | Notes |
|---|---|
| **Supabase** (preferred) | Generous free tier, built-in pooling (PgBouncer), easy backups, Karachi latency: ~100 ms via Mumbai region |
| **Vercel Postgres** | Zero-config for Vercel projects; automatically injects `POSTGRES_URL` and friends |
| Self-hosted | Requires manual TLS configuration, not recommended for first launch |

### Supabase setup

1. Create a new project at [supabase.com](https://supabase.com).
2. Under **Project Settings → Database**, copy the two connection strings:
   - **Connection pooling** (port `6543`) → use as `DATABASE_URL`
   - **Direct connection** (port `5432`) → use as `POSTGRES_URL_NON_POOLING`
3. Both strings must include `sslmode=require`.
4. Add `?pgbouncer=true&connection_limit=1` to `DATABASE_URL` (Prisma + PgBouncer requirement).

```
# Example Supabase values
DATABASE_URL=postgresql://postgres:<password>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1
POSTGRES_URL_NON_POOLING=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require
```

### Applying migrations in production

The project uses `pnpm build:deploy` as the Vercel build command. This runs:

```
prisma generate → prisma migrate deploy → next build
```

`prisma migrate deploy` applies any pending migration files from `prisma/migrations/` without creating new ones. It is safe to run multiple times (idempotent).

> **Never** run `prisma migrate dev` in production. That command creates shadow databases and can destructively alter schemas.

---

## 3. Vercel Project Setup

### Link the repository

```bash
# Install Vercel CLI if needed
pnpm install -g vercel

# Link from the project root
vercel link
```

### Configure build settings (Vercel dashboard)

| Setting | Value |
|---|---|
| **Framework Preset** | Next.js |
| **Build Command** | `pnpm build:deploy` |
| **Output Directory** | `.next` (auto-detected) |
| **Install Command** | `pnpm install --frozen-lockfile` |
| **Node.js Version** | 20.x |

> If you use the Vercel dashboard "Import Git Repository" flow, override the Build Command to `pnpm build:deploy` before the first deployment.

### Deployment branches

| Branch | Vercel Environment | Notes |
|---|---|---|
| `main` | Production | Triggers on merge; applies migrations |
| `develop` | Preview | Uses preview environment variables |
| Any PR | Preview | One-click preview URL per PR |

---

## 4. Environment Variables Reference

Add these in **Vercel Dashboard → Project → Settings → Environment Variables**.

Mark secrets as "Sensitive" (encrypted at rest, masked in logs).

### Required for any deployment

| Variable | Example | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://partyheaven.co` | No trailing slash. Used in metadata and canonical URLs. |
| `DATABASE_URL` | `postgresql://...?pgbouncer=true` | Pooled connection string. |
| `POSTGRES_URL_NON_POOLING` | `postgresql://...` | Direct connection for migrations. |
| `AUTH_SECRET` | `openssl rand -base64 32` | Min 32 chars. Rotate if compromised. |

### Strongly recommended

| Variable | Example | Notes |
|---|---|---|
| `AUTH_URL` | `https://partyheaven.co` | Explicit Auth.js canonical URL. Prevents redirect issues behind reverse proxies. |
| `AUTH_GOOGLE_ID` | `123...apps.googleusercontent.com` | Google OAuth Client ID. |
| `AUTH_GOOGLE_SECRET` | `GOCSPX-...` | Google OAuth Client Secret. |
| `UPSTASH_REDIS_REST_URL` | `https://xxx.upstash.io` | Redis rate limiting. Falls back to in-memory if omitted. |
| `UPSTASH_REDIS_REST_TOKEN` | `AXxx...` | Must be set with `UPSTASH_REDIS_REST_URL`. |

### Email notifications

| Variable | Example | Notes |
|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | |
| `SMTP_PORT` | `587` | Use `465` for implicit TLS. |
| `SMTP_SECURE` | `false` | Set `true` for port 465. |
| `SMTP_USER` | `hello@example.com` | Use App Passwords for Gmail. |
| `SMTP_PASSWORD` | `abcd efgh ijkl mnop` | |
| `SMTP_FROM_EMAIL` | `orders@partyheaven.co` | Sender address. |
| `SMTP_FROM_NAME` | `Party Heaven` | Display name. |
| `NOTIFY_ADMIN_EMAILS` | `ops@partyheaven.co` | Comma-separated. |

### Telegram alerts

| Variable | Example | Notes |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | `123456:ABCdef...` | From @BotFather. |
| `TELEGRAM_CHAT_ID` | `-1001234567890` | Negative for group/channel IDs. |

### Analytics

| Variable | Example | Notes |
|---|---|---|
| `NEXT_PUBLIC_GA_ID` | `G-XXXXXXXXXX` | Google Analytics 4. |
| `NEXT_PUBLIC_GTM_ID` | `GTM-XXXXXXX` | Google Tag Manager container (loaded via `@next/third-parties`). |
| `NEXT_PUBLIC_META_PIXEL_ID` | `123456789012345` | Meta Pixel. |

### Security / misc

| Variable | Example | Notes |
|---|---|---|
| `APP_ALLOWED_ORIGINS` | `https://admin.partyheaven.co` | Extra CSRF-trusted origins. Usually empty. |
| `APP_SECRET` | `openssl rand -hex 32` | Reserved for future server-side integrations. |

---

## 5. Auth Providers

### Email / password

Works out of the box via the `Credentials` provider. No additional setup required beyond `DATABASE_URL` and `AUTH_SECRET`.

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Under "Authorized redirect URIs", add:
   ```
   https://your-domain.com/api/auth/callback/google
   ```
   Add both production and preview URLs if needed.
4. Copy **Client ID** → `AUTH_GOOGLE_ID` and **Client Secret** → `AUTH_GOOGLE_SECRET`.
5. Under "Authorized JavaScript origins", add your production domain.

> For Vercel preview deployments, add the wildcard preview URL pattern or individual preview URLs to the authorized redirect URIs.

---

## 6. SMTP Email Provider

The app uses **Nodemailer** with any standard SMTP server. Choose one:

### Gmail (simple, suitable for low volume)

1. Enable 2-Step Verification on your Google account.
2. Generate an **App Password** at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. Set:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your@gmail.com
   SMTP_PASSWORD=<16-char app password>
   ```

**Limit:** ~500 emails/day. Suitable for launch phase.

### Brevo (formerly Sendinblue — recommended for production)

1. Create an account at [brevo.com](https://brevo.com).
2. Go to **SMTP & API → SMTP** and generate credentials.
3. Set:
   ```
   SMTP_HOST=smtp-relay.brevo.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=<your Brevo login email>
   SMTP_PASSWORD=<Brevo SMTP key>
   ```

**Limit:** 300 emails/day free, paid plans from €25/month.

### Postmark (recommended for transactional reliability)

1. Create an account at [postmarkapp.com](https://postmarkapp.com).
2. Create a Server and verify your sender domain.
3. Set:
   ```
   SMTP_HOST=smtp.postmarkapp.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=<server API token>
   SMTP_PASSWORD=<server API token>
   ```

### Deferred: campaign / bulk email

The `EmailSubscriber` table and stub campaign provider are in place. Connecting a live Mailchimp/Brevo/Klaviyo marketing integration is deferred. See `docs/dev/email-marketing.md`.

---

## 7. Upstash Redis

Redis is used exclusively for distributed rate limiting across Vercel's serverless functions. Without it, each function instance maintains its own in-memory counter — acceptable for very low traffic but bypassable at scale.

### Setup

1. Create a database at [console.upstash.com](https://console.upstash.com/).
2. Choose **Global** replication for multi-region coverage, or **Regional** (Mumbai for Pakistan latency).
3. Under **REST API**, copy the URL and token.
4. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

### What is rate-limited

| Endpoint | Limit | Window |
|---|---|---|
| Sign-in (per IP) | 20 req | 15 min |
| Sign-in (per email) | 10 req | 15 min |
| Sign-up (per IP) | 5 req | 1 hour |
| Sign-up (per email) | 3 req | 1 hour |
| Email subscribe (per IP) | 5 req | 10 min |
| Contact form (per IP) | 10 req | 15 min |
| Contact form (per email) | 5 req | 15 min |

If Redis is unavailable, the in-memory fallback activates automatically. No error is surfaced to the user.

---

## 8. Telegram Bot Alerts

Telegram notifications are admin-only alerts for new orders, contact form submissions, and low-stock warnings.

### Setup

1. Open Telegram and message [@BotFather](https://t.me/BotFather).
2. Send `/newbot`, follow the prompts, and copy the **token**.
3. Create an admin group/channel and add your bot to it as an administrator.
4. Send any message in the group, then fetch:
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
5. Find `"chat":{"id": ...}` in the response — this is `TELEGRAM_CHAT_ID`. Groups have negative IDs.
6. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.

> Telegram notifications are non-blocking — a failure never affects the customer checkout flow. Errors are logged at `warn` level.

---

## 9. Analytics

### Google Analytics 4

1. Create a GA4 property at [analytics.google.com](https://analytics.google.com).
2. Under **Admin → Data Streams**, create a Web stream for your domain.
3. Copy the **Measurement ID** (format: `G-XXXXXXXXXX`).
4. Set `NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX`.

Events tracked: `page_view`, `view_item`, `add_to_cart`, `begin_checkout`, `purchase`.

### Meta Pixel

1. Create a Pixel at [business.facebook.com](https://business.facebook.com) → Events Manager.
2. Copy the **Pixel ID**.
3. Set `NEXT_PUBLIC_META_PIXEL_ID=<pixel_id>`.

Events tracked: `PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase`.

### Both are optional

The app functions normally without either. Analytics failures are isolated and never crash the app.

---

## 10. Build & Deploy Pipeline

### Recommended Vercel configuration (`vercel.json`)

The project does not ship a `vercel.json` by default — Vercel auto-detects Next.js. If custom configuration is needed:

```json
{
  "buildCommand": "pnpm build:deploy",
  "installCommand": "pnpm install --frozen-lockfile"
}
```

### What `pnpm build:deploy` does

```
prisma generate        (regenerate Prisma Client types)
prisma migrate deploy  (apply pending migrations idempotently)
next build             (full production build)
```

This command is safe to run multiple times. Failed migrations will abort the build and prevent a broken deployment from going live.

### CI pre-checks (recommended before merging to main)

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build   # local-safe build (no migration)
```

Playwright E2E tests (`pnpm test:e2e`) can be run in CI against a preview deployment URL by setting `PLAYWRIGHT_BASE_URL`.

---

## 11. Health Check

`GET /api/health` returns a JSON status document:

```json
{
  "status": "ok",
  "uptime": 1234,
  "timestamp": "2026-04-23T12:00:00.000Z",
  "appUrl": "https://partyheaven.co",
  "checks": {
    "env":  { "status": "pass" },
    "db":   { "status": "pass" }
  }
}
```

- **200 OK** when all checks pass.
- **503 Service Unavailable** when any check fails (with `"status": "degraded"`).

### Configure in Vercel

Under **Project → Settings → Health Checks**, set the path to `/api/health`. Vercel will poll this endpoint after each deployment and roll back automatically if it returns a non-200 response.

### Configure in uptime monitors

Use [Better Uptime](https://betterstack.com/better-uptime), [UptimeRobot](https://uptimerobot.com), or [Checkly](https://checklyhq.com):

```
URL:      https://partyheaven.co/api/health
Method:   GET
Interval: 1 minute
Expected: status 200, body contains "ok"
```

---

## 12. Custom Domain & DNS

1. In Vercel, go to **Project → Settings → Domains** and add your domain.
2. Add the required DNS records at your registrar (Vercel provides the exact values):
   - **A record** or **CNAME** pointing to Vercel's IP/alias.
   - **www redirect** or CNAME for `www` → apex.
3. Vercel automatically provisions a TLS certificate via Let's Encrypt.

### Pakistan domain registrars

`.pk` domains require a local registrar. Recommended options:
- [PKNIC](https://pknic.net.pk/) — official Pakistani registry
- [Namecheap](https://namecheap.com/) — supports `.pk` TLD

### Update Auth.js after domain is live

Update `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the production domain. Add the production callback URL to your Google OAuth client.

---

## 13. Security Checklist

The following security controls are already implemented:

- [x] `poweredByHeader: false` in `next.config.ts`
- [x] Global CSP, HSTS, X-Frame-Options, X-Content-Type-Options headers via `src/config/security.ts`
- [x] CSRF protection for all mutations (`assertTrustedOrigin()`)
- [x] Redis-first rate limiting with memory fallback
- [x] JWT sessions (no DB hit per request)
- [x] Role refresh window (5 min) to propagate admin changes without re-login
- [x] bcrypt (12 rounds) for credential passwords
- [x] Logger redacts sensitive fields (bearer tokens, JWT-like strings, passwords)
- [x] `POSTGRES_URL_NON_POOLING` used only for migrations — never for hot-path queries
- [x] Health endpoint returns no internal error details to callers

Verify before launch:

- [ ] `AUTH_SECRET` is at least 32 random characters and is not the placeholder value
- [ ] `DATABASE_URL` is the pooled connection string with `pgbouncer=true`
- [ ] Google OAuth redirect URIs are scoped to your production domain only
- [ ] SMTP credentials are app-specific (not your Google account password)
- [ ] `APP_ALLOWED_ORIGINS` is empty or lists only known first-party domains
- [ ] Vercel environment variables are scoped to the correct environments (Production / Preview / Development)
