import type { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import { AppError } from "@/lib/errors/app-error";
import { getPrismaClient } from "@/server/db";

import type { AdminBlogCreateInput, AdminBlogUpdateInput } from "./validation";

type AuditActorInput = {
  actorId: string;
  actorRole?: string | null;
};

export type AdminBlogListFilters = {
  query?: string;
  status?: "ALL" | "DRAFT" | "PUBLISHED" | "ARCHIVED";
};

export type AdminBlogRecord = {
  id: string;
  locale: string;
  title: string;
  slug: string;
  excerpt: string;
  content: Prisma.JsonValue;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  coverImageWidth: number | null;
  coverImageHeight: number | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: Date | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoCanonicalUrl: string | null;
  seoOgTitle: string | null;
  seoOgDescription: string | null;
  seoImageUrl: string | null;
  seoKeywords: string | null;
  seoNoIndex: boolean;
  seoSchemaNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminBlogListItem = {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: Date | null;
  updatedAt: Date;
};

function isKnownStatus(value: string | undefined): value is "DRAFT" | "PUBLISHED" | "ARCHIVED" {
  return value === "DRAFT" || value === "PUBLISHED" || value === "ARCHIVED";
}

function parsePublishedAt(value: string | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

function parseContentJson(value: string): Prisma.InputJsonValue {
  try {
    return JSON.parse(value) as Prisma.InputJsonValue;
  } catch {
    throw new AppError("Blog content JSON is invalid.", "VALIDATION_ERROR", {
      statusCode: 400,
      userMessage: "Please provide valid content JSON before saving.",
    });
  }
}

function buildSlugError(error: unknown): AppError | null {
  if (!(error instanceof PrismaClientKnownRequestError)) {
    return null;
  }

  if (error.code !== "P2002") {
    return null;
  }

  const rawTarget = error.meta?.target;
  const targets = Array.isArray(rawTarget)
    ? rawTarget.map((value) => `${value}`.toLowerCase())
    : typeof rawTarget === "string"
      ? [rawTarget.toLowerCase()]
      : [];

  if (!targets.some((target) => target.includes("slug"))) {
    return null;
  }

  return new AppError("Blog post slug must be unique.", "BLOG_POST_SLUG_TAKEN", {
    statusCode: 409,
    userMessage: "That blog URL is already in use. Please choose a unique slug.",
  });
}

async function writeBlogAuditLog(input: {
  action: "blog.created" | "blog.updated" | "blog.deleted";
  actor: AuditActorInput;
  blogPostId: string;
  changes: Record<string, unknown>;
}) {
  const db = getPrismaClient();

  await db.auditLog.create({
    data: {
      actorId: input.actor.actorId,
      action: input.action,
      model: "BlogPost",
      modelId: input.blogPostId,
      changes: {
        actorRole: input.actor.actorRole ?? null,
        ...input.changes,
      },
    },
  });
}

export async function listAdminBlogPosts(filters: AdminBlogListFilters = {}): Promise<AdminBlogListItem[]> {
  const db = getPrismaClient();
  const query = filters.query?.trim();
  const status = isKnownStatus(filters.status) ? filters.status : undefined;

  return db.blogPost.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { slug: { contains: query, mode: "insensitive" } },
              { excerpt: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { publishedAt: "desc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
    },
  });
}

export async function getAdminBlogPostById(id: string): Promise<AdminBlogRecord | null> {
  const db = getPrismaClient();

  return db.blogPost.findUnique({
    where: { id },
    select: {
      id: true,
      locale: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      coverImageUrl: true,
      coverImageAlt: true,
      coverImageWidth: true,
      coverImageHeight: true,
      status: true,
      publishedAt: true,
      seoTitle: true,
      seoDescription: true,
      seoCanonicalUrl: true,
      seoOgTitle: true,
      seoOgDescription: true,
      seoImageUrl: true,
      seoKeywords: true,
      seoNoIndex: true,
      seoSchemaNotes: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function createAdminBlogPost(input: { data: AdminBlogCreateInput; actor: AuditActorInput }) {
  const db = getPrismaClient();

  try {
    const created = await db.blogPost.create({
      data: {
        locale: input.data.locale,
        title: input.data.title,
        slug: input.data.slug,
        excerpt: input.data.excerpt,
        content: parseContentJson(input.data.contentJson),
        coverImageUrl: input.data.coverImageUrl ?? null,
        coverImageAlt: input.data.coverImageAlt ?? null,
        coverImageWidth: input.data.coverImageWidth ?? null,
        coverImageHeight: input.data.coverImageHeight ?? null,
        status: input.data.status,
        publishedAt: parsePublishedAt(input.data.publishedAt),
        seoTitle: input.data.seoTitle ?? null,
        seoDescription: input.data.seoDescription ?? null,
        seoCanonicalUrl: input.data.seoCanonicalUrl ?? null,
        seoOgTitle: input.data.seoOgTitle ?? null,
        seoOgDescription: input.data.seoOgDescription ?? null,
        seoImageUrl: input.data.seoImageUrl ?? null,
        seoKeywords: input.data.seoKeywords ?? null,
        seoNoIndex: input.data.seoNoIndex,
        seoSchemaNotes: input.data.seoSchemaNotes ?? null,
      },
      select: {
        id: true,
        locale: true,
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        coverImageUrl: true,
        coverImageAlt: true,
        coverImageWidth: true,
        coverImageHeight: true,
        status: true,
        publishedAt: true,
        seoTitle: true,
        seoDescription: true,
        seoCanonicalUrl: true,
        seoOgTitle: true,
        seoOgDescription: true,
        seoImageUrl: true,
        seoKeywords: true,
        seoNoIndex: true,
        seoSchemaNotes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await writeBlogAuditLog({
      action: "blog.created",
      actor: input.actor,
      blogPostId: created.id,
      changes: {
        after: {
          title: created.title,
          slug: created.slug,
          status: created.status,
          publishedAt: created.publishedAt,
        },
      },
    });

    return created;
  } catch (error) {
    const slugError = buildSlugError(error);

    if (slugError) {
      throw slugError;
    }

    throw error;
  }
}

export async function updateAdminBlogPost(input: { data: AdminBlogUpdateInput; actor: AuditActorInput }) {
  const db = getPrismaClient();

  const previous = await db.blogPost.findUnique({
    where: { id: input.data.id },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      publishedAt: true,
    },
  });

  if (!previous) {
    throw new AppError("Blog post not found.", "BLOG_POST_NOT_FOUND", {
      statusCode: 404,
      userMessage: "The selected blog post no longer exists.",
    });
  }

  try {
    const updated = await db.blogPost.update({
      where: { id: input.data.id },
      data: {
        locale: input.data.locale,
        title: input.data.title,
        slug: input.data.slug,
        excerpt: input.data.excerpt,
        content: parseContentJson(input.data.contentJson),
        coverImageUrl: input.data.coverImageUrl ?? null,
        coverImageAlt: input.data.coverImageAlt ?? null,
        coverImageWidth: input.data.coverImageWidth ?? null,
        coverImageHeight: input.data.coverImageHeight ?? null,
        status: input.data.status,
        publishedAt: parsePublishedAt(input.data.publishedAt),
        seoTitle: input.data.seoTitle ?? null,
        seoDescription: input.data.seoDescription ?? null,
        seoCanonicalUrl: input.data.seoCanonicalUrl ?? null,
        seoOgTitle: input.data.seoOgTitle ?? null,
        seoOgDescription: input.data.seoOgDescription ?? null,
        seoImageUrl: input.data.seoImageUrl ?? null,
        seoKeywords: input.data.seoKeywords ?? null,
        seoNoIndex: input.data.seoNoIndex,
        seoSchemaNotes: input.data.seoSchemaNotes ?? null,
      },
      select: {
        id: true,
        locale: true,
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        coverImageUrl: true,
        coverImageAlt: true,
        coverImageWidth: true,
        coverImageHeight: true,
        status: true,
        publishedAt: true,
        seoTitle: true,
        seoDescription: true,
        seoCanonicalUrl: true,
        seoOgTitle: true,
        seoOgDescription: true,
        seoImageUrl: true,
        seoKeywords: true,
        seoNoIndex: true,
        seoSchemaNotes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await writeBlogAuditLog({
      action: "blog.updated",
      actor: input.actor,
      blogPostId: updated.id,
      changes: {
        before: {
          title: previous.title,
          slug: previous.slug,
          status: previous.status,
          publishedAt: previous.publishedAt,
        },
        after: {
          title: updated.title,
          slug: updated.slug,
          status: updated.status,
          publishedAt: updated.publishedAt,
        },
      },
    });

    return updated;
  } catch (error) {
    const slugError = buildSlugError(error);

    if (slugError) {
      throw slugError;
    }

    if (error instanceof PrismaClientKnownRequestError && error.code === "P2025") {
      throw new AppError("Blog post not found.", "BLOG_POST_NOT_FOUND", {
        statusCode: 404,
        userMessage: "The selected blog post no longer exists.",
      });
    }

    throw error;
  }
}

export async function deleteAdminBlogPost(input: { blogPostId: string; actor: AuditActorInput }) {
  const db = getPrismaClient();

  const post = await db.blogPost.findUnique({
    where: {
      id: input.blogPostId,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
    },
  });

  if (!post) {
    throw new AppError("Blog post not found.", "BLOG_POST_NOT_FOUND", {
      statusCode: 404,
      userMessage: "The selected blog post no longer exists.",
    });
  }

  try {
    await db.blogPost.delete({
      where: {
        id: input.blogPostId,
      },
    });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2025") {
      return;
    }

    throw error;
  }

  await writeBlogAuditLog({
    action: "blog.deleted",
    actor: input.actor,
    blogPostId: post.id,
    changes: {
      deleted: {
        title: post.title,
        slug: post.slug,
        status: post.status,
      },
    },
  });
}
