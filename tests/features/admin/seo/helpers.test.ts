import { describe, expect, it } from "vitest";

import {
  adminSeoFieldsSchema,
  adminSlugSchema,
  buildAdminSeoPreview,
  createSlugCandidate,
} from "@/features/admin/seo/schema";

describe("admin SEO helpers", () => {
  it("builds a stable slug candidate from plain-language titles", () => {
    expect(createSlugCandidate("  Daily Face Wash!  " )).toBe("daily-face-wash");
    expect(createSlugCandidate("50% OFF Bundle")).toBe("50-off-bundle");
  });

  it("accepts practical SEO field input for admin workflows", () => {
    const parsed = adminSeoFieldsSchema.safeParse({
      seoTitle: "Daily Face Wash | Party Heaven",
      seoDescription: "A gentle cleanser for everyday routines and quick shopping decisions.",
      seoCanonicalUrl: "/categories/personal-care/daily-face-wash",
      seoOgTitle: "Daily Face Wash deal",
      seoOgDescription: "See price, skin type fit, and delivery details.",
      seoImageUrl: "https://example.com/seo/face-wash.jpg",
      seoNoIndex: false,
      seoSchemaNotes: "Use Product schema with brand, SKU, and availability.",
    });

    expect(parsed.success).toBe(true);
  });

  it("returns clear validation messages for invalid SEO input", () => {
    const parsed = adminSeoFieldsSchema.safeParse({
      seoCanonicalUrl: "not a valid canonical",
      seoImageUrl: "invalid-image-url",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => issue.message).join(" ");
      expect(issues).toMatch(/canonical/i);
      expect(issues).toMatch(/valid/i);
    }

    const slugCheck = adminSlugSchema.safeParse("checkout");
    expect(slugCheck.success).toBe(false);
    if (!slugCheck.success) {
      expect(slugCheck.error.issues[0]?.message).toMatch(/reserved|specific/i);
    }
  });

  it("formats an admin-facing preview with fallback values", () => {
    const preview = buildAdminSeoPreview({
      title: "Daily Face Wash",
      slug: "daily-face-wash",
      description: "Gentle cleanser for everyday use.",
      seoTitle: "",
      seoDescription: "",
      basePath: "/categories/personal-care",
    });

    expect(preview.title).toBe("Daily Face Wash");
    expect(preview.url).toContain("/categories/personal-care/daily-face-wash");
    expect(preview.description).toContain("Gentle cleanser");
  });
});
