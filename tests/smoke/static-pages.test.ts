/**
 * Smoke tests for static informational pages (/about, /privacy, /terms, /shipping-policy).
 *
 * These tests validate:
 * - Page metadata is defined and contains real (non-placeholder) content.
 * - Each page exports a default component function.
 * - Metadata titles and descriptions are meaningful and reference the correct canonical paths.
 *
 * NOTE: Coverage for src/app/** is intentionally excluded from the coverage report
 * (Next.js app-dir entry points are not unit-testable in the traditional sense).
 * These tests are smoke-level sanity checks only.
 */

import { describe, expect, it } from "vitest";

// Import metadata and default exports directly from the page modules.
// The metadata objects are plain JS objects so they are safe to import in a Node test environment.
import AboutPage, { metadata as aboutMeta } from "@/app/(storefront)/about/page";
import PrivacyPage, { metadata as privacyMeta } from "@/app/(storefront)/privacy/page";
import ShippingPolicyPage, {
  metadata as shippingMeta,
} from "@/app/(storefront)/shipping-policy/page";
import TermsPage, { metadata as termsMeta } from "@/app/(storefront)/terms/page";

describe("static informational pages — metadata", () => {
  it("/about has a meaningful title and description", () => {
    expect(typeof aboutMeta.title).toBe("string");
    expect(String(aboutMeta.title).toLowerCase()).toContain("about");
    expect(typeof aboutMeta.description).toBe("string");
    expect(String(aboutMeta.description).length).toBeGreaterThan(20);
    // Should no longer reference 'placeholder'
    expect(String(aboutMeta.description).toLowerCase()).not.toContain("placeholder");
  });

  it("/privacy has a meaningful title and description", () => {
    expect(typeof privacyMeta.title).toBe("string");
    expect(String(privacyMeta.title).toLowerCase()).toContain("privacy");
    expect(typeof privacyMeta.description).toBe("string");
    expect(String(privacyMeta.description).length).toBeGreaterThan(20);
    expect(String(privacyMeta.description).toLowerCase()).not.toContain("placeholder");
  });

  it("/terms has a meaningful title and description", () => {
    expect(typeof termsMeta.title).toBe("string");
    expect(String(termsMeta.title).toLowerCase()).toContain("terms");
    expect(typeof termsMeta.description).toBe("string");
    expect(String(termsMeta.description).length).toBeGreaterThan(20);
    expect(String(termsMeta.description).toLowerCase()).not.toContain("placeholder");
  });

  it("/shipping-policy has a meaningful title and description", () => {
    expect(typeof shippingMeta.title).toBe("string");
    expect(String(shippingMeta.title).toLowerCase()).toContain("shipping");
    expect(typeof shippingMeta.description).toBe("string");
    expect(String(shippingMeta.description).length).toBeGreaterThan(20);
    expect(String(shippingMeta.description).toLowerCase()).not.toContain("placeholder");
  });

  it("all four pages export a default component function", () => {
    expect(typeof AboutPage).toBe("function");
    expect(typeof PrivacyPage).toBe("function");
    expect(typeof TermsPage).toBe("function");
    expect(typeof ShippingPolicyPage).toBe("function");
  });

  it("/about metadata has a canonical URL", () => {
    expect(aboutMeta.alternates?.canonical).toBeDefined();
    const canonical = String(aboutMeta.alternates?.canonical ?? "");
    expect(canonical).toContain("/about");
  });

  it("/shipping-policy metadata has a canonical URL", () => {
    expect(shippingMeta.alternates?.canonical).toBeDefined();
    const canonical = String(shippingMeta.alternates?.canonical ?? "");
    expect(canonical).toContain("/shipping-policy");
  });
});
