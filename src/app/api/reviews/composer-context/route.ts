import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getCustomerReviewComposerContext } from "@/features/reviews/service";
import { createRouteHandlerErrorResponse, createValidationAppError } from "@/lib/errors/handling";

const querySchema = z
  .object({
    productId: z.string().trim().min(1).optional(),
    dealId: z.string().trim().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.productId && !data.dealId) {
      ctx.addIssue({
        code: "custom",
        path: ["productId"],
        message: "A productId or dealId is required.",
      });
    }
  });

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      productId: searchParams.get("productId") ?? undefined,
      dealId: searchParams.get("dealId") ?? undefined,
    });

    if (!parsed.success) {
      throw createValidationAppError(parsed.error, "Invalid review composer context query.");
    }

    const session = await auth();
    const context = await getCustomerReviewComposerContext({
      userId: session?.user?.id ?? null,
      ...(parsed.data.productId ? { productId: parsed.data.productId } : {}),
      ...(parsed.data.dealId ? { dealId: parsed.data.dealId } : {}),
    });

    return NextResponse.json(
      {
        ok: true,
        context,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return createRouteHandlerErrorResponse(error, "reviews:composer-context", {
      userMessage: "We could not load review options right now. Please try again.",
    });
  }
}
