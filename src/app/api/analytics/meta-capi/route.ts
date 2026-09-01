import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildSupplementalEvent,
  isMetaCapiEnabled,
  META_CAPI_CURRENCY,
  type MetaCapiCustomData,
  sendMetaCapiEvents,
} from "@/features/analytics/meta-capi";
import {
  createRouteHandlerErrorResponse,
  createValidationAppError,
} from "@/lib/errors/handling";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertTrustedRouteHandlerRequest } from "@/lib/security/csrf";

/**
 * POST /api/analytics/meta-capi
 *
 * Optional client-to-server bridge for Meta Conversion API events (other than
 * Purchase, which is fired server-side at order placement).
 *
 * Purpose: let the store send funnel events (`ViewContent`, `AddToCart`,
 * `InitiateCheckout`, `Search`, …) through CAPI when desired — for example to
 * keep conversion data flowing when browser-side tracking is blocked.
 *
 * Security model:
 *  - CSRF/trusted-origin enforced via `assertTrustedRouteHandlerRequest`.
 *  - Rate-limited per IP (60/min) to deter event-injection abuse.
 *  - NO PII is accepted from the client. Identity comes only from the `_fbp` /
 *    `_fbc` cookies and request headers, both read server-side.
 *  - Only when CAPI is configured (`META_PIXEL_ID` + `META_CAPI_ACCESS_TOKEN`)
 *    does this route forward anything; otherwise it returns a no-op success so
 *    client callers never need to know about configuration.
 *
 * Deduplication: when the GTM Meta Pixel tag and this route are both used for
 * the same event, set the same `event_id` in both (the Pixel tag's Event ID
 * field) so Meta counts the event only once.
 *
 * Request body (JSON):
 *   {
 *     event_name: "ViewContent" | "AddToCart" | "InitiateCheckout" | "Search"
 *               | "AddToWishlist" | "CompleteRegistration" | "PageView",
 *     event_id?: string,
 *     event_source_url?: string,
 *     data?: { currency?: "PKR", value?, contents?, content_ids?, ... }
 *   }
 */

const META_FBP_COOKIE = "_fbp";
const META_FBC_COOKIE = "_fbc";

const metaCapiBridgeSchema = z
  .object({
    event_name: z.enum([
      "PageView",
      "ViewContent",
      "AddToCart",
      "InitiateCheckout",
      "Search",
      "AddToWishlist",
      "CompleteRegistration",
    ]),
    event_id: z.string().trim().min(1).max(100).optional(),
    event_source_url: z.string().url().max(500).optional(),
    data: z
      .object({
        currency: z.literal("PKR").optional(),
        value: z.number().finite().nonnegative().optional(),
        contents: z
          .array(
            z
              .object({
                id: z.string().trim().min(1).max(200),
                quantity: z.number().int().positive().max(99),
                item_price: z.number().finite().nonnegative().optional(),
                content_name: z.string().trim().min(1).max(200).optional(),
                content_category: z.string().trim().min(1).max(200).optional(),
              })
              .strict(),
          )
          .max(50)
          .optional(),
        content_ids: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
        content_type: z.enum(["product", "product_group"]).optional(),
        num_items: z.number().int().nonnegative().max(1000).optional(),
        order_id: z.string().trim().min(1).max(100).optional(),
        search_string: z.string().trim().min(1).max(200).optional(),
        status: z.string().trim().min(1).max(100).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

function getClientIp(request: NextRequest): string | undefined {
  return request.headers.get("x-forwarded-for")?.split(",").at(0)?.trim() || undefined;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // CSRF — verify the request originates from a trusted origin.
    assertTrustedRouteHandlerRequest(request, { action: "analytics:meta-capi" });

    // No-op when CAPI is not configured (client callers stay simple).
    if (!isMetaCapiEnabled()) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Rate limit by IP to deter event-injection abuse.
    const ip = getClientIp(request) ?? "unknown";
    const rateLimit = await checkRateLimit({
      action: "analytics:meta-capi",
      identifier: ip,
      limit: 60,
      windowMs: 60_000,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        { ok: false, error: "Too many analytics events. Please try again later." },
        { status: 429 },
      );
    }

    const rawBody: unknown = await request.json();
    const parsed = metaCapiBridgeSchema.safeParse(rawBody);

    if (!parsed.success) {
      throw createValidationAppError(parsed.error, "Invalid analytics event payload.");
    }

    // Read the Meta Pixel cookies server-side; never accept them from the body.
    const cookieStore = await cookies();
    const fbp = cookieStore.get(META_FBP_COOKIE)?.value;
    const fbc = cookieStore.get(META_FBC_COOKIE)?.value;
    const userAgent = request.headers.get("user-agent") || undefined;

    // Rebuild the custom_data with only present fields so the payload matches
    // `MetaCapiCustomData` under `exactOptionalPropertyTypes` (zod's optional
    // fields widen to `| undefined`). The schema has already validated the
    // shape, so the cast is safe.
    const rawData = parsed.data.data;
    const customData: MetaCapiCustomData | undefined = rawData
      ? ({
          currency: rawData.currency ?? META_CAPI_CURRENCY,
          ...(rawData.value !== undefined ? { value: rawData.value } : {}),
          ...(rawData.contents ? { contents: rawData.contents } : {}),
          ...(rawData.content_ids ? { content_ids: rawData.content_ids } : {}),
          ...(rawData.content_type ? { content_type: rawData.content_type } : {}),
          ...(rawData.num_items !== undefined ? { num_items: rawData.num_items } : {}),
          ...(rawData.order_id ? { order_id: rawData.order_id } : {}),
          ...(rawData.search_string ? { search_string: rawData.search_string } : {}),
          ...(rawData.status ? { status: rawData.status } : {}),
        } as MetaCapiCustomData)
      : undefined;

    const event = buildSupplementalEvent({
      eventName: parsed.data.event_name,
      ...(parsed.data.event_id ? { eventId: parsed.data.event_id } : {}),
      ...(parsed.data.event_source_url ? { eventSourceUrl: parsed.data.event_source_url } : {}),
      ...(fbp ? { fbp } : {}),
      ...(fbc ? { fbc } : {}),
      ...(ip !== "unknown" ? { clientIp: ip } : {}),
      ...(userAgent ? { userAgent } : {}),
      ...(customData ? { customData } : {}),
    });

    const result = await sendMetaCapiEvents([event]);

    return NextResponse.json({ ok: true, delivered: result.sent });
  } catch (error) {
    return createRouteHandlerErrorResponse(error, "analytics:meta-capi", {
      userMessage: "We could not record the analytics event.",
    });
  }
}
