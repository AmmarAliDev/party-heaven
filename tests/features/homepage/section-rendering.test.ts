import { describe, expect, it } from "vitest";

import type { HomepageSection } from "@/features/homepage";
import {
  hasRegisteredSectionComponent,
  resolveHomepageSections,
  SECTION_RENDER_ORDER,
} from "@/features/homepage";

describe("homepage section rendering", () => {
  it("falls back to default sections when CMS content is missing", () => {
    const result = resolveHomepageSections(null);

    expect(result.source).toBe("fallback");
    expect(result.sections.length).toBeGreaterThan(0);
    expect(result.sections.map((section) => section.kind)).toEqual([
      "party-heaven",
      "featured-categories",
      "featured-products",
    ]);
    expect(result.sections.some((section) => section.kind === "hero-banner")).toBe(false);
    expect(result.sections.some((section) => section.kind === "blog-highlights")).toBe(false);
  });

  it("renders CMS sections in deterministic order, merges missing fallback kinds, and respects disabled configured kinds", () => {
    const cmsSections: HomepageSection[] = [
      {
        id: "cms-banner",
        kind: "announcement-bar",
        message: "Weekend savings",
        href: "/categories",
        displayOrder: 1,
      },
      {
        id: "cms-categories",
        kind: "featured-categories",
        title: "CMS categories",
        categories: [],
        displayOrder: 20,
      },
      {
        id: "cms-products-disabled",
        kind: "featured-products",
        title: "Disabled section",
        products: [],
        enabled: false,
        displayOrder: 20,
      },
      {
        id: "cms-deal",
        kind: "deal-spotlight",
        title: "Deal",
        description: "Limited time",
        dealLabel: "Deal",
        price: 1000,
        compareAt: 1200,
        ctaLabel: "View",
        ctaHref: "/preview",
        displayOrder: 20,
      },
    ];

    const result = resolveHomepageSections(cmsSections);

    expect(result.source).toBe("cms");
    expect(result.sections.map((section) => section.id)).toEqual([
      "cms-banner",
      "fallback-party-heaven",
      "cms-categories",
      "cms-deal",
    ]);
    expect(result.sections.some((section) => section.id === "fallback-featured-products")).toBe(false);
  });

  it("keeps homepage composition stable when admin adds a single primary section", () => {
    const cmsSections: HomepageSection[] = [
      {
        id: "cms-party-heaven",
        kind: "party-heaven",
        title: "Party Heaven picks",
        products: [],
        ctaLabel: "View all",
        ctaHref: "/categories/party-heaven",
        placeholderMessage: "No products right now.",
        displayOrder: 25,
      },
    ];

    const result = resolveHomepageSections(cmsSections);

    expect(result.source).toBe("cms");
    expect(result.sections.some((section) => section.id === "cms-party-heaven" && section.kind === "party-heaven")).toBe(true);
    expect(result.sections.some((section) => section.kind === "featured-categories")).toBe(true);
    expect(result.sections.some((section) => section.kind === "featured-products")).toBe(true);
    expect(result.sections.some((section) => section.kind === "hero-banner")).toBe(false);
    expect(result.sections.some((section) => section.kind === "blog-highlights")).toBe(false);
    expect(result.sections.filter((section) => section.kind === "party-heaven")).toHaveLength(1);
  });

  it("composes multiple section types without duplicating configured kinds", () => {
    const cmsSections: HomepageSection[] = [
      {
        id: "cms-banner",
        kind: "announcement-bar",
        message: "Weekend savings",
        href: "/categories",
        displayOrder: 1,
      },
      {
        id: "cms-categories",
        kind: "featured-categories",
        title: "CMS categories",
        categories: [],
        displayOrder: 20,
      },
      {
        id: "cms-products",
        kind: "featured-products",
        title: "CMS products",
        products: [],
        displayOrder: 30,
      },
    ];

    const result = resolveHomepageSections(cmsSections);

    expect(result.source).toBe("cms");
    expect(result.sections.map((section) => section.id)).toEqual([
      "cms-banner",
      "fallback-party-heaven",
      "cms-categories",
      "cms-products",
    ]);
    expect(result.sections.some((section) => section.kind === "hero-banner")).toBe(false);
  });

  it("keeps fallback primary sections when CMS provides only announcement bars", () => {
    const cmsSections: HomepageSection[] = [
      {
        id: "cms-banner",
        kind: "announcement-bar",
        message: "Weekend savings",
        href: "/categories",
        displayOrder: 1,
      },
    ];

    const result = resolveHomepageSections(cmsSections);

    expect(result.source).toBe("cms");
    expect(result.sections.some((section) => section.id === "cms-banner")).toBe(true);
    expect(result.sections.some((section) => section.kind === "featured-products")).toBe(true);
    expect(result.sections.some((section) => section.kind === "hero-banner")).toBe(false);
    expect(result.sections.some((section) => section.kind === "blog-highlights")).toBe(false);
  });

  it("keeps fallback primary sections when CMS provides only campaign overlays", () => {
    const cmsSections: HomepageSection[] = [
      {
        id: "campaign-abc123",
        kind: "deal-spotlight",
        title: "Campaign deal",
        description: "Campaign-managed spotlight",
        dealLabel: "Active campaign",
        price: 899,
        compareAt: 1199,
        ctaLabel: "Shop campaign",
        ctaHref: "/categories",
        displayOrder: 40,
      },
    ];

    const result = resolveHomepageSections(cmsSections);

    expect(result.source).toBe("cms");
    expect(result.sections.some((section) => section.id === "campaign-abc123")).toBe(true);
    expect(result.sections.some((section) => section.kind === "featured-products")).toBe(true);
    expect(result.sections.some((section) => section.kind === "hero-banner")).toBe(false);
    expect(result.sections.some((section) => section.id === "fallback-deal-spotlight")).toBe(false);
  });

  it("keeps section architecture modular with registry coverage for each section kind", () => {
    expect(SECTION_RENDER_ORDER.every((kind) => hasRegisteredSectionComponent(kind))).toBe(true);
  });
});
