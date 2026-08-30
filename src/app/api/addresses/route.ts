import { NextResponse } from "next/server";

import {
  listSavedAddresses,
  savedAddressInputSchema,
  upsertSavedAddress,
} from "@/features/addresses";
import { guardRouteHandlerAccess } from "@/lib/auth/guards";
import { AppError } from "@/lib/errors/app-error";
import { createRouteHandlerErrorResponse, createValidationAppError } from "@/lib/errors/handling";
import { assertTrustedRouteHandlerRequest } from "@/lib/security/csrf";

function requireUserId(userId: string | undefined) {
  if (!userId) {
    throw new AppError("Missing authenticated user id", "AUTH_MISSING_USER_ID", {
      statusCode: 401,
      userMessage: "Please sign in again and retry.",
    });
  }

  return userId;
}

export async function GET() {
  try {
    const access = await guardRouteHandlerAccess();
    if (!access.ok) {
      return access.response;
    }

    const addresses = await listSavedAddresses(requireUserId(access.session.user.id));

    return NextResponse.json({
      ok: true,
      addresses,
    });
  } catch (error) {
    return createRouteHandlerErrorResponse(error, "addresses:list", {
      userMessage: "We could not load your saved addresses. Please try again.",
    });
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedRouteHandlerRequest(request, { action: "addresses:save" });

    const access = await guardRouteHandlerAccess();
    if (!access.ok) {
      return access.response;
    }

    const payload = await request.json();
    const parsed = savedAddressInputSchema.safeParse(payload);

    if (!parsed.success) {
      throw createValidationAppError(parsed.error, "Invalid address payload.");
    }

    const result = await upsertSavedAddress(requireUserId(access.session.user.id), parsed.data);

    return NextResponse.json({
      ok: true,
      address: result.address,
      created: result.created,
    });
  } catch (error) {
    return createRouteHandlerErrorResponse(error, "addresses:save", {
      userMessage: "We could not save this address. Please try again.",
    });
  }
}
