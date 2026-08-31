import type { MetadataRoute } from "next";
import { describe, expect, it, vi } from "vitest";

import { pushUniqueSitemapEntry, resolveSitemapUrl } from "@/lib/seo/sitemap";

vi.mock("@/config/env", () => ({
  env: { appUrl: "https://partyheaven.local" },
}));

describe("SEO - sitemap URL resolution", () => {
  it("resolves a default path to an absolute URL", () => {
    expect(resolveSitemapUrl("/categories/home-care")).toBe("https://partyheaven.local/categories/home-care");
  });

  it("honors a canonical override that differs from the default path", () => {
    expect(resolveSitemapUrl("/categories/home-care", "/c/cleaning")).toBe(
      "https://partyheaven.local/c/cleaning",
    );
  });

  it("honors an absolute canonical override", () => {
    expect(resolveSitemapUrl("/categories/home-care", "https://example.com/c/cleaning")).toBe(
      "https://example.com/c/cleaning",
    );
  });

  it("dedupes an override that resolves to the same URL as the default", () => {
    expect(resolveSitemapUrl("/categories/home-care", "/categories/home-care")).toBe(
      "https://partyheaven.local/categories/home-care",
    );
    // Trailing-slash variant also collapses to the default.
    expect(resolveSitemapUrl("/categories/home-care", "/categories/home-care/")).toBe(
      "https://partyheaven.local/categories/home-care",
    );
  });

  it("ignores empty canonical overrides", () => {
    expect(resolveSitemapUrl("/categories/home-care", "")).toBe(
      "https://partyheaven.local/categories/home-care",
    );
    expect(resolveSitemapUrl("/categories/home-care", null)).toBe(
      "https://partyheaven.local/categories/home-care",
    );
    expect(resolveSitemapUrl("/categories/home-care", "   ")).toBe(
      "https://partyheaven.local/categories/home-care",
    );
  });
});

describe("SEO - unique sitemap entry push", () => {
  it("appends an entry and records the URL as seen", () => {
    const entries: MetadataRoute.Sitemap = [];
    const seen = new Set<string>();

    pushUniqueSitemapEntry(entries, seen, "https://partyheaven.local/about", new Date("2026-01-01"));

    expect(entries).toHaveLength(1);
    expect(entries[0]?.url).toBe("https://partyheaven.local/about");
    expect(seen.has("https://partyheaven.local/about")).toBe(true);
  });

  it("skips duplicate URLs (including trailing-slash variants)", () => {
    const entries: MetadataRoute.Sitemap = [];
    const seen = new Set<string>();

    pushUniqueSitemapEntry(entries, seen, "https://partyheaven.local/about", new Date("2026-01-01"));
    pushUniqueSitemapEntry(entries, seen, "https://partyheaven.local/about/", new Date("2026-01-02"));

    expect(entries).toHaveLength(1);
    expect(entries[0]?.url).toBe("https://partyheaven.local/about");
  });

  it("applies change frequency and priority when provided", () => {
    const entries: MetadataRoute.Sitemap = [];
    const seen = new Set<string>();

    pushUniqueSitemapEntry(entries, seen, "https://partyheaven.local/", new Date("2026-01-01"), {
      changeFrequency: "daily",
      priority: 1.0,
    });

    expect(entries[0]).toMatchObject({
      url: "https://partyheaven.local",
      changeFrequency: "daily",
      priority: 1.0,
    });
  });
});
