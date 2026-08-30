import { describe, expect, it } from "vitest";

import {
  buildPasswordResetUrl,
  createPasswordResetTokenPair,
  hashPasswordResetToken,
  isPasswordResetTokenExpired,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from "@/lib/auth/password-reset-token";

describe("password reset token utilities", () => {
  it("creates a token/hash pair with a one-hour expiry", () => {
    const now = new Date("2026-04-26T10:00:00.000Z");
    const pair = createPasswordResetTokenPair(now);

    expect(pair.token.length).toBeGreaterThan(30);
    expect(pair.tokenHash).toBe(hashPasswordResetToken(pair.token));
    expect(pair.expiresAt.getTime()).toBe(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MS);
  });

  it("hashes tokens deterministically", () => {
    const token = "test-reset-token";

    expect(hashPasswordResetToken(token)).toBe(hashPasswordResetToken(token));
    expect(hashPasswordResetToken(token)).not.toBe(hashPasswordResetToken(`${token}-other`));
  });

  it("detects token expiry precisely", () => {
    const now = new Date("2026-04-26T10:00:00.000Z");
    const expiresAt = new Date("2026-04-26T11:00:00.000Z");

    expect(isPasswordResetTokenExpired(expiresAt, now)).toBe(false);
    expect(isPasswordResetTokenExpired(expiresAt, new Date("2026-04-26T11:00:00.000Z"))).toBe(true);
  });

  it("builds reset URLs with the token query param", () => {
    const url = buildPasswordResetUrl("https://example.com", "/auth/reset-password", "abc123");

    expect(url).toBe("https://example.com/auth/reset-password?token=abc123");
  });
});
