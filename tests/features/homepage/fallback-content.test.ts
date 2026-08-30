import { describe, expect, it } from "vitest";

import { buildHomepageFallbackSections } from "@/features/homepage/fallback-content";

describe("homepage fallback content", () => {
  it("keeps the remaining baseline storefront sections", () => {
    const sections = buildHomepageFallbackSections();

    expect(sections.map((section) => section.kind)).toEqual([
      "featured-categories",
      "featured-products",
      "featured-deals",
    ]);
  });
});

