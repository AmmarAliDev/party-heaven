import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { listAdminOccasionProducts } from "@/features/admin/occasions";
import { guardRouteHandlerAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";
import { createRouteHandlerErrorResponse, createValidationAppError } from "@/lib/errors/handling";

export const runtime = "nodejs";

const occasionProductsQuerySchema = z.object({
  categoryId: z.string().trim().min(1, "Category ID is required.").max(80),
});

export async function GET(request: NextRequest) {
  try {
    const access = await guardRouteHandlerAccess({
      permissions: [rbacPermissions.adminAccess, rbacPermissions.catalogWrite],
    });

    if (!access.ok) {
      return access.response;
    }

    const parsedResult = occasionProductsQuerySchema.safeParse({
      categoryId: request.nextUrl.searchParams.get("categoryId") ?? undefined,
    });

    if (!parsedResult.success) {
      throw createValidationAppError(parsedResult.error, "Invalid occasion products query.");
    }

    const products = await listAdminOccasionProducts(parsedResult.data.categoryId);

    return NextResponse.json({ ok: true, products });
  } catch (error) {
    return createRouteHandlerErrorResponse(error, "admin occasion products", {
      userMessage: "We could not load occasion products right now. Please try again.",
    });
  }
}
