import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock)),
  category: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  productVariant: {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  productImage: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
  },
  productSpecification: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  inventory: {
    deleteMany: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  },
  wishlistItem: {
    deleteMany: vi.fn(),
  },
  cartItem: {
    deleteMany: vi.fn(),
  },
  review: {
    deleteMany: vi.fn(),
  },
  dealCampaignProduct: {
    deleteMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({
  getPrismaClient: () => prismaMock,
}));

import {
  createAdminProduct,
  deleteAdminProduct,
  getAdminProductById,
  listAdminProducts,
  listAdminRelatedProducts,
  updateAdminProduct,
} from "@/features/admin/products";

describe("admin product service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads variant-specific images into the admin edit form record", async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      id: "product-1",
      name: "Classic Tee",
      slug: "classic-tee",
      shortDescription: "Soft tee",
      description: "Soft tee with multiple sizes",
      status: "PUBLISHED",
      masterSku: "TEE-CLASSIC",
      seoTitle: null,
      seoDescription: null,
      seoCanonicalUrl: null,
      seoOgTitle: null,
      seoOgDescription: null,
      seoImageUrl: null,
      seoNoIndex: false,
      seoSchemaNotes: null,
      metadata: { variantsEnabled: true, relatedProductIds: [] },
      category: { id: "category-1", name: "Apparel", slug: "apparel" },
      // No product-level images — all media lives on the variants below.
      images: [],
      specifications: [],
      variants: [
        {
          id: "variant-1",
          title: "Small / Blue",
          sku: "TEE-S-BLU",
          options: { Size: "Small", Color: "Blue" },
          price: 799,
          compareAtPrice: null,
          isDefault: true,
          inventory: { quantity: 5 },
        },
        {
          id: "variant-2",
          title: "Medium / Blue",
          sku: "TEE-M-BLU",
          options: { Size: "Medium", Color: "Blue" },
          price: 799,
          compareAtPrice: null,
          isDefault: false,
          inventory: { quantity: 8 },
        },
      ],
      createdAt: new Date("2026-04-17T10:00:00.000Z"),
      updatedAt: new Date("2026-04-17T10:00:00.000Z"),
    });
    prismaMock.productImage.findMany.mockResolvedValue([
      { url: "https://example.com/small-blue.jpg", alt: "Small blue tee", position: 0, productVariantId: "variant-1" },
      { url: "https://example.com/medium-blue.jpg", alt: "Medium blue tee", position: 1, productVariantId: "variant-2" },
    ]);

    const record = await getAdminProductById("product-1");

    expect(record).not.toBeNull();
    // Variant images must surface in the edit form with the correct variant index.
    expect(record?.images).toEqual([
      { url: "https://example.com/small-blue.jpg", alt: "Small blue tee", variantIndex: 0 },
      { url: "https://example.com/medium-blue.jpg", alt: "Medium blue tee", variantIndex: 1 },
    ]);
    expect(prismaMock.productImage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productVariant: { productId: "product-1" } },
      }),
    );
  });

  it("returns null when the product does not exist", async () => {
    prismaMock.product.findUnique.mockResolvedValue(null);

    const record = await getAdminProductById("missing");

    expect(record).toBeNull();
    expect(prismaMock.productImage.findMany).not.toHaveBeenCalled();
  });

  it("applies query, type, and pagination filters when listing products", async () => {
    prismaMock.product.findMany.mockResolvedValue([]);

    await listAdminProducts({
      query: "wash",
      status: "PUBLISHED",
      type: "SIMPLE",
      page: 2,
      pageSize: 20,
    });

    expect(prismaMock.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            { status: "PUBLISHED" },
            expect.objectContaining({ OR: expect.any(Array) }),
            {
              OR: expect.arrayContaining([
                {
                  metadata: {
                    path: ["variantsEnabled"],
                    equals: false,
                  },
                },
              ]),
            },
          ]),
        },
        skip: 20,
        take: 20,
      }),
    );

    const listQuery = prismaMock.product.findMany.mock.calls[0]?.[0];
    expect(listQuery?.select).toMatchObject({
      id: true,
      name: true,
      slug: true,
      shortDescription: true,
      status: true,
      seoTitle: true,
      updatedAt: true,
      metadata: true,
      category: {
        select: {
          name: true,
        },
      },
      variants: expect.any(Object),
    });
    expect(listQuery?.select?.images).toBeUndefined();
    expect(listQuery?.select?.specifications).toBeUndefined();
    expect(listQuery?.select?.description).toBeUndefined();
  });

  it("lists related products with category, query, and pinned selected items", async () => {
    prismaMock.product.findMany.mockResolvedValueOnce([
      { id: "product-5", name: "Face Wash Foam", slug: "face-wash-foam", category: { name: "Skincare" } },
    ]);
    prismaMock.product.findMany.mockResolvedValueOnce([
      { id: "product-2", name: "Old Pick", slug: "old-pick", category: { name: "Skincare" } },
    ]);

    const items = await listAdminRelatedProducts({
      categoryId: "category-1",
      query: "wash",
      excludeProductId: "product-1",
      take: 20,
      selectedIds: ["product-2", "product-5"],
    });

    expect(prismaMock.product.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            { NOT: { id: "product-1" } },
            { categoryId: "category-1" },
            expect.objectContaining({
              OR: expect.arrayContaining([
                { name: { contains: "wash", mode: "insensitive" } },
                { slug: { contains: "wash", mode: "insensitive" } },
              ]),
            }),
          ]),
        },
        take: 20,
      }),
    );

    expect(prismaMock.product.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          id: { in: ["product-2", "product-5"] },
          NOT: { id: "product-1" },
        },
      }),
    );

    expect(items).toEqual([
      { id: "product-2", title: "Old Pick", slug: "old-pick", categoryName: "Skincare" },
      { id: "product-5", title: "Face Wash Foam", slug: "face-wash-foam", categoryName: "Skincare" },
    ]);
  });

  it("lists related products without filters and dedupes overlapping items", async () => {
    prismaMock.product.findMany.mockResolvedValueOnce([
      { id: "product-1", name: "Face Wash", slug: "face-wash", category: { name: "Skincare" } },
    ]);
    prismaMock.product.findMany.mockResolvedValueOnce([
      { id: "product-1", name: "Face Wash", slug: "face-wash", category: { name: "Skincare" } },
    ]);

    const items = await listAdminRelatedProducts({
      take: 10,
      selectedIds: ["product-1"],
    });

    expect(prismaMock.product.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        take: 10,
      }),
    );
    const relatedQuery = prismaMock.product.findMany.mock.calls[0]?.[0];
    expect(relatedQuery?.where).toBeUndefined();
    expect(items).toEqual([
      { id: "product-1", title: "Face Wash", slug: "face-wash", categoryName: "Skincare" },
    ]);
  });

  it("creates a simple product with inventory and audit logging", async () => {
    prismaMock.category.findUnique.mockResolvedValue({ id: "category-1", name: "Skincare" });
    prismaMock.product.findMany.mockResolvedValue([]);
    prismaMock.product.create.mockResolvedValue({
      id: "product-1",
      name: "Daily Face Wash",
      slug: "daily-face-wash",
      shortDescription: "Gentle cleanser",
      description: "Longer description",
      status: "PUBLISHED",
      masterSku: "FACE-WASH-001",
      seoTitle: "Daily Face Wash",
      seoDescription: "Gentle cleanser for daily use",
      seoImageUrl: null,
      metadata: { variantsEnabled: false, relatedProductIds: [] },
      category: { id: "category-1", name: "Skincare", slug: "skincare" },
      variants: [],
      images: [],
      specifications: [],
      createdAt: new Date("2026-04-17T10:00:00.000Z"),
      updatedAt: new Date("2026-04-17T10:00:00.000Z"),
    });
    prismaMock.productVariant.create.mockResolvedValue({ id: "variant-1" });
    prismaMock.inventory.create.mockResolvedValue({ id: "inventory-1" });
    prismaMock.productImage.createMany.mockResolvedValue({ count: 1 });
    prismaMock.productSpecification.createMany.mockResolvedValue({ count: 1 });
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await createAdminProduct({
      data: {
        title: "Daily Face Wash",
        slug: "daily-face-wash",
        shortDescription: "Gentle cleanser",
        description: "Longer description",
        categoryId: "category-1",
        status: "PUBLISHED",
        sku: "FACE-WASH-001",
        price: 499,
        comparePrice: 599,
        stock: 20,
        variantsEnabled: false,
        variants: [],
        images: [{ url: "https://example.com/image.jpg", alt: "Hero image" }],
        specifications: [{ key: "Size", value: "200ml" }],
        relatedProductIds: [],
        seoTitle: "Daily Face Wash",
        seoDescription: "Gentle cleanser for daily use",
        seoCanonicalUrl: undefined,
        seoOgTitle: undefined,
        seoOgDescription: undefined,
        seoImageUrl: undefined,
        seoKeywords: undefined,
        seoNoIndex: false,
        seoSchemaNotes: undefined,
      },
      actor: {
        actorId: "admin-1",
        actorRole: "PRODUCT_MANAGER",
      },
    });

    expect(prismaMock.product.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.productVariant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId: "product-1",
          sku: "FACE-WASH-001",
          price: 499,
          compareAtPrice: 599,
          isDefault: true,
        }),
      }),
    );
    expect(prismaMock.inventory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productVariantId: "variant-1",
          quantity: 20,
        }),
      }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "product.created",
          model: "Product",
          modelId: "product-1",
        }),
      }),
    );
  });

  it("creates a variant product and preserves SEO fields", async () => {
    prismaMock.category.findUnique.mockResolvedValue({ id: "category-1", name: "Apparel" });
    prismaMock.product.findMany.mockResolvedValue([{ id: "product-9" }]);
    prismaMock.product.create.mockResolvedValue({ id: "product-2" });
    prismaMock.product.findUnique.mockResolvedValue({
      id: "product-2",
      name: "Classic Tee",
      slug: "classic-tee",
      shortDescription: "Soft tee",
      description: "Soft tee with multiple sizes",
      status: "PUBLISHED",
      masterSku: "TEE-CLASSIC",
      seoTitle: "Classic Tee | Party Heaven",
      seoDescription: "Soft cotton tee in multiple sizes.",
      seoImageUrl: "https://example.com/tee-seo.jpg",
      metadata: { variantsEnabled: true, relatedProductIds: ["product-9"] },
      category: { id: "category-1", name: "Apparel", slug: "apparel" },
      variants: [
        {
          id: "variant-1",
          title: "Small / Blue",
          sku: "TEE-S-BLU",
          options: { Size: "Small", Color: "Blue" },
          price: 799,
          compareAtPrice: 999,
          isDefault: true,
          inventory: { quantity: 5 },
        },
        {
          id: "variant-2",
          title: "Medium / Blue",
          sku: "TEE-M-BLU",
          options: { Size: "Medium", Color: "Blue" },
          price: 799,
          compareAtPrice: null,
          isDefault: false,
          inventory: { quantity: 8 },
        },
      ],
      images: [],
      specifications: [],
      createdAt: new Date("2026-04-17T10:00:00.000Z"),
      updatedAt: new Date("2026-04-17T10:00:00.000Z"),
    });
    prismaMock.productVariant.create
      .mockResolvedValueOnce({ id: "variant-1" })
      .mockResolvedValueOnce({ id: "variant-2" });
    prismaMock.inventory.create
      .mockResolvedValueOnce({ id: "inventory-1" })
      .mockResolvedValueOnce({ id: "inventory-2" });
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-variant" });

    const created = await createAdminProduct({
      data: {
        title: "Classic Tee",
        slug: "classic-tee",
        shortDescription: "Soft tee",
        description: "Soft tee with multiple sizes",
        categoryId: "category-1",
        status: "PUBLISHED",
        sku: "TEE-CLASSIC",
        price: 0,
        comparePrice: undefined,
        stock: 0,
        variantsEnabled: true,
        variants: [
          {
            title: "Small / Blue",
            sku: "TEE-S-BLU",
            price: 799,
            comparePrice: 999,
            stock: 5,
            options: { Size: "Small", Color: "Blue" },
            isDefault: true,
          },
          {
            title: "Medium / Blue",
            sku: "TEE-M-BLU",
            price: 799,
            comparePrice: undefined,
            stock: 8,
            options: { Size: "Medium", Color: "Blue" },
            isDefault: false,
          },
        ],
        images: [],
        specifications: [],
        relatedProductIds: ["product-9"],
        seoTitle: "Classic Tee | Party Heaven",
        seoDescription: "Soft cotton tee in multiple sizes.",
        seoCanonicalUrl: undefined,
        seoOgTitle: undefined,
        seoOgDescription: undefined,
        seoImageUrl: "https://example.com/tee-seo.jpg",
        seoKeywords: undefined,
        seoNoIndex: false,
        seoSchemaNotes: undefined,
      },
      actor: {
        actorId: "admin-2",
        actorRole: "SUPER_ADMIN",
      },
    });

    expect(prismaMock.productVariant.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.inventory.create).toHaveBeenCalledTimes(2);
    expect(created.variantsEnabled).toBe(true);
    expect(created.seoTitle).toBe("Classic Tee | Party Heaven");
    expect(created.seoDescription).toBe("Soft cotton tee in multiple sizes.");
    expect(created.seoImageUrl).toBe("https://example.com/tee-seo.jpg");
  });

  it("creates a variant product with images attached to specific variants", async () => {
    prismaMock.category.findUnique.mockResolvedValue({ id: "category-1", name: "Apparel" });
    prismaMock.product.findMany.mockResolvedValue([]);
    prismaMock.product.create.mockResolvedValue({ id: "product-2" });
    prismaMock.product.findUnique.mockResolvedValue({
      id: "product-2",
      name: "Classic Tee",
      slug: "classic-tee",
      shortDescription: "Soft tee",
      description: "Soft tee with multiple sizes",
      status: "PUBLISHED",
      masterSku: "TEE-CLASSIC",
      seoTitle: null,
      seoDescription: null,
      seoImageUrl: null,
      metadata: { variantsEnabled: true, relatedProductIds: [] },
      category: { id: "category-1", name: "Apparel", slug: "apparel" },
      variants: [
        {
          id: "variant-1",
          title: "Small / Blue",
          sku: "TEE-S-BLU",
          options: { Size: "Small", Color: "Blue" },
          price: 799,
          compareAtPrice: null,
          isDefault: true,
          inventory: { quantity: 5 },
        },
        {
          id: "variant-2",
          title: "Medium / Blue",
          sku: "TEE-M-BLU",
          options: { Size: "Medium", Color: "Blue" },
          price: 799,
          compareAtPrice: null,
          isDefault: false,
          inventory: { quantity: 8 },
        },
      ],
      images: [
        {
          url: "https://example.com/small-blue.jpg",
          alt: "Small blue tee",
          position: 0,
          productVariantId: "variant-1",
        },
        {
          url: "https://example.com/shared.jpg",
          alt: "Shared tee image",
          position: 1,
        },
      ],
      specifications: [],
      createdAt: new Date("2026-04-17T10:00:00.000Z"),
      updatedAt: new Date("2026-04-17T10:00:00.000Z"),
    });
    prismaMock.productVariant.create
      .mockResolvedValueOnce({ id: "variant-1" })
      .mockResolvedValueOnce({ id: "variant-2" });
    prismaMock.inventory.create
      .mockResolvedValueOnce({ id: "inventory-1" })
      .mockResolvedValueOnce({ id: "inventory-2" });
    prismaMock.productImage.createMany.mockResolvedValue({ count: 2 });
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-variant-images" });

    const created = await createAdminProduct({
      data: {
        title: "Classic Tee",
        slug: "classic-tee",
        shortDescription: "Soft tee",
        description: "Soft tee with multiple sizes",
        categoryId: "category-1",
        status: "PUBLISHED",
        sku: "TEE-CLASSIC",
        price: 0,
        comparePrice: undefined,
        stock: 0,
        variantsEnabled: true,
        variants: [
          {
            title: "Small / Blue",
            sku: "TEE-S-BLU",
            price: 799,
            comparePrice: undefined,
            stock: 5,
            options: { Size: "Small", Color: "Blue" },
            isDefault: true,
          },
          {
            title: "Medium / Blue",
            sku: "TEE-M-BLU",
            price: 799,
            comparePrice: undefined,
            stock: 8,
            options: { Size: "Medium", Color: "Blue" },
            isDefault: false,
          },
        ],
        // First image → variant index 0 (small), second image → shared/product-level
        images: [
          { url: "https://example.com/small-blue.jpg", alt: "Small blue tee", variantIndex: 0 },
          { url: "https://example.com/shared.jpg", alt: "Shared tee image" },
        ],
        specifications: [],
        relatedProductIds: [],
        seoTitle: undefined,
        seoDescription: undefined,
        seoCanonicalUrl: undefined,
        seoOgTitle: undefined,
        seoOgDescription: undefined,
        seoImageUrl: undefined,
        seoKeywords: undefined,
        seoNoIndex: false,
        seoSchemaNotes: undefined,
      },
      actor: {
        actorId: "admin-2",
        actorRole: "SUPER_ADMIN",
      },
    });

    expect(prismaMock.productVariant.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.productImage.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          productVariantId: "variant-1",
          url: "https://example.com/small-blue.jpg",
          position: 0,
        }),
        expect.objectContaining({
          productId: "product-2",
          url: "https://example.com/shared.jpg",
          position: 1,
        }),
      ],
    });
    // The service round-trips the image back with the resolved variant index.
    expect(created.images[0]).toMatchObject({
      url: "https://example.com/small-blue.jpg",
      variantIndex: 0,
    });
    expect(created.images[1]).toMatchObject({
      url: "https://example.com/shared.jpg",
      variantIndex: null,
    });
  });

  it("updates a variant product and writes before/after audit data", async () => {
    prismaMock.category.findUnique.mockResolvedValue({ id: "category-1", name: "Apparel" });
    prismaMock.product.findMany.mockResolvedValue([{ id: "product-9" }]);
    prismaMock.product.findUnique
      .mockResolvedValueOnce({
        id: "product-1",
        name: "Classic Tee",
        slug: "classic-tee",
        status: "DRAFT",
        masterSku: "TEE-CLASSIC",
        metadata: { variantsEnabled: false, relatedProductIds: [] },
      })
      .mockResolvedValueOnce({
        id: "product-1",
        name: "Classic Tee",
        slug: "classic-tee",
        shortDescription: "Soft tee",
        description: "Soft tee with multiple sizes",
        status: "PUBLISHED",
        masterSku: "TEE-CLASSIC",
        seoTitle: "Classic Tee",
        seoDescription: "Soft tee",
        seoImageUrl: null,
        metadata: { variantsEnabled: true, relatedProductIds: ["product-9"] },
        category: { id: "category-1", name: "Apparel", slug: "apparel" },
        variants: [],
        images: [],
        specifications: [],
        createdAt: new Date("2026-04-17T10:00:00.000Z"),
        updatedAt: new Date("2026-04-17T12:00:00.000Z"),
      });
    prismaMock.product.update.mockResolvedValue({ id: "product-1" });
    prismaMock.productVariant.findMany.mockResolvedValue([{ id: "variant-2", sku: "TEE-S-BLU" }]);
    prismaMock.productVariant.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.inventory.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.productImage.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.productSpecification.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.productVariant.update.mockResolvedValue({ id: "variant-2" });
    prismaMock.inventory.upsert.mockResolvedValue({ id: "inventory-2" });
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-2" });

    await updateAdminProduct({
      data: {
        id: "product-1",
        title: "Classic Tee",
        slug: "classic-tee",
        shortDescription: "Soft tee",
        description: "Soft tee with multiple sizes",
        categoryId: "category-1",
        status: "PUBLISHED",
        sku: "TEE-CLASSIC",
        price: 0,
        comparePrice: undefined,
        stock: 0,
        variantsEnabled: true,
        variants: [
          {
            title: "Small / Blue",
            sku: "TEE-S-BLU",
            price: 799,
            comparePrice: 999,
            stock: 5,
            options: { Size: "Small", Color: "Blue" },
            isDefault: true,
          },
        ],
        images: [],
        specifications: [],
        relatedProductIds: ["product-9"],
        seoTitle: "Classic Tee",
        seoDescription: "Soft tee",
        seoCanonicalUrl: undefined,
        seoOgTitle: undefined,
        seoOgDescription: undefined,
        seoImageUrl: undefined,
        seoKeywords: undefined,
        seoNoIndex: false,
        seoSchemaNotes: undefined,
      },
      actor: {
        actorId: "admin-1",
        actorRole: "SUPER_ADMIN",
      },
    });

    expect(prismaMock.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "product-1" },
        data: expect.objectContaining({
          name: "Classic Tee",
          slug: "classic-tee",
          status: "PUBLISHED",
        }),
      }),
    );
    expect(prismaMock.productVariant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "variant-2" },
        data: expect.objectContaining({
          sku: "TEE-S-BLU",
          isDefault: true,
        }),
      }),
    );
    expect(prismaMock.productVariant.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "product.updated",
          modelId: "product-1",
          changes: expect.objectContaining({
            before: expect.objectContaining({
              status: "DRAFT",
            }),
            after: expect.objectContaining({
              status: "PUBLISHED",
            }),
          }),
        }),
      }),
    );
  });

  it("removes deselected variants after clearing dependent rows", async () => {
    prismaMock.category.findUnique.mockResolvedValue({ id: "category-1", name: "Apparel" });
    prismaMock.product.findMany.mockResolvedValue([]);
    prismaMock.product.findUnique
      .mockResolvedValueOnce({
        id: "product-3",
        name: "Bundle",
        slug: "bundle",
        status: "DRAFT",
        masterSku: "BUNDLE-001",
        metadata: { variantsEnabled: true, relatedProductIds: [] },
      })
      .mockResolvedValueOnce({
        id: "product-3",
        name: "Bundle",
        slug: "bundle",
        shortDescription: "x",
        description: "y",
        status: "PUBLISHED",
        masterSku: "BUNDLE-001",
        seoTitle: null,
        seoDescription: null,
        seoImageUrl: null,
        metadata: { variantsEnabled: true, relatedProductIds: [] },
        category: { id: "category-1", name: "Apparel", slug: "apparel" },
        variants: [],
        images: [],
        specifications: [],
        createdAt: new Date("2026-04-17T10:00:00.000Z"),
        updatedAt: new Date("2026-04-17T12:00:00.000Z"),
      });

    prismaMock.product.update.mockResolvedValue({ id: "product-3" });
    prismaMock.productVariant.findMany.mockResolvedValue([
      { id: "variant-active", sku: "BUNDLE-A" },
      { id: "variant-removed", sku: "BUNDLE-B" },
    ]);
    prismaMock.wishlistItem.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.cartItem.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.productImage.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.inventory.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.productVariant.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.productVariant.update.mockResolvedValue({ id: "variant-active" });
    prismaMock.inventory.upsert.mockResolvedValue({ id: "inventory-active" });
    prismaMock.productSpecification.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-removed" });

    await updateAdminProduct({
      data: {
        id: "product-3",
        title: "Bundle",
        slug: "bundle",
        shortDescription: "x",
        description: "y",
        categoryId: "category-1",
        status: "PUBLISHED",
        sku: "BUNDLE-001",
        price: 0,
        comparePrice: undefined,
        stock: 0,
        variantsEnabled: true,
        variants: [
          {
            title: "Bundle A",
            sku: "BUNDLE-A",
            price: 499,
            comparePrice: undefined,
            stock: 10,
            options: { Pack: "A" },
            isDefault: true,
          },
        ],
        images: [],
        specifications: [],
        relatedProductIds: [],
        seoTitle: undefined,
        seoDescription: undefined,
        seoCanonicalUrl: undefined,
        seoOgTitle: undefined,
        seoOgDescription: undefined,
        seoImageUrl: undefined,
        seoKeywords: undefined,
        seoNoIndex: false,
        seoSchemaNotes: undefined,
      },
      actor: {
        actorId: "admin-3",
        actorRole: "SUPER_ADMIN",
      },
    });

    expect(prismaMock.wishlistItem.deleteMany).toHaveBeenCalledWith({
      where: {
        productVariantId: {
          in: ["variant-removed"],
        },
      },
    });
    expect(prismaMock.cartItem.deleteMany).toHaveBeenCalledWith({
      where: {
        productVariantId: {
          in: ["variant-removed"],
        },
      },
    });
    expect(prismaMock.productVariant.deleteMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ["variant-removed"],
        },
      },
    });
  });

  it("clears variant images and recreates them with the new assignment on update", async () => {
    prismaMock.category.findUnique.mockResolvedValue({ id: "category-1", name: "Apparel" });
    prismaMock.product.findMany.mockResolvedValue([]);
    prismaMock.product.findUnique
      .mockResolvedValueOnce({
        id: "product-4",
        name: "Classic Tee",
        slug: "classic-tee",
        status: "DRAFT",
        masterSku: "TEE-CLASSIC",
        metadata: { variantsEnabled: true, relatedProductIds: [] },
      })
      .mockResolvedValueOnce({
        id: "product-4",
        name: "Classic Tee",
        slug: "classic-tee",
        shortDescription: "Soft tee",
        description: "Soft tee with multiple sizes",
        status: "PUBLISHED",
        masterSku: "TEE-CLASSIC",
        seoTitle: null,
        seoDescription: null,
        seoImageUrl: null,
        metadata: { variantsEnabled: true, relatedProductIds: [] },
        category: { id: "category-1", name: "Apparel", slug: "apparel" },
        variants: [
          {
            id: "variant-1",
            title: "Small / Blue",
            sku: "TEE-S-BLU",
            options: { Size: "Small", Color: "Blue" },
            price: 799,
            compareAtPrice: null,
            isDefault: true,
            inventory: { quantity: 5 },
          },
        ],
        images: [
          {
            url: "https://example.com/small-blue.jpg",
            alt: "Small blue tee",
            position: 0,
            productVariantId: "variant-1",
          },
        ],
        specifications: [],
        createdAt: new Date("2026-04-17T10:00:00.000Z"),
        updatedAt: new Date("2026-04-17T12:00:00.000Z"),
      });

    prismaMock.product.update.mockResolvedValue({ id: "product-4" });
    prismaMock.productVariant.findMany.mockResolvedValue([{ id: "variant-1", sku: "TEE-S-BLU" }]);
    prismaMock.productVariant.update.mockResolvedValue({ id: "variant-1" });
    prismaMock.inventory.upsert.mockResolvedValue({ id: "inventory-1" });
    prismaMock.productImage.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.productImage.createMany.mockResolvedValue({ count: 1 });
    prismaMock.productSpecification.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-update-images" });

    await updateAdminProduct({
      data: {
        id: "product-4",
        title: "Classic Tee",
        slug: "classic-tee",
        shortDescription: "Soft tee",
        description: "Soft tee with multiple sizes",
        categoryId: "category-1",
        status: "PUBLISHED",
        sku: "TEE-CLASSIC",
        price: 0,
        comparePrice: undefined,
        stock: 0,
        variantsEnabled: true,
        variants: [
          {
            title: "Small / Blue",
            sku: "TEE-S-BLU",
            price: 799,
            comparePrice: undefined,
            stock: 5,
            options: { Size: "Small", Color: "Blue" },
            isDefault: true,
          },
        ],
        images: [
          { url: "https://example.com/small-blue.jpg", alt: "Small blue tee", variantIndex: 0 },
        ],
        specifications: [],
        relatedProductIds: [],
        seoTitle: undefined,
        seoDescription: undefined,
        seoCanonicalUrl: undefined,
        seoOgTitle: undefined,
        seoOgDescription: undefined,
        seoImageUrl: undefined,
        seoKeywords: undefined,
        seoNoIndex: false,
        seoSchemaNotes: undefined,
      },
      actor: {
        actorId: "admin-4",
        actorRole: "SUPER_ADMIN",
      },
    });

    // Product-level images are cleared, then any variant-linked images are cleared.
    expect(prismaMock.productImage.deleteMany).toHaveBeenCalledWith({
      where: { productId: "product-4" },
    });
    expect(prismaMock.productImage.deleteMany).toHaveBeenCalledWith({
      where: {
        productVariantId: {
          in: ["variant-1"],
        },
      },
    });
    // The image is recreated attached to the resolved variant id.
    expect(prismaMock.productImage.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          productVariantId: "variant-1",
          url: "https://example.com/small-blue.jpg",
          position: 0,
        }),
      ],
    });
  });

  it("deletes product with variants, dependent rows, and audit log", async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      id: "product-10",
      name: "Legacy Product",
      slug: "legacy-product",
      status: "ARCHIVED",
      categoryId: "category-1",
    });
    prismaMock.productVariant.findMany.mockResolvedValue([
      { id: "variant-10" },
      { id: "variant-11" },
    ]);
    prismaMock.wishlistItem.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.cartItem.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.productImage.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.inventory.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.productVariant.deleteMany.mockResolvedValue({ count: 2 });
    prismaMock.productSpecification.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.review.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.dealCampaignProduct.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.product.delete.mockResolvedValue({ id: "product-10" });
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-delete" });

    await deleteAdminProduct({
      productId: "product-10",
      actor: {
        actorId: "admin-10",
        actorRole: "SUPER_ADMIN",
      },
    });

    expect(prismaMock.product.delete).toHaveBeenCalledWith({
      where: {
        id: "product-10",
      },
    });
    expect(prismaMock.dealCampaignProduct.deleteMany).toHaveBeenCalledWith({
      where: {
        productId: "product-10",
      },
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "product.deleted",
          modelId: "product-10",
        }),
      }),
    );
  });
});
