/**
 * Product detail service tests (alias coverage).
 *
 * Exercises the same service functions through a secondary test file
 * to ensure variant and related-product mapping works end-to-end.
 */
import { describe, expect, it, vi } from "vitest";

import { getProductBySlug, getRelatedProducts } from "@/features/catalog";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetPublishedProductBySlug = vi.fn();
const mockGetPublishedProductContextBySlug = vi.fn().mockResolvedValue(null);
const mockGetRelatedPublishedProducts = vi.fn();

vi.mock("@/server/db/catalog-queries", () => ({
  listPublishedCategories: vi.fn().mockResolvedValue([]),
  getPublishedCategoryBySlug: vi.fn().mockResolvedValue(null),
  listPublishedProductsByCategory: vi.fn().mockResolvedValue([]),
  listPublishedProductsByIds: vi.fn().mockResolvedValue([]),
  getPublishedProductContextBySlug: (...args: unknown[]) => mockGetPublishedProductContextBySlug(...args),
  getPublishedProductBySlug: (...args: unknown[]) => mockGetPublishedProductBySlug(...args),
  getRelatedPublishedProducts: (...args: unknown[]) => mockGetRelatedPublishedProducts(...args),
  getAllPublishedProductSlugsWithCategories: vi.fn().mockResolvedValue([]),
  searchPublishedProducts: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// Shared mock record
// ---------------------------------------------------------------------------

const FACE_WASH_RECORD = {
  id: "prod-face-wash",
  name: "Hydra Care Face Wash",
  slug: "hydra-care-face-wash",
  shortDescription: "Gentle daily cleanser.",
  description: null,
  masterSku: "HCF-001",
  metadata: { variantsEnabled: true },
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
  category: { id: "cat-pc", name: "Personal Care", slug: "personal-care" },
  images: [
    { id: "img-1", url: "https://cdn.example.com/face-wash.webp", alt: "Face wash", position: 0 },
    { id: "img-2", url: "https://cdn.example.com/face-wash-2.webp", alt: "Face wash side", position: 1 },
  ],
  specifications: [
    { id: "s1", key: "Volume", value: "100ml" },
    { id: "s2", key: "Type", value: "Daily care" },
  ],
  variants: [
    {
      id: "v-50ml",
      title: "50ml",
      sku: "HCF-050",
      options: { Size: "50ml" },
      price: 399,
      compareAtPrice: null,
      isDefault: false,
      inventory: { quantity: 8 },
    },
    {
      id: "v-100ml",
      title: "100ml",
      sku: "HCF-001",
      options: { Size: "100ml" },
      price: 699,
      compareAtPrice: null,
      isDefault: true,
      inventory: { quantity: 22 },
    },
  ],
  reviews: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("product detail service", () => {
  it("returns product details by slug", async () => {
    mockGetPublishedProductBySlug.mockResolvedValue(FACE_WASH_RECORD);

    const product = await getProductBySlug("hydra-care-face-wash");

    expect(product).not.toBeNull();
    expect(product?.slug).toBe("hydra-care-face-wash");
    expect(product?.images.length).toBe(2);
    expect(product?.specifications.length).toBe(2);
    expect(product?.reviewSummary.totalCount).toBe(0);
  });

  it("returns null for unknown product slug", async () => {
    mockGetPublishedProductBySlug.mockResolvedValue(null);

    const product = await getProductBySlug("missing-product");

    expect(product).toBeNull();
  });

  it("includes variant groups for variant-enabled products", async () => {
    mockGetPublishedProductBySlug.mockResolvedValue(FACE_WASH_RECORD);

    const product = await getProductBySlug("hydra-care-face-wash");

    expect(product).not.toBeNull();
    expect(product?.variantGroups.length).toBeGreaterThan(0);
    expect(product?.variantGroups[0]?.options.length).toBeGreaterThan(1);
  });

  it("returns related products in same category excluding current product", async () => {
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
        variants: [
          {
            id: "v1",
            title: "Default",
            sku: "SSL-001",
            options: null,
            price: 849,
            compareAtPrice: 999,
            isDefault: true,
            inventory: { quantity: 5 },
          },
        ],
        reviews: [],
      },
    ]);

    const related = await getRelatedProducts("personal-care", "hydra-care-face-wash");

    expect(related.length).toBeGreaterThan(0);
    expect(related.find((item) => item.slug === "hydra-care-face-wash")).toBeUndefined();
    expect(related.every((item) => item.categorySlug === "personal-care")).toBe(true);
  });
});

