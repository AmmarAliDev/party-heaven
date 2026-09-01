# Release & Launch Checklists

Three phase-gated checklists covering everything from code freeze to post-launch monitoring.

- **Pre-launch checklist** — complete before going live
- **Release checklist** — per-deployment steps
- **Post-launch checklist** — first 24–72 hours after launch

---

## Pre-Launch Checklist

Complete this once before the first production deployment and revisit before any major release.

### Infrastructure

- [ ] PostgreSQL database provisioned (Supabase or Vercel Postgres)
- [ ] `DATABASE_URL` (pooled, pgbouncer) and `POSTGRES_URL_NON_POOLING` (direct) configured in Vercel
- [ ] Upstash Redis database provisioned; `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` configured
- [ ] Vercel project linked to the correct GitHub repository and branch (`main`)
- [ ] Build command set to `pnpm build:deploy` in Vercel project settings
- [ ] Node.js version pinned to 20.x in Vercel project settings
- [ ] Custom domain added in Vercel and DNS records propagated
- [ ] TLS certificate issued and valid (Vercel auto-provisions via Let's Encrypt)

### Authentication

- [ ] `AUTH_SECRET` set to a random 32+ character secret (`openssl rand -base64 32`)
- [ ] `AUTH_URL` set to the production domain (e.g. `https://partyheaven.co`)
- [ ] Google OAuth Client ID and Secret configured (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`)
- [ ] Production domain added to Google OAuth "Authorized redirect URIs":
      `https://partyheaven.co/api/auth/callback/google`
- [ ] Test sign-in with credentials and Google OAuth on the production deployment

### Database

- [ ] All migrations applied (`prisma migrate deploy` runs as part of `build:deploy`)
- [ ] Seed data applied if required (`pnpm prisma:seed`)
- [ ] Admin user account created with `SUPER_ADMIN` role
- [ ] Role assignments verified in Supabase / psql

### Email

- [ ] SMTP credentials configured and verified (send a test email)
- [ ] `SMTP_FROM_EMAIL` uses a domain you control (avoids spam filters)
- [ ] `NOTIFY_ADMIN_EMAILS` set to real admin inbox(es)
- [ ] SPF and DKIM DNS records added for your sending domain
- [ ] Test order notification email received in admin inbox

### Notifications

- [ ] Telegram bot created, added to admin group, and chat ID confirmed
- [ ] `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` configured
- [ ] Test contact form submission triggers Telegram alert

### Analytics

- [ ] GTM container ID configured (`NEXT_PUBLIC_GTM_ID`) — single analytics pipeline (GA4 + Meta Pixel configured inside the container)
- [ ] Test the funnel events in GTM Preview mode (view_item_list, view_item, add_to_cart, view_cart, remove_from_cart, begin_checkout, purchase)
- [ ] GA4 DebugView confirms the same events arrive (GA4 event tags/triggers set up in GTM)
- [ ] Meta Pixel Helper browser extension confirms Meta standard events fire (Meta tags map event names)
- [ ] Meta Conversion API configured (`META_PIXEL_ID` + `META_CAPI_ACCESS_TOKEN`) and a test order appears as a `Purchase` in Meta Events Manager (use `META_CAPI_TEST_EVENT_CODE` in Test Events); GTM Meta Pixel Purchase tag Event ID set to `ecommerce.transaction_id` for dedup — see `docs/dev/meta-conversion-api.md`

### Health & Monitoring

- [ ] `/api/health` returns `200 OK` with `status: "ok"` on the production deployment
- [ ] Health check path configured in Vercel project settings (`/api/health`)
- [ ] Uptime monitor set up (UptimeRobot / Better Uptime / Checkly) polling `/api/health` every minute
- [ ] Alert email/SMS configured in the uptime monitor

### Security

- [ ] `AUTH_SECRET` is not the placeholder value from `.env.example`
- [ ] `AUTH_URL` is set to the production domain (prevents open redirect issues)
- [ ] Google OAuth redirect URIs are scoped to production domain only
- [ ] Vercel environment variables scoped correctly (Production vs Preview vs Development)
- [ ] `APP_ALLOWED_ORIGINS` reviewed — empty or lists only known first-party origins
- [ ] CSP headers verified in browser DevTools → Network tab (look for `Content-Security-Policy`)
- [ ] HSTS header present (`Strict-Transport-Security`)

### Content

- [ ] Homepage sections configured in `/admin/homepage` (hero, featured categories, etc.)
- [ ] At least one published category exists
- [ ] At least one published product exists with inventory > 0
- [ ] Site name, logo, tagline, and contact details updated in `src/config/site.ts`
- [ ] `/about`, `/contact`, `/privacy`, `/terms` pages have real content
- [ ] Shipping policy and return policy pages updated for your business

### Performance

- [ ] Lighthouse score > 80 on mobile for the homepage
- [ ] Core Web Vitals in Vercel Analytics or PageSpeed Insights are acceptable
- [ ] Images are served as AVIF/WebP (Next.js Image component handles this automatically)

### Legal & Compliance

- [ ] Privacy policy published and up to date
- [ ] Cookie notice / consent banner reviewed (analytics cookies)
- [ ] Terms and conditions published

---

## Release Checklist

Run before merging a feature branch to `main` and triggering a production deployment.

### Code quality

- [ ] `pnpm format` — no formatting changes remaining
- [ ] `pnpm lint` — zero warnings or errors
- [ ] `pnpm typecheck` — zero TypeScript errors
- [ ] `pnpm test` — all unit and integration tests pass
- [ ] `pnpm build` — local build succeeds (catches Next.js build errors before deploy)

### Schema changes

- [ ] If `prisma/schema.prisma` was modified: a new migration file exists in `prisma/migrations/`
- [ ] Migration has been reviewed for destructive operations (column drops, type changes)
- [ ] Any required data backfill is handled in the migration or a seed script

### Feature review

- [ ] Feature works end-to-end in a Vercel preview deployment
- [ ] Loading states, empty states, and error states render correctly
- [ ] New server actions include `assertTrustedOrigin()` / `checkRateLimit()` where applicable
- [ ] New API routes include trusted-origin checks and input validation
- [ ] No `console.log` or debug statements left in production code
- [ ] No hardcoded secrets, credentials, or internal URLs in the diff

### Documentation

- [ ] `docs/dev/` updated for any new developer-facing conventions
- [ ] `docs/ai/task-status.md` updated with completed items and deferred decisions

### Deployment

- [ ] PR approved and merged to `main`
- [ ] Vercel deployment triggered automatically
- [ ] Build logs reviewed — no unexpected warnings
- [ ] `/api/health` returns `200 OK` after deployment
- [ ] Smoke test: place a test order end-to-end on production or staging

---

## Post-Launch Checklist

Complete within 24–72 hours of the first live customer-facing deployment.

### Day 1

- [ ] Monitor Vercel function logs for unexpected errors (`vercel logs` or dashboard)
- [ ] Check uptime monitor — no alerts triggered
- [ ] Verify at least one real order flows through: checkout → confirmation email → Telegram alert
- [ ] Confirm inventory is decremented correctly after an order
- [ ] Review any rate-limit hits in Upstash Redis console
- [ ] Check GA4 real-time view (or GTM Preview) for page views and events

### Day 2–3

- [ ] Review Vercel Analytics (if enabled) for INP, LCP, and CLS scores
- [ ] Check Supabase database metrics: connection count, query latency, storage usage
- [ ] Review Telegram bot for any missed or duplicate notifications
- [ ] Verify email deliverability: check SPF/DKIM status at [mail-tester.com](https://mail-tester.com)
- [ ] Review Vercel build minutes consumption and estimate ongoing usage

### Ongoing

- [ ] Set up a weekly review of `/admin/orders` for any stale `PENDING` orders
- [ ] Review `AuditLog` entries for unexpected admin actions
- [ ] Monitor database size growth — plan for a larger Supabase tier as needed
- [ ] Rotate `AUTH_SECRET` at least annually (requires all users to re-sign-in)
- [ ] Keep `next`, `next-auth`, `prisma`, and security-related packages updated monthly

---

## Rollback Procedure

If a deployment introduces a critical regression:

### Option A — Instant rollback via Vercel dashboard

1. Go to **Project → Deployments**.
2. Find the last good deployment.
3. Click **Promote to Production**.

This does not roll back database migrations. If the previous code is incompatible with the current schema, a schema rollback is also required.

### Option B — Schema rollback

Prisma does not support automatic migration rollback. For destructive changes:

1. Write a new migration that reverses the change:
   ```bash
   pnpm prisma:migrate:dev --name revert_<change_name>
   ```
2. Deploy the new migration with the rolled-back code.

> Always review migrations for destructive operations before merging. Column drops are irreversible without a backup.

### Emergency contacts and escalation

Document your escalation path here before launch:
- Primary on-call: _______________
- Database backup access: _______________
- Vercel account owner: _______________
