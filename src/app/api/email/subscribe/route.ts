import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";

import { subscribeEmail } from "@/features/email-marketing";
import { createRouteHandlerErrorResponse } from "@/lib/errors/handling";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertTrustedRouteHandlerRequest } from "@/lib/security/csrf";

/**
 * POST /api/email/subscribe
 *
 * Captures a new email marketing subscriber or updates an existing one.
 *
 * Request body (JSON):
 *   { email: string; firstName?: string; source: string; tags?: string[] }
 *
 * Responses:
 *   201 { ok: true; alreadySubscribed: false }
 *   200 { ok: true; alreadySubscribed: true }
 *   400 { ok: false; error: string }
 *   429 { ok: false; error: string }  — rate limited
 *
 * Rate limit: 5 subscribe attempts per IP per 10 minutes.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // CSRF — verify the request comes from a trusted origin.
    assertTrustedRouteHandlerRequest(request);

    // Rate limit by IP to deter abuse / list inflation.
    const ip = request.headers.get("x-forwarded-for")?.split(",").at(0)?.trim() ?? "unknown";
    const rl = await checkRateLimit({
      action: "email:subscribe",
      identifier: ip,
      limit: 5,
      windowMs: 10 * 60_000,
    });

    if (!rl.success) {
      return NextResponse.json(
        { ok: false, error: "Too many subscribe requests. Please try again later." },
        { status: 429 },
      );
    }

    const body: unknown = await request.json();
    const result = await subscribeEmail(body as Parameters<typeof subscribeEmail>[0]);

    if (!result.success) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      { ok: true, alreadySubscribed: result.alreadySubscribed },
      { status: result.alreadySubscribed ? 200 : 201 },
    );
  } catch (error) {
    return createRouteHandlerErrorResponse(error, "email:subscribe", {
      userMessage: "We could not save your subscription. Please try again.",
    });
  }
}
