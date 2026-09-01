import { cookies, headers } from "next/headers";

import type { EnvSource } from "@/config/env";
import { env } from "@/config/env";
import { createLogger, sanitizeForLogging } from "@/lib/logger";

import { getMetaCapiConfig } from "./config";
import { buildPurchaseEvent } from "./payload";
import { sendMetaCapiEvents } from "./sender";
import type { MetaCapiPurchaseInput } from "./types";

/**
 * Server-side Meta CAPI Purchase orchestration.
 *
 * Called right after an order is placed. It is fully non-blocking: if CAPI is
 * not configured, or Meta is unreachable, or this runs outside a request
 * context (e.g. prerendering), it returns `false` and only logs — it never
 * throws and never breaks order placement.
 */

const metaCapiLogger = createLogger("analytics.meta-capi");

const META_FBP_COOKIE = "_fbp";
const META_FBC_COOKIE = "_fbc";

/**
 * Reads the `_fbp`/`_fbc` Meta Pixel cookies plus best-effort IP / User-Agent
 * from the current request. Returns `{}` when there is no request context.
 */
async function readRequestContext(): Promise<{
  fbp?: string;
  fbc?: string;
  clientIp?: string;
  userAgent?: string;
}> {
  try {
    // `cookies()` / `headers()` are async in Next.js 16.
    const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);

    const fbp = cookieStore.get(META_FBP_COOKIE)?.value;
    const fbc = cookieStore.get(META_FBC_COOKIE)?.value;
    const clientIp = headerStore.get("x-forwarded-for")?.split(",").at(0)?.trim();
    const userAgent = headerStore.get("user-agent") ?? undefined;

    return {
      ...(fbp ? { fbp } : {}),
      ...(fbc ? { fbc } : {}),
      ...(clientIp ? { clientIp } : {}),
      ...(userAgent ? { userAgent } : {}),
    };
  } catch {
    return {};
  }
}

/**
 * Fires the server-side CAPI `Purchase` event for a freshly placed order.
 *
 * Returns `true` when Meta acknowledged the event, `false` when CAPI is
 * disabled or the send failed. Never throws.
 */
export async function fireMetaCapiPurchaseSafely(
  input: MetaCapiPurchaseInput,
  rawEnv: EnvSource = process.env,
): Promise<boolean> {
  if (!getMetaCapiConfig(rawEnv)) {
    return false;
  }

  try {
    const requestContext = await readRequestContext();

    const event = buildPurchaseEvent({
      ...input,
      ...requestContext,
      eventSourceUrl:
        input.eventSourceUrl ??
        `${env.appUrl}/checkout/confirmation/${encodeURIComponent(input.orderNumber)}`,
    });

    const result = await sendMetaCapiEvents([event], rawEnv);

    if (!result.sent) {
      metaCapiLogger.warn("meta conversion api purchase not sent", {
        orderNumber: input.orderNumber,
        error: result.error,
      });
    }

    return result.sent;
  } catch (error) {
    // Must never break order placement.
    metaCapiLogger.error("meta conversion api purchase crashed", {
      orderNumber: input.orderNumber,
      error: sanitizeForLogging(error),
    });
    return false;
  }
}
