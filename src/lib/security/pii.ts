/**
 * PII protection utilities for logging and display.
 *
 * NEVER log raw email addresses or other PII in production logs.
 * Always pass email values through these helpers before logging.
 */

/**
 * Mask an email address for safe logging.
 * Converts "user@example.com" → "u***@example.com".
 * Returns "***@***" for malformed values.
 */
export function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) {
    return "***@***";
  }

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  if (!domain) {
    return "***@***";
  }

  const masked = local[0] + "***";
  return `${masked}@${domain}`;
}

/**
 * Strip control characters from a string to prevent log injection attacks.
 * Removes all characters in the C0 and C1 control ranges.
 */
export function stripControlChars(value: string): string {
   
  return value.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
}
