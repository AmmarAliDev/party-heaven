import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminDealCreateInput } from "@/features/admin/deals/validation";
import { AppError } from "@/lib/errors/app-error";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock)),
  category: {
    findUnique: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  deal: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  dealImage: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  dealProduct: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  dealSpecification: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({
  getPrismaClient: () => prismaMock,
}));

vi.mock("@/features/admin/products", () => ({
  listAdminProductCategories: vi.fn().mockResolvedValue([
    { id: "category-1", name: "Home Care", slug: "home-care", status: "PUBLISHED" },
    { id: "category-2", name: "Grocery", slug: "grocery", status: "PUBLISHED" },
  ]),
}));

import {
  createAdminDeal,
  deleteAdminDeal,
  getAdminDealById,
  getDealErrorCode,
  listAdminDealCategories,
  listAdminDealProducts,
  listAdminRelatedDeals,
  updateAdminDeal,
} from "@/features/admin/deals";

const ACTOR = { actorId: "user-1", actorRole: "SUPER_ADMIN" };

function buildVariant(overrides: Record<string, unknown> = {}) {
  return {
    id: "variant-1",
    title: "Default",
    sku: "SKU-1",
    price: 500,
    compareAtPrice: null,
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
    categoryId: "category-1",
    variants: [buildVariant()],
    ...overrides,
  };
}

function buildDealFormRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "deal-1",
    title: "Flash Cleaner Deal",
    slug: "flash-cleaner-deal",
    shortDescription: null,
    description: null,
    status: "PUBLISHED",
    categoryId: "category-1",
    price: 950,
    compareAtPrice: 1200,
    metadata: { relatedDealIds: [] },
    seoTitle: null,
    seoDescription: null,
    seoCanonicalUrl: null,
    seoOgTitle: null,
    seoOgDescription: null,
    seoImageUrl: null,
    seoNoIndex: false,
    seoSchemaNotes: null,
    createdAt: new Date("2026-08-30T08:00:00.000Z"),
    updatedAt: new Date("2026-08-30T08:00:00.000Z"),
    images: [],
    category: { id: "category-1", name: "Home Care", slug: "home-care" },
    products: [
      {
        id: "dp-1",
        quantity: 2,
        productVariantId: null,
        product: buildProduct(),
      },
    ],
    specifications: [],
    ...overrides,
  };
}

function buildDealFormInput(overrides: Partial<AdminDealCreateInput> = {}): AdminDealCreateInput {
  return {
    title: "Flash Cleaner Deal",
    slug: "flash-cleaner-deal",
    shortDescription: "Two for one clean",
    description: "A longer deal description",
    status: "PUBLISHED",
    categoryId: "category-1",
    price: 950,
    comparePrice: 1200,
    products: [{ productId: "product-1", variantId: undefined, quantity: 2 }],
    images: [],
    specifications: [],
    relatedDealIds: [],
    seoTitle: undefined,
    seoDescription: undefined,
    seoCanonicalUrl: undefined,
    seoOgTitle: undefined,
    seoOgDescription: undefined,
    seoImageUrl: undefined,
    seoNoIndex: false,
    seoSchemaNotes: undefined,
    ...overrides,
  };
}

describe("admin deal service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.deal.create.mockImplementation(async (args: { data: { id?: string } }) => ({
      id: args.data.id ?? "deal-1",
    }));
  });

  it("lists admin deal categories by reusing the product category options", async () => {
    const categories = await listAdminDealCategories();

    expect(categories).toHaveLength(2);
    expect(categories[0]).toMatchObject({ id: "category-1", name: "Home Care" });
  });

  it("lists products (with variant stock) for a category picker", async () => {
    prismaMock.product.findMany.mockResolvedValue([
      {
        id: "product-1",
        name: "Flash Cleaner",
        slug: "flash-cleaner",
        variants: [
          { id: "variant-1", title: "Default", sku: "SKU-1", price: 500, compareAtPrice: null, isDefault: true, inventory: { quantity: 4 } },
          { id: "variant-2", title: "Large", sku: "SKU-2", price: 700, compareAtPrice: null, isDefault: false, inventory: { quantity: 9 } },
        ],
      },
    ]);

    const products = await listAdminDealProducts("category-1");

    expect(products).toHaveLength(1);
    expect(products[0]?.hasMultipleVariants).toBe(true);
    expect(products[0]?.variants[0]).toMatchObject({ id: "variant-1", stock: 4 });
    expect(products[0]?.variants[1]).toMatchObject({ id: "variant-2", stock: 9 });
  });

  it("rejects creating a deal when a product quantity exceeds its stock", async () => {
    prismaMock.category.findUnique.mockResolvedValue({ id: "category-1" });
    prismaMock.product.findMany.mockResolvedValue([buildProduct()]);

    await expect(
      createAdminDeal({
        actor: ACTOR,
        data: buildDealFormInput({
          price: 950,
          products: [{ productId: "product-1", variantId: undefined, quantity: 11 }],
        }),
      }),
    ).rejects.toMatchObject({ code: "DEAL_STOCK_EXCEEDED" });

    expect(prismaMock.deal.create).not.toHaveBeenCalled();
  });

  it("uses the selected variant stock when a variant is linked", async () => {
    prismaMock.category.findUnique.mockResolvedValue({ id: "category-1" });
    prismaMock.product.findMany.mockResolvedValue([
      buildProduct({
        variants: [
          buildVariant({ id: "variant-1", inventory: { quantity: 10 } }),
          buildVariant({ id: "variant-2", title: "Large", isDefault: false, inventory: { quantity: 2 } }),
        ],
      }),
    ]);

    prismaMock.deal.findUnique.mockResolvedValue(
      buildDealFormRow({
        products: [
          {
            id: "dp-1",
            quantity: 2,
            productVariantId: "variant-2",
            product: buildProduct({
              variants: [
                buildVariant({ id: "variant-1", inventory: { quantity: 10 } }),
                buildVariant({ id: "variant-2", title: "Large", isDefault: false, inventory: { quantity: 2 } }),
              ],
            }),
          },
        ],
      }),
    );

    const created = await createAdminDeal({
      actor: ACTOR,
      data: buildDealFormInput({
        products: [{ productId: "product-1", variantId: "variant-2", quantity: 2 }],
        images: [{ url: "https://example.com/deal.jpg", alt: "Deal image" }],
      }),
    });

    expect(created.products[0]?.variantId).toBe("variant-2");
    expect(created.products[0]?.availableStock).toBe(2);
    expect(prismaMock.dealProduct.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            productId: "product-1",
            productVariantId: "variant-2",
            quantity: 2,
          }),
        ]),
      }),
    );
  });

  it("throws a category mismatch error when a product is not in the selected category", async () => {
    prismaMock.category.findUnique.mockResolvedValue({ id: "category-2" });
    prismaMock.product.findMany.mockResolvedValue([buildProduct({ categoryId: "category-1" })]);

    await expect(
      createAdminDeal({
        actor: ACTOR,
        data: buildDealFormInput({
          title: "Bad Deal",
          slug: "bad-deal",
          status: "DRAFT",
          categoryId: "category-2",
          price: 100,
          products: [{ productId: "product-1", variantId: undefined, quantity: 1 }],
        }),
      }),
    ).rejects.toMatchObject({ code: "DEAL_PRODUCT_CATEGORY_MISMATCH" });
  });

  it("rejects an explicit variant that does not belong to the product", async () => {
    prismaMock.category.findUnique.mockResolvedValue({ id: "category-1" });
    prismaMock.product.findMany.mockResolvedValue([buildProduct()]);

    await expect(
      createAdminDeal({
        actor: ACTOR,
        data: buildDealFormInput({
          title: "Bad Variant Deal",
          slug: "bad-variant-deal",
          status: "DRAFT",
          price: 100,
          products: [{ productId: "product-1", variantId: "variant-999", quantity: 1 }],
        }),
      }),
    ).rejects.toMatchObject({ code: "DEAL_VARIANT_INVALID" });
  });

  it("returns the edit form record with resolved stock for a variant deal", async () => {
    prismaMock.deal.findUnique.mockResolvedValue(
      buildDealFormRow({
        description: "A great deal",
        images: [{ url: "https://example.com/deal.jpg", alt: "Deal image" }],
        products: [
          {
            id: "dp-1",
            quantity: 3,
            productVariantId: "variant-2",
            product: buildProduct({
              variants: [
                buildVariant({ id: "variant-1", inventory: { quantity: 10 } }),
                buildVariant({ id: "variant-2", title: "Large", isDefault: false, inventory: { quantity: 2 } }),
              ],
            }),
          },
        ],
      }),
    );

    const record = await getAdminDealById("deal-1");

    expect(record).not.toBeNull();
    expect(record?.products[0]?.variantId).toBe("variant-2");
    expect(record?.products[0]?.variantTitle).toBe("Large");
    expect(record?.products[0]?.availableStock).toBe(2);
    expect(record?.availableStock).toBe(2);
    expect(record?.price).toBe(950);
    expect(record?.images[0]).toMatchObject({ url: "https://example.com/deal.jpg" });
  });

  it("updates an existing deal and replaces its products, images, and specifications", async () => {
    prismaMock.deal.findUnique
      .mockResolvedValueOnce({ id: "deal-1", title: "Old", slug: "old", status: "DRAFT" })
      .mockResolvedValueOnce(
        buildDealFormRow({
          images: [{ url: "https://example.com/new.jpg", alt: "New" }],
          specifications: [{ key: "Included", value: "Bundle" }],
        }),
      );

    prismaMock.category.findUnique.mockResolvedValue({ id: "category-1" });
    prismaMock.product.findMany.mockResolvedValue([buildProduct()]);

    const updated = await updateAdminDeal({
      actor: ACTOR,
      data: {
        id: "deal-1",
        ...buildDealFormInput({
          products: [{ productId: "product-1", variantId: undefined, quantity: 1 }],
          images: [{ url: "https://example.com/new.jpg", alt: "New" }],
          specifications: [{ key: "Included", value: "Bundle" }],
        }),
      },
    });

    expect(updated.title).toBe("Flash Cleaner Deal");
    expect(prismaMock.dealProduct.deleteMany).toHaveBeenCalledWith({ where: { dealId: "deal-1" } });
    expect(prismaMock.dealProduct.createMany).toHaveBeenCalled();
    expect(prismaMock.dealImage.deleteMany).toHaveBeenCalledWith({ where: { dealId: "deal-1" } });
    expect(prismaMock.dealImage.createMany).toHaveBeenCalled();
    expect(prismaMock.dealSpecification.deleteMany).toHaveBeenCalledWith({ where: { dealId: "deal-1" } });
    expect(prismaMock.dealSpecification.createMany).toHaveBeenCalled();
  });

  it("searches related deals and pins selected deals to the top", async () => {
    prismaMock.deal.findMany.mockResolvedValueOnce([
      { id: "deal-search", title: "Search Deal", slug: "search-deal", category: { name: "Grocery" } },
    ]);
    prismaMock.deal.findMany.mockResolvedValueOnce([
      { id: "deal-pinned", title: "Pinned Deal", slug: "pinned-deal", category: { name: "Home Care" } },
    ]);

    const deals = await listAdminRelatedDeals({
      query: "search",
      categoryId: "category-2",
      excludeDealId: "deal-1",
      selectedIds: ["deal-pinned"],
    });

    expect(deals.map((deal) => deal.id)).toEqual(["deal-pinned", "deal-search"]);
    expect(deals[0]).toMatchObject({ title: "Pinned Deal", categoryName: "Home Care" });
  });

  it("deletes a deal and its related rows", async () => {
    prismaMock.deal.findUnique.mockResolvedValue({
      id: "deal-1",
      title: "Flash Cleaner Deal",
      slug: "flash-cleaner-deal",
      status: "PUBLISHED",
    });

    await deleteAdminDeal({ dealId: "deal-1", actor: ACTOR });

    expect(prismaMock.dealImage.deleteMany).toHaveBeenCalledWith({ where: { dealId: "deal-1" } });
    expect(prismaMock.dealProduct.deleteMany).toHaveBeenCalledWith({ where: { dealId: "deal-1" } });
    expect(prismaMock.dealSpecification.deleteMany).toHaveBeenCalledWith({ where: { dealId: "deal-1" } });
    expect(prismaMock.deal.delete).toHaveBeenCalledWith({ where: { id: "deal-1" } });
  });

  it("maps AppError codes to friendly flash codes", () => {
    const error = new AppError("Deal quantity exceeds available stock.", "DEAL_STOCK_EXCEEDED", {});

    expect(getDealErrorCode(error, "createFailed")).toBe("stockExceeded");
  });
});
