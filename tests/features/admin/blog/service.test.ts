import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  blogPost: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({
  getPrismaClient: () => prismaMock,
}));

import {
  createAdminBlogPost,
  deleteAdminBlogPost,
  listAdminBlogPosts,
  updateAdminBlogPost,
} from "@/features/admin/blog";

describe("admin blog service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies query and status filters", async () => {
    prismaMock.blogPost.findMany.mockResolvedValue([]);

    await listAdminBlogPosts({
      query: "budget",
      status: "PUBLISHED",
    });

    expect(prismaMock.blogPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PUBLISHED",
          OR: expect.any(Array),
        }),
      }),
    );

    const listQuery = prismaMock.blogPost.findMany.mock.calls[0]?.[0];
    expect(listQuery?.select).toMatchObject({
      id: true,
      title: true,
      slug: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
    });
    expect(listQuery?.select?.content).toBeUndefined();
    expect(listQuery?.select?.excerpt).toBeUndefined();
    expect(listQuery?.select?.seoDescription).toBeUndefined();
  });

  it("creates blog post and writes audit log", async () => {
    prismaMock.blogPost.create.mockResolvedValue({
      id: "post-1",
      locale: "en",
      title: "Budget Basket",
      slug: "budget-basket",
      excerpt: "desc",
      content: [],
      coverImageUrl: null,
      coverImageAlt: null,
      coverImageWidth: null,
      coverImageHeight: null,
      status: "DRAFT",
      publishedAt: null,
      seoTitle: null,
      seoDescription: null,
      seoCanonicalUrl: null,
      seoOgTitle: null,
      seoOgDescription: null,
      seoImageUrl: null,
      seoNoIndex: false,
      seoSchemaNotes: null,
      createdAt: new Date("2026-04-26T10:00:00.000Z"),
      updatedAt: new Date("2026-04-26T10:00:00.000Z"),
    });

    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await createAdminBlogPost({
      data: {
        locale: "en",
        title: "Budget Basket",
        slug: "budget-basket",
        excerpt: "A practical article summary.",
        contentJson: JSON.stringify([{ type: "paragraph", text: "Hello" }]),
        coverImageUrl: undefined,
        coverImageAlt: undefined,
        coverImageWidth: undefined,
        coverImageHeight: undefined,
        status: "DRAFT",
        publishedAt: undefined,
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

    expect(prismaMock.blogPost.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "blog.created",
          model: "BlogPost",
          modelId: "post-1",
        }),
      }),
    );
  });

  it("updates blog post and writes before/after audit details", async () => {
    prismaMock.blogPost.findUnique.mockResolvedValue({
      id: "post-1",
      title: "Old title",
      slug: "old-title",
      status: "DRAFT",
      publishedAt: null,
    });

    prismaMock.blogPost.update.mockResolvedValue({
      id: "post-1",
      locale: "en",
      title: "Updated title",
      slug: "updated-title",
      excerpt: "desc",
      content: [],
      coverImageUrl: null,
      coverImageAlt: null,
      coverImageWidth: null,
      coverImageHeight: null,
      status: "PUBLISHED",
      publishedAt: new Date("2026-04-26T11:00:00.000Z"),
      seoTitle: null,
      seoDescription: null,
      seoCanonicalUrl: null,
      seoOgTitle: null,
      seoOgDescription: null,
      seoImageUrl: null,
      seoNoIndex: false,
      seoSchemaNotes: null,
      createdAt: new Date("2026-04-26T10:00:00.000Z"),
      updatedAt: new Date("2026-04-26T11:00:00.000Z"),
    });

    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-2" });

    await updateAdminBlogPost({
      data: {
        id: "post-1",
        locale: "en",
        title: "Updated title",
        slug: "updated-title",
        excerpt: "A practical article summary.",
        contentJson: JSON.stringify([{ type: "paragraph", text: "Hello" }]),
        coverImageUrl: undefined,
        coverImageAlt: undefined,
        coverImageWidth: undefined,
        coverImageHeight: undefined,
        status: "PUBLISHED",
        publishedAt: "2026-04-26T11:00:00.000Z",
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
        actorRole: "PRODUCT_MANAGER",
      },
    });

    expect(prismaMock.blogPost.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "blog.updated",
          modelId: "post-1",
          changes: expect.objectContaining({
            before: expect.objectContaining({
              title: "Old title",
              slug: "old-title",
              status: "DRAFT",
            }),
            after: expect.objectContaining({
              title: "Updated title",
              slug: "updated-title",
              status: "PUBLISHED",
            }),
          }),
        }),
      }),
    );
  });

  it("deletes blog post and writes audit log", async () => {
    prismaMock.blogPost.findUnique.mockResolvedValue({
      id: "post-1",
      title: "Delete me",
      slug: "delete-me",
      status: "ARCHIVED",
    });

    prismaMock.blogPost.delete.mockResolvedValue({ id: "post-1" });
    prismaMock.auditLog.create.mockResolvedValue({ id: "audit-3" });

    await deleteAdminBlogPost({
      blogPostId: "post-1",
      actor: {
        actorId: "admin-3",
        actorRole: "SUPER_ADMIN",
      },
    });

    expect(prismaMock.blogPost.delete).toHaveBeenCalledWith({
      where: { id: "post-1" },
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "blog.deleted",
          modelId: "post-1",
        }),
      }),
    );
  });
});
