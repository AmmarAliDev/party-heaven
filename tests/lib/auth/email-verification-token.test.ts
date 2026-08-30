import { describe, expect, it } from "vitest";

import {
  buildEmailVerificationUrl,
  createEmailVerificationTokenPair,
  EMAIL_VERIFICATION_TOKEN_TTL_MS,
  hashEmailVerificationToken,
  isEmailVerificationTokenExpired,
} from "@/lib/auth/email-verification-token";

describe("email verification token utilities", () => {
  it("creates a token/hash pair with a 24-hour expiry", () => {
    const now = new Date("2026-04-26T10:00:00.000Z");
    const pair = createEmailVerificationTokenPair(now);

    expect(pair.token.length).toBeGreaterThan(30);
    expect(pair.tokenHash).toBe(hashEmailVerificationToken(pair.token));
    expect(pair.expiresAt.getTime()).toBe(now.getTime() + EMAIL_VERIFICATION_TOKEN_TTL_MS);
  });

  it("hashes tokens deterministically", () => {
    const token = "test-verify-token";

    expect(hashEmailVerificationToken(token)).toBe(hashEmailVerificationToken(token));
    expect(hashEmailVerificationToken(token)).not.toBe(hashEmailVerificationToken(`${token}-other`));
  });

  it("detects token expiry precisely", () => {
    const now = new Date("2026-04-26T10:00:00.000Z");
    const expiresAt = new Date("2026-04-27T10:00:00.000Z");

    expect(isEmailVerificationTokenExpired(expiresAt, now)).toBe(false);
    expect(isEmailVerificationTokenExpired(expiresAt, new Date("2026-04-27T10:00:00.000Z"))).toBe(true);
  });

  it("builds verify-email URLs with the token query param", () => {
    const url = buildEmailVerificationUrl("https://example.com", "/auth/verify-email", "abc123");

    expect(url).toBe("https://example.com/auth/verify-email?token=abc123");
  });
});
