import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { listAdminOccasionDeals } from "@/features/admin/occasions";
import { guardRouteHandlerAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";
import { createRouteHandlerErrorResponse } from "@/lib/errors/handling";

export const runtime = "nodejs";

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const access = await guardRouteHandlerAccess({
      permissions: [rbacPermissions.adminAccess, rbacPermissions.catalogWrite],
    });

    if (!access.ok) {
      return access.response;
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    const deals = await listAdminOccasionDeals({
      ...(query ? { query } : {}),
      take: parseNumber(searchParams.get("take"), 20),
      selectedIds: searchParams.getAll("selectedIds"),
    });

    return NextResponse.json({ ok: true, deals });
  } catch (error) {
    return createRouteHandlerErrorResponse(error, "admin occasion deals", {
      userMessage: "We could not load deals right now. Please try again.",
    });
  }
}
