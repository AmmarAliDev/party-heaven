import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

import { routes } from "@/config/routes";
import type { RoleKey } from "@/lib/auth/roles";

import {
  type AccessDenialReason,
  evaluateRouteAccess,
  type RbacPermission,
  rbacPermissions,
} from "./rbac";

type AuthenticatedSession = Session & {
  user: NonNullable<Session["user"]>;
};

export interface RouteGuardOptions {
  roles?: readonly RoleKey[];
  permissions?: readonly RbacPermission[];
  from?: string;
}

export type RouteHandlerAccessResult =
  | {
      ok: true;
      role: RoleKey | null;
      session: AuthenticatedSession;
    }
  | {
      ok: false;
      response: NextResponse;
    };

async function getAuthSession() {
  const { auth } = await import("@/auth");
  return auth();
}

function isSafeRelativePath(value: string) {
  const candidate = value.trim();

  if (!candidate.startsWith("/")) {
    return false;
  }

  if (candidate.startsWith("//") || candidate.includes("://") || candidate.includes("\\")) {
    return false;
  }

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(candidate.slice(1)) || /[\r\n]/.test(candidate)) {
    return false;
  }

  return true;
}

function appendFromQuery(path: string, from?: string) {
  if (!from) {
    return path;
  }

  const candidate = from.trim();
  if (!candidate || !isSafeRelativePath(candidate)) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}from=${encodeURIComponent(candidate)}`;
}

export function getAccessDeniedPath(reason: AccessDenialReason, from?: string) {
  const basePath = reason === "unauthorized" ? routes.system.unauthorized : routes.system.forbidden;
  return appendFromQuery(basePath, from);
}

export function buildAccessDeniedResponse(reason: AccessDenialReason) {
  const isUnauthorized = reason === "unauthorized";

  return NextResponse.json(
    {
      code: isUnauthorized ? "AUTH_REQUIRED" : "FORBIDDEN",
      message: isUnauthorized
        ? "Please sign in with an authorized account to continue."
        : "You do not have permission to access this resource.",
    },
    {
      status: isUnauthorized ? 401 : 403,
    },
  );
}

/**
 * Authoritative server-side guard for layouts, pages, and server actions.
 * Redirects to the dedicated status pages instead of leaking raw auth errors.
 */
export async function requireRouteAccess(options: RouteGuardOptions = {}) {
  const session = await getAuthSession();
  const result = evaluateRouteAccess({
    isAuthenticated: Boolean(session?.user),
    role: session?.user?.role,
    roles: options.roles,
    permissions: options.permissions,
  });

  if (!result.isAllowed) {
    redirect(getAccessDeniedPath(result.reason, options.from));
  }

  return {
    role: result.role,
    session: session as AuthenticatedSession,
  };
}

export async function requireAdminAccess(options: RouteGuardOptions = {}) {
  return requireRouteAccess({
    ...options,
    permissions: [rbacPermissions.adminAccess],
  });
}

/**
 * Route-handler variant that returns a typed `NextResponse` instead of a
 * redirect/throw, which keeps JSON APIs easy to compose and test.
 */
export async function guardRouteHandlerAccess(
  options: RouteGuardOptions = {},
): Promise<RouteHandlerAccessResult> {
  const session = await getAuthSession();
  const result = evaluateRouteAccess({
    isAuthenticated: Boolean(session?.user),
    role: session?.user?.role,
    roles: options.roles,
    permissions: options.permissions,
  });

  if (!result.isAllowed) {
    return {
      ok: false,
      response: buildAccessDeniedResponse(result.reason),
    };
  }

  return {
    ok: true,
    role: result.role,
    session: session as AuthenticatedSession,
  };
}
