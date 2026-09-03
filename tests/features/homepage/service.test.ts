import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  homePageSection: {
    findMany: vi.fn(),
  },
  orderItem: {
    groupBy: vi.fn(),
  },
  banner: {
    findMany: vi.fn(),
  },
  dealCampaign: {
    findMany: vi.fn(),
  },
}));

const mockGetCatalogCategories = vi.hoisted(() => vi.fn());
const mockListAllPublishedProducts = vi.hoisted(() => vi.fn());
const mockListPublishedProductsByIds = vi.hoisted(() => vi.fn());
const mockListPublishedDeals = vi.hoisted(() => vi.fn());

vi.mock("@/server/db", () => ({
  getPrismaClient: () => prismaMock,
}));

vi.mock("@/features/catalog", () => ({
  getCatalogCategories: (...args: unknown[]) => mockGetCatalogCategories(...args),
}));

vi.mock("@/features/deals", () => ({
  listPublishedDeals: (...args: unknown[]) => mockListPublishedDeals(...args),
}));

vi.mock("@/server/db/catalog-queries", () => ({
  listAllPublishedProducts: (...args: unknown[]) => mockListAllPublishedProducts(...args),
  listPublishedProductsByIds: (...args: unknown[]) => mockListPublishedProductsByIds(...args),
}));

import { getHomepageContent } from "@/features/homepage";
import type { StorefrontProductRecord } from "@/server/db/catalog-queries";

function buildStorefrontProductRecord(
  id: string,
  overrides: Partial<StorefrontProductRecord> = {},
): StorefrontProductRecord {
  return {
    id,
    name: `Product ${id}`,
    slug: `product-${id}`,
    shortDescription: `Short description for ${id}`,
    description: `Long description for ${id}`,
    masterSku: null,
    metadata: null,
    createdAt: new Date("2026-05-04T08:00:00.000Z"),
    updatedAt: new Date("2026-05-04T08:00:00.000Z"),
    category: {
      id: `category-${id}`,
      name: "Category",
      slug: "category",
    },
    images: [
      {
        id: `image-${id}`,
        url: `https://cdn.example.com/${id}.jpg`,
        alt: `Image ${id}`,
        position: 0,
        productVariantId: null,
      },
    ],
    specifications: [],
    variants: [
      {
        id: `variant-${id}`,
        title: null,
        sku: `SKU-${id}`,
        options: null,
        price: 1000,
        compareAtPrice: 1200,
        isDefault: true,
        inventory: {
          quantity: 12,
        },
      },
    ],
    reviews: [],
    ...overrides,
  };
}

describe("homepage CMS service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.orderItem.groupBy.mockResolvedValue([]);
    prismaMock.banner.findMany.mockResolvedValue([]);
    prismaMock.dealCampaign.findMany.mockResolvedValue([]);
    mockGetCatalogCategories.mockResolvedValue([]);
    mockListAllPublishedProducts.mockResolvedValue([]);
    mockListPublishedProductsByIds.mockResolvedValue([]);
    // Default: no published deals so Featured Deals section hydrates with []
    mockListPublishedDeals.mockResolvedValue([]);
  });

  it("reflects valid admin homepage content on the storefront contract", async () => {
    prismaMock.homePageSection.findMany.mockResolvedValue([
      {
        id: "section-announcement",
        key: "announcement-primary",
        title: "Announcement",
        type: "announcement-bar",
        content: {
          message: "Admin managed announcement",
          href: "/categories",
          label: "Shop now",
        },
        meta: {
          enabled: true,
        },
        position: 10,
        active: true,
        createdAt: new Date("2026-04-20T08:00:00.000Z"),
        updatedAt: new Date("2026-04-20T08:00:00.000Z"),
      },
    ]);

    const result = await getHomepageContent();

    expect(result.source).toBe("cms");
    expect(result.sections[0]).toMatchObject({
      kind: "announcement-bar",
      message: "Admin managed announcement",
      href: "/categories",
      label: "Shop now",
    });
  });

  it("falls back safely when all admin homepage records are inactive", async () => {
    prismaMock.homePageSection.findMany.mockResolvedValue([
      {
        id: "section-categories-disabled",
        key: "categories-disabled",
        title: "Featured categories",
        type: "featured-categories",
        content: {
          description: "Should not render.",
          categories: [],
        },
        meta: {},
        position: 10,
        active: false,
        createdAt: new Date("2026-04-20T08:00:00.000Z"),
        updatedAt: new Date("2026-04-20T08:00:00.000Z"),
      },
      {
        id: "section-deal-disabled",
        key: "deal-disabled",
        title: "Deal spotlight",
        type: "deal-spotlight",
        content: {
          description: "Should not render.",
          dealLabel: "Inactive",
          price: 899,
          compareAt: 1099,
          ctaLabel: "View",
          ctaHref: "/categories",
        },
        meta: {},
        position: 40,
        active: false,
        createdAt: new Date("2026-04-20T08:00:00.000Z"),
        updatedAt: new Date("2026-04-20T08:00:00.000Z"),
      },
    ]);

    const result = await getHomepageContent();

    expect(result.source).toBe("fallback");
    expect(result.sections.some((section) => section.id === "categories-disabled")).toBe(false);
    expect(result.sections.some((section) => section.id === "deal-disabled")).toBe(false);
    expect(result.sections.some((section) => section.kind === "deal-spotlight")).toBe(false);
  });

  it("keeps baseline homepage sections when only admin banners are active", async () => {
    prismaMock.homePageSection.findMany.mockResolvedValue([]);
    prismaMock.banner.findMany.mockResolvedValue([
      {
        id: "banner-1",
        title: "Weekend sale is live",
        imageUrl: "https://store.public.blob.vercel-storage.com/admin/banner/weekend-sale.png",
        href: "/categories",
        position: 1,
        active: true,
        startAt: null,
        endAt: null,
        createdAt: new Date("2026-05-04T08:00:00.000Z"),
        updatedAt: new Date("2026-05-04T08:00:00.000Z"),
      },
    ]);

    const result = await getHomepageContent();

    expect(result.source).toBe("cms");
    expect(result.sections.some((section) => section.id === "banner-banner-1" && section.kind === "announcement-bar")).toBe(true);
    expect(result.sections.some((section) => section.kind === "featured-categories")).toBe(true);
    expect(result.sections.some((section) => section.kind === "featured-products")).toBe(true);
  });

  it("keeps baseline homepage sections when admin content is only banners and campaign deal overlays", async () => {
    prismaMock.homePageSection.findMany.mockResolvedValue([]);
    prismaMock.banner.findMany.mockResolvedValue([
      {
        id: "banner-2",
        title: "Limited offer this week",
        imageUrl: "https://store.public.blob.vercel-storage.com/admin/banner/limited-offer.png",
        href: "/categories",
        position: 1,
        active: true,
        startAt: null,
        endAt: null,
        createdAt: new Date("2026-05-04T08:00:00.000Z"),
        updatedAt: new Date("2026-05-04T08:00:00.000Z"),
      },
    ]);
    prismaMock.dealCampaign.findMany.mockResolvedValue([
      {
        id: "campaign-1",
        name: "Weekend campaign",
        description: "Campaign deal block",
        targetHref: null,
        imageUrl: null,
        imageAlt: null,
        active: true,
        startsAt: null,
        endsAt: null,
        updatedAt: new Date("2026-05-04T08:00:00.000Z"),
        products: [],
      },
    ]);

    const result = await getHomepageContent();

    expect(result.source).toBe("cms");
    expect(result.sections.some((section) => section.id === "banner-banner-2" && section.kind === "announcement-bar")).toBe(true);
    expect(result.sections.some((section) => section.id === "campaign-campaign-1" && section.kind === "deal-spotlight")).toBe(true);
    expect(result.sections.some((section) => section.kind === "featured-categories")).toBe(true);
    expect(result.sections.some((section) => section.id === "fallback-deal-spotlight")).toBe(false);
  });

  it("uses campaign targetHref and image fields when provided", async () => {
    prismaMock.homePageSection.findMany.mockResolvedValue([]);
    prismaMock.banner.findMany.mockResolvedValue([]);
    prismaMock.dealCampaign.findMany.mockResolvedValue([
      {
        id: "campaign-targeted",
        name: "Targeted campaign",
        description: "Direct campaign destination",
        price: 1399,
        compareAt: 1699,
        targetHref: "/categories/party-heaven/flash-cleaner",
        imageUrl: "https://store.public.blob.vercel-storage.com/admin/content/campaign-targeted.png",
        imageAlt: "Campaign featured product collage",
        active: true,
        startsAt: null,
        endsAt: null,
        updatedAt: new Date("2026-05-05T08:00:00.000Z"),
        products: [],
      },
    ]);

    const result = await getHomepageContent();
    const section = result.sections.find((entry) => entry.id === "campaign-campaign-targeted");

    expect(section).toMatchObject({
      kind: "deal-spotlight",
      price: 1399,
      compareAt: 1699,
      ctaHref: "/categories/party-heaven/flash-cleaner",
      image: {
        url: "https://store.public.blob.vercel-storage.com/admin/content/campaign-targeted.png",
        alt: "Campaign featured product collage",
      },
    });
  });

  it("falls back to linked campaign product URL and image when explicit target/image are missing or invalid", async () => {
    prismaMock.homePageSection.findMany.mockResolvedValue([]);
    prismaMock.banner.findMany.mockResolvedValue([]);
    prismaMock.dealCampaign.findMany.mockResolvedValue([
      {
        id: "campaign-product-fallback",
        name: "Fallback campaign",
        description: "Derived from linked product",
        targetHref: "javascript:alert(1)",
        imageUrl: null,
        imageAlt: null,
        active: true,
        startsAt: null,
        endsAt: null,
        updatedAt: new Date("2026-05-05T08:00:00.000Z"),
        products: [
          {
            product: {
              slug: "flash-cleaner",
              category: {
                slug: "home-care",
              },
              images: [
                {
                  url: "https://store.public.blob.vercel-storage.com/admin/content/flash-cleaner.png",
                  alt: "Flash cleaner bottle",
                },
              ],
              variants: [
                {
                  price: 799,
                  compareAtPrice: 999,
                },
              ],
            },
          },
        ],
      },
    ]);

    const result = await getHomepageContent();
    const section = result.sections.find((entry) => entry.id === "campaign-campaign-product-fallback");

    expect(section).toMatchObject({
      kind: "deal-spotlight",
      price: 799,
      compareAt: 999,
      ctaHref: "/categories/home-care/flash-cleaner",
      image: {
        url: "https://store.public.blob.vercel-storage.com/admin/content/flash-cleaner.png",
        alt: "Flash cleaner bottle",
      },
    });
  });

  it("renders zero pricing when linked campaign product pricing is missing", async () => {
    prismaMock.homePageSection.findMany.mockResolvedValue([]);
    prismaMock.banner.findMany.mockResolvedValue([]);
    prismaMock.dealCampaign.findMany.mockResolvedValue([
      {
        id: "campaign-missing-pricing",
        name: "Missing pricing campaign",
        description: "No variant pricing available",
        targetHref: null,
        imageUrl: null,
        imageAlt: null,
        active: true,
        startsAt: null,
        endsAt: null,
        updatedAt: new Date("2026-05-05T08:00:00.000Z"),
        products: [
          {
            product: {
              slug: "flash-cleaner",
              category: {
                slug: "home-care",
              },
              images: [],
              variants: [],
            },
          },
        ],
      },
    ]);

    const result = await getHomepageContent();
    const section = result.sections.find((entry) => entry.id === "campaign-campaign-missing-pricing");

    expect(section).toMatchObject({
      kind: "deal-spotlight",
      price: 0,
      compareAt: 0,
      ctaHref: "/categories/home-care/flash-cleaner",
    });
  });

  it("keeps compare-at equal to price when linked campaign compare-at is absent or invalid", async () => {
    prismaMock.homePageSection.findMany.mockResolvedValue([]);
    prismaMock.banner.findMany.mockResolvedValue([]);
    prismaMock.dealCampaign.findMany.mockResolvedValue([
      {
        id: "campaign-no-discount",
        name: "No discount campaign",
        description: "Compare-at should not exceed real data",
        targetHref: null,
        imageUrl: null,
        imageAlt: null,
        active: true,
        startsAt: null,
        endsAt: null,
        updatedAt: new Date("2026-05-05T08:00:00.000Z"),
        products: [
          {
            product: {
              slug: "flash-cleaner",
              category: {
                slug: "home-care",
              },
              images: [],
              variants: [
                {
                  price: 899,
                  compareAtPrice: 799,
                },
              ],
            },
          },
        ],
      },
    ]);

    const result = await getHomepageContent();
    const section = result.sections.find((entry) => entry.id === "campaign-campaign-no-discount");

    expect(section).toMatchObject({
      kind: "deal-spotlight",
      price: 899,
      compareAt: 899,
    });
  });

  /**
   * Regression test for: adding a standalone deal-spotlight section from admin
   * caused all other homepage sections (featured-categories, etc.) to
   * disappear because the resolver treated deal-spotlight as a "primary"
   * section and returned only CMS sections without fallback merging.
   *
   * Fix: deal-spotlight is now always an overlay section (like announcement-bar)
   * and never prevents fallback section merging on its own.
   */
  it("keeps baseline homepage sections when only a standalone admin deal-spotlight exists", async () => {
    prismaMock.homePageSection.findMany.mockResolvedValue([
      {
        id: "section-deal-1",
        key: "deal-spotlight-weekly",
        title: "Weekly Deal",
        type: "deal-spotlight",
        content: {
          description: "Grab this week's best deal.",
          dealLabel: "Deal of the Week",
          price: 799,
          compareAt: 1200,
          ctaLabel: "Shop now",
          ctaHref: "/categories/grocery/rice-bag",
        },
        meta: {},
        position: 40,
        active: true,
        createdAt: new Date("2026-05-04T08:00:00.000Z"),
        updatedAt: new Date("2026-05-04T08:00:00.000Z"),
      },
    ]);

    const result = await getHomepageContent();

    // The deal-spotlight section from admin must be present.
    expect(result.source).toBe("cms");
    expect(
      result.sections.some((section) => section.id === "deal-spotlight-weekly" && section.kind === "deal-spotlight"),
    ).toBe(true);

    // All primary homepage sections must still be present via fallback merging.
    expect(result.sections.some((section) => section.kind === "featured-categories")).toBe(true);
    expect(result.sections.some((section) => section.kind === "featured-products")).toBe(true);

    // The fallback deal-spotlight must NOT duplicate the admin-managed one.
    expect(result.sections.filter((section) => section.kind === "deal-spotlight")).toHaveLength(1);
  });

  it("skips malformed banners safely and falls back when they are the only admin content", async () => {
    prismaMock.homePageSection.findMany.mockResolvedValue([]);
    prismaMock.banner.findMany.mockResolvedValue([
      {
        id: "banner-invalid",
        title: "   ",
        imageUrl: "https://store.public.blob.vercel-storage.com/admin/banner/invalid.png",
        href: "javascript:alert('xss')",
        position: 1,
        active: true,
        startAt: null,
        endAt: null,
        createdAt: new Date("2026-05-04T08:00:00.000Z"),
        updatedAt: new Date("2026-05-04T08:00:00.000Z"),
      },
    ]);

    const result = await getHomepageContent();

    expect(result.source).toBe("fallback");
    expect(result.sections.some((section) => section.id === "banner-banner-invalid")).toBe(false);
  });

  it("keeps homepage stable when banners are removed and no admin content remains", async () => {
    prismaMock.homePageSection.findMany.mockResolvedValue([]);
    prismaMock.banner.findMany.mockResolvedValue([]);
    prismaMock.dealCampaign.findMany.mockResolvedValue([]);

    const result = await getHomepageContent();

    expect(result.source).toBe("fallback");
    expect(result.sections.some((section) => section.kind === "deal-spotlight")).toBe(false);
    expect(result.sections.some((section) => section.id.startsWith("banner-"))).toBe(false);
    expect(result.sections.some((section) => section.id.startsWith("campaign-"))).toBe(false);
  });

  it("hydrates featured categories from DB-backed catalog categories", async () => {
    prismaMock.homePageSection.findMany.mockResolvedValue([
      {
        id: "section-featured-categories",
        key: "featured-categories-home",
        title: "Featured categories",
        type: "featured-categories",
        content: {
          description: "Legacy fallback categories",
          categories: [
            {
              id: "legacy-category",
              title: "Legacy category",
              description: "Legacy content",
              href: "/categories/legacy-category",
            },
          ],
        },
        meta: { enabled: true },
        position: 20,
        active: true,
        createdAt: new Date("2026-05-04T08:00:00.000Z"),
        updatedAt: new Date("2026-05-04T08:00:00.000Z"),
      },
    ]);

    mockGetCatalogCategories.mockResolvedValue([
      {
        id: "category-home-care",
        name: "Home Care",
        slug: "home-care",
        description: "Cleaning and household essentials.",
        cardImageUrl: "/images/home-care.png",
        seoTitle: undefined,
        seoDescription: undefined,
        productCount: 18,
        href: "/categories/home-care",
      },
    ]);

    const result = await getHomepageContent();
    const categorySection = result.sections.find((section) => section.kind === "featured-categories");

    expect(categorySection).toMatchObject({
      kind: "featured-categories",
      categories: [
        {
          id: "category-home-care",
          name: "Home Care",
          slug: "home-care",
          description: "Cleaning and household essentials.",
          href: "/categories/home-care",
          cardImageUrl: "/images/home-care.png",
        },
      ],
    });
  });

  it("preserves normalized fallback categories when the catalog category read is unavailable", async () => {
    prismaMock.homePageSection.findMany.mockResolvedValue([
      {
        id: "section-featured-categories",
        key: "featured-categories-home",
        title: "Featured categories",
        type: "featured-categories",
        content: {
          description: "Legacy fallback categories",
          categories: [
            {
              id: "legacy-category",
              title: "Legacy category",
              description: "Legacy content",
              href: "/categories/legacy-category",
            },
          ],
        },
        meta: { enabled: true },
        position: 20,
        active: true,
        createdAt: new Date("2026-05-04T08:00:00.000Z"),
        updatedAt: new Date("2026-05-04T08:00:00.000Z"),
      },
    ]);

    mockGetCatalogCategories.mockRejectedValue(new Error("Catalog DB unavailable"));

    const result = await getHomepageContent();
    const categorySection = result.sections.find((section) => section.kind === "featured-categories");

    expect(categorySection).toMatchObject({
      kind: "featured-categories",
      categories: [
        {
          id: "legacy-category",
          name: "Legacy category",
          description: "Legacy content",
          href: "/categories/legacy-category",
        },
      ],
    });

    expect(categorySection?.categories[0]).not.toHaveProperty("title");
  });

  it("normalizes legacy featured-category imageUrl fields into cardImageUrl when catalog hydration is unavailable", async () => {
    prismaMock.homePageSection.findMany.mockResolvedValue([
      {
        id: "section-featured-categories",
        key: "featured-categories-home",
        title: "Featured categories",
        type: "featured-categories",
        content: {
          description: "Legacy fallback categories",
          categories: [
            {
              id: "legacy-category",
              title: "Legacy category",
              description: "Legacy content",
              href: "/categories/legacy-category",
              imageUrl: "https://cdn.example.com/categories/legacy-category.jpg",
            },
          ],
        },
        meta: { enabled: true },
        position: 20,
        active: true,
        createdAt: new Date("2026-05-04T08:00:00.000Z"),
        updatedAt: new Date("2026-05-04T08:00:00.000Z"),
      },
    ]);

    mockGetCatalogCategories.mockRejectedValue(new Error("Catalog DB unavailable"));

    const result = await getHomepageContent();
    const categorySection = result.sections.find((section) => section.kind === "featured-categories");

    expect(categorySection).toMatchObject({
      kind: "featured-categories",
      categories: [
        {
          id: "legacy-category",
          name: "Legacy category",
          description: "Legacy content",
          href: "/categories/legacy-category",
          cardImageUrl: "https://cdn.example.com/categories/legacy-category.jpg",
        },
      ],
    });

    expect(categorySection?.categories[0]).not.toHaveProperty("imageUrl");
  });

  it("hydrates Featured Deals section with live deals", async () => {
    prismaMock.homePageSection.findMany.mockResolvedValue([
      {
        id: "section-featured-deals",
        key: "featured-deals-home",
        title: "Featured Deals",
        type: "featured-deals",
        content: {
          description: "Hand-picked deals",
          ctaLabel: "View all",
          ctaHref: "/deals",
          placeholderMessage: "No Featured Deals right now.",
        },
        meta: { enabled: true },
        position: 25,
        active: true,
        createdAt: new Date("2026-08-30T08:00:00.000Z"),
        updatedAt: new Date("2026-08-30T08:00:00.000Z"),
      },
    ]);

    mockListPublishedDeals.mockResolvedValue([
      {
        id: "deal-1",
        slug: "cheap-soap-bundle",
        title: "Cheap Soap Bundle",
        shortDescription: "Two bars for the price of one",
        status: "PUBLISHED",
        categorySlug: "personal-care",
        price: 250,
        compareAt: 350,
        images: [
          {
            url: "https://store.public.blob.vercel-storage.com/admin/deals/soap.png",
            alt: "Cheap Soap Bundle",
          },
        ],
        products: [
          {
            id: "prod-1",
            name: "Cheap Soap",
            slug: "cheap-soap",
            href: "/categories/personal-care/cheap-soap",
            variantTitle: null,
            quantity: 2,
            availableStock: 10,
            isAvailable: true,
          },
        ],
        specifications: [],
        relatedDealIds: [],
        availableStock: 10,
        isAvailable: true,
        isLowStock: false,
      },
    ]);

    const result = await getHomepageContent();
    const featuredDealsSection = result.sections.find((section) => section.kind === "featured-deals");

    expect(featuredDealsSection).toMatchObject({
      kind: "featured-deals",
      title: "Featured Deals",
      deals: [
        {
          id: "deal-1",
          slug: "cheap-soap-bundle",
          title: "Cheap Soap Bundle",
          href: "/deals/cheap-soap-bundle",
          price: 250,
          compareAt: 350,
          productSummary: "Cheap Soap",
          itemCount: 1,
          isAvailable: true,
        },
      ],
    });
  });

  it("renders Featured Deals section empty state gracefully when deals fetch fails", async () => {
    prismaMock.homePageSection.findMany.mockResolvedValue([
      {
        id: "section-featured-deals",
        key: "featured-deals-home",
        title: "Featured Deals",
        type: "featured-deals",
        content: {
          ctaLabel: "View all",
          ctaHref: "/deals",
          placeholderMessage: "No deals right now.",
        },
        meta: { enabled: true },
        position: 25,
        active: true,
        createdAt: new Date("2026-08-30T08:00:00.000Z"),
        updatedAt: new Date("2026-08-30T08:00:00.000Z"),
      },
    ]);

    mockListPublishedDeals.mockRejectedValue(new Error("Deals DB unavailable"));

    const result = await getHomepageContent();
    const featuredDealsSection = result.sections.find((section) => section.kind === "featured-deals");

    // Section must still be present; deals array will be empty (not hydrated)
    expect(featuredDealsSection).toMatchObject({
      kind: "featured-deals",
      deals: [],
    });
  });

  it("hydrates featured products from the top 5 most-sold published products", async () => {
    prismaMock.homePageSection.findMany.mockResolvedValue([
      {
        id: "section-featured-products",
        key: "featured-products-home",
        title: "Featured products",
        type: "featured-products",
        content: {
          description: "Legacy fallback products",
          products: [
            {
              id: "fallback-1",
              name: "Fallback product",
              href: "/preview",
              price: 999,
            },
          ],
        },
        meta: { enabled: true },
        position: 30,
        active: true,
        createdAt: new Date("2026-05-04T08:00:00.000Z"),
        updatedAt: new Date("2026-05-04T08:00:00.000Z"),
      },
    ]);

    prismaMock.orderItem.groupBy.mockResolvedValue([
      { productId: "product-4", _sum: { quantity: 40 }, _count: { _all: 4 } },
      { productId: "product-2", _sum: { quantity: 30 }, _count: { _all: 3 } },
      { productId: "product-5", _sum: { quantity: 20 }, _count: { _all: 2 } },
      { productId: "product-1", _sum: { quantity: 10 }, _count: { _all: 1 } },
      { productId: "product-3", _sum: { quantity: 5 }, _count: { _all: 1 } },
    ]);

    mockListPublishedProductsByIds.mockResolvedValue([
      buildStorefrontProductRecord("product-1"),
      buildStorefrontProductRecord("product-5"),
      buildStorefrontProductRecord("product-2"),
      buildStorefrontProductRecord("product-4"),
      buildStorefrontProductRecord("product-3"),
    ]);

    const result = await getHomepageContent();
    const featuredProductsSection = result.sections.find((section) => section.kind === "featured-products");

    expect(featuredProductsSection).toMatchObject({
      kind: "featured-products",
      products: [
        {
          id: "product-4",
          name: "Product product-4",
          href: "/categories/category/product-product-4",
          price: 1000,
          compareAt: 1200,
          badge: "Best seller",
        },
        {
          id: "product-2",
          name: "Product product-2",
          href: "/categories/category/product-product-2",
          price: 1000,
          compareAt: 1200,
          badge: "Best seller",
        },
        {
          id: "product-5",
          name: "Product product-5",
          href: "/categories/category/product-product-5",
          price: 1000,
          compareAt: 1200,
          badge: "Best seller",
        },
        {
          id: "product-1",
          name: "Product product-1",
          href: "/categories/category/product-product-1",
          price: 1000,
          compareAt: 1200,
          badge: "Best seller",
        },
        {
          id: "product-3",
          name: "Product product-3",
          href: "/categories/category/product-product-3",
          price: 1000,
          compareAt: 1200,
          badge: "Best seller",
        },
      ],
    });

    expect(featuredProductsSection?.products).toHaveLength(5);
  });

  it("filters non-published sold products and fills remaining slots from published catalog products", async () => {
    prismaMock.homePageSection.findMany.mockResolvedValue([
      {
        id: "section-featured-products",
        key: "featured-products-home",
        title: "Featured products",
        type: "featured-products",
        content: {
          description: "Top sellers",
          products: [],
        },
        meta: { enabled: true },
        position: 30,
        active: true,
        createdAt: new Date("2026-05-04T08:00:00.000Z"),
        updatedAt: new Date("2026-05-04T08:00:00.000Z"),
      },
    ]);

    prismaMock.orderItem.groupBy.mockResolvedValue([
      { productId: "product-1", _sum: { quantity: 18 }, _count: { _all: 2 } },
      { productId: "product-2", _sum: { quantity: 17 }, _count: { _all: 2 } },
      { productId: "product-3", _sum: { quantity: 16 }, _count: { _all: 2 } },
      { productId: "product-4", _sum: { quantity: 15 }, _count: { _all: 2 } },
    ]);

    mockListPublishedProductsByIds.mockResolvedValue([buildStorefrontProductRecord("product-2")]);
    mockListAllPublishedProducts.mockResolvedValue([
      buildStorefrontProductRecord("product-2"),
      buildStorefrontProductRecord("product-5"),
      buildStorefrontProductRecord("product-6"),
      buildStorefrontProductRecord("product-7"),
    ]);

    const result = await getHomepageContent();
    const featuredProductsSection = result.sections.find((section) => section.kind === "featured-products");

    expect(featuredProductsSection).toMatchObject({
      kind: "featured-products",
      products: [
        { id: "product-2", badge: "Best seller" },
        { id: "product-5", badge: "Best seller" },
        { id: "product-6", badge: "Best seller" },
        { id: "product-7", badge: "Best seller" },
      ],
    });
  });

  it("uses stored fallback featured products when meaningful sales data is still sparse", async () => {
    prismaMock.homePageSection.findMany.mockResolvedValue([
      {
        id: "section-featured-products",
        key: "featured-products-home",
        title: "Featured products",
        type: "featured-products",
        content: {
          description: "Top sellers",
          products: [
            {
              id: "fallback-1",
              name: "Fallback One",
              description: "Pinned while sales mature.",
              href: "/categories/home-care/fallback-one",
              price: 1100,
            },
            {
              id: "fallback-2",
              name: "Fallback Two",
              href: "/categories/home-care/fallback-two",
              price: 1200,
            },
            {
              id: "fallback-3",
              name: "Fallback Three",
              href: "/categories/home-care/fallback-three",
              price: 1300,
            },
            {
              id: "fallback-4",
              name: "Fallback Four",
              href: "/categories/home-care/fallback-four",
              price: 1400,
            },
          ],
        },
        meta: { enabled: true },
        position: 30,
        active: true,
        createdAt: new Date("2026-05-04T08:00:00.000Z"),
        updatedAt: new Date("2026-05-04T08:00:00.000Z"),
      },
    ]);

    prismaMock.orderItem.groupBy.mockResolvedValue([
      { productId: "product-9", _sum: { quantity: 8 }, _count: { _all: 1 } },
    ]);

    mockListPublishedProductsByIds.mockResolvedValue([buildStorefrontProductRecord("product-9")]);
    mockListAllPublishedProducts.mockResolvedValue([]);

    const result = await getHomepageContent();
    const featuredProductsSection = result.sections.find((section) => section.kind === "featured-products");

    expect(featuredProductsSection).toMatchObject({
      kind: "featured-products",
      products: [
        { id: "product-9", badge: "Best seller" },
        { id: "fallback-1" },
        { id: "fallback-2" },
        { id: "fallback-3" },
        { id: "fallback-4" },
      ],
    });

    expect(featuredProductsSection?.products).toHaveLength(5);
  });

  it("prefers recent published catalog products over stored fallback content when sales are sparse", async () => {
    prismaMock.homePageSection.findMany.mockResolvedValue([
      {
        id: "section-featured-products",
        key: "featured-products-home",
        title: "Featured products",
        type: "featured-products",
        content: {
          description: "Top sellers",
          products: [
            {
              id: "fallback-1",
              name: "Fallback One",
              href: "/categories/home-care/fallback-one",
              price: 1100,
            },
            {
              id: "fallback-2",
              name: "Fallback Two",
              href: "/categories/home-care/fallback-two",
              price: 1200,
            },
            {
              id: "fallback-3",
              name: "Fallback Three",
              href: "/categories/home-care/fallback-three",
              price: 1300,
            },
            {
              id: "fallback-4",
              name: "Fallback Four",
              href: "/categories/home-care/fallback-four",
              price: 1400,
            },
          ],
        },
        meta: { enabled: true },
        position: 30,
        active: true,
        createdAt: new Date("2026-05-04T08:00:00.000Z"),
        updatedAt: new Date("2026-05-04T08:00:00.000Z"),
      },
    ]);

    prismaMock.orderItem.groupBy.mockResolvedValue([
      { productId: "product-9", _sum: { quantity: 8 }, _count: { _all: 1 } },
    ]);

    mockListPublishedProductsByIds.mockResolvedValue([buildStorefrontProductRecord("product-9")]);
    // Recent published catalog products exist, so they must fill the remaining
    // slots BEFORE the stored fallback content (fallback items carry no slug and
    // therefore no add-to-cart affordance).
    mockListAllPublishedProducts.mockResolvedValue([
      buildStorefrontProductRecord("product-10"),
      buildStorefrontProductRecord("product-11"),
      buildStorefrontProductRecord("product-12"),
    ]);

    const result = await getHomepageContent();
    const featuredProductsSection = result.sections.find((section) => section.kind === "featured-products");

    expect(featuredProductsSection).toMatchObject({
      kind: "featured-products",
      products: [
        { id: "product-9", badge: "Best seller" },
        { id: "product-10", slug: "product-product-10" },
        { id: "product-11", slug: "product-product-11" },
        { id: "product-12", slug: "product-product-12" },
        { id: "fallback-1" },
      ],
    });

    expect(featuredProductsSection?.products).toHaveLength(5);
  });
});
