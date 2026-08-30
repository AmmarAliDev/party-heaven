/**
 * Tests for the category SEO content generator.
 *
 * All tests are pure unit tests — no DB or network calls.
 */
import { describe, expect, it } from "vitest";

import { generateCategorySeoContent } from "@/features/catalog/seo/category-seo-content";
import type { CatalogCategory } from "@/features/catalog/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCategory(overrides: Partial<CatalogCategory> = {}): CatalogCategory {
  return {
    id: "category-home-care",
    name: "Home Care",
    slug: "home-care",
    description: "Cleaning, laundry, and restock-friendly home essentials.",
    productCount: 12,
    href: "/categories/home-care",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Title & description
// ---------------------------------------------------------------------------

describe("generateCategorySeoContent — title and description", () => {
  it("returns the known template title for home-care", () => {
    const content = generateCategorySeoContent(makeCategory({ slug: "home-care" }));
    expect(content.title).toBe(
      "Home Care Products in Pakistan — Cleaning & Laundry Essentials",
    );
  });

  it("returns the known template title for grocery", () => {
    const content = generateCategorySeoContent(
      makeCategory({ slug: "grocery", name: "Grocery" }),
    );
    expect(content.title).toContain("Grocery");
  });

  it("returns the known template title for personal-care", () => {
    const content = generateCategorySeoContent(
      makeCategory({ slug: "personal-care", name: "Personal Care" }),
    );
    expect(content.title).toContain("Personal Care");
  });

  it("generates a generic title for an unknown category", () => {
    const content = generateCategorySeoContent(
      makeCategory({ slug: "electronics", name: "Electronics" }),
    );
    expect(content.title).toContain("Electronics");
    expect(content.title).toContain("Pakistan");
  });

  it("description is at most 160 characters", () => {
    const content = generateCategorySeoContent(makeCategory());
    expect(content.description.length).toBeLessThanOrEqual(160);
  });

  it("generic description is at most 160 characters", () => {
    const content = generateCategorySeoContent(
      makeCategory({
        slug: "unknown-very-long-category",
        name: "Unknown Very Long Category",
        description: "A quite descriptive description that keeps going and going.",
      }),
    );
    expect(content.description.length).toBeLessThanOrEqual(160);
  });
});

// ---------------------------------------------------------------------------
// Intro copy
// ---------------------------------------------------------------------------

describe("generateCategorySeoContent — introCopy", () => {
  it("returns non-empty intro copy", () => {
    const content = generateCategorySeoContent(makeCategory());
    expect(content.introCopy.length).toBeGreaterThan(50);
  });

  it("generic intro copy includes the category name", () => {
    const content = generateCategorySeoContent(
      makeCategory({ slug: "garden", name: "Garden" }),
    );
    expect(content.introCopy).toContain("Garden");
  });
});

// ---------------------------------------------------------------------------
// FAQs
// ---------------------------------------------------------------------------

describe("generateCategorySeoContent — faqs", () => {
  it("returns at least 3 FAQ items for known categories", () => {
    for (const slug of ["home-care", "grocery", "personal-care"]) {
      const content = generateCategorySeoContent(makeCategory({ slug }));
      expect(content.faqs.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("returns at least 3 FAQ items for generic categories", () => {
    const content = generateCategorySeoContent(
      makeCategory({ slug: "tools", name: "Tools" }),
    );
    expect(content.faqs.length).toBeGreaterThanOrEqual(3);
  });

  it("every FAQ item has a non-empty question and answer", () => {
    const content = generateCategorySeoContent(makeCategory());
    for (const faq of content.faqs) {
      expect(faq.question.length).toBeGreaterThan(0);
      expect(faq.answer.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Internal links
// ---------------------------------------------------------------------------

describe("generateCategorySeoContent — internalLinks", () => {
  it("always includes an 'All Categories' link", () => {
    const content = generateCategorySeoContent(makeCategory());
    const allCats = content.internalLinks.find((l) => l.label === "All Categories");
    expect(allCats).toBeDefined();
    expect(allCats?.href).toBe("/categories");
  });

  it("always includes a blog link", () => {
    const content = generateCategorySeoContent(makeCategory());
    const blog = content.internalLinks.find((l) => l.href === "/blog");
    expect(blog).toBeDefined();
  });

  it("excludes the current category from internal links", () => {
    const content = generateCategorySeoContent(makeCategory({ slug: "home-care" }), {
      allCategorySlugs: ["home-care", "grocery", "personal-care"],
    });
    const self = content.internalLinks.find((l) => l.href === "/categories/home-care");
    expect(self).toBeUndefined();
  });

  it("includes sibling categories passed via options", () => {
    const content = generateCategorySeoContent(makeCategory({ slug: "home-care" }), {
      allCategorySlugs: ["home-care", "grocery", "personal-care"],
    });
    const grocery = content.internalLinks.find((l) => l.href === "/categories/grocery");
    const personal = content.internalLinks.find(
      (l) => l.href === "/categories/personal-care",
    );
    expect(grocery).toBeDefined();
    expect(personal).toBeDefined();
  });

  it("every internal link has a non-empty label and href starting with /", () => {
    const content = generateCategorySeoContent(makeCategory());
    for (const link of content.internalLinks) {
      expect(link.label.length).toBeGreaterThan(0);
      expect(link.href.startsWith("/")).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Blog topics
// ---------------------------------------------------------------------------

describe("generateCategorySeoContent — blogTopics", () => {
  it("returns at least 3 blog topics for known categories", () => {
    for (const slug of ["home-care", "grocery", "personal-care"]) {
      const content = generateCategorySeoContent(makeCategory({ slug }));
      expect(content.blogTopics.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("returns at least 1 blog topic for generic categories", () => {
    const content = generateCategorySeoContent(
      makeCategory({ slug: "stationery", name: "Stationery" }),
    );
    expect(content.blogTopics.length).toBeGreaterThanOrEqual(1);
  });

  it("every blog topic is a non-empty string", () => {
    const content = generateCategorySeoContent(makeCategory());
    for (const topic of content.blogTopics) {
      expect(typeof topic).toBe("string");
      expect(topic.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Schema notes
// ---------------------------------------------------------------------------

describe("generateCategorySeoContent — schemaNotes", () => {
  it("returns a non-empty schema notes string", () => {
    const content = generateCategorySeoContent(makeCategory());
    expect(content.schemaNotes.length).toBeGreaterThan(0);
  });

  it("schema notes mention BreadcrumbList", () => {
    const content = generateCategorySeoContent(makeCategory());
    expect(content.schemaNotes.toLowerCase()).toContain("breadcrumb");
  });
});

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

describe("generateCategorySeoContent — options", () => {
  it("uses the three seed category slugs when allCategorySlugs is omitted", () => {
    const content = generateCategorySeoContent(makeCategory({ slug: "grocery" }));
    // home-care and personal-care should appear as sibling links
    const homeLink = content.internalLinks.find((l) => l.href === "/categories/home-care");
    expect(homeLink).toBeDefined();
  });

  it("respects a custom allCategorySlugs list", () => {
    const content = generateCategorySeoContent(makeCategory({ slug: "books" }), {
      allCategorySlugs: ["books", "toys"],
    });
    // toys should appear, home-care should not
    const toys = content.internalLinks.find((l) => l.href === "/categories/toys");
    const homeCare = content.internalLinks.find(
      (l) => l.href === "/categories/home-care",
    );
    expect(toys).toBeDefined();
    expect(homeCare).toBeUndefined();
  });
});
