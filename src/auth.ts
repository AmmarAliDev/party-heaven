/**
 * Auth.js (NextAuth) v5 configuration — Party Heaven e-commerce app.
 *
 * Strategy: JWT sessions (works seamlessly across credentials + OAuth).
 * The PrismaAdapter stores OAuth Account links and User records in the DB,
 * while sessions travel as encrypted JWTs so no DB hit is needed per request.
 *
 * Providers:
 *  - Credentials  → email + bcrypt password
 *  - Google        → OAuth 2.0 SSO (reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET)
 *
 * Env vars required (see docs/dev/auth.md):
 *  AUTH_SECRET            — random secret, ≥ 32 chars
 *  AUTH_URL               — optional (defaults to NEXT_PUBLIC_APP_URL)
 *  AUTH_GOOGLE_ID         — Google OAuth client ID
 *  AUTH_GOOGLE_SECRET     — Google OAuth client secret
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { RoleKey } from "@/lib/auth/roles";
import { getPrismaClient } from "@/server/db";

import { signInValidator } from "./features/auth/validators";
import { comparePassword } from "./lib/auth/password";

const db = getPrismaClient();
const ROLE_REFRESH_WINDOW_MS = 5 * 60 * 1000;

async function refreshTokenRole(input: {
  tokenId?: unknown;
  roleFromUser?: RoleKey | null;
  existingRole?: RoleKey | null;
  refreshedAt?: number | null;
}) {
  const now = Date.now();

  if (input.roleFromUser) {
    return {
      role: input.roleFromUser,
      refreshedAt: now,
    };
  }

  const tokenUserId = typeof input.tokenId === "string" && input.tokenId.length > 0 ? input.tokenId : null;
  const lastRefreshedAt =
    typeof input.refreshedAt === "number" && Number.isFinite(input.refreshedAt) ? input.refreshedAt : null;
  const shouldRefreshRole =
    !input.existingRole || !lastRefreshedAt || now - lastRefreshedAt >= ROLE_REFRESH_WINDOW_MS;

  if (!tokenUserId || !shouldRefreshRole) {
    return {
      role: input.existingRole ?? RoleKey.CUSTOMER,
      refreshedAt: lastRefreshedAt ?? now,
    };
  }

  const dbUser = await db.user.findUnique({
    where: { id: tokenUserId },
    include: { role: true },
  });

  return {
    role: dbUser ? dbUser.role?.key ?? RoleKey.CUSTOMER : null,
    refreshedAt: now,
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Attach to Prisma so OAuth accounts + users are persisted.
  adapter: PrismaAdapter(db),

  // JWT sessions avoid a DB round-trip on every auth check and work with
  // both the Credentials provider and OAuth providers simultaneously.
  session: { strategy: "jwt" },

  providers: [
    // ── Google OAuth ──────────────────────────────────────────────────────
    // Reads AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from env automatically.
    Google,

    // ── Email / Password ──────────────────────────────────────────────────
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        // Validate shape before touching the DB.
        const parsed = signInValidator.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await db.user.findUnique({
          where: { email },
          include: { role: true },
        });

        // Guard: user must exist and have a password (credentials account).
        if (!user?.password) return null;

        const passwordValid = await comparePassword(password, user.password);
        if (!passwordValid) return null;

        // Credentials accounts must verify email before they can sign in.
        if (!user.emailVerified) return null;

        // Return minimal user object; role is added to JWT in the callback.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          // Extra field: picked up in the jwt callback below.
          role: user.role?.key ?? RoleKey.CUSTOMER,
        };
      },
    }),
  ],

  callbacks: {
    /**
     * jwt callback — runs when a token is created or refreshed.
     * Persist `id` and `role` into the JWT so the session callback can read them.
     *
     * Credentials sign-in: authorize() already attaches `role` to the user object,
     * so no extra DB query is needed.
     * OAuth sign-in: PrismaAdapter returns the user row without relations, so we
     * fetch the role from the DB only in that case (once, at sign-in time).
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      const roleFromUser = user ? (user as { role?: RoleKey | null }).role : undefined;
      const roleSnapshot = await refreshTokenRole({
        tokenId: token.id,
        existingRole: (token.role as RoleKey | null | undefined) ?? null,
        refreshedAt:
          typeof token.roleRefreshedAt === "number" ? token.roleRefreshedAt : null,
        ...(roleFromUser !== undefined ? { roleFromUser } : {}),
      });

      token.role = roleSnapshot.role;
      token.roleRefreshedAt = roleSnapshot.refreshedAt;

      return token;
    },

    /**
     * session callback — shapes what client code sees via useSession / auth().
     * Reads from the JWT, avoids an extra DB query per request.
     */
    session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: (token.id as string | undefined) ?? "",
          role: (token.role as RoleKey | null | undefined) ?? null,
        },
      };
    },
  },

  pages: {
    // Use custom pages instead of Auth.js built-in pages.
    signIn: "/auth/sign-in",
    newUser: "/auth/sign-up",
    error: "/auth/error",
  },
});
