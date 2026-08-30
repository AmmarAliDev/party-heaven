import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  deal: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({
  getPrismaClient: () => prismaMock,
}));

import { getDealBySlug, listPublishedDeals, listPublishedDealsByIds } from "@/features/deals";

function buildVariant(overrides: Record<string, unknown> = {}) {
  return {
    id: "variant-1",
    title: "Default",
    isDefault: true,
    inventory: { quantity: 10 },
    ...overrides,
  };
}

function buildProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: "product-1",
    name: "Flash Cleaner",
    slug: "flash-cleaner",
    status: "PUBLISHED",
    category: { slug: "home-care" },
    variants: [buildVariant()],
    ...overrides,
  };
}

function buildDealRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "deal-1",
    title: "Flash Cleaner Deal",
    slug: "flash-cleaner-deal",
    shortDescription: "Two for one clean",
    description: "A longer deal description",
    status: "PUBLISHED",
    price: 500,
    compareAtPrice: 650,
    seoTitle: null,
    seoDescription: null,
    seoCanonicalUrl: null,
    seoOgTitle: null,
    seoOgDescription: null,
    seoImageUrl: null,
    seoNoIndex: false,
    metadata: null,
    images: [
      { url: "https://store.public.blob.vercel-storage.com/admin/deals/one.jpg", alt: "Deal one" },
      { url: "https://store.public.blob.vercel-storage.com/admin/deals/two.jpg", alt: null },
    ],
    category: { slug: "home-care" },
    products: [
      {
        id: "deal-product-1",
        quantity: 2,
        productVariantId: null,
        product: buildProduct(),
      },
    ],
    specifications: [
      { key: "Included items", value: "2-piece bundle" },
      { key: "Best before", value: "2026" },
    ],
    ...overrides,
  };
}

describe("storefront deals service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps a published deal with deal-level pricing and included products", async () => {
    prismaMock.deal.findMany.mockResolvedValue([buildDealRecord()]);

    const deals = await listPublishedDeals();

    expect(deals).toHaveLength(1);
    const deal = deals[0];
    expect(deal).toMatchObject({
      slug: "flash-cleaner-deal",
      title: "Flash Cleaner Deal",
      shortDescription: "Two for one clean",
      price: 500,
      compareAt: 650,
      availableStock: 10,
      isAvailable: true,
      isLowStock: false,
      categorySlug: "home-care",
      products: [
        {
          id: "product-1",
          name: "Flash Cleaner",
          href: "/categories/home-care/flash-cleaner",
          variantTitle: null,
          quantity: 2,
          availableStock: 10,
          isAvailable: true,
        },
      ],
      specifications: [
        { label: "Included items", value: "2-piece bundle" },
        { label: "Best before", value: "2026" },
      ],
    });
    expect(deal.images).toHaveLength(2);
    expect(deal.images[0].alt).toBe("Deal one");
    // Second image falls back to the deal title for alt text.
    expect(deal.images[1].alt).toBe("Flash Cleaner Deal");
  });

  it("flags low stock and out-of-stock deals from the least-available product", async () => {
    prismaMock.deal.findMany.mockResolvedValue([
      buildDealRecord({
        id: "deal-low",
        slug: "low",
        price: 300,
        compareAtPrice: null,
        products: [
          {
            id: "dp-low",
            quantity: 1,
            productVariantId: null,
            product: buildProduct({ id: "product-1", variants: [buildVariant({ inventory: { quantity: 4 } })] }),
          },
        ],
      }),
      buildDealRecord({
        id: "deal-out",
        slug: "out",
        price: 300,
        compareAtPrice: null,
        products: [
          {
            id: "dp-out",
            quantity: 1,
            productVariantId: null,
            product: buildProduct({ id: "product-2", name: "Empty Stock", slug: "empty-stock", variants: [buildVariant({ inventory: { quantity: 0 } })] }),
          },
        ],
      }),
    ]);

    const deals = await listPublishedDeals();
    const low = deals.find((deal) => deal.id === "deal-low");
    const out = deals.find((deal) => deal.id === "deal-out");

    expect(low?.isLowStock).toBe(true);
    expect(low?.isAvailable).toBe(true);
    expect(out?.isAvailable).toBe(false);
    expect(out?.availableStock).toBe(0);
  });

  it("computes availability from ALL included products (min stock wins)", async () => {
    prismaMock.deal.findMany.mockResolvedValue([
      buildDealRecord({
        id: "deal-bundle",
        slug: "bundle",
        products: [
          {
            id: "dp-1",
            quantity: 1,
            productVariantId: null,
            product: buildProduct({ id: "product-1", variants: [buildVariant({ inventory: { quantity: 10 } })] }),
          },
          {
            id: "dp-2",
            quantity: 3,
            productVariantId: null,
            product: buildProduct({
              id: "product-2",
              name: "Party Cups",
              slug: "party-cups",
              variants: [buildVariant({ id: "variant-2", inventory: { quantity: 2 } })],
            }),
          },
        ],
      }),
    ]);

    const deals = await listPublishedDeals();
    const deal = deals[0];

    expect(deal?.products).toHaveLength(2);
    expect(deal?.availableStock).toBe(2);
    expect(deal?.isAvailable).toBe(true);
  });

  it("uses the linked variant for stock and shows its label", async () => {
    prismaMock.deal.findMany.mockResolvedValue([
      buildDealRecord({
        products: [
          {
            id: "dp-1",
            quantity: 1,
            productVariantId: "variant-2",
            product: buildProduct({
              variants: [
                buildVariant({ id: "variant-1", inventory: { quantity: 10 } }),
                buildVariant({ id: "variant-2", title: "Large", isDefault: false, inventory: { quantity: 3 } }),
              ],
            }),
          },
        ],
      }),
    ]);

    const deals = await listPublishedDeals();
    const deal = deals[0];

    expect(deal?.products[0]?.variantTitle).toBe("Large");
    expect(deal?.products[0]?.availableStock).toBe(3);
    expect(deal?.availableStock).toBe(3);
    expect(deal?.isLowStock).toBe(true);
  });

  it("filters out unpublished products from the deal while keeping published ones", async () => {
    prismaMock.deal.findMany.mockResolvedValue([
      buildDealRecord({
        products: [
          {
            id: "dp-pub",
            quantity: 1,
            productVariantId: null,
            product: buildProduct({ id: "product-1" }),
          },
          {
            id: "dp-hidden",
            quantity: 1,
            productVariantId: null,
            product: buildProduct({ id: "product-2", name: "Hidden", slug: "hidden", status: "DRAFT" }),
          },
        ],
      }),
    ]);

    const deals = await listPublishedDeals();

    expect(deals[0]?.products.map((product) => product.id)).toEqual(["product-1"]);
  });

  it("returns null for a non-published deal by slug", async () => {
    prismaMock.deal.findUnique.mockResolvedValue(buildDealRecord({ status: "DRAFT" }));

    const deal = await getDealBySlug("flash-cleaner-deal");

    expect(deal).toBeNull();
  });

  it("returns null for a deal with no published products", async () => {
    prismaMock.deal.findUnique.mockResolvedValue(
      buildDealRecord({
        products: [
          {
            id: "dp-hidden",
            quantity: 1,
            productVariantId: null,
            product: buildProduct({ status: "ARCHIVED" }),
          },
        ],
      }),
    );

    const deal = await getDealBySlug("flash-cleaner-deal");

    expect(deal).toBeNull();
  });

  it("filters unpublished deals in the listing", async () => {
    prismaMock.deal.findMany.mockResolvedValue([buildDealRecord()]);

    const deals = await listPublishedDeals();

    // The service's where clause is what enforces publish-state; the mock
    // simply returns the record, so assert the query used the right where.
    const [args] = prismaMock.deal.findMany.mock.calls[0];
    expect(args.where).toEqual({
      status: "PUBLISHED",
      products: {
        some: {
          product: {
            status: "PUBLISHED",
          },
        },
      },
    });
  });

  it("hydrates related deals by ids in input order", async () => {
    prismaMock.deal.findMany.mockResolvedValue([
      buildDealRecord({ id: "deal-b", slug: "b" }),
      buildDealRecord({ id: "deal-a", slug: "a" }),
    ]);

    const deals = await listPublishedDealsByIds(["deal-a", "deal-b", "missing"]);

    expect(deals.map((deal) => deal.id)).toEqual(["deal-a", "deal-b"]);
    const [args] = prismaMock.deal.findMany.mock.calls[0];
    expect(args.where.id.in).toEqual(["deal-a", "deal-b", "missing"]);
  });

  it("returns no related deals when no ids are provided", async () => {
    const deals = await listPublishedDealsByIds([]);

    expect(deals).toEqual([]);
    expect(prismaMock.deal.findMany).not.toHaveBeenCalled();
  });
});
