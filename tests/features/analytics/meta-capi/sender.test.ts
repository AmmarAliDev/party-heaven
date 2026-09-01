import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MetaCapiEvent } from "@/features/analytics/meta-capi";
import { sendMetaCapiEvents } from "@/features/analytics/meta-capi";

const enabledEnv = {
  META_PIXEL_ID: "123456789",
  META_CAPI_ACCESS_TOKEN: "EAAG-test-token",
};

const event: MetaCapiEvent = {
  event_name: "Purchase",
  event_time: 1_234_567_890,
  event_id: "OD-20260901-0001",
  action_source: "website",
  user_data: { em: ["hashed-email"] },
  custom_data: { currency: "PKR", value: 2150 },
};

const fetchMock = vi.hoisted(() => vi.fn());

describe("meta-capi sender", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is a silent no-op when CAPI is not configured", async () => {
    const result = await sendMetaCapiEvents([event], {});

    expect(result.sent).toBe(false);
    expect(result.eventCount).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a no-op for an empty event list", async () => {
    const result = await sendMetaCapiEvents([], enabledEnv);

    expect(result.sent).toBe(false);
    expect(result.eventCount).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts events to the Meta Graph API and reports success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events_received: 1 }),
    });

    const result = await sendMetaCapiEvents([event], enabledEnv);

    expect(result.sent).toBe(true);
    expect(result.eventsReceived).toBe(1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://graph.facebook.com");
    expect(parsed.pathname).toBe("/v21.0/123456789/events");
    expect(parsed.searchParams.get("access_token")).toBe("EAAG-test-token");

    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body)) as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });

  it("includes the test event code when configured", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events_received: 1 }),
    });

    await sendMetaCapiEvents([event], { ...enabledEnv, META_CAPI_TEST_EVENT_CODE: "TESTCODE123" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { test_event_code?: string };
    expect(body.test_event_code).toBe("TESTCODE123");
  });

  it("returns an error result without throwing on an API error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ error: { message: "Invalid token" } }),
    });

    const result = await sendMetaCapiEvents([event], enabledEnv);

    expect(result.sent).toBe(false);
    expect(result.error).toContain("Invalid token");
  });

  it("returns an error result without throwing on a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await sendMetaCapiEvents([event], enabledEnv);

    expect(result.sent).toBe(false);
    expect(result.error).toBe("network down");
  });
});
