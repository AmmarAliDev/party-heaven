import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { searchAdminOccasionCatalog } from "@/features/admin/occasions";
import { guardRouteHandlerAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";
import { createRouteHandlerErrorResponse } from "@/lib/errors/handling";

export const runtime = "nodejs";

const occasionSearchQuerySchema = z.object({
  q: z.string().trim().min(1, "Search query is required.").max(120),
});

export async function GET(request: NextRequest) {
  try {
    const access = await guardRouteHandlerAccess({
      permissions: [rbacPermissions.adminAccess, rbacPermissions.catalogWrite],
    });

    if (!access.ok) {
      return access.response;
    }

    const parsedResult = occasionSearchQuerySchema.safeParse({
      q: request.nextUrl.searchParams.get("q") ?? undefined,
    });

    if (!parsedResult.success) {
      return NextResponse.json({
        ok: true,
        categories: [],
        products: [],
        deals: [],
      });
    }

    const result = await searchAdminOccasionCatalog(parsedResult.data.q);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return createRouteHandlerErrorResponse(error, "admin occasion search", {
      userMessage: "We could not search the catalog right now. Please try again.",
    });
  }
}
