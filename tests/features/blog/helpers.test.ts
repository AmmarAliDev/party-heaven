import { beforeEach, describe, expect, it, vi } from "vitest";

const mockListBlogPostsByLocale = vi.fn();
const mockGetBlogPostBySlug = vi.fn();
const mockGetAllBlogPostSlugsByLocale = vi.fn();

vi.mock("@/server/db/blog-queries", () => ({
  listBlogPostsByLocale: (...args: unknown[]) => mockListBlogPostsByLocale(...args),
  getBlogPostBySlug: (...args: unknown[]) => mockGetBlogPostBySlug(...args),
  getAllBlogPostSlugsByLocale: (...args: unknown[]) => mockGetAllBlogPostSlugsByLocale(...args),
}));

import {
  buildBlogListingJsonLd,
  buildBlogPostBreadcrumbJsonLd,
  buildBlogPostJsonLd,
  getBlogPostBySlug,
  getBlogPosts,
  getBlogPostSlugs,
  getRelatedBlogPosts,
  toBlogMetadataInput,
} from "@/features/blog";

const blogRows = [
  {
    id: "blog-en-budget-grocery-basket",
    locale: "en",
    title: "Build a Weekly Budget Grocery Basket in Karachi",
    slug: "weekly-budget-grocery-basket-karachi",
    excerpt:
      "A practical seven-day basket planning framework that keeps essentials in stock while reducing waste and impulse spending.",
    content: [{ type: "paragraph", text: "Budget planning works best." }],
    coverImageUrl: "/blog/budget-basket.svg",
    coverImageAlt: "Paper grocery bag with essential pantry items",
    coverImageWidth: 1200,
    coverImageHeight: 630,
    status: "PUBLISHED",
    publishedAt: new Date("2026-04-16T09:30:00.000Z"),
    seoTitle: "Weekly Budget Grocery Basket Guide | Party Heaven Blog",
    seoDescription:
      "Learn a practical weekly grocery basket strategy for Karachi households, including staple planning, spend caps, and waste reduction tips.",
    seoCanonicalUrl: null,
    seoOgTitle: "Weekly Budget Grocery Basket Guide",
    seoOgDescription:
      "Plan essentials first, reduce waste, and keep your grocery budget predictable.",
    seoImageUrl: "/blog/budget-basket.svg",
    seoNoIndex: false,
    seoSchemaNotes: "Add FAQ schema later when admin publishing supports FAQ pairs.",
    createdAt: new Date("2026-04-16T09:30:00.000Z"),
    updatedAt: new Date("2026-04-16T09:30:00.000Z"),
  },
  {
    id: "blog-en-household-restock-routine",
    locale: "en",
    title: "How to Build a Reliable Home Restock Routine",
    slug: "home-restock-routine-checklist",
    excerpt:
      "Set up a low-friction restock rhythm for home-care and personal-care essentials using inventory checkpoints and reorder triggers.",
    content: [{ type: "paragraph", text: "Most urgent shopping happens because reorder points are unknown." }],
    coverImageUrl: "/blog/restock-routine.svg",
    coverImageAlt: "Household shelves with cleaning and personal care items",
    coverImageWidth: 1200,
    coverImageHeight: 630,
    status: "PUBLISHED",
    publishedAt: new Date("2026-04-18T11:00:00.000Z"),
    seoTitle: "Home Restock Routine Checklist | Party Heaven Blog",
    seoDescription:
      "Create a dependable restock checklist for home and personal care essentials with practical thresholds and reorder triggers.",
    seoCanonicalUrl: null,
    seoOgTitle: null,
    seoOgDescription: null,
    seoImageUrl: "/blog/restock-routine.svg",
    seoNoIndex: false,
    seoSchemaNotes: null,
    createdAt: new Date("2026-04-18T11:00:00.000Z"),
    updatedAt: new Date("2026-04-18T11:00:00.000Z"),
  },
  {
    id: "blog-en-ramadan-pantry-planning",
    locale: "en",
    title: "Seasonal Pantry Planning for Ramadan",
    slug: "seasonal-pantry-planning-ramadan",
    excerpt:
      "A draft planning template for balancing staple pantry items and iftar-specific ingredients during high-demand weeks.",
    content: [{ type: "paragraph", text: "This draft post outlines a seasonal pantry approach." }],
    coverImageUrl: "/blog/seasonal-planning.svg",
    coverImageAlt: "Pantry shelves with labeled jars and weekly planning notes",
    coverImageWidth: 1200,
    coverImageHeight: 630,
    status: "DRAFT",
    publishedAt: new Date("2026-04-25T07:15:00.000Z"),
    seoTitle: "Seasonal Pantry Planning for Ramadan",
    seoDescription:
      "Draft guidance for planning pantry essentials and special-occasion ingredients during Ramadan.",
    seoCanonicalUrl: null,
    seoOgTitle: null,
    seoOgDescription: null,
    seoImageUrl: null,
    seoNoIndex: true,
    seoSchemaNotes: "Keep noindex enabled until this draft is reviewed and published.",
    createdAt: new Date("2026-04-25T07:15:00.000Z"),
    updatedAt: new Date("2026-04-25T07:15:00.000Z"),
  },
] as const;

describe("blog helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListBlogPostsByLocale.mockResolvedValue(blogRows);
    mockGetBlogPostBySlug.mockImplementation(async (slug: string) => blogRows.find((row) => row.slug === slug) ?? null);
    mockGetAllBlogPostSlugsByLocale.mockResolvedValue(
      blogRows
        .filter((row) => row.status === "PUBLISHED")
        .map((row) => ({ slug: row.slug })),
    );
  });

  it("returns published English posts sorted by publish date descending", async () => {
    const posts = await getBlogPosts({ locale: "en" });

    expect(posts.length).toBeGreaterThan(0);
    expect(posts[0]?.slug).toBe("home-restock-routine-checklist");
    expect(posts.every((post) => post.status === "published")).toBe(true);
  });

  it("returns static params slugs for published posts", async () => {
    const slugs = await getBlogPostSlugs("en");

    expect(slugs).toContain("weekly-budget-grocery-basket-karachi");
    expect(slugs).toContain("home-restock-routine-checklist");
    expect(slugs).not.toContain("seasonal-pantry-planning-ramadan");
  });

  it("returns null for unpublished post by default and allows includeDrafts", async () => {
    const hiddenDraft = await getBlogPostBySlug("seasonal-pantry-planning-ramadan", { locale: "en" });
    const visibleDraft = await getBlogPostBySlug("seasonal-pantry-planning-ramadan", {
      locale: "en",
      includeDrafts: true,
    });

    expect(hiddenDraft).toBeNull();
    expect(visibleDraft?.status).toBe("draft");
  });

  it("builds metadata input with SEO field overrides", async () => {
    const post = await getBlogPostBySlug("weekly-budget-grocery-basket-karachi", {
      locale: "en",
      includeDrafts: true,
    });

    expect(post).toBeTruthy();

    const metadataInput = toBlogMetadataInput(post!);
    expect(metadataInput.title).toBe("Weekly Budget Grocery Basket Guide | Party Heaven Blog");
    expect(metadataInput.path).toBe("/blog/weekly-budget-grocery-basket-karachi");
    expect(metadataInput.openGraphImage).toBe("/blog/budget-basket.svg");
    expect(metadataInput.noIndex).toBe(false);
  });

  it("returns related posts excluding the current article", async () => {
    const post = await getBlogPostBySlug("weekly-budget-grocery-basket-karachi", {
      locale: "en",
      includeDrafts: true,
    });

    expect(post).toBeTruthy();

    const related = await getRelatedBlogPosts(post!, 2);
    expect(related.length).toBeLessThanOrEqual(2);
    expect(related.some((item) => item.slug === post!.slug)).toBe(false);
  });

  it("builds listing and post structured data payloads", async () => {
    const posts = await getBlogPosts({ locale: "en" });
    const listingJsonLd = buildBlogListingJsonLd(posts);
    const post = await getBlogPostBySlug("home-restock-routine-checklist", {
      locale: "en",
      includeDrafts: true,
    });

    expect(post).toBeTruthy();

    const postJsonLd = buildBlogPostJsonLd(post!);
    const breadcrumbJsonLd = buildBlogPostBreadcrumbJsonLd(post!);

    expect(listingJsonLd["@type"]).toBe("CollectionPage");
    expect(postJsonLd["@type"]).toBe("BlogPosting");
    expect(postJsonLd.mainEntityOfPage["@id"]).toMatch(/\/blog\/home-restock-routine-checklist$/);
    expect(breadcrumbJsonLd["@type"]).toBe("BreadcrumbList");
  });
});
