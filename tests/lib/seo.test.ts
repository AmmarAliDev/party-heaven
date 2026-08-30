import { describe, it, expect, vi } from "vitest";

import { resolveCanonicalUrl, generateSlug, isValidSlug } from "@/lib/seo/slug";

vi.mock("@/config/env", () => ({
  env: { appUrl: "https://partyheaven.local" },
}));

describe("SEO - Canonical URL", () => {
  it("resolves naked path to full url", () => {
    expect(resolveCanonicalUrl("/test")).toBe("https://partyheaven.local/test");
  });

  it("adds leading slash if missing", () => {
    expect(resolveCanonicalUrl("test/path")).toBe("https://partyheaven.local/test/path");
  });

  it("removes trailing slashes", () => {
    expect(resolveCanonicalUrl("/test/")).toBe("https://partyheaven.local/test");
  });

  it("returns base url for missing or root path", () => {
    expect(resolveCanonicalUrl()).toBe("https://partyheaven.local");
    expect(resolveCanonicalUrl("/")).toBe("https://partyheaven.local");
  });

  it("returns external URL as is if provided", () => {
    expect(resolveCanonicalUrl("https://example.com/test")).toBe("https://example.com/test");
  });
});

describe("SEO - Slugs", () => {
  it("generates clean slug", () => {
    expect(generateSlug("Hello World! This is a Test 123.")).toBe("hello-world-this-is-a-test-123");
  });

  it("handles trailing/leading spaces and hyphens", () => {
    expect(generateSlug(" --Test string--  ")).toBe("test-string");
  });

  it("handles non-english accents via NFD", () => {
    expect(generateSlug("Café ñ niña naïve")).toBe("cafe-n-nina-naive");
  });

  it("validates correct slugs", () => {
    expect(isValidSlug("valid-slug-123")).toBe(true);
    expect(isValidSlug("hello")).toBe(true);
  });

  it("rejects incorrect slugs", () => {
    expect(isValidSlug("Invalid-slug")).toBe(false); // Uppercase
    expect(isValidSlug("invalid--slug")).toBe(false); // Double hyphen
    expect(isValidSlug("-invalid")).toBe(false); // Leading hyphen
    expect(isValidSlug("invalid ")).toBe(false); // Trailing space
    expect(isValidSlug("")).toBe(false);
  });
});
