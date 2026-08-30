/**
 * Catalog search service tests.
 *
 * Mocks the catalog-queries module so no real DB connection is needed.
 * Verifies keyword search routing and result mapping.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { searchCatalogProducts } from "@/features/catalog";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSearchPublishedProducts = vi.fn();

vi.mock("@/server/db/catalog-queries", () => ({
  listPublishedCategories: vi.fn().mockResolvedValue([]),
  getPublishedCategoryBySlug: vi.fn().mockResolvedValue(null),
  listPublishedProductsByCategory: vi.fn().mockResolvedValue([]),
  listPublishedProductsByIds: vi.fn().mockResolvedValue([]),
  countPublishedPartyHeavenProducts: vi.fn().mockResolvedValue(0),
  getPublishedProductContextBySlug: vi.fn().mockResolvedValue(null),
  getPublishedProductBySlug: vi.fn().mockResolvedValue(null),
  getRelatedPublishedProducts: vi.fn().mockResolvedValue([]),
  getAllPublishedProductSlugsWithCategories: vi.fn().mockResolvedValue([]),
  searchPublishedProducts: (...args: unknown[]) => mockSearchPublishedProducts(...args),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSearchProductRecord(
  overrides: Partial<{
    id: string;
    slug: string;
    name: string;
    shortDescription: string;
    description: string | null;
    category: { id: string; name: string; slug: string };
    createdAt: Date;
    images: Array<{ id: string; url: string | null; alt: string | null; position: number }>;
  }> = {},
) {
  const {
    id = "p1",
    slug = "ultra-wash-detergent-1kg",
    name = "Ultra Wash Detergent 1kg",
    shortDescription = "Strong stain removal.",
    description = null,
    category = { id: "cat-hc", name: "Home Care", slug: "home-care" },
    createdAt = new Date(),
  } = overrides;
  return {
    id,
    name,
    slug,
    shortDescription,
    description,
    masterSku: null,
    metadata: null,
    createdAt,
    updatedAt: new Date(),
    category,
    images: overrides.images ?? [],
    specifications: [{ id: "s1", key: "Weight", value: "1kg" }],
    variants: [
      {
        id: "v1",
        title: "Default",
        sku: "UWD-001",
        options: null,
        price: 899,
        compareAtPrice: 1099,
        isDefault: true,
        inventory: { quantity: 18 },
      },
    ],
    reviews: [{ rating: 5 }, { rating: 4 }],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("catalog search service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns product matches for a keyword", async () => {
    mockSearchPublishedProducts.mockResolvedValue([
      makeSearchProductRecord(),
    ]);

    const result = await searchCatalogProducts("detergent");

    expect(result.total).toBeGreaterThan(0);
    expect(result.items[0]?.slug).toBe("ultra-wash-detergent-1kg");
    expect(result.items[0]?.imageUrl).toBeUndefined();
    expect(result.source).toBe("db");
  });

  it("maps the first valid image URL into search card results", async () => {
    mockSearchPublishedProducts.mockResolvedValue([
      makeSearchProductRecord({
        images: [
          { id: "img-1", url: "", alt: "Broken", position: 0 },
          { id: "img-2", url: "/uploads/catalog/detergent.png", alt: "Detergent pack", position: 1 },
        ],
      }),
    ]);

    const result = await searchCatalogProducts("detergent");

    expect(result.items[0]?.imageUrl).toBe("/uploads/catalog/detergent.png");
  });

  it("skips unsafe image URLs and preserves placeholder fallback behavior", async () => {
    mockSearchPublishedProducts.mockResolvedValue([
      makeSearchProductRecord({
        images: [{ id: "img-1", url: "javascript:alert('xss')", alt: "Unsafe", position: 0 }],
      }),
    ]);

    const result = await searchCatalogProducts("detergent");

    expect(result.items[0]?.imageUrl).toBeUndefined();
  });

  it("returns an empty result set for unknown terms (no DB matches)", async () => {
    mockSearchPublishedProducts.mockResolvedValue([]);

    const result = await searchCatalogProducts("zzzz-no-hit-term");

    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it("matches products by category name (searching a category surfaces its products)", async () => {
    mockSearchPublishedProducts.mockResolvedValue([
      makeSearchProductRecord({
        slug: "vanilla-amber-jar",
        name: "Vanilla Amber Jar",
        category: { id: "cat-candles", name: "Candles", slug: "candles" },
      }),
    ]);

    const result = await searchCatalogProducts("candles");

    expect(result.items[0]?.slug).toBe("vanilla-amber-jar");
  });

  it("matches plural queries against singular product names", async () => {
    mockSearchPublishedProducts.mockResolvedValue([
      makeSearchProductRecord({
        slug: "gold-chain-necklace",
        name: "Gold Chain Necklace",
      }),
    ]);

    const result = await searchCatalogProducts("chains");

    expect(result.items[0]?.slug).toBe("gold-chain-necklace");
  });

  it("matches any word of a multi-word query", async () => {
    mockSearchPublishedProducts.mockResolvedValue([
      makeSearchProductRecord({
        slug: "lavender-candle",
        name: "Lavender Candle",
      }),
    ]);

    const result = await searchCatalogProducts("scented candle");

    expect(result.items[0]?.slug).toBe("lavender-candle");
  });

  it("ranks name/category matches above description-only matches", async () => {
    const older = new Date("2024-01-01T00:00:00Z");
    const newer = new Date("2025-01-01T00:00:00Z");

    mockSearchPublishedProducts.mockResolvedValue([
      // Balloons only match deep inside the description, yet are newest.
      makeSearchProductRecord({
        id: "p-balloons",
        slug: "birthday-balloons",
        name: "Birthday Balloons",
        description: "Perfect for parties with candles and confetti.",
        createdAt: newer,
      }),
      // Candles match by name even though they are older.
      makeSearchProductRecord({
        id: "p-candle-trio",
        slug: "candle-trio",
        name: "Candle Trio",
        description: "Soy wax candles.",
        createdAt: older,
      }),
    ]);

    const result = await searchCatalogProducts("candles");

    expect(result.items[0]?.slug).toBe("candle-trio");
    expect(result.items[1]?.slug).toBe("birthday-balloons");
  });

  it("respects the result limit", async () => {
    mockSearchPublishedProducts.mockResolvedValue([makeSearchProductRecord()]);

    const result = await searchCatalogProducts("care", { limit: 1 });

    expect(result.items).toHaveLength(1);
  });

  it("returns empty result for blank query without hitting DB", async () => {
    const result = await searchCatalogProducts("  ");

    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);
    // DB should not be called for empty queries
    expect(mockSearchPublishedProducts).not.toHaveBeenCalled();
  });
});

