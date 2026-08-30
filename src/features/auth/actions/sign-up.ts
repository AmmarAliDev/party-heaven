"use server";

/**
 * Sign-up server action.
 *
 * Creates a new credentials-based account and starts email verification.
 *
 * Flow:
 *  1. Validate input with Zod.
 *  2. Rate-limit by email (prevents enumeration bursts).
 *  3. Check whether the email is already registered.
 *  4. Hash the password with bcrypt.
 *  5. Resolve or create the CUSTOMER role.
 *  6. Insert the User record.
 *  7. Create and send a verification email link.
 */

import { headers } from "next/headers";

import { env } from "@/config/env";
import { routes } from "@/config/routes";
import { issueEmailVerificationToken } from "@/features/auth/email-verification";
import { sendEmailVerificationEmail } from "@/features/auth/email-verification-email";
import { signUpValidator } from "@/features/auth/validators";
import {
  buildEmailVerificationUrl,
  createEmailVerificationTokenPair,
} from "@/lib/auth/email-verification-token";
import { hashPassword } from "@/lib/auth/password";
import { RoleKey } from "@/lib/auth/roles";
import { toActionErrorState } from "@/lib/errors/handling";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertTrustedOrigin, getClientIp } from "@/lib/security/csrf";
import { validateWithSchema } from "@/lib/security/validation";
import { getPrismaClient } from "@/server/db";

export interface SignUpActionState {
  errors?: string[];
  success?: boolean;
  message?: string;
}

const SIGN_UP_SUCCESS_MESSAGE =
  "If your account can be created, we sent a verification email. Please check your inbox before signing in.";

/**
 * Sign-up server action — compatible with React 19 `useActionState`.
 */
export async function signUpAction(
  _prev: SignUpActionState | null,
  formData: FormData,
): Promise<SignUpActionState> {
  const db = getPrismaClient();

  try {
    await assertTrustedOrigin({ action: "auth:sign-up" });
  } catch (error) {
    return toActionErrorState(error, "sign-up");
  }

  // ── 1. Parse & validate ───────────────────────────────────────────────────
  const raw = {
    name: formData.get("name") ?? undefined,
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  };

  const parsed = validateWithSchema(signUpValidator, raw);
  if (!parsed.success) {
    return {
      errors: parsed.errors,
    };
  }

  const { name, email, password } = parsed.data;

  // ── 2. Rate limit (Redis-backed when configured; memory fallback for local) ──
  const headerList = await headers();
  const ip = getClientIp(headerList);

  // IP-only bucket — primary enumeration guard. An attacker cycling through
  // different email addresses cannot create fresh buckets to evade this limit.
  const ipRlResult = await checkRateLimit({
    identifier: ip,
    action: "auth:sign-up",
    limit: 10,
    windowMs: 60_000,
  });

  if (!ipRlResult.success) {
    return {
      errors: ["Too many sign-up attempts. Please wait a minute and try again."],
    };
  }

  // Per-email bucket — secondary limit to slow concentrated attempts against a
  // single address (e.g. credential-stuffing a known email).
  const emailRlResult = await checkRateLimit({
    identifier: email.toLowerCase(),
    action: "auth:sign-up:email",
    limit: 3,
    windowMs: 60_000,
  });

  if (!emailRlResult.success) {
    return {
      errors: ["Too many sign-up attempts. Please wait a minute and try again."],
    };
  }

  // ── 3. Check for duplicate email ──────────────────────────────────────────
  // Return a generic success-like response for existing emails so an attacker
  // cannot distinguish a registered address from an unregistered one (i.e. no
  // email enumeration via differing error vs. success responses).
  const existing = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      emailVerified: true,
    },
  });
  if (existing) {
    if (!existing.emailVerified && existing.email) {
      await issueEmailVerificationToken({
        userId: existing.id,
        email: existing.email,
      });
    }

    return {
      success: true,
      message: SIGN_UP_SUCCESS_MESSAGE,
    };
  }

  // ── 4. Hash password ──────────────────────────────────────────────────────
  const passwordHash = await hashPassword(password);

  // ── 5. Resolve CUSTOMER role ──────────────────────────────────────────────
  // Upsert is idempotent: creates the role when missing and avoids unique-
  // constraint races when multiple sign-up requests run concurrently.
  const customerRole = await db.role.upsert({
    where: { key: RoleKey.CUSTOMER },
    create: {
      key: RoleKey.CUSTOMER,
      name: "Customer",
      permissions: [],
    },
    update: {},
  });

  // ── 6. Create user + verification token atomically ───────────────────────
  const tokenPair = createEmailVerificationTokenPair();
  let createdUserEmail: string | null;

  try {
    createdUserEmail = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: name || null,
          password: passwordHash,
          roleId: customerRole.id,
        },
        select: {
          id: true,
          email: true,
        },
      });

      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: tokenPair.tokenHash,
          expiresAt: tokenPair.expiresAt,
        },
      });

      return user.email;
    });
  } catch (err) {
    return toActionErrorState(
      err,
      "sign-up:create-user-or-verify-token",
      "Could not create your account. Please try again.",
    );
  }

  if (typeof createdUserEmail === "string") {
    const verificationUrl = buildEmailVerificationUrl(env.appUrl, routes.auth.verifyEmail, tokenPair.token);

    try {
      await sendEmailVerificationEmail({
        email: createdUserEmail,
        verificationUrl,
      });
    } catch (error) {
      logger.error("sign-up: verification email send failed", {
        error,
        emailDomain: createdUserEmail.split("@")[1] ?? "unknown",
      });
    }
  }

  logger.info("sign-up: verification initiated", {
    emailDomain: email.split("@")[1] ?? "unknown",
  });

  return {
    success: true,
    message: SIGN_UP_SUCCESS_MESSAGE,
  };
}
