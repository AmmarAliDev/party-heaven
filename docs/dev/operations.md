# Operations Guide

This document covers backup strategy, database operations, monitoring, and routine maintenance for the Party Heaven production deployment.

---

## Table of Contents

1. [Database Backups](#1-database-backups)
2. [Monitoring & Alerting](#2-monitoring--alerting)
3. [Log Management](#3-log-management)
4. [Routine Maintenance](#4-routine-maintenance)
5. [Scaling Guidance](#5-scaling-guidance)
6. [Incident Response](#6-incident-response)
7. [Secrets Rotation](#7-secrets-rotation)

---

## 1. Database Backups

### Supabase automatic backups

Supabase provides automatic daily point-in-time backups:

| Plan | Backup retention | PITR resolution |
|---|---|---|
| Free | 7 days (daily snapshots) | Daily |
| Pro ($25/month) | 7 days PITR | 1 second |
| Team ($599/month) | 28 days PITR | 1 second |

**Recommendation:** Use the **Pro plan** from launch. Daily snapshots on the free tier mean up to 24 hours of data loss in a worst-case scenario.

### Manual backup procedure

Run a full logical dump from the direct connection (non-pooling URL) using `pg_dump`:

```bash
pg_dump \
  --no-acl \
  --no-owner \
  --format=custom \
  --file="partyheaven_$(date +%Y%m%d_%H%M%S).dump" \
  "$POSTGRES_URL_NON_POOLING"
```

Store dump files in object storage (AWS S3, Cloudflare R2, or Supabase Storage).

### Restore from backup

```bash
# Restore to a fresh database
pg_restore \
  --no-acl \
  --no-owner \
  --dbname="<target_connection_string>" \
  partyheaven_YYYYMMDD_HHMMSS.dump
```

After restoring, run `prisma migrate deploy` to ensure the migration history table is in sync.

### Backup schedule recommendations

| Frequency | Method | Retention |
|---|---|---|
| Daily (automated) | Supabase built-in | 7–28 days |
| Weekly (manual) | `pg_dump` | 90 days |
| Pre-deployment | `pg_dump` before any schema migration | Keep for 30 days |

> Always take a manual backup before applying a migration that drops columns or tables.

---

## 2. Monitoring & Alerting

### Uptime monitoring

Set up an external uptime check at `/api/health`:

```
URL:     https://partyheaven.co/api/health
Method:  GET
Interval: 1 minute
Expected: HTTP 200, body contains "ok"
Alert on: 2 consecutive failures
```

Recommended services:
- [Better Uptime](https://betterstack.com/better-uptime) — free tier, Slack/SMS/email alerts
- [UptimeRobot](https://uptimerobot.com) — free tier, 5-minute intervals
- [Checkly](https://checklyhq.com) — supports API assertions

### Vercel built-in monitoring

- **Vercel Analytics** — Web Vitals (LCP, INP, CLS) per page. Enable in Project Settings.
- **Vercel Function Logs** — real-time serverless function output. Access via dashboard or `vercel logs`.
- **Deployment notifications** — configure Slack or email alerts for failed builds.

### Supabase monitoring

- **Database health** — connection count, query latency, and storage in the Supabase dashboard.
- **Slow query log** — under **Database → Query Performance**. Review queries taking > 100 ms.
- **pg_stat_activity** — for live connection debugging:
  ```sql
  SELECT pid, usename, application_name, state, query_start, query
  FROM pg_stat_activity
  WHERE state != 'idle'
  ORDER BY query_start;
  ```

### Upstash Redis monitoring

- **Request count and error rate** — visible in the Upstash console.
- **Latency** — should be < 20 ms from Vercel functions for same-region deployments.
- Alert if error rate exceeds 1% (signals rate-limit store is unreachable; app falls back to in-memory).

### Application-level health checks

The `GET /api/health` endpoint checks:
1. **env** — required environment variables are present
2. **db** — `SELECT 1` round-trip succeeds within 5 seconds

A `503` response means at least one check failed. The response body identifies which check failed.

---

## 3. Log Management

### Log levels

The app uses `createLogger()` from `src/lib/logger.ts`. Log levels in order of severity:

| Level | Used for |
|---|---|
| `debug` | Verbose tracing (development only) |
| `info` | Normal operation events |
| `warn` | Non-critical issues (failed notification, rate-limit fallback) |
| `error` | Unexpected failures needing investigation |

### What is logged

- Server action failures (with safe, redacted context)
- API route errors (status 4xx/5xx with request context)
- Health check degradation
- Notification channel failures (email, Telegram)
- Rate-limit configuration issues

### What is NOT logged

The logger automatically redacts:
- Bearer tokens and Authorization headers
- JWT-like strings
- Fields named `password`, `token`, `secret`, `apiKey`

### Viewing logs

```bash
# Tail production logs via Vercel CLI
vercel logs --follow

# Filter by function name
vercel logs --follow | grep "api:health"
```

In the Vercel dashboard: **Project → Functions** tab shows invocation logs grouped by route.

### Log retention

Vercel retains function logs for 7 days by default. For longer retention:
- Forward logs to a service like [Axiom](https://axiom.co) (has a Vercel integration) or [Datadog](https://datadog.com).
- Configure in Vercel: **Project → Settings → Log Drains**.

---

## 4. Routine Maintenance

### Weekly

- [ ] Review `/admin/orders` for any orders stuck in `PENDING` > 24 hours
- [ ] Check admin inbox for delivery failure notices from SMTP
- [ ] Review Upstash Redis error rate in the console
- [ ] Scan Vercel function logs for recurring errors

### Monthly

- [ ] Review and update dependencies:
  ```bash
  pnpm outdated
  # Update carefully — test after each significant version bump
  ```
- [ ] Review `AuditLog` table for unexpected admin actions
- [ ] Rotate SMTP credentials if using app passwords (when Google forces it)
- [ ] Verify backups are restorable (restore to a test database quarterly)
- [ ] Review Supabase storage usage and plan tier

### Quarterly

- [ ] Rotate `AUTH_SECRET` (requires all users to sign in again — schedule during low-traffic window)
- [ ] Review Google OAuth consent screen settings for any policy changes
- [ ] Update `next`, `next-auth`, `prisma`, and `@upstash/*` to latest stable versions
- [ ] Audit `AbandonedCartEvent` table size — truncate events older than 90 days if needed

### Database maintenance

```sql
-- Reclaim space after bulk deletes (e.g., clearing old audit logs)
VACUUM ANALYZE;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;

-- Prune audit log entries older than 180 days (example)
DELETE FROM "AuditLog" WHERE "createdAt" < NOW() - INTERVAL '180 days';

-- Prune resolved abandoned cart events older than 90 days
DELETE FROM "AbandonedCartEvent"
WHERE "createdAt" < NOW() - INTERVAL '90 days'
  AND "eventType" IN ('CART_RECOVERED', 'CART_EXPIRED');
```

---

## 5. Scaling Guidance

### Database connections

Vercel functions are ephemeral and can spawn many concurrent instances. Each instance opens a Prisma Client connection.

**Mitigation already in place:**
- `connection_limit=1` in `DATABASE_URL` for PgBouncer compatibility
- `pgbouncer=true` enables transaction-mode pooling

**As traffic grows:**
- Monitor the active connection count in Supabase (alert if approaching 80% of the plan limit)
- Upgrade to Supabase Pro to increase the connection pool size
- Consider [Prisma Accelerate](https://www.prisma.io/data-platform/accelerate) for a global connection pool and query caching

### Vercel function limits

| Resource | Hobby | Pro |
|---|---|---|
| Function timeout | 10 s | 60 s |
| Function memory | 1 GB | 3 GB |
| Bandwidth | 100 GB/month | 1 TB/month |

The checkout transaction and invoice generation are the heaviest operations. Monitor P95 duration in Vercel Analytics.

### Rate limiting at scale

Upstash Redis rate limiting is already distributed. No changes needed for horizontal scaling.

### Caching opportunities (deferred)

The current release does not use any server-side caching beyond ISR (`revalidate = 900`) on catalog routes. Future opportunities:
- Cache catalog product list queries in Redis (deferred — requires live catalog persistence)
- Use Prisma Accelerate for query-level caching

---

## 6. Incident Response

### Severity definitions

| Severity | Criteria | Response |
|---|---|---|
| P1 — Critical | Site down, checkout broken, data loss | Immediate; rollback within 30 min |
| P2 — High | Orders not notifying, sign-in broken | Respond within 2 hours |
| P3 — Medium | Analytics not tracking, search broken | Respond within 24 hours |
| P4 — Low | UI glitch, non-critical admin feature | Next sprint |

### P1 response procedure

1. Check `/api/health` — identify which check is failing.
2. Check Vercel deployment status and function error rate.
3. If a recent deployment introduced the issue: **rollback immediately** via Vercel dashboard (Deployments → Promote last good).
4. If database is unreachable: check Supabase status page and connection string.
5. Communicate status to stakeholders.
6. After restoration: write a brief incident report documenting root cause and prevention.

### Vercel status

Check [vercel-status.com](https://www.vercel-status.com) for platform-level outages before investigating application code.

### Supabase status

Check [status.supabase.com](https://status.supabase.com) for database platform issues.

---

## 7. Secrets Rotation

### `AUTH_SECRET`

Rotating this secret invalidates all active JWT sessions — every signed-in user will be signed out.

1. Generate a new secret: `openssl rand -base64 32`
2. Schedule during a low-traffic window (e.g. 2 AM Karachi time, UTC+5)
3. Update in Vercel environment variables
4. Trigger a redeployment (or redeploy manually)
5. Communicate to users that they will need to sign in again

### SMTP credentials

Rotate when:
- An employee with email access leaves
- Google forces App Password rotation
- You switch SMTP providers

1. Generate new credentials in your email provider
2. Update `SMTP_USER` and `SMTP_PASSWORD` in Vercel
3. Redeploy to pick up the new values
4. Send a test email to confirm delivery

### Google OAuth secret

1. Go to Google Cloud Console → OAuth 2.0 Client → Rotate secret
2. Update `AUTH_GOOGLE_SECRET` in Vercel
3. Redeploy

### Database password

1. Rotate in Supabase: **Project Settings → Database → Reset database password**
2. Update `DATABASE_URL` and `POSTGRES_URL_NON_POOLING` in Vercel
3. Redeploy (new Prisma connections will use the updated URL)

### Upstash Redis token

1. Rotate in Upstash console: **Database → REST API → Regenerate token**
2. Update `UPSTASH_REDIS_REST_TOKEN` in Vercel
3. Redeploy
4. Rate limiting falls back to in-memory during the brief window between old token expiry and redeployment — acceptable
