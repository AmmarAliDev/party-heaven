// NextAuth session and JWT type augmentation for this project.
// Adds `id` and typed `role` fields to the session user so downstream code can
// rely on safe RBAC checks without stringly-typed access.
// Reference: https://authjs.dev/getting-started/typescript

import type { DefaultSession } from "next-auth";

import type { RoleKey } from "@/lib/auth/roles";

declare module "next-auth" {
  interface Session {
    user: {
      /** Database user ID (UUID). */
      id: string;
      /** Role key from the Role table (e.g. `RoleKey.CUSTOMER`). */
      role: RoleKey | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** Database user ID propagated into the JWT payload. */
    id?: string;
    /** Role key propagated into the JWT payload for fast RBAC checks. */
    role?: RoleKey | null;
    /** Last time the role snapshot was refreshed from the database. */
    roleRefreshedAt?: number;
  }
}
