/**
 * Product detail service tests.
 *
 * Mocks the catalog-queries module so no real DB connection is needed.
 * Verifies product detail mapping, variant groups, reviews, and related products.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getProductBySlug,
  getProductMetadataBySlug,
  getProductSlugsWithCategory,
  getRelatedProducts,
} from "@/features/catalog";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDetailRecord(overrides: Partial<{
  id: string;
  slug: string;
  categorySlug: string;
  masterSku: string | null;
  variantsEnabled: boolean;
  reviews: Array<{ id: string; rating: number; title: string | null; body: string | null; status: string; createdAt: Date | string; user: { name: string | null } | null }>;
}> = {}) {
  const {
    id = "prod-face-wash",
    slug = "hydra-care-face-wash",
    categorySlug = "personal-care",
    masterSku = "HCF-001",
    variantsEnabled = false,
    reviews = [],
  } = overrides;

  return {
    id,
    name: "Hydra Care Face Wash",
    slug,
    shortDescription: "Gentle daily cleanser.",
    description: "A long description of the face wash.",
    masterSku,
    metadata: { variantsEnabled },
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    category: { id: "cat-pc", name: "Personal Care", slug: categorySlug },
    images: [
      { id: "img-1", url: "https://picsum.photos/seed/face-wash/600", alt: "Face wash bottle", position: 0 },
    ],
    specifications: [
      { id: "spec-1", key: "Volume", value: "100ml" },
      { id: "spec-2", key: "Type", value: "Daily care" },
    ],
    variants: [
      {
        id: "var-1",
        title: "Default",
        sku: "HCF-001",
        options: null,
        price: 699,
        compareAtPrice: null,
        isDefault: true,
        inventory: { quantity: 22 },
      },
    ],
    reviews,
  };
}

function makeVariantProductRecord() {
  return {
    id: "prod-detergent",
    name: "Ultra Wash Detergent",
    slug: "ultra-wash-detergent-1kg",
    shortDescription: "Strong stain removal.",
    description: null,
    masterSku: "UWD-MASTER",
    metadata: { variantsEnabled: true },
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    category: { id: "cat-hc", name: "Home Care", slug: "home-care" },
    images: [] as Array<{
      id: string;
      url: string;
      alt: string | null;
      position: number;
      productVariantId?: string;
    }>,
    specifications: [],
    variants: [
      {
        id: "var-500g",
        title: "500g",
        sku: "UWD-500G",
        options: { Size: "500g" },
        price: 499,
        compareAtPrice: null,
        isDefault: false,
        inventory: { quantity: 5 },
      },
      {
        id: "var-1kg",
        title: "1kg",
        sku: "UWD-1KG",
        options: { Size: "1kg" },
        price: 899,
        compareAtPrice: 1099,
        isDefault: true,
        inventory: { quantity: 18 },
      },
      {
        id: "var-2kg",
        title: "2kg",
        sku: "UWD-2KG",
        options: { Size: "2kg" },
        price: 1599,
        compareAtPrice: null,
        isDefault: false,
        inventory: { quantity: 8 },
      },
    ] as Array<{
      id: string;
      title: string | null;
      sku: string | null;
      options: Record<string, string> | null;
      price: number;
      compareAtPrice: number | null;
      isDefault: boolean;
      inventory: { quantity: number };
    }>,
    reviews: [],
  };
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetPublishedProductBySlug = vi.fn();
const mockGetPublishedProductContextBySlug = vi.fn();
const mockGetRelatedPublishedProducts = vi.fn();
const mockGetAllPublishedProductSlugsWithCategories = vi.fn();
const mockListPublishedProductsByIds = vi.fn().mockResolvedValue([]);

vi.mock("@/server/db/catalog-queries", () => ({
  listPublishedCategories: vi.fn().mockResolvedValue([]),
  getPublishedCategoryBySlug: vi.fn().mockResolvedValue(null),
  listPublishedProductsByCategory: vi.fn().mockResolvedValue([]),
  listPublishedProductsByIds: (...args: unknown[]) => mockListPublishedProductsByIds(...args),
  getPublishedProductContextBySlug: (...args: unknown[]) => mockGetPublishedProductContextBySlug(...args),
  getPublishedProductBySlug: (...args: unknown[]) => mockGetPublishedProductBySlug(...args),
  getRelatedPublishedProducts: (...args: unknown[]) => mockGetRelatedPublishedProducts(...args),
  getAllPublishedProductSlugsWithCategories: (...args: unknown[]) =>
    mockGetAllPublishedProductSlugsWithCategories(...args),
  searchPublishedProducts: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("product detail service", () => {
  beforeEach(() => {
    mockGetPublishedProductBySlug.mockReset();
    mockGetPublishedProductContextBySlug.mockReset();
    mockGetRelatedPublishedProducts.mockReset();
    mockGetAllPublishedProductSlugsWithCategories.mockReset();
    mockListPublishedProductsByIds.mockReset();
    mockListPublishedProductsByIds.mockResolvedValue([]);
  });

  it("returns full product detail for a valid slug", async () => {
    mockGetPublishedProductBySlug.mockResolvedValue(makeDetailRecord());

    const product = await getProductBySlug("hydra-care-face-wash");

    expect(product).not.toBeNull();
    expect(product?.slug).toBe("hydra-care-face-wash");
    expect(product?.sku).toBe("HCF-001");
    expect(product?.images.length).toBeGreaterThan(0);
    expect(product?.specifications.length).toBeGreaterThan(0);
  });

  it("includes the resolved product URL", async () => {
    mockGetPublishedProductBySlug.mockResolvedValue(makeDetailRecord());

    const product = await getProductBySlug("hydra-care-face-wash");

    expect(product?.href).toBe("/categories/personal-care/hydra-care-face-wash");
  });

  it("returns null for an unknown slug", async () => {
    mockGetPublishedProductBySlug.mockResolvedValue(null);

    const product = await getProductBySlug("does-not-exist");

    expect(product).toBeNull();
  });

  it("includes variant groups for products with variants enabled", async () => {
    mockGetPublishedProductBySlug.mockResolvedValue(makeVariantProductRecord());

    const product = await getProductBySlug("ultra-wash-detergent-1kg");

    expect(product?.variantGroups.length).toBe(1);
    expect(product?.variantGroups[0]?.name).toBe("Size");
    expect(product?.variantGroups[0]?.options.length).toBe(3);
  });

  it("builds a variant group from titles when variants have no options", async () => {
    const record = makeVariantProductRecord();
    // Variants without option values still need a storefront picker so
    // variant-specific images can be switched.
    record.variants = record.variants.map((variant) => ({
      ...variant,
      options: null,
      title: variant.title ?? variant.sku ?? "Variant",
    }));
    mockGetPublishedProductBySlug.mockResolvedValue(record);

    const product = await getProductBySlug("ultra-wash-detergent-1kg");

    expect(product?.variantGroups.length).toBe(1);
    expect(product?.variantGroups[0]?.name).toBe("Variant");
    expect(product?.variantGroups[0]?.options.map((option) => option.label)).toEqual([
      "500g",
      "1kg",
      "2kg",
    ]);
    expect(product?.variantGroups[0]?.options.map((option) => option.id)).toEqual([
      "var-500g",
      "var-1kg",
      "var-2kg",
    ]);
  });

  it("resolves the detail sku from the default variant before the master SKU", async () => {
    mockGetPublishedProductBySlug.mockResolvedValue(makeVariantProductRecord());

    const product = await getProductBySlug("ultra-wash-detergent-1kg");

    // Cart/wishlist line items are keyed by variant SKU, so the PDP detail sku
    // must match the default variant's sku (UWD-1KG) rather than the master SKU
    // (UWD-MASTER) so PDP in-cart/wishlist state stays aligned.
    expect(product?.sku).toBe("UWD-1KG");
  });

  it("falls back to the master SKU when the product has no variant sku", async () => {
    const record = makeVariantProductRecord();
    record.variants = record.variants.map((variant) => ({ ...variant, sku: null }));
    mockGetPublishedProductBySlug.mockResolvedValue(record);

    const product = await getProductBySlug("ultra-wash-detergent-1kg");

    expect(product?.sku).toBe("UWD-MASTER");
  });

  it("has empty variant groups for simple products", async () => {
    mockGetPublishedProductBySlug.mockResolvedValue(makeDetailRecord({ variantsEnabled: false }));

    const product = await getProductBySlug("hydra-care-face-wash");

    expect(product?.variantGroups).toHaveLength(0);
  });

  it("includes review summary data from APPROVED reviews", async () => {
    const reviews = [
      { id: "r1", rating: 5, title: "Great", body: "Loved it!", status: "APPROVED", createdAt: new Date(), user: { name: "Alice" } },
      { id: "r2", rating: 4, title: "Good", body: "Pretty good.", status: "APPROVED", createdAt: new Date(), user: null },
      { id: "r3", rating: 3, title: "OK", body: "Average.", status: "APPROVED", createdAt: new Date(), user: { name: "Bob" } },
    ];
    mockGetPublishedProductBySlug.mockResolvedValue(makeDetailRecord({ reviews }));

    const product = await getProductBySlug("hydra-care-face-wash");

    expect(product?.reviewSummary.totalCount).toBe(3);
    expect(product?.reviewSummary.averageRating).toBe(4);
    expect(product?.reviews.every((r) => r.status === "APPROVED")).toBe(true);
  });

  it("maps review dates safely when cached records return createdAt as a string", async () => {
    const stringDate = "2026-05-04T09:10:11.000Z";
    const reviews = [
      {
        id: "r1",
        rating: 5,
        title: "Great",
        body: "Loved it!",
        status: "APPROVED",
        createdAt: stringDate,
        user: { name: "Alice" },
      },
    ];
    mockGetPublishedProductBySlug.mockResolvedValue(makeDetailRecord({ reviews }));

    const product = await getProductBySlug("hydra-care-face-wash");

    expect(product?.reviews[0]?.date).toBe(stringDate);
  });

  it("returns empty review summary when no reviews exist", async () => {
    mockGetPublishedProductBySlug.mockResolvedValue(makeDetailRecord({ reviews: [] }));

    const product = await getProductBySlug("hydra-care-face-wash");

    expect(product?.reviewSummary.totalCount).toBe(0);
    expect(product?.reviewSummary.averageRating).toBe(0);
  });

  it("sets Anonymous as author when user is null", async () => {
    const reviews = [
      { id: "r1", rating: 5, title: null, body: "Nice!", status: "APPROVED", createdAt: new Date(), user: null },
    ];
    mockGetPublishedProductBySlug.mockResolvedValue(makeDetailRecord({ reviews }));

    const product = await getProductBySlug("hydra-care-face-wash");

    expect(product?.reviews[0]?.author).toBe("Anonymous");
  });

  it("maps real image url onto the images array", async () => {
    mockGetPublishedProductBySlug.mockResolvedValue(makeDetailRecord());

    const product = await getProductBySlug("hydra-care-face-wash");

    expect(product?.images[0]?.url).toBe("https://picsum.photos/seed/face-wash/600");
  });

  it("returns related products from the same category excluding self", async () => {
    mockGetPublishedProductContextBySlug.mockResolvedValue({
      id: "prod-face-wash",
      slug: "hydra-care-face-wash",
      name: "Hydra Care Face Wash",
      shortDescription: "Gentle daily cleanser.",
      metadata: null,
      category: { slug: "personal-care" },
    });
    mockGetRelatedPublishedProducts.mockResolvedValue([
      {
        id: "p2",
        name: "Silk Soft Lotion",
        slug: "silk-soft-lotion",
        shortDescription: null,
        description: null,
        masterSku: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: "cat-pc", name: "Personal Care", slug: "personal-care" },
        images: [],
        specifications: [],
        variants: [{ id: "v1", title: "Default", sku: "SSL-001", options: null, price: 849, compareAtPrice: 999, isDefault: true, inventory: { quantity: 5 } }],
        reviews: [],
      },
    ]);

    const related = await getRelatedProducts("personal-care", "hydra-care-face-wash");

    expect(related.length).toBeGreaterThan(0);
    expect(related.every((p) => p.categorySlug === "personal-care")).toBe(true);
    expect(related.some((p) => p.slug === "hydra-care-face-wash")).toBe(false);
    expect(related.every((p) => p.href.startsWith("/categories/"))).toBe(true);
  });

  it("prioritizes curated related product ids before fallback recommendations", async () => {
    mockGetPublishedProductContextBySlug.mockResolvedValue({
      id: "prod-face-wash",
      slug: "hydra-care-face-wash",
      name: "Hydra Care Face Wash",
      shortDescription: "Gentle daily cleanser.",
      metadata: {
        variantsEnabled: false,
        relatedProductIds: ["p-curated"],
      },
      category: { slug: "personal-care" },
    });

    mockListPublishedProductsByIds.mockResolvedValue([
      {
        id: "p-curated",
        name: "Curated Lotion",
        slug: "curated-lotion",
        shortDescription: null,
        description: null,
        masterSku: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: "cat-pc", name: "Personal Care", slug: "personal-care" },
        images: [],
        specifications: [],
        variants: [{ id: "v1", title: "Default", sku: "CUR-001", options: null, price: 899, compareAtPrice: null, isDefault: true, inventory: { quantity: 6 } }],
        reviews: [],
      },
    ]);

    mockGetRelatedPublishedProducts.mockResolvedValue([
      {
        id: "p-fallback",
        name: "Fallback Wash",
        slug: "fallback-wash",
        shortDescription: null,
        description: null,
        masterSku: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: "cat-pc", name: "Personal Care", slug: "personal-care" },
        images: [],
        specifications: [],
        variants: [{ id: "v2", title: "Default", sku: "FB-001", options: null, price: 799, compareAtPrice: null, isDefault: true, inventory: { quantity: 5 } }],
        reviews: [],
      },
    ]);

    const related = await getRelatedProducts("personal-care", "hydra-care-face-wash");

    expect(related[0]?.slug).toBe("curated-lotion");
    expect(related.some((item) => item.slug === "fallback-wash")).toBe(true);
  });

  it("accepts legacy related metadata objects and excludes the current product by id", async () => {
    mockGetPublishedProductContextBySlug.mockResolvedValue({
      id: "prod-face-wash",
      slug: "hydra-care-face-wash",
      name: "Hydra Care Face Wash",
      shortDescription: "Gentle daily cleanser.",
      metadata: {
        variantsEnabled: false,
        relatedProducts: [{ id: "prod-face-wash" }, { id: "p-curated" }],
      },
      category: { slug: "personal-care" },
    });

    mockListPublishedProductsByIds.mockResolvedValue([
      {
        id: "prod-face-wash",
        name: "Hydra Care Face Wash",
        slug: "hydra-care-face-wash",
        shortDescription: null,
        description: null,
        masterSku: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: "cat-pc", name: "Personal Care", slug: "personal-care" },
        images: [],
        specifications: [],
        variants: [{ id: "self-v1", title: "Default", sku: "HCF-001", options: null, price: 699, compareAtPrice: null, isDefault: true, inventory: { quantity: 10 } }],
        reviews: [],
      },
      {
        id: "p-curated",
        name: "Curated Lotion",
        slug: "curated-lotion",
        shortDescription: null,
        description: null,
        masterSku: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: "cat-pc", name: "Personal Care", slug: "personal-care" },
        images: [],
        specifications: [],
        variants: [{ id: "v1", title: "Default", sku: "CUR-001", options: null, price: 899, compareAtPrice: null, isDefault: true, inventory: { quantity: 6 } }],
        reviews: [],
      },
    ]);
    mockGetRelatedPublishedProducts.mockResolvedValue([]);

    const related = await getRelatedProducts("personal-care", "hydra-care-face-wash");

    expect(related.map((item) => item.slug)).toEqual(["curated-lotion"]);
  });

  it("returns an empty array when related lookup fails", async () => {
    mockGetPublishedProductContextBySlug.mockRejectedValue(new Error("query failed"));

    await expect(getRelatedProducts("personal-care", "hydra-care-face-wash")).resolves.toEqual([]);
  });

  it("caps related products at 4", async () => {
    mockGetPublishedProductContextBySlug.mockResolvedValue({
      id: "prod-face-wash",
      slug: "hydra-care-face-wash",
      name: "Hydra Care Face Wash",
      shortDescription: "Gentle daily cleanser.",
      metadata: null,
      category: { slug: "personal-care" },
    });
    mockListPublishedProductsByIds.mockResolvedValue([]);
    mockGetRelatedPublishedProducts.mockResolvedValue([
      {
        id: "p-1",
        name: "Fallback Product 1",
        slug: "fallback-product-1",
        shortDescription: null,
        description: null,
        masterSku: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: "cat-pc", name: "Personal Care", slug: "personal-care" },
        images: [],
        specifications: [],
        variants: [{ id: "v-1", title: "Default", sku: "FB-001", options: null, price: 799, compareAtPrice: null, isDefault: true, inventory: { quantity: 5 } }],
        reviews: [],
      },
      {
        id: "p-2",
        name: "Fallback Product 2",
        slug: "fallback-product-2",
        shortDescription: null,
        description: null,
        masterSku: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: "cat-pc", name: "Personal Care", slug: "personal-care" },
        images: [],
        specifications: [],
        variants: [{ id: "v-2", title: "Default", sku: "FB-002", options: null, price: 899, compareAtPrice: null, isDefault: true, inventory: { quantity: 5 } }],
        reviews: [],
      },
      {
        id: "p-3",
        name: "Fallback Product 3",
        slug: "fallback-product-3",
        shortDescription: null,
        description: null,
        masterSku: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: "cat-pc", name: "Personal Care", slug: "personal-care" },
        images: [],
        specifications: [],
        variants: [{ id: "v-3", title: "Default", sku: "FB-003", options: null, price: 999, compareAtPrice: null, isDefault: true, inventory: { quantity: 5 } }],
        reviews: [],
      },
      {
        id: "p-4",
        name: "Fallback Product 4",
        slug: "fallback-product-4",
        shortDescription: null,
        description: null,
        masterSku: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: "cat-pc", name: "Personal Care", slug: "personal-care" },
        images: [],
        specifications: [],
        variants: [{ id: "v-4", title: "Default", sku: "FB-004", options: null, price: 1099, compareAtPrice: null, isDefault: true, inventory: { quantity: 5 } }],
        reviews: [],
      },
      {
        id: "p-5",
        name: "Fallback Product 5",
        slug: "fallback-product-5",
        shortDescription: null,
        description: null,
        masterSku: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: "cat-pc", name: "Personal Care", slug: "personal-care" },
        images: [],
        specifications: [],
        variants: [{ id: "v-5", title: "Default", sku: "FB-005", options: null, price: 1199, compareAtPrice: null, isDefault: true, inventory: { quantity: 5 } }],
        reviews: [],
      },
      {
        id: "p-6",
        name: "Fallback Product 6",
        slug: "fallback-product-6",
        shortDescription: null,
        description: null,
        masterSku: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: "cat-pc", name: "Personal Care", slug: "personal-care" },
        images: [],
        specifications: [],
        variants: [{ id: "v-6", title: "Default", sku: "FB-006", options: null, price: 1299, compareAtPrice: null, isDefault: true, inventory: { quantity: 5 } }],
        reviews: [],
      },
    ]);

    const related = await getRelatedProducts("personal-care", "hydra-care-face-wash");

    expect(related.length).toBe(4);
  });

  it("returns all published product slugs with category slugs", async () => {
    mockGetAllPublishedProductSlugsWithCategories.mockResolvedValue([
      { slug: "product-a", category: { slug: "home-care" } },
      { slug: "product-b", category: { slug: "grocery" } },
    ]);

    const slugs = await getProductSlugsWithCategory();

    expect(slugs.length).toBe(2);
    expect(slugs.every((s) => typeof s.slug === "string" && typeof s.categorySlug === "string")).toBe(true);
  });

  it("returns lightweight metadata by slug without loading full product detail", async () => {
    mockGetPublishedProductContextBySlug.mockResolvedValue({
      id: "prod-face-wash",
      slug: "hydra-care-face-wash",
      name: "Hydra Care Face Wash",
      shortDescription: "Gentle daily cleanser.",
      metadata: null,
      category: { slug: "personal-care" },
    });

    const metadata = await getProductMetadataBySlug("hydra-care-face-wash");

    expect(metadata).toEqual({
      name: "Hydra Care Face Wash",
      shortDescription: "Gentle daily cleanser.",
      categorySlug: "personal-care",
    });
  });

  it("maps variant-specific images with variantId and variantLabel", async () => {
    const record = makeVariantProductRecord();
    record.images = [
      { id: "img-1kg", url: "https://picsum.photos/seed/1kg/600", alt: "1kg pack", position: 0, productVariantId: "var-1kg" },
      { id: "img-500g", url: "https://picsum.photos/seed/500g/600", alt: "500g pack", position: 1, productVariantId: "var-500g" },
      { id: "img-shared", url: "https://picsum.photos/seed/shared/600", alt: "Shared", position: 2 },
    ];
    mockGetPublishedProductBySlug.mockResolvedValue(record);

    const product = await getProductBySlug("ultra-wash-detergent-1kg");

    // Product-level (shared) image comes first, then variant images grouped by variant order.
    expect(product?.images.map((img) => img.id)).toEqual(["img-shared", "img-500g", "img-1kg"]);
    expect(product?.images.find((img) => img.id === "img-1kg")).toMatchObject({
      variantId: "var-1kg",
      variantLabel: "1kg",
      isPrimary: true,
    });
    expect(product?.images.find((img) => img.id === "img-500g")).toMatchObject({
      variantId: "var-500g",
      variantLabel: "500g",
      isPrimary: true,
    });
    // Shared/product-level image carries no variant association.
    expect(product?.images.find((img) => img.id === "img-shared")).not.toHaveProperty("variantId");
  });

  it("marks only the first image of each variant as primary", async () => {
    const record = makeVariantProductRecord();
    record.images = [
      { id: "img-1kg-a", url: "https://picsum.photos/seed/1kg-a/600", alt: "1kg front", position: 0, productVariantId: "var-1kg" },
      { id: "img-1kg-b", url: "https://picsum.photos/seed/1kg-b/600", alt: "1kg back", position: 1, productVariantId: "var-1kg" },
    ];
    mockGetPublishedProductBySlug.mockResolvedValue(record);

    const product = await getProductBySlug("ultra-wash-detergent-1kg");

    const variantImages = product?.images.filter((img) => img.variantId === "var-1kg");
    expect(variantImages?.map((img) => img.isPrimary)).toEqual([true, false]);
  });

  it("falls back to variant labels derived from variant titles when options are missing", async () => {
    const record = makeVariantProductRecord();
    record.variants = record.variants.map((variant) => ({ ...variant, options: null }));
    record.images = [
      { id: "img-1kg", url: "https://picsum.photos/seed/1kg/600", alt: null, position: 0, productVariantId: "var-1kg" },
    ];
    mockGetPublishedProductBySlug.mockResolvedValue(record);

    const product = await getProductBySlug("ultra-wash-detergent-1kg");

    expect(product?.images[0]).toMatchObject({
      variantId: "var-1kg",
      variantLabel: "1kg",
    });
  });
});

