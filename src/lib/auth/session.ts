/**
 * Server-side session utilities.
 *
 * All functions in this file are server-only (they import from `@/auth` which
 * uses server APIs). Do not import this file from Client Components.
 *
 * Usage pattern:
 *   const session = await getSession();             // nullable
 *   const session = await requireSession();         // redirects if missing
 *   const role    = await getCurrentUserRole();     // typed RoleKey | null
 *   const allowed = await hasPermission(...);       // boolean
 */

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { routes } from "@/config/routes";
import type { RoleKey } from "@/lib/auth/roles";

import {
  hasAnyPermission as roleHasAnyPermission,
  normalizeRole,
  type RbacPermission,
} from "./rbac";

/** Return the current session, or `null` if the user is not authenticated. */
export async function getSession() {
  return auth();
}

/**
 * Require an authenticated session.
 * Redirects to the sign-in page if the user is not logged in.
 * Use in Server Components and Server Actions that need a logged-in user.
 */
export async function requireSession(redirectTo = routes.auth.signIn) {
  const session = await auth();
  if (!session?.user) {
    redirect(redirectTo);
  }
  return session;
}

/**
 * Return the current user's database ID, or `null` if not authenticated.
 * Safe to call in any Server Component — no redirect side-effect.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Return the current user's typed role key (e.g. `RoleKey.CUSTOMER`),
 * or `null` if not authenticated.
 */
export async function getCurrentUserRole(): Promise<RoleKey | null> {
  const session = await auth();
  return normalizeRole(session?.user?.role);
}

/**
 * Check whether the current user has one of the given roles.
 * Returns `false` for unauthenticated users.
 */
export async function hasRole(...roleKeys: RoleKey[]): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role ? roleKeys.includes(role) : false;
}

/** Check whether the current user has a specific permission grant. */
export async function hasPermission(permission: RbacPermission): Promise<boolean> {
  const role = await getCurrentUserRole();
  return roleHasAnyPermission(role, [permission]);
}

/** Check whether the current user has any permission from the supplied list. */
export async function hasAnyPermission(...permissions: RbacPermission[]): Promise<boolean> {
  const role = await getCurrentUserRole();
  return roleHasAnyPermission(role, permissions);
}
