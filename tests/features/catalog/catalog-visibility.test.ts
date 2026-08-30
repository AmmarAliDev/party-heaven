/**
 * Catalog publish visibility tests.
 *
 * Verifies that:
 *   - PUBLISHED categories and products appear on the storefront.
 *   - DRAFT and ARCHIVED categories/products are excluded.
 *   - Only APPROVED reviews appear on product detail pages.
 *   - Empty states are handled gracefully.
 *
 * These are unit tests that mock the catalog-queries module so no real
 * DB connection is needed.
 */
import { describe, expect, it, vi } from "vitest";

import {
  getCatalogCategories,
  getCatalogCategory,
  getCatalogCategoryListing,
  getProductBySlug,
} from "@/features/catalog";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockListPublishedCategories = vi.fn();
const mockGetPublishedCategoryBySlug = vi.fn();
const mockListPublishedProductsByCategory = vi.fn();
const mockGetPublishedProductBySlug = vi.fn();
const mockListAllPublishedProducts = vi.fn();
const mockCountPublishedPartyHeavenProducts = vi.fn().mockResolvedValue(0);
const mockGetPublishedProductContextBySlug = vi.fn().mockResolvedValue(null);

vi.mock("@/server/db/catalog-queries", () => ({
  listPublishedCategories: (...args: unknown[]) => mockListPublishedCategories(...args),
  getPublishedCategoryBySlug: (...args: unknown[]) => mockGetPublishedCategoryBySlug(...args),
  listPublishedProductsByCategory: (...args: unknown[]) => mockListPublishedProductsByCategory(...args),
  listAllPublishedProducts: (...args: unknown[]) => mockListAllPublishedProducts(...args),
  countPublishedPartyHeavenProducts: (...args: unknown[]) => mockCountPublishedPartyHeavenProducts(...args),
  getPublishedProductContextBySlug: (...args: unknown[]) => mockGetPublishedProductContextBySlug(...args),
  listPublishedProductsByIds: vi.fn().mockResolvedValue([]),
  getPublishedProductBySlug: (...args: unknown[]) => mockGetPublishedProductBySlug(...args),
  getRelatedPublishedProducts: vi.fn().mockResolvedValue([]),
  getAllPublishedProductSlugsWithCategories: vi.fn().mockResolvedValue([]),
  searchPublishedProducts: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PUBLISHED_CATEGORY = {
  id: "cat-grocery",
  name: "Grocery",
  slug: "grocery",
  description: "Pantry staples.",
  seoTitle: null,
  seoDescription: null,
  _count: { products: 2 },
};

function makeProduct(overrides: Partial<{ id: string; slug: string }> = {}) {
  const { id = "prod-1", slug = "rice-5kg" } = overrides;
  return {
    id,
    name: `Product ${slug}`,
    slug,
    shortDescription: "A grocery product.",
    description: null,
    masterSku: null,
    metadata: null,
    createdAt: new Date("2025-06-01"),
    updatedAt: new Date("2025-06-01"),
    category: { id: "cat-grocery", name: "Grocery", slug: "grocery" },
    images: [],
    specifications: [],
    variants: [
      {
        id: `var-${id}`,
        title: "Default",
        sku: `SKU-${id}`,
        options: null,
        price: 1000,
        compareAtPrice: null,
        isDefault: true,
        inventory: { quantity: 20 },
      },
    ],
    reviews: [],
  };
}

// ---------------------------------------------------------------------------
// Category visibility
// ---------------------------------------------------------------------------

describe("category publish visibility", () => {
  it("returns published categories to the storefront", async () => {
    mockListPublishedCategories.mockResolvedValue([PUBLISHED_CATEGORY]);
    mockCountPublishedPartyHeavenProducts.mockResolvedValue(0);

    const categories = await getCatalogCategories();

    expect(categories).toHaveLength(2);
    expect(categories[0]?.slug).toBe("party-heaven");
    expect(categories.some((category) => category.slug === "grocery")).toBe(true);
  });

  it("returns only Party Heaven when no physical categories are published", async () => {
    mockListPublishedCategories.mockResolvedValue([]);
    mockCountPublishedPartyHeavenProducts.mockResolvedValue(0);

    const categories = await getCatalogCategories();

    expect(categories).toHaveLength(1);
    expect(categories[0]?.slug).toBe("party-heaven");
  });

  it("returns null for a DRAFT category slug", async () => {
    // DB query returns null for non-PUBLISHED categories
    mockGetPublishedCategoryBySlug.mockResolvedValue(null);

    const category = await getCatalogCategory("draft-category");

    expect(category).toBeNull();
  });

  it("returns null for an ARCHIVED category slug", async () => {
    mockGetPublishedCategoryBySlug.mockResolvedValue(null);

    const category = await getCatalogCategory("archived-category");

    expect(category).toBeNull();
  });

  it("returns null listing for unpublished category slug", async () => {
    mockGetPublishedCategoryBySlug.mockResolvedValue(null);
    mockListPublishedProductsByCategory.mockResolvedValue([]);

    const listing = await getCatalogCategoryListing({ slug: "draft-category" });

    expect(listing).toBeNull();
  });

  it("shows correct published product count on category card", async () => {
    mockListPublishedCategories.mockResolvedValue([
      { ...PUBLISHED_CATEGORY, _count: { products: 7 } },
    ]);
    mockCountPublishedPartyHeavenProducts.mockResolvedValue(0);

    const categories = await getCatalogCategories();
    const category = categories.find((entry) => entry.slug === "grocery");

    expect(category?.productCount).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// Product visibility
// ---------------------------------------------------------------------------

describe("product publish visibility", () => {
  it("returns a published product by slug", async () => {
    mockGetPublishedProductBySlug.mockResolvedValue(makeProduct({ slug: "rice-5kg" }));

    const product = await getProductBySlug("rice-5kg");

    expect(product).not.toBeNull();
    expect(product?.slug).toBe("rice-5kg");
  });

  it("returns null for a DRAFT product slug", async () => {
    // DB query returns null for non-PUBLISHED products
    mockGetPublishedProductBySlug.mockResolvedValue(null);

    const product = await getProductBySlug("draft-product");

    expect(product).toBeNull();
  });

  it("returns null for an ARCHIVED product slug", async () => {
    mockGetPublishedProductBySlug.mockResolvedValue(null);

    const product = await getProductBySlug("archived-product");

    expect(product).toBeNull();
  });

  it("product listing only shows products from the DB query (published products)", async () => {
    mockGetPublishedCategoryBySlug.mockResolvedValue(PUBLISHED_CATEGORY);
    // Simulates DB returning only 2 published products (draft/archived excluded by query)
    mockListPublishedProductsByCategory.mockResolvedValue([
      makeProduct({ id: "p1", slug: "rice-5kg" }),
      makeProduct({ id: "p2", slug: "cooking-oil-1l" }),
    ]);

    const listing = await getCatalogCategoryListing({ slug: "grocery" });

    expect(listing?.totalProductCount).toBe(2);
    expect(listing?.products.every((p) => ["rice-5kg", "cooking-oil-1l"].includes(p.slug))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Review visibility
// ---------------------------------------------------------------------------

describe("review publish visibility", () => {
  it("only includes APPROVED reviews in the product detail", async () => {
    // The DB query already filters to APPROVED; this validates the mapping layer
    const approvedReviews = [
      {
        id: "r1",
        rating: 5,
        title: "Excellent",
        body: "Loved it",
        status: "APPROVED",
        createdAt: new Date(),
        user: { name: "Alice" },
      },
      {
        id: "r2",
        rating: 4,
        title: "Good",
        body: "Pretty good",
        status: "APPROVED",
        createdAt: new Date(),
        user: null,
      },
    ];

    mockGetPublishedProductBySlug.mockResolvedValue({
      ...makeProduct({ slug: "rice-5kg" }),
      reviews: approvedReviews,
    });

    const product = await getProductBySlug("rice-5kg");

    expect(product?.reviews).toHaveLength(2);
    expect(product?.reviews.every((r) => r.status === "APPROVED")).toBe(true);
    expect(product?.reviewSummary.totalCount).toBe(2);
  });

  it("returns empty review state when no approved reviews exist", async () => {
    mockGetPublishedProductBySlug.mockResolvedValue({
      ...makeProduct({ slug: "rice-5kg" }),
      reviews: [],
    });

    const product = await getProductBySlug("rice-5kg");

    expect(product?.reviews).toHaveLength(0);
    expect(product?.reviewSummary.totalCount).toBe(0);
    expect(product?.reviewSummary.averageRating).toBe(0);
  });
});
