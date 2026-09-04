import type { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import type { AdminProductCategoryOption } from "@/features/admin/products";
import { listAdminProductCategories } from "@/features/admin/products";
import { AppError } from "@/lib/errors/app-error";
import { getPrismaClient } from "@/server/db";

import { DEFAULT_ADMIN_OCCASION_PAGE_SIZE, MAX_ADMIN_OCCASION_PAGE_SIZE } from "./constants";
import type { AdminOccasionCreateInput, AdminOccasionProductInput, AdminOccasionUpdateInput } from "./validation";

type AuditActorInput = {
  actorId: string;
  actorRole?: string | null;
};

type OccasionDbClient = ReturnType<typeof getPrismaClient> | Prisma.TransactionClient;

export type AdminOccasionListFilters = {
  query?: string;
  status?: "ALL" | "DRAFT" | "PUBLISHED" | "ARCHIVED";
  kind?: "ALL" | "SPECIAL" | "NORMAL";
  page?: number;
  pageSize?: number;
};

export type AdminOccasionListItem = {
  id: string;
  name: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isSpecial: boolean;
  coverImageUrl: string | null;
  productCount: number;
  dealCount: number;
  /** Total curated items (products + deals). */
  itemCount: number;
  updatedAt: Date;
};

/** Categories available for the occasion product pickers (mirrors product admin options). */
export type AdminOccasionCategoryOption = AdminProductCategoryOption;

export type AdminOccasionProductOption = {
  id: string;
  name: string;
  slug: string;
  categoryId: string | null;
  categoryName: string | null;
};

export type AdminOccasionDealOption = {
  id: string;
  title: string;
  slug: string;
  categoryName: string | null;
};

export type AdminOccasionSearchResult = {
  categories: AdminOccasionCategoryOption[];
  products: Array<{
    id: string;
    name: string;
    slug: string;
    categoryId: string | null;
    categoryName: string | null;
  }>;
  deals: AdminOccasionDealOption[];
};

export type AdminOccasionFormProduct = {
  productId: string;
  productName: string;
  productSlug: string;
  categoryId: string | null;
  categoryName: string | null;
};

export type AdminOccasionFormDeal = {
  dealId: string;
  dealTitle: string;
  dealSlug: string;
};

export type AdminOccasionFormRecord = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  coverImageUrl: string;
  coverImageAlt: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isSpecial: boolean;
  products: AdminOccasionFormProduct[];
  deals: AdminOccasionFormDeal[];
  seoTitle: string;
  seoDescription: string;
  seoCanonicalUrl: string;
  seoOgTitle: string;
  seoOgDescription: string;
  seoImageUrl: string;
  seoKeywords: string;
  seoNoIndex: boolean;
  seoSchemaNotes: string;
  createdAt: Date;
  updatedAt: Date;
};

const adminOccasionListSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  isSpecial: true,
  coverImageUrl: true,
  updatedAt: true,
  _count: {
    select: {
      products: true,
      deals: true,
    },
  },
} satisfies Prisma.OccasionSelect;

type SelectedAdminOccasionList = Prisma.OccasionGetPayload<{ select: typeof adminOccasionListSelect }>;

const adminOccasionFormSelect = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  description: true,
  coverImageUrl: true,
  coverImageAlt: true,
  status: true,
  isSpecial: true,
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
  products: {
    orderBy: { position: "asc" as const },
    select: {
      productId: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          categoryId: true,
          category: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  },
  deals: {
    orderBy: { position: "asc" as const },
    select: {
      dealId: true,
      deal: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
    },
  },
} satisfies Prisma.OccasionSelect;

type SelectedAdminOccasionForm = Prisma.OccasionGetPayload<{ select: typeof adminOccasionFormSelect }>;

function isKnownStatus(value: string | undefined): value is "DRAFT" | "PUBLISHED" | "ARCHIVED" {
  return value === "DRAFT" || value === "PUBLISHED" || value === "ARCHIVED";
}

function normalizePage(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.floor(value ?? 1));
}

function normalizePageSize(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return DEFAULT_ADMIN_OCCASION_PAGE_SIZE;
  }

  return Math.min(
    MAX_ADMIN_OCCASION_PAGE_SIZE,
    Math.max(1, Math.floor(value ?? DEFAULT_ADMIN_OCCASION_PAGE_SIZE)),
  );
}

function mapAdminOccasionListItem(record: SelectedAdminOccasionList): AdminOccasionListItem {
  const productCount = record._count.products;
  const dealCount = record._count.deals;

  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    status: record.status,
    isSpecial: record.isSpecial,
    coverImageUrl: record.coverImageUrl,
    productCount,
    dealCount,
    itemCount: productCount + dealCount,
    updatedAt: record.updatedAt,
  };
}

function mapAdminOccasionFormRecord(record: SelectedAdminOccasionForm): AdminOccasionFormRecord {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    shortDescription: record.shortDescription ?? "",
    description: record.description ?? "",
    coverImageUrl: record.coverImageUrl ?? "",
    coverImageAlt: record.coverImageAlt ?? "",
    status: record.status,
    isSpecial: record.isSpecial,
    products: record.products.map((row) => ({
      productId: row.product.id,
      productName: row.product.name,
      productSlug: row.product.slug,
      categoryId: row.product.categoryId,
      categoryName: row.product.category?.name ?? null,
    })),
    deals: record.deals.map((row) => ({
      dealId: row.deal.id,
      dealTitle: row.deal.title,
      dealSlug: row.deal.slug,
    })),
    seoTitle: record.seoTitle ?? "",
    seoDescription: record.seoDescription ?? "",
    seoCanonicalUrl: record.seoCanonicalUrl ?? "",
    seoOgTitle: record.seoOgTitle ?? "",
    seoOgDescription: record.seoOgDescription ?? "",
    seoImageUrl: record.seoImageUrl ?? "",
    seoKeywords: record.seoKeywords ?? "",
    seoNoIndex: record.seoNoIndex ?? false,
    seoSchemaNotes: record.seoSchemaNotes ?? "",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function buildMutationError(error: unknown): AppError | null {
  if (!(error instanceof PrismaClientKnownRequestError)) {
    return null;
  }

  if (error.code === "P2002") {
    const rawTarget = error.meta?.target;
    const targets = Array.isArray(rawTarget)
      ? rawTarget.map((value) => `${value}`.toLowerCase())
      : typeof rawTarget === "string"
        ? [rawTarget.toLowerCase()]
        : [];

    if (targets.some((target) => target.includes("slug"))) {
      return new AppError("Occasion slug must be unique.", "OCCASION_SLUG_TAKEN", {
        statusCode: 409,
        userMessage: "This slug is already used by another occasion.",
      });
    }
  }

  if (error.code === "P2003") {
    return new AppError("Occasion references a missing product or deal.", "OCCASION_REFERENCE_INVALID", {
      statusCode: 400,
      userMessage: "One of the selected products or deals is no longer available.",
    });
  }

  if (error.code === "P2025") {
    return new AppError("Occasion not found.", "OCCASION_NOT_FOUND", {
      statusCode: 404,
      userMessage: "The selected occasion no longer exists.",
    });
  }

  return null;
}

async function writeOccasionAuditLog(tx: OccasionDbClient, input: {
  action: "occasion.created" | "occasion.updated" | "occasion.deleted";
  actor: AuditActorInput;
  occasionId: string;
  changes: Record<string, unknown>;
}) {
  await tx.auditLog.create({
    data: {
      actorId: input.actor.actorId,
      action: input.action,
      model: "Occasion",
      modelId: input.occasionId,
      changes: {
        actorRole: input.actor.actorRole ?? null,
        ...input.changes,
      },
    },
  });
}

/**
 * Validates that every curated product and deal id still exists. Runs inside
 * the mutation transaction so a missing item aborts the whole save.
 */
async function validateOccasionItems(
  input: { products: AdminOccasionProductInput[]; dealIds: string[] },
  dbClient: OccasionDbClient,
) {
  const productIds = [...new Set(input.products.map((product) => product.productId).filter(Boolean))];
  const dealIds = [...new Set(input.dealIds)];

  if (productIds.length > 0) {
    const productMatches = await dbClient.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });

    if (productMatches.length !== productIds.length) {
      throw new AppError("One or more occasion products are invalid.", "OCCASION_PRODUCT_INVALID", {
        statusCode: 400,
        userMessage: "One or more selected products are no longer available.",
      });
    }
  }

  if (dealIds.length > 0) {
    const dealMatches = await dbClient.deal.findMany({
      where: { id: { in: dealIds } },
      select: { id: true },
    });

    if (dealMatches.length !== dealIds.length) {
      throw new AppError("One or more occasion deals are invalid.", "OCCASION_DEAL_INVALID", {
        statusCode: 400,
        userMessage: "One or more selected deals are no longer available.",
      });
    }
  }
}

async function createOccasionProducts(tx: OccasionDbClient, occasionId: string, products: AdminOccasionProductInput[]) {
  if (products.length === 0) {
    return;
  }

  await tx.occasionProduct.createMany({
    data: products
      .map((product, index) => ({
        occasionId,
        productId: product.productId,
        position: index,
      }))
      .filter((row, index, all) => all.findIndex((candidate) => candidate.productId === row.productId) === index),
  });
}

async function createOccasionDeals(tx: OccasionDbClient, occasionId: string, dealIds: string[]) {
  const uniqueIds = [...new Set(dealIds)];

  if (uniqueIds.length === 0) {
    return;
  }

  await tx.occasionDeal.createMany({
    data: uniqueIds.map((dealId, index) => ({
      occasionId,
      dealId,
      position: index,
    })),
  });
}

export async function listAdminOccasions(filters: AdminOccasionListFilters = {}): Promise<AdminOccasionListItem[]> {
  const db = getPrismaClient();
  const query = filters.query?.trim();
  const status = isKnownStatus(filters.status) ? filters.status : undefined;
  const page = normalizePage(filters.page);
  const pageSize = normalizePageSize(filters.pageSize);
  const conditions: Prisma.OccasionWhereInput[] = [];

  if (status) {
    conditions.push({ status });
  }

  if (filters.kind === "SPECIAL") {
    conditions.push({ isSpecial: true });
  } else if (filters.kind === "NORMAL") {
    conditions.push({ isSpecial: false });
  }

  if (query) {
    conditions.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { slug: { contains: query, mode: "insensitive" } },
        {
          products: {
            some: {
              product: {
                name: { contains: query, mode: "insensitive" },
              },
            },
          },
        },
        {
          deals: {
            some: {
              deal: {
                title: { contains: query, mode: "insensitive" },
              },
            },
          },
        },
      ],
    });
  }

  const records = await db.occasion.findMany({
    ...(conditions.length > 0 ? { where: { AND: conditions } } : {}),
    select: adminOccasionListSelect,
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return records.map(mapAdminOccasionListItem);
}

/**
 * Categories available for the occasion product pickers. Reuses the product
 * admin category options so the pickers stay consistent with the catalog.
 */
export async function listAdminOccasionCategories(): Promise<AdminOccasionCategoryOption[]> {
  return listAdminProductCategories();
}

/**
 * Products (id/name/slug) for a given category. Used by the occasion form's
 * category → product cascade and the `GET /api/admin/occasions/products` route.
 */
export async function listAdminOccasionProducts(categoryId: string): Promise<AdminOccasionProductOption[]> {
  const db = getPrismaClient();

  if (!categoryId.trim()) {
    return [];
  }

  const records = await db.product.findMany({
    where: {
      categoryId,
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      categoryId: true,
      category: {
        select: {
          name: true,
        },
      },
    },
  });

  return records.map((record) => ({
    id: record.id,
    name: record.name,
    slug: record.slug,
    categoryId: record.categoryId,
    categoryName: record.category?.name ?? null,
  }));
}

export type AdminOccasionDealsFilter = {
  query?: string;
  take?: number;
  selectedIds?: string[];
};

/**
 * Deals for the occasion deal picker (debounced client search). Selected ids
 * are pinned to the top, mirroring the related-deals picker.
 */
export async function listAdminOccasionDeals(
  filter: AdminOccasionDealsFilter = {},
): Promise<AdminOccasionDealOption[]> {
  const db = getPrismaClient();

  const { query, take = 20, selectedIds = [] } = filter;
  const conditions: Prisma.DealWhereInput[] = [];
  const normalizedQuery = query?.trim();

  if (normalizedQuery) {
    conditions.push({
      OR: [
        { title: { contains: normalizedQuery, mode: "insensitive" } },
        { slug: { contains: normalizedQuery, mode: "insensitive" } },
      ],
    });
  }

  const [searchItems, pinnedItems] = await Promise.all([
    db.deal.findMany({
      ...(conditions.length > 0 ? { where: { AND: conditions } } : {}),
      orderBy: [{ title: "asc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        category: {
          select: {
            name: true,
          },
        },
      },
      take,
    }),
    selectedIds.length > 0
      ? db.deal.findMany({
          where: {
            id: { in: selectedIds },
          },
          select: {
            id: true,
            title: true,
            slug: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const seen = new Set<string>();
  const merged = [...pinnedItems, ...searchItems].filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });

  return merged.map((item) => ({
    id: item.id,
    title: item.title,
    slug: item.slug,
    categoryName: item.category?.name ?? null,
  }));
}

/**
 * Combined catalog search for the occasion form's "quick search" field.
 * Returns matching categories, products, and deals so an admin can jump
 * between content types in one place.
 */
export async function searchAdminOccasionCatalog(
  query: string,
): Promise<AdminOccasionSearchResult> {
  const db = getPrismaClient();
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return { categories: [], products: [], deals: [] };
  }

  const matchesQuery = {
    contains: normalizedQuery,
    mode: "insensitive" as const,
  };

  const [categories, products, deals] = await Promise.all([
    db.category.findMany({
      where: {
        OR: [{ name: matchesQuery }, { slug: matchesQuery }],
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
      },
      take: 6,
    }),
    db.product.findMany({
      where: {
        OR: [{ name: matchesQuery }, { slug: matchesQuery }],
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        categoryId: true,
        category: {
          select: {
            name: true,
          },
        },
      },
      take: 8,
    }),
    db.deal.findMany({
      where: {
        OR: [{ title: matchesQuery }, { slug: matchesQuery }],
      },
      orderBy: [{ title: "asc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        category: {
          select: {
            name: true,
          },
        },
      },
      take: 8,
    }),
  ]);

  return {
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      status: category.status,
    })),
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      categoryId: product.categoryId,
      categoryName: product.category?.name ?? null,
    })),
    deals: deals.map((deal) => ({
      id: deal.id,
      title: deal.title,
      slug: deal.slug,
      categoryName: deal.category?.name ?? null,
    })),
  };
}

export async function getAdminOccasionById(occasionId: string): Promise<AdminOccasionFormRecord | null> {
  const db = getPrismaClient();
  const record = await db.occasion.findUnique({
    where: { id: occasionId },
    select: adminOccasionFormSelect,
  });

  if (!record) {
    return null;
  }

  return mapAdminOccasionFormRecord(record);
}

function buildOccasionMutationData(data: AdminOccasionCreateInput) {
  return {
    name: data.name,
    slug: data.slug,
    shortDescription: data.shortDescription ?? null,
    description: data.description ?? null,
    coverImageUrl: data.coverImageUrl ?? null,
    coverImageAlt: data.coverImageAlt ?? null,
    status: data.status,
    isSpecial: data.isSpecial,
    seoTitle: data.seoTitle ?? null,
    seoDescription: data.seoDescription ?? null,
    seoCanonicalUrl: data.seoCanonicalUrl ?? null,
    seoOgTitle: data.seoOgTitle ?? null,
    seoOgDescription: data.seoOgDescription ?? null,
    seoImageUrl: data.seoImageUrl ?? null,
    seoKeywords: data.seoKeywords ?? null,
    seoNoIndex: data.seoNoIndex ?? false,
    seoSchemaNotes: data.seoSchemaNotes ?? null,
  };
}

export async function createAdminOccasion(input: {
  data: AdminOccasionCreateInput;
  actor: AuditActorInput;
}): Promise<AdminOccasionFormRecord> {
  const db = getPrismaClient();

  try {
    return await db.$transaction(async (tx) => {
      await validateOccasionItems(
        {
          products: input.data.products,
          dealIds: input.data.dealIds,
        },
        tx,
      );

      const created = await tx.occasion.create({
        data: buildOccasionMutationData(input.data),
        select: {
          id: true,
        },
      });

      await createOccasionProducts(tx, created.id, input.data.products);
      await createOccasionDeals(tx, created.id, input.data.dealIds);

      await writeOccasionAuditLog(tx, {
        action: "occasion.created",
        actor: input.actor,
        occasionId: created.id,
        changes: {
          after: {
            name: input.data.name,
            slug: input.data.slug,
            status: input.data.status,
            isSpecial: input.data.isSpecial,
            productCount: input.data.products.length,
            dealCount: input.data.dealIds.length,
          },
        },
      });

      const record = await tx.occasion.findUnique({
        where: { id: created.id },
        select: adminOccasionFormSelect,
      });

      if (!record) {
        throw new AppError("Occasion could not be reloaded after creation.", "OCCASION_NOT_FOUND", {
          statusCode: 500,
          userMessage: "The saved occasion could not be reloaded.",
        });
      }

      return mapAdminOccasionFormRecord(record);
    });
  } catch (error) {
    const mutationError = buildMutationError(error);
    if (mutationError) {
      throw mutationError;
    }

    throw error;
  }
}

export async function updateAdminOccasion(input: {
  data: AdminOccasionUpdateInput;
  actor: AuditActorInput;
}): Promise<AdminOccasionFormRecord> {
  const db = getPrismaClient();
  const previous = await db.occasion.findUnique({
    where: { id: input.data.id },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      isSpecial: true,
    },
  });

  if (!previous) {
    throw new AppError("Occasion not found.", "OCCASION_NOT_FOUND", {
      statusCode: 404,
      userMessage: "The selected occasion no longer exists.",
    });
  }

  try {
    return await db.$transaction(async (tx) => {
      await validateOccasionItems(
        {
          products: input.data.products,
          dealIds: input.data.dealIds,
        },
        tx,
      );

      await tx.occasion.update({
        where: { id: input.data.id },
        data: buildOccasionMutationData(input.data),
      });

      await tx.occasionProduct.deleteMany({
        where: { occasionId: input.data.id },
      });
      await createOccasionProducts(tx, input.data.id, input.data.products);

      await tx.occasionDeal.deleteMany({
        where: { occasionId: input.data.id },
      });
      await createOccasionDeals(tx, input.data.id, input.data.dealIds);

      const updated = await tx.occasion.findUnique({
        where: { id: input.data.id },
        select: adminOccasionFormSelect,
      });

      if (!updated) {
        throw new AppError("Occasion not found after update.", "OCCASION_NOT_FOUND", {
          statusCode: 404,
          userMessage: "The saved occasion could not be reloaded.",
        });
      }

      await writeOccasionAuditLog(tx, {
        action: "occasion.updated",
        actor: input.actor,
        occasionId: input.data.id,
        changes: {
          before: {
            name: previous.name,
            slug: previous.slug,
            status: previous.status,
            isSpecial: previous.isSpecial,
          },
          after: {
            name: updated.name,
            slug: updated.slug,
            status: updated.status,
            isSpecial: updated.isSpecial,
            productCount: updated.products.length,
            dealCount: updated.deals.length,
          },
        },
      });

      return mapAdminOccasionFormRecord(updated);
    });
  } catch (error) {
    const mutationError = buildMutationError(error);
    if (mutationError) {
      throw mutationError;
    }

    throw error;
  }
}

export async function deleteAdminOccasion(input: {
  occasionId: string;
  actor: AuditActorInput;
}) {
  const db = getPrismaClient();

  const occasion = await db.occasion.findUnique({
    where: { id: input.occasionId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
    },
  });

  if (!occasion) {
    throw new AppError("Occasion not found.", "OCCASION_NOT_FOUND", {
      statusCode: 404,
      userMessage: "The selected occasion no longer exists.",
    });
  }

  try {
    await db.$transaction(async (tx) => {
      // Curated product/deal links cascade on delete (DB constraint); the
      // underlying products and deals are never touched.
      await tx.occasion.delete({
        where: { id: occasion.id },
      });

      await writeOccasionAuditLog(tx, {
        action: "occasion.deleted",
        actor: input.actor,
        occasionId: occasion.id,
        changes: {
          before: {
            name: occasion.name,
            slug: occasion.slug,
            status: occasion.status,
          },
        },
      });
    });
  } catch (error) {
    const mutationError = buildMutationError(error);
    if (mutationError) {
      throw mutationError;
    }

    throw error;
  }
}
