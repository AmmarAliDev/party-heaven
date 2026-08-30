import { NextResponse } from "next/server";
import { z } from "zod";

import {
  addWishlistItemForUser,
  getWishlistSkusForUser,
  removeWishlistSelectionForUser,
  removeWishlistSkuForUser,
} from "@/features/wishlist";
import { guardRouteHandlerAccess } from "@/lib/auth/guards";
import { AppError } from "@/lib/errors/app-error";
import { createRouteHandlerErrorResponse, createValidationAppError } from "@/lib/errors/handling";
import { assertTrustedRouteHandlerRequest } from "@/lib/security/csrf";

const wishlistSelectionSchema = z.object({
  productSlug: z.string().trim().min(1),
  optionId: z.string().trim().min(1).optional(),
});

const wishlistRemoveSchema = z.union([
  wishlistSelectionSchema,
  z.object({
    sku: z.string().trim().min(1),
  }),
]);

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

    const skus = await getWishlistSkusForUser(requireUserId(access.session.user.id));

    return NextResponse.json({ ok: true, skus });
  } catch (error) {
    return createRouteHandlerErrorResponse(error, "wishlist:list", {
      userMessage: "We could not load your wishlist. Please try again.",
    });
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedRouteHandlerRequest(request, { action: "wishlist:add" });

    const access = await guardRouteHandlerAccess();
    if (!access.ok) {
      return access.response;
    }

    const payload = await request.json();
    const parsedResult = wishlistSelectionSchema.safeParse(payload);

    if (!parsedResult.success) {
      throw createValidationAppError(parsedResult.error, "Invalid wishlist add payload.");
    }

    const item = await addWishlistItemForUser(
      requireUserId(access.session.user.id),
      parsedResult.data,
    );

    return NextResponse.json({
      ok: true,
      wishlistItemId: item.id,
    });
  } catch (error) {
    return createRouteHandlerErrorResponse(error, "wishlist:add", {
      userMessage: "We could not save this item to your wishlist. Please try again.",
    });
  }
}

export async function DELETE(request: Request) {
  try {
    assertTrustedRouteHandlerRequest(request, { action: "wishlist:remove" });

    const access = await guardRouteHandlerAccess();
    if (!access.ok) {
      return access.response;
    }

    const payload = await request.json();
    const parsedResult = wishlistRemoveSchema.safeParse(payload);

    if (!parsedResult.success) {
      throw createValidationAppError(parsedResult.error, "Invalid wishlist remove payload.");
    }

    const userId = requireUserId(access.session.user.id);
    const removed = "sku" in parsedResult.data
      ? await removeWishlistSkuForUser(userId, parsedResult.data.sku)
      : await removeWishlistSelectionForUser(userId, parsedResult.data);

    return NextResponse.json({
      ok: true,
      removed,
    });
  } catch (error) {
    return createRouteHandlerErrorResponse(error, "wishlist:remove", {
      userMessage: "We could not remove this item from your wishlist. Please try again.",
    });
  }
}