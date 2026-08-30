import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";

import { unsubscribeByToken } from "@/features/email-marketing";
import { createRouteHandlerErrorResponse } from "@/lib/errors/handling";

/**
 * GET /api/email/unsubscribe?token=<unsubscribeToken>
 *
 * Handles one-click unsubscribe links embedded in marketing emails.
 * The token is the opaque `unsubscribeToken` stored on the EmailSubscriber row.
 *
 * NEVER include the subscriber's email in the URL — always use this token.
 *
 * On success, returns a plain JSON 200 so the link can be clicked directly from
 * an email client. A future enhancement can redirect to an HTML confirmation page.
 *
 * Responses:
 *   200 { ok: true; message: string }  — success or token not found (anti-enumeration)
 *   400 { ok: false; error: string }   — malformed / invalid token format
 *   500                                — internal server error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const token = request.nextUrl.searchParams.get("token") ?? "";
    const result = await unsubscribeByToken({ token });

    if (!result.success) {
      if (result.reason === "invalid") {
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      }
      // Internal error — surface as 500 rather than masking it as 400.
      return NextResponse.json(
        { ok: false, error: "We could not process your unsubscribe request. Please try again." },
        { status: 500 },
      );
    }

    // Returns 200 for both successful unsubscribes and "token not found" (anti-enumeration).
    return NextResponse.json({
      ok: true,
      message: "You have been successfully unsubscribed from our marketing emails.",
    });
  } catch (error) {
    return createRouteHandlerErrorResponse(error, "email:unsubscribe", {
      userMessage: "We could not process your unsubscribe request. Please try again.",
    });
  }
}

/**
 * POST /api/email/unsubscribe
 *
 * Programmatic unsubscribe (e.g. from a preferences page or one-click unsubscribe
 * header in email clients — RFC 8058 List-Unsubscribe-Post).
 *
 * Accepts:
 *   - application/json:                 { token: string }
 *   - application/x-www-form-urlencoded: token=<value>  or  List-Unsubscribe=One-Click
 *
 * Responses:
 *   200 { ok: true }  — always returned (anti-enumeration; errors are not surfaced)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    let token = "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      // RFC 8058: mail clients send List-Unsubscribe=One-Click; fall back to token param.
      token = params.get("token") ?? params.get("List-Unsubscribe") ?? "";
    } else {
      // Default: treat as JSON.
      const body: unknown = await request.json().catch(() => null);
      token =
        body != null && typeof body === "object" && "token" in body
          ? String((body as Record<string, unknown>).token ?? "")
          : "";
    }

    await unsubscribeByToken({ token });

    // Always return 200 — never reveal token validity to callers (anti-enumeration).
    return NextResponse.json({ ok: true });
  } catch (error) {
    return createRouteHandlerErrorResponse(error, "email:unsubscribe", {
      userMessage: "We could not process your unsubscribe request. Please try again.",
    });
  }
}
