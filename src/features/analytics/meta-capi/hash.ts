import { createHash } from "node:crypto";

import type { MetaCapiUserData } from "./types";

/**
 * Meta Conversion API PII hashing.
 *
 * Meta requires identifying `user_data` fields to be SHA-256 hashed before
 * transmission. Normalization matters — Meta compares hashes, so both the
 * browser pixel and the server must hash the SAME normalized value:
 *   - email:   lowercase, trimmed
 *   - phone:   digits only, international format, WITHOUT the leading `+`
 *   - names:   lowercase, trimmed, whitespace collapsed
 *
 * Only ever pass the RAW PII into these helpers; the output hashes are what
 * get sent to Meta. Raw PII must never be logged.
 */

/** Lowercases and trims an email address. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Normalizes a phone number for hashing:
 * strips spaces, dashes, parentheses, dots and a leading `+`, and returns the
 * remaining digits. Left as-entered otherwise so `+92300…` and `0300…` both
 * hash consistently with what the caller entered.
 */
export function normalizePhone(value: string): string {
  return value.replace(/[^\d]/g, "");
}

/** Lowercases, trims, and collapses internal whitespace in a name. */
export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** SHA-256 hex digest of a normalized value. */
export function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashIfPresent(value: string | null | undefined): string | undefined {
  if (!value || value.trim().length === 0) {
    return undefined;
  }
  return hashValue(value);
}

/**
 * Splits a full name into a best-effort first/last pair. Anything after the
 * first token is treated as the last name (supports multi-word surnames).
 */
export function splitFullName(fullName: string): { firstName?: string; lastName?: string } {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return {};
  }

  if (tokens.length === 1) {
    return { ...(tokens[0] ? { firstName: tokens[0] } : {}) };
  }

  const firstName = tokens[0];
  const lastName = tokens.slice(1).join(" ");

  return {
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
  };
}

export type HashUserDataInput = {
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  /** A stable identifier (user id / order number) hashed as `external_id`. */
  externalId?: string | null;
};

/**
 * Builds the `user_data` object with SHA-256 hashed PII. Empty/null values are
 * omitted. `externalId` (e.g. the signed-in user id) is hashed into
 * `external_id` so Meta can link server events to a known visitor.
 */
export function hashUserData(input: HashUserDataInput): Pick<
  MetaCapiUserData,
  "em" | "ph" | "fn" | "ln" | "external_id"
> {
  const userData: Pick<MetaCapiUserData, "em" | "ph" | "fn" | "ln" | "external_id"> = {};

  const hashedEmail = hashIfPresent(input.email ? normalizeEmail(input.email) : undefined);
  if (hashedEmail) {
    userData.em = [hashedEmail];
  }

  const hashedPhone = hashIfPresent(input.phone ? normalizePhone(input.phone) : undefined);
  if (hashedPhone) {
    userData.ph = [hashedPhone];
  }

  if (input.fullName) {
    const { firstName, lastName } = splitFullName(input.fullName);
    const hashedFirstName = hashIfPresent(firstName ? normalizeName(firstName) : undefined);
    const hashedLastName = hashIfPresent(lastName ? normalizeName(lastName) : undefined);

    if (hashedFirstName) {
      userData.fn = [hashedFirstName];
    }
    if (hashedLastName) {
      userData.ln = [hashedLastName];
    }
  }

  const hashedExternalId = hashIfPresent(input.externalId);
  if (hashedExternalId) {
    userData.external_id = [hashedExternalId];
  }

  return userData;
}
