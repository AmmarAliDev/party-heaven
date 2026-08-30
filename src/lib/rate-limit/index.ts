import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { logger } from "@/lib/logger";

/**
 * Rate-limit foundation for sensitive auth and mutation routes.
 *
 * Preferred production backend: Upstash Redis (`@upstash/redis` + `@upstash/ratelimit`).
 * Local/test fallback: in-memory sliding window so the same helper can compile
 * and run even when Redis is intentionally not configured.
 */

export interface RateLimitOptions {
  /** Unique identifier for the requester (e.g. IP, email, user ID). */
  identifier: string;
  /** Action name used as a namespace key (e.g. "auth:sign-in"). */
  action: string;
  /** Maximum requests allowed within the window. Default: 5. */
  limit?: number;
  /** Time window in milliseconds. Default: 60 000 (1 minute). */
  windowMs?: number;
}

export interface RateLimitResult {
  /** `true` if the request is within limit; `false` if it should be blocked. */
  success: boolean;
  /** Requests remaining in the current window. */
  remaining: number;
  /** Timestamp when the current window resets. */
  reset: Date;
  /** Which backend served the check. */
  backend: "memory" | "redis";
}

interface NormalizedRateLimitOptions {
  action: string;
  identifier: string;
  limit: number;
  windowMs: number;
}

interface RateLimitStore {
  limit(options: NormalizedRateLimitOptions): Promise<RateLimitResult>;
}

interface MemoryEntry {
  count: number;
  resetAt: number;
}

/** How often (ms) the cleanup sweep runs. */
export const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60_000;

/** Maximum number of keys kept in the in-memory fallback store. */
export const RATE_LIMIT_MAX_STORE_SIZE = 10_000;

const RATE_LIMIT_IDENTIFIER_MAX_LENGTH = 128;
const memoryStore = new Map<string, MemoryEntry>();
const rateLimitLogger = logger.child("rate-limit");

function evictExpired(): void {
  const now = Date.now();

  for (const [key, entry] of memoryStore) {
    if (entry.resetAt <= now) {
      memoryStore.delete(key);
    }
  }
}

function evictOldestIfNeeded(): void {
  while (memoryStore.size >= RATE_LIMIT_MAX_STORE_SIZE) {
    const firstKey = memoryStore.keys().next().value;

    if (firstKey === undefined) {
      break;
    }

    memoryStore.delete(firstKey);
  }
}

const _cleanupInterval: ReturnType<typeof setInterval> = setInterval(
  evictExpired,
  RATE_LIMIT_CLEANUP_INTERVAL_MS,
);
if (typeof _cleanupInterval === "object" && "unref" in _cleanupInterval) {
  (_cleanupInterval as NodeJS.Timeout).unref();
}

export function stopRateLimitCleanup(): void {
  clearInterval(_cleanupInterval);
}

class MemoryRateLimitStore implements RateLimitStore {
  async limit({
    identifier,
    action,
    limit,
    windowMs,
  }: NormalizedRateLimitOptions): Promise<RateLimitResult> {
    const key = `${action}:${identifier}`;
    const now = Date.now();
    const entry = memoryStore.get(key);

    if (!entry || entry.resetAt <= now) {
      const resetAt = now + windowMs;
      evictOldestIfNeeded();
      memoryStore.set(key, { count: 1, resetAt });

      return {
        success: true,
        remaining: Math.max(0, limit - 1),
        reset: new Date(resetAt),
        backend: "memory",
      };
    }

    if (entry.count >= limit) {
      return {
        success: false,
        remaining: 0,
        reset: new Date(entry.resetAt),
        backend: "memory",
      };
    }

    entry.count += 1;

    return {
      success: true,
      remaining: Math.max(0, limit - entry.count),
      reset: new Date(entry.resetAt),
      backend: "memory",
    };
  }
}

function hasUpstashConfig(
  rawEnv: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return Boolean(rawEnv.UPSTASH_REDIS_REST_URL && rawEnv.UPSTASH_REDIS_REST_TOKEN);
}

class UpstashRateLimitStore implements RateLimitStore {
  private readonly redis = Redis.fromEnv();
  private readonly limiters = new Map<string, Ratelimit>();

  private getLimiter(limit: number, windowMs: number): Ratelimit {
    const cacheKey = `${limit}:${windowMs}`;
    const existingLimiter = this.limiters.get(cacheKey);

    if (existingLimiter) {
      return existingLimiter;
    }

    const seconds = Math.max(1, Math.ceil(windowMs / 1_000));
    const ratelimit = new Ratelimit({
      redis: this.redis,
      limiter: Ratelimit.slidingWindow(limit, `${seconds} s`),
      analytics: false,
      prefix: "party-heaven:ratelimit",
    });

    this.limiters.set(cacheKey, ratelimit);
    return ratelimit;
  }

  async limit({
    identifier,
    action,
    limit,
    windowMs,
  }: NormalizedRateLimitOptions): Promise<RateLimitResult> {
    const limiter = this.getLimiter(limit, windowMs);
    const result = await limiter.limit(`${action}:${identifier}`);

    return {
      success: result.success,
      remaining: Math.max(0, result.remaining),
      reset: new Date(result.reset),
      backend: "redis",
    };
  }
}

const memoryRateLimitStore = new MemoryRateLimitStore();
let redisRateLimitStore: UpstashRateLimitStore | null | undefined;

function getRateLimitStore(): RateLimitStore {
  if (!hasUpstashConfig()) {
    return memoryRateLimitStore;
  }

  if (redisRateLimitStore === undefined) {
    try {
      redisRateLimitStore = new UpstashRateLimitStore();
    } catch (error) {
      redisRateLimitStore = null;
      rateLimitLogger.warn("upstash rate-limit initialization failed; using memory fallback", {
        err: error,
      });
    }
  }

  return redisRateLimitStore ?? memoryRateLimitStore;
}

function normalizeOptions({
  action,
  identifier,
  limit = 5,
  windowMs = 60_000,
}: RateLimitOptions): NormalizedRateLimitOptions {
  return {
    action: action.trim() || "global",
    identifier: identifier.trim().slice(0, RATE_LIMIT_IDENTIFIER_MAX_LENGTH) || "anonymous",
    limit: Math.max(1, limit),
    windowMs: Math.max(1_000, windowMs),
  };
}

export function getRateLimitBackend(
  rawEnv: Readonly<Record<string, string | undefined>> = process.env,
): "memory" | "redis" {
  return hasUpstashConfig(rawEnv) ? "redis" : "memory";
}

/**
 * Check whether an action by the given identifier is within rate limits.
 *
 * Callers keep one stable API regardless of whether the active backend is
 * Redis (production) or the in-memory fallback (local/test).
 */
export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const normalizedOptions = normalizeOptions(options);
  const store = getRateLimitStore();

  try {
    return await store.limit(normalizedOptions);
  } catch (error) {
    if (store !== memoryRateLimitStore) {
      rateLimitLogger.warn("redis rate-limit request failed; retrying with memory fallback", {
        action: normalizedOptions.action,
        err: error,
      });
      return memoryRateLimitStore.limit(normalizedOptions);
    }

    throw error;
  }
}
