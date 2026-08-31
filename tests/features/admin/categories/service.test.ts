import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (tx: typeof prismaMock) => Promise<unknown>) => callback(prismaMock)),
  category: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  product: {
    updateMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({
  getPrismaClient: () => prismaMock,
}));

import {
  createAdminCategory,
  deleteAdminCategory,
  listAdminCategories,
  updateAdminCategory,
} from "@/features/admin/categories";

describe("admin categories service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies query and status filters", async () => {
    prismaMock.category.findMany.mockResolvedValue([]);

    await listAdminCategories({
      query: "home",
      status: "PUBLISHED",
    });

    expect(prismaMock.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PUBLISHED",
          OR: expect.any(Array),
        }),
      }),
    );

    const listQuery = prismaMock.category.findMany.mock.calls[0]?.[0];
    expect(listQuery?.select).toMatchObject({
      id: true,
      name: true,
      slug: true,
      description: true,
      status: true,
      seoTitle: true,
      seoDescription: true,
      updatedAt: true,
    });
    expect(listQuery?.select?.seoCanonicalUrl).toBeUndefined();
    expect(listQuery?.select?.cardImageUrl).toBeUndefined();
    expect(listQuery?.select?.createdAt).toBeUndefined();
  });

  it("creates category and writes audit log", async () => {
    prismaMock.category.create.mockResolvedValue({
      id: "category-1",
      name: "Home Care",
      slug: "home-care",
      description: "x",
      cardImageUrl: "https://cdn.example.com/category/home-care.jpg",
      status: "DRAFT",
      seoTitle: null,
      seoDescription: null,
      createdAt: new Date("2026-04-13T10:00:00.000Z"),
      updatedAt: new Date("2026-04-13T10:00:00.000Z"),
    });
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await createAdminCategory({
      data: {
        name: "Home Care",
        slug: "home-care",
        description: "x",
        categoryCardImageUrl: "https://cdn.example.com/category/home-care.jpg",
        status: "DRAFT",
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
        actorId: "admin-1",
        actorRole: "SUPER_ADMIN",
      },
    });

    expect(prismaMock.category.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cardImageUrl: "https://cdn.example.com/category/home-care.jpg",
        }),
      }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "category.created",
          model: "Category",
          modelId: "category-1",
        }),
      }),
    );
  });

  it("updates category and writes before/after audit data", async () => {
    prismaMock.category.findUnique.mockResolvedValue({
      id: "category-1",
      name: "Home Care",
      slug: "home-care",
      description: "x",
      cardImageUrl: "https://cdn.example.com/category/home-care.jpg",
      status: "DRAFT",
      seoTitle: null,
      seoDescription: null,
      createdAt: new Date("2026-04-13T10:00:00.000Z"),
      updatedAt: new Date("2026-04-13T10:00:00.000Z"),
    });
    prismaMock.category.update.mockResolvedValue({
      id: "category-1",
      name: "Home + Kitchen",
      slug: "home-kitchen",
      description: "y",
      cardImageUrl: "https://cdn.example.com/category/home-kitchen.jpg",
      status: "PUBLISHED",
      seoTitle: null,
      seoDescription: null,
      createdAt: new Date("2026-04-13T10:00:00.000Z"),
      updatedAt: new Date("2026-04-13T12:00:00.000Z"),
    });
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-2" });

    await updateAdminCategory({
      data: {
        id: "category-1",
        name: "Home + Kitchen",
        slug: "home-kitchen",
        description: "y",
        categoryCardImageUrl: "https://cdn.example.com/category/home-kitchen.jpg",
        status: "PUBLISHED",
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
        actorId: "admin-1",
        actorRole: "PRODUCT_MANAGER",
      },
    });

    expect(prismaMock.category.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.category.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cardImageUrl: "https://cdn.example.com/category/home-kitchen.jpg",
        }),
      }),
    );
    expect(prismaMock.category.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          parentId: null,
        }),
      }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "category.updated",
          modelId: "category-1",
          changes: expect.objectContaining({
            before: expect.objectContaining({
              name: "Home Care",
              slug: "home-care",
              status: "DRAFT",
            }),
            after: expect.objectContaining({
              name: "Home + Kitchen",
              slug: "home-kitchen",
              status: "PUBLISHED",
            }),
          }),
        }),
      }),
    );
  });

  it("deletes category and detaches linked products", async () => {
    prismaMock.category.findUnique.mockResolvedValue({
      id: "category-1",
      name: "Home Care",
      slug: "home-care",
      description: "x",
      status: "ARCHIVED",
      seoTitle: null,
      seoDescription: null,
    });
    prismaMock.product.updateMany.mockResolvedValue({ count: 3 });
    prismaMock.category.delete.mockResolvedValue({ id: "category-1" });
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-3" });

    await deleteAdminCategory({
      categoryId: "category-1",
      actor: {
        actorId: "admin-2",
        actorRole: "SUPER_ADMIN",
      },
    });

    expect(prismaMock.product.updateMany).toHaveBeenCalledWith({
      where: { categoryId: "category-1" },
      data: { categoryId: null },
    });
    expect(prismaMock.category.delete).toHaveBeenCalledWith({
      where: { id: "category-1" },
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "category.deleted",
          modelId: "category-1",
        }),
      }),
    );
  });
});
