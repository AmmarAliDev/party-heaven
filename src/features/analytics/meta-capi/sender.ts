import type { EnvSource } from "@/config/env";
import { createLogger, sanitizeForLogging } from "@/lib/logger";

import { getMetaCapiConfig } from "./config";
import type { MetaCapiEvent, MetaCapiSendResult } from "./types";

/**
 * Sends events to the Meta Conversion API endpoint:
 *   POST https://graph.facebook.com/{version}/{pixel_id}/events
 *
 * The access token travels as a query parameter (the standard transport). It is
 * server-only and never leaves the server; errors are logged WITHOUT the token
 * or raw PII.
 */

const metaCapiLogger = createLogger("analytics.meta-capi");

const REQUEST_TIMEOUT_MS = 10_000;

type MetaCapiEndpointResponse = {
  events_received?: number;
  messages?: Array<{ message?: string }>;
  error?: { message?: string; code?: number };
};

/**
 * Performs the HTTP request to Meta. Throws on transport/parse failures so the
 * caller can decide how to react; `sendMetaCapiEvents` wraps it and never
 * throws.
 */
async function postMetaCapiEvents(
  events: MetaCapiEvent[],
  config: NonNullable<ReturnType<typeof getMetaCapiConfig>>,
): Promise<{ eventsReceived: number }> {
  const url = new URL(
    `https://graph.facebook.com/${config.graphVersion}/${config.pixelId}/events`,
  );
  url.searchParams.set("access_token", config.accessToken);

  const body: Record<string, unknown> = { data: events };
  if (config.testEventCode) {
    body.test_event_code = config.testEventCode;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    let payload: MetaCapiEndpointResponse | null = null;
    try {
      payload = (await response.json()) as MetaCapiEndpointResponse;
    } catch {
      payload = null;
    }

    if (!response.ok || payload?.error) {
      const message = payload?.error?.message ?? payload?.messages?.[0]?.message ?? response.statusText;
      throw new Error(`Meta CAPI request failed (${response.status}): ${message}`);
    }

    return { eventsReceived: payload?.events_received ?? events.length };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Sends one or more CAPI events. Returns a normalized result and NEVER throws:
 * analytics failures are logged and must not break the calling flow.
 *
 * When CAPI is not configured this is a silent no-op returning `sent: false`.
 */
export async function sendMetaCapiEvents(
  events: MetaCapiEvent[],
  rawEnv: EnvSource = process.env,
): Promise<MetaCapiSendResult> {
  const config = getMetaCapiConfig(rawEnv);

  if (!config) {
    return { sent: false, eventCount: events.length };
  }

  if (events.length === 0) {
    return { sent: false, eventCount: 0 };
  }

  try {
    const { eventsReceived } = await postMetaCapiEvents(events, config);
    metaCapiLogger.info("meta conversion api events sent", {
      eventCount: events.length,
      eventsReceived,
      testMode: Boolean(config.testEventCode),
    });

    return {
      sent: true,
      eventCount: events.length,
      eventsReceived,
    };
  } catch (error) {
    metaCapiLogger.error("meta conversion api send failed", sanitizeForLogging(error));
    return {
      sent: false,
      eventCount: events.length,
      error: error instanceof Error ? error.message : "Unknown Meta CAPI error",
    };
  }
}
