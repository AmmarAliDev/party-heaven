/**
 * Catalog listing service tests.
 *
 * Mocks the catalog-queries module so no real DB connection is needed.
 * Verifies filter/sort/pagination logic inside the service layer.
 */
import { describe, expect, it, vi } from "vitest";

import { getCatalogCategoryListing } from "@/features/catalog";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCategoryRecord(overrides?: Partial<{ id: string; name: string; slug: string }>) {
  return {
    id: overrides?.id ?? "cat-home-care",
    name: overrides?.name ?? "Home Care",
    slug: overrides?.slug ?? "home-care",
    description: "Cleaning and home essentials.",
    seoTitle: null,
    seoDescription: null,
    _count: { products: 3 },
  };
}

function makeProductRecord(
  overrides: Partial<{
    id: string;
    slug: string;
    price: number;
    compareAtPrice: number | null;
    inventoryQty: number;
    rating: number;
    reviewCount: number;
    images: Array<{
      id: string;
      url: string;
      alt: string | null;
      position: number;
      productVariantId: string | null;
    }>;
    variants: Array<{
      id: string;
      title: string | null;
      sku: string;
      options: Record<string, string> | null;
      price: number;
      compareAtPrice: number | null;
      isDefault: boolean;
      inventory: { quantity: number };
    }>;
  }> = {},
) {
  const {
    id = "prod-1",
    slug = "test-product",
    price = 500,
    compareAtPrice = null,
    inventoryQty = 10,
    rating = 4,
    reviewCount = 5,
    images = [],
    variants,
  } = overrides;

  return {
    id,
    name: `Product ${slug}`,
    slug,
    shortDescription: "A test product.",
    description: "Long description.",
    masterSku: null,
    metadata: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    category: { id: "cat-home-care", name: "Home Care", slug: "home-care" },
    images,
    specifications: [
      { id: "spec-1", key: "Type", value: "Liquid" },
      { id: "spec-2", key: "Size", value: "500ml" },
    ],
    variants:
      variants ?? [
        {
          id: `var-${id}`,
          title: "Default",
          sku: `SKU-${id}`,
          options: null,
          price,
          compareAtPrice,
          isDefault: true,
          inventory: { quantity: inventoryQty },
        },
      ],
    reviews: Array.from({ length: reviewCount }, () => ({ rating })),
  };
}

// ---------------------------------------------------------------------------
// Mock catalog-queries
// ---------------------------------------------------------------------------

const mockListPublishedCategories = vi.fn();
const mockGetPublishedCategoryBySlug = vi.fn();
const mockListPublishedProductsByCategory = vi.fn();
const mockListAllPublishedProducts = vi.fn();
const mockCountPublishedOneDollarProducts = vi.fn().mockResolvedValue(0);
const mockGetPublishedProductContextBySlug = vi.fn().mockResolvedValue(null);

vi.mock("@/server/db/catalog-queries", () => ({
  listPublishedCategories: (...args: unknown[]) => mockListPublishedCategories(...args),
  getPublishedCategoryBySlug: (...args: unknown[]) => mockGetPublishedCategoryBySlug(...args),
  listPublishedProductsByCategory: (...args: unknown[]) => mockListPublishedProductsByCategory(...args),
  listAllPublishedProducts: (...args: unknown[]) => mockListAllPublishedProducts(...args),
  countPublishedOneDollarProducts: (...args: unknown[]) => mockCountPublishedOneDollarProducts(...args),
  getPublishedProductContextBySlug: (...args: unknown[]) => mockGetPublishedProductContextBySlug(...args),
  listPublishedProductsByIds: vi.fn().mockResolvedValue([]),
  getPublishedProductBySlug: vi.fn().mockResolvedValue(null),
  getRelatedPublishedProducts: vi.fn().mockResolvedValue([]),
  getAllPublishedProductSlugsWithCategories: vi.fn().mockResolvedValue([]),
  searchPublishedProducts: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("catalog listing service", () => {
  it("returns category listing data for a valid slug", async () => {
    mockGetPublishedCategoryBySlug.mockResolvedValue(makeCategoryRecord());
    mockListPublishedProductsByCategory.mockResolvedValue([
      makeProductRecord({ id: "p1", slug: "product-a" }),
      makeProductRecord({ id: "p2", slug: "product-b" }),
      makeProductRecord({ id: "p3", slug: "product-c" }),
    ]);

    const listing = await getCatalogCategoryListing({ slug: "home-care" });

    expect(listing).not.toBeNull();
    expect(listing?.category.slug).toBe("home-care");
    expect(listing?.totalProductCount).toBe(3);
    expect(listing?.products).toHaveLength(3);
  });

  it("defaults to an initial page size of 6 products", async () => {
    mockGetPublishedCategoryBySlug.mockResolvedValue(makeCategoryRecord());
    mockListPublishedProductsByCategory.mockResolvedValue(
      Array.from({ length: 9 }, (_, index) =>
        makeProductRecord({
          id: `p${index + 1}`,
          slug: `product-${index + 1}`,
          price: 200 + index,
        }),
      ),
    );

    const listing = await getCatalogCategoryListing({ slug: "home-care" });

    expect(listing).not.toBeNull();
    expect(listing?.products).toHaveLength(6);
    expect(listing?.pagination.currentPage).toBe(1);
    expect(listing?.pagination.pageSize).toBe(6);
    expect(listing?.pagination.hasNextPage).toBe(true);
  });

  it("returns null when the category is not published", async () => {
    mockGetPublishedCategoryBySlug.mockResolvedValue(null);
    mockListPublishedProductsByCategory.mockResolvedValue([]);

    const listing = await getCatalogCategoryListing({ slug: "draft-category" });

    expect(listing).toBeNull();
  });

  it("filters by out-of-stock availability", async () => {
    mockGetPublishedCategoryBySlug.mockResolvedValue(makeCategoryRecord());
    mockListPublishedProductsByCategory.mockResolvedValue([
      makeProductRecord({ id: "p1", slug: "in-stock-product", inventoryQty: 10 }),
      makeProductRecord({ id: "p2", slug: "out-of-stock-product", inventoryQty: 0 }),
    ]);

    const listing = await getCatalogCategoryListing({
      slug: "home-care",
      searchParams: { availability: "out-of-stock" },
    });

    expect(listing?.filteredProductCount).toBe(1);
    expect(listing?.products[0]?.slug).toBe("out-of-stock-product");
  });

  it("filters by on-sale discount", async () => {
    mockGetPublishedCategoryBySlug.mockResolvedValue(makeCategoryRecord());
    mockListPublishedProductsByCategory.mockResolvedValue([
      makeProductRecord({ id: "p1", slug: "full-price-product", price: 500, compareAtPrice: null }),
      makeProductRecord({ id: "p2", slug: "on-sale-product", price: 500, compareAtPrice: 700 }),
    ]);

    const listing = await getCatalogCategoryListing({
      slug: "home-care",
      searchParams: { discount: "on-sale" },
    });

    expect(listing?.filteredProductCount).toBe(1);
    expect(listing?.products[0]?.slug).toBe("on-sale-product");
  });

  it("sorts products by ascending price", async () => {
    mockGetPublishedCategoryBySlug.mockResolvedValue(makeCategoryRecord());
    mockListPublishedProductsByCategory.mockResolvedValue([
      makeProductRecord({ id: "p1", slug: "expensive-product", price: 2000 }),
      makeProductRecord({ id: "p2", slug: "cheap-product", price: 200 }),
      makeProductRecord({ id: "p3", slug: "mid-product", price: 800 }),
    ]);

    const listing = await getCatalogCategoryListing({
      slug: "home-care",
      searchParams: { sort: "price-asc" },
    });

    expect(listing?.products.map((p) => p.slug)).toEqual([
      "cheap-product",
      "mid-product",
      "expensive-product",
    ]);
  });

  it("applies discount and availability filters before sorting by descending price", async () => {
    mockGetPublishedCategoryBySlug.mockResolvedValue(makeCategoryRecord());
    mockListPublishedProductsByCategory.mockResolvedValue([
      makeProductRecord({ id: "p1", slug: "sale-low-price", price: 400, compareAtPrice: 600, inventoryQty: 10 }),
      makeProductRecord({ id: "p2", slug: "sale-high-price", price: 900, compareAtPrice: 1200, inventoryQty: 2 }),
      makeProductRecord({ id: "p3", slug: "not-on-sale", price: 700, compareAtPrice: null, inventoryQty: 9 }),
      makeProductRecord({ id: "p4", slug: "sale-out-of-stock", price: 1200, compareAtPrice: 1500, inventoryQty: 0 }),
    ]);

    const listing = await getCatalogCategoryListing({
      slug: "home-care",
      searchParams: {
        discount: "on-sale",
        availability: "in-stock",
        sort: "price-desc",
      },
    });

    expect(listing?.filteredProductCount).toBe(2);
    expect(listing?.products.map((product) => product.slug)).toEqual([
      "sale-high-price",
      "sale-low-price",
    ]);
  });

  it("returns empty products list when no products match filters", async () => {
    mockGetPublishedCategoryBySlug.mockResolvedValue(makeCategoryRecord());
    mockListPublishedProductsByCategory.mockResolvedValue([
      makeProductRecord({ id: "p1", slug: "product-a", inventoryQty: 10 }),
    ]);

    const listing = await getCatalogCategoryListing({
      slug: "home-care",
      searchParams: { availability: "out-of-stock" },
    });

    expect(listing?.filteredProductCount).toBe(0);
    expect(listing?.products).toHaveLength(0);
  });

  it("builds One Dollar listing from derived <= 280 Rs. membership", async () => {
    mockListAllPublishedProducts.mockResolvedValue([
      makeProductRecord({ id: "p1", slug: "eligible-100", price: 100 }),
      makeProductRecord({ id: "p2", slug: "eligible-280", price: 280 }),
      makeProductRecord({ id: "p3", slug: "excluded-281", price: 281 }),
    ]);

    const listing = await getCatalogCategoryListing({ slug: "one-dollar" });

    expect(listing).not.toBeNull();
    expect(listing?.category.slug).toBe("one-dollar");
    expect(listing?.totalProductCount).toBe(2);
    expect(listing?.products.map((product) => product.slug)).toEqual([
      "eligible-100",
      "eligible-280",
    ]);
  });

  it("uses the first variant image as the card cover when no product-level image exists", async () => {
    mockGetPublishedCategoryBySlug.mockResolvedValue(makeCategoryRecord());
    // The query layer merges variant-level images into `record.images` before
    // the service maps cards, so a variant-only product still gets a real cover.
    mockListPublishedProductsByCategory.mockResolvedValue([
      makeProductRecord({
        id: "p1",
        slug: "variant-product",
        images: [
          {
            id: "img-var-1",
            url: "https://picsum.photos/seed/tee/400",
            alt: "Blue variant",
            position: 0,
            productVariantId: "var-p1",
          },
        ],
      }),
    ]);

    const listing = await getCatalogCategoryListing({ slug: "home-care" });

    expect(listing?.products[0]?.imageUrl).toBe("https://picsum.photos/seed/tee/400");
    expect(listing?.products[0]?.imageLabel).toBe("Blue variant");
  });

  it("prefers the product-level image over variant images for the card cover", async () => {
    mockGetPublishedCategoryBySlug.mockResolvedValue(makeCategoryRecord());
    mockListPublishedProductsByCategory.mockResolvedValue([
      makeProductRecord({
        id: "p1",
        slug: "shared-product",
        images: [
          {
            id: "img-shared",
            url: "https://picsum.photos/seed/shared/400",
            alt: "Shared cover",
            position: 0,
            productVariantId: null,
          },
          {
            id: "img-var-1",
            url: "https://picsum.photos/seed/blue/400",
            alt: "Blue variant",
            position: 1,
            productVariantId: "var-p1",
          },
        ],
      }),
    ]);

    const listing = await getCatalogCategoryListing({ slug: "home-care" });

    expect(listing?.products[0]?.imageUrl).toBe("https://picsum.photos/seed/shared/400");
  });

  it("uses the default variant's image as the card cover over a lower-positioned non-default image", async () => {
    mockGetPublishedCategoryBySlug.mockResolvedValue(makeCategoryRecord());
    mockListPublishedProductsByCategory.mockResolvedValue([
      makeProductRecord({
        id: "p1",
        slug: "variant-product",
        images: [
          {
            id: "img-other",
            url: "https://picsum.photos/seed/other/400",
            alt: "Other variant",
            position: 0,
            productVariantId: "var-other",
          },
          {
            id: "img-default",
            url: "https://picsum.photos/seed/default/400",
            alt: "Default variant",
            position: 1,
            productVariantId: "var-default",
          },
        ],
        variants: [
          {
            id: "var-default",
            title: "Default",
            sku: "SKU-D",
            options: null,
            price: 500,
            compareAtPrice: null,
            isDefault: true,
            inventory: { quantity: 5 },
          },
          {
            id: "var-other",
            title: "Other",
            sku: "SKU-O",
            options: null,
            price: 500,
            compareAtPrice: null,
            isDefault: false,
            inventory: { quantity: 3 },
          },
        ],
      }),
    ]);

    const listing = await getCatalogCategoryListing({ slug: "home-care" });

    // Even though the non-default variant's image has the lower position, the
    // default variant's image must be the cover.
    expect(listing?.products[0]?.imageUrl).toBe("https://picsum.photos/seed/default/400");
    expect(listing?.products[0]?.imageLabel).toBe("Default variant");
  });
});

