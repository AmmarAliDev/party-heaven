import { NextResponse } from "next/server";
import { z } from "zod";

import {
  deleteSavedAddress,
  savedAddressInputSchema,
  setDefaultSavedAddress,
  updateSavedAddress,
} from "@/features/addresses";
import { guardRouteHandlerAccess } from "@/lib/auth/guards";
import { AppError } from "@/lib/errors/app-error";
import { createRouteHandlerErrorResponse, createValidationAppError } from "@/lib/errors/handling";
import { assertTrustedRouteHandlerRequest } from "@/lib/security/csrf";

type AddressRouteContext = {
  params: Promise<{ addressId: string }>;
};

const setDefaultPayloadSchema = z.object({
  isDefault: z.literal(true),
});

function requireUserId(userId: string | undefined) {
  if (!userId) {
    throw new AppError("Missing authenticated user id", "AUTH_MISSING_USER_ID", {
      statusCode: 401,
      userMessage: "Please sign in again and retry.",
    });
  }

  return userId;
}

export async function PATCH(request: Request, context: AddressRouteContext) {
  try {
    assertTrustedRouteHandlerRequest(request, { action: "addresses:update" });

    const access = await guardRouteHandlerAccess();
    if (!access.ok) {
      return access.response;
    }

    const { addressId } = await context.params;
    const payload = await request.json();
    const userId = requireUserId(access.session.user.id);

    const setDefaultResult = setDefaultPayloadSchema.safeParse(payload);
    if (setDefaultResult.success) {
      const address = await setDefaultSavedAddress(userId, addressId);

      return NextResponse.json({
        ok: true,
        address,
      });
    }

    const parsed = savedAddressInputSchema.safeParse(payload);

    if (!parsed.success) {
      throw createValidationAppError(parsed.error, "Invalid address payload.");
    }

    const address = await updateSavedAddress(userId, addressId, parsed.data);

    return NextResponse.json({
      ok: true,
      address,
    });
  } catch (error) {
    return createRouteHandlerErrorResponse(error, "addresses:update", {
      userMessage: "We could not update this address. Please try again.",
    });
  }
}

export async function DELETE(request: Request, context: AddressRouteContext) {
  try {
    assertTrustedRouteHandlerRequest(request, { action: "addresses:delete" });

    const access = await guardRouteHandlerAccess();
    if (!access.ok) {
      return access.response;
    }

    const { addressId } = await context.params;
    const result = await deleteSavedAddress(requireUserId(access.session.user.id), addressId);

    return NextResponse.json({
      ok: true,
      removed: result.removed,
    });
  } catch (error) {
    return createRouteHandlerErrorResponse(error, "addresses:delete", {
      userMessage: "We could not remove this address. Please try again.",
    });
  }
}
