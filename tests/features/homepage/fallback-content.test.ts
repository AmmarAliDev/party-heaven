import { describe, expect, it } from "vitest";

import { buildHomepageFallbackSections } from "@/features/homepage/fallback-content";

describe("homepage fallback content", () => {
  it("does not include a hero banner section", () => {
    const sections = buildHomepageFallbackSections();

    expect(sections.some((section) => section.kind === "hero-banner")).toBe(false);
  });

  it("does not include a blog highlights section", () => {
    const sections = buildHomepageFallbackSections();

    expect(sections.some((section) => section.kind === "blog-highlights")).toBe(false);
  });

  it("keeps the remaining baseline storefront sections", () => {
    const sections = buildHomepageFallbackSections();

    expect(sections.map((section) => section.kind)).toEqual([
      "featured-categories",
      "featured-products",
      "featured-deals",
    ]);
  });
});

