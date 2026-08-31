import type { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import { AppError } from "@/lib/errors/app-error";
import { getPrismaClient } from "@/server/db";

import type { CategoryCreateInput, CategoryUpdateInput } from "./validation";

type AuditActorInput = {
  actorId: string;
  actorRole?: string | null;
};

export type AdminCategoryListFilters = {
  query?: string;
  status?: "ALL" | "DRAFT" | "PUBLISHED" | "ARCHIVED";
};

export type AdminCategoryRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cardImageUrl: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
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

export type AdminCategoryListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: Date;
};

function isKnownStatus(value: string | undefined): value is "DRAFT" | "PUBLISHED" | "ARCHIVED" {
  return value === "DRAFT" || value === "PUBLISHED" || value === "ARCHIVED";
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

  return new AppError("Category slug must be unique.", "CATEGORY_SLUG_TAKEN", {
    statusCode: 409,
    userMessage: "This slug is already used by another category.",
  });
}

async function writeCategoryAuditLog(input: {
  action: "category.created" | "category.updated" | "category.deleted";
  actor: AuditActorInput;
  categoryId: string;
  changes: Record<string, unknown>;
}) {
  const db = getPrismaClient();

  await db.auditLog.create({
    data: {
      actorId: input.actor.actorId,
      action: input.action,
      model: "Category",
      modelId: input.categoryId,
      changes: {
        actorRole: input.actor.actorRole ?? null,
        ...input.changes,
      },
    },
  });
}

export async function listAdminCategories(filters: AdminCategoryListFilters = {}): Promise<AdminCategoryListItem[]> {
  const db = getPrismaClient();
  const query = filters.query?.trim();
  const status = isKnownStatus(filters.status) ? filters.status : undefined;

  return db.category.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(query
        ? {
            OR: [
              {
                name: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                slug: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      status: true,
      seoTitle: true,
      seoDescription: true,
      updatedAt: true,
    },
  });
}

export async function getAdminCategoryById(categoryId: string): Promise<AdminCategoryRecord | null> {
  const db = getPrismaClient();

  return db.category.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      cardImageUrl: true,
      status: true,
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

export async function createAdminCategory(input: {
  data: CategoryCreateInput;
  actor: AuditActorInput;
}): Promise<AdminCategoryRecord> {
  const db = getPrismaClient();
  const createData = {
    name: input.data.name,
    slug: input.data.slug,
    description: input.data.description ?? null,
    cardImageUrl: input.data.categoryCardImageUrl ?? null,
    status: input.data.status,
    seoTitle: input.data.seoTitle ?? null,
    seoDescription: input.data.seoDescription ?? null,
    seoCanonicalUrl: input.data.seoCanonicalUrl ?? null,
    seoOgTitle: input.data.seoOgTitle ?? null,
    seoOgDescription: input.data.seoOgDescription ?? null,
    seoImageUrl: input.data.seoImageUrl ?? null,
    seoKeywords: input.data.seoKeywords ?? null,
    seoNoIndex: input.data.seoNoIndex,
    seoSchemaNotes: input.data.seoSchemaNotes ?? null,
    parentId: null,
  } as Prisma.CategoryUncheckedCreateInput;

  try {
    const created = await db.category.create({
      data: createData,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        cardImageUrl: true,
        status: true,
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

    await writeCategoryAuditLog({
      action: "category.created",
      actor: input.actor,
      categoryId: created.id,
      changes: {
        after: {
          name: created.name,
          slug: created.slug,
          status: created.status,
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

export async function updateAdminCategory(input: {
  data: CategoryUpdateInput;
  actor: AuditActorInput;
}): Promise<AdminCategoryRecord> {
  const db = getPrismaClient();
  const parentInput = input.data as CategoryUpdateInput & { parentId?: string | null };
  const updateData = {
    name: input.data.name,
    slug: input.data.slug,
    description: input.data.description ?? null,
    cardImageUrl: input.data.categoryCardImageUrl ?? null,
    status: input.data.status,
    seoTitle: input.data.seoTitle ?? null,
    seoDescription: input.data.seoDescription ?? null,
    seoCanonicalUrl: input.data.seoCanonicalUrl ?? null,
    seoOgTitle: input.data.seoOgTitle ?? null,
    seoOgDescription: input.data.seoOgDescription ?? null,
    seoImageUrl: input.data.seoImageUrl ?? null,
    seoKeywords: input.data.seoKeywords ?? null,
    seoNoIndex: input.data.seoNoIndex,
    seoSchemaNotes: input.data.seoSchemaNotes ?? null,
    ...(parentInput.parentId === undefined ? {} : { parentId: parentInput.parentId }),
  } as Prisma.CategoryUncheckedUpdateInput;

  const previous = await db.category.findUnique({
    where: { id: input.data.id },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      seoTitle: true,
      seoDescription: true,
      description: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  if (!previous) {
    throw new AppError("Category not found.", "CATEGORY_NOT_FOUND", {
      statusCode: 404,
      userMessage: "The selected category no longer exists.",
    });
  }

  try {
    const updated = await db.category.update({
      where: { id: input.data.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        cardImageUrl: true,
        status: true,
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

    await writeCategoryAuditLog({
      action: "category.updated",
      actor: input.actor,
      categoryId: updated.id,
      changes: {
        before: {
          name: previous.name,
          slug: previous.slug,
          status: previous.status,
        },
        after: {
          name: updated.name,
          slug: updated.slug,
          status: updated.status,
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
      throw new AppError("Category not found during update.", "CATEGORY_NOT_FOUND", {
        statusCode: 404,
        userMessage: "The selected category no longer exists.",
      });
    }

    throw error;
  }
}

export async function deleteAdminCategory(input: {
  categoryId: string;
  actor: AuditActorInput;
}) {
  const db = getPrismaClient();

  const category = await db.category.findUnique({
    where: { id: input.categoryId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
    },
  });

  if (!category) {
    throw new AppError("Category not found.", "CATEGORY_NOT_FOUND", {
      statusCode: 404,
      userMessage: "The selected category no longer exists.",
    });
  }

  let detachedProductCount = 0;

  try {
    detachedProductCount = await db.$transaction(async (tx) => {
      const detached = await tx.product.updateMany({
        where: {
          categoryId: category.id,
        },
        data: {
          categoryId: null,
        },
      });

      await tx.category.delete({
        where: {
          id: category.id,
        },
      });

      return detached.count;
    });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2003") {
      const meta = (error.meta ?? {}) as Record<string, unknown>;
      const metaStr = JSON.stringify(meta).toLowerCase();

      // If the constraint/meta indicates products are involved, keep the
      // existing user-friendly message. Otherwise surface a more generic
      // foreign-key related error so we don't incorrectly claim products
      // are the cause (could be parent category, audit logs, etc.).
      if (metaStr.includes("product") || metaStr.includes("products") || metaStr.includes("product_id")) {
        throw new AppError("Cannot delete category with attached products.", "CATEGORY_HAS_PRODUCTS", {
          statusCode: 409,
          userMessage: "Move products out of this category before deleting it.",
        });
      }

      throw new AppError("Cannot delete category due to related records.", "CATEGORY_HAS_RELATED_RECORDS", {
        statusCode: 409,
        userMessage: "This category has related records preventing deletion.",
      });
    }

    throw error;
  }

  await writeCategoryAuditLog({
    action: "category.deleted",
    actor: input.actor,
    categoryId: category.id,
    changes: {
      before: {
        name: category.name,
        slug: category.slug,
        status: category.status,
      },
      detachedProductCount,
    },
  });
}
