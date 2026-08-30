import type { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import { listAdminProductCategories } from "@/features/admin/products";
import { AppError } from "@/lib/errors/app-error";
import { getDisplayVariantLabel } from "@/lib/variant-label";
import { getPrismaClient } from "@/server/db";

import { DEAL_LOW_STOCK_THRESHOLD } from "./constants";
import type {
  AdminDealCreateInput,
  AdminDealImageInput,
  AdminDealProductInput,
  AdminDealSpecificationInput,
  AdminDealUpdateInput,
} from "./validation";

type AuditActorInput = {
  actorId: string;
  actorRole?: string | null;
};

type DealDbClient = ReturnType<typeof getPrismaClient> | Prisma.TransactionClient;

const DEFAULT_ADMIN_DEAL_PAGE_SIZE = 20;
const MAX_ADMIN_DEAL_PAGE_SIZE = 100;

export type AdminDealListFilters = {
  query?: string;
  status?: "ALL" | "DRAFT" | "PUBLISHED" | "ARCHIVED";
  page?: number;
  pageSize?: number;
};

export type AdminDealListItem = {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  categoryName: string | null;
  /** Compact summary of the included products (e.g. "A + B +1 more"). */
  productSummary: string;
  /** Number of products included in the deal. */
  itemCount: number;
  availableStock: number;
  isAvailable: boolean;
  isLowStock: boolean;
  updatedAt: Date;
};

export type AdminDealCategoryOption = {
  id: string;
  name: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
};

export type AdminDealProductVariantOption = {
  id: string;
  title: string | null;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  isDefault: boolean;
};

export type AdminDealProductOption = {
  id: string;
  name: string;
  slug: string;
  hasMultipleVariants: boolean;
  variants: AdminDealProductVariantOption[];
};

export type AdminDealFormProduct = {
  productId: string;
  productName: string;
  productSlug: string;
  variantId: string | null;
  variantTitle: string | null;
  quantity: number;
  availableStock: number;
  price: number;
  compareAtPrice: number | null;
};

export type AdminDealFormRecord = {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  categoryId: string;
  categoryName: string | null;
  categorySlug: string | null;
  price: number;
  comparePrice: number | null;
  products: AdminDealFormProduct[];
  images: Array<{ url: string; alt: string }>;
  specifications: Array<{ key: string; value: string }>;
  relatedDealIds: string[];
  seoTitle: string;
  seoDescription: string;
  seoCanonicalUrl: string;
  seoOgTitle: string;
  seoOgDescription: string;
  seoImageUrl: string;
  seoNoIndex: boolean;
  seoSchemaNotes: string;
  /** Available stock on the least-available included product. */
  availableStock: number;
  isAvailable: boolean;
  isLowStock: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminRelatedDealOption = {
  id: string;
  title: string;
  slug: string;
  categoryName: string | null;
};

export type AdminRelatedDealsFilter = {
  excludeDealId?: string;
  categoryId?: string;
  query?: string;
  take?: number;
  selectedIds?: string[];
};

const adminDealListSelect = {
  id: true,
  title: true,
  slug: true,
  status: true,
  updatedAt: true,
  category: {
    select: {
      name: true,
    },
  },
  products: {
    orderBy: { position: "asc" as const },
    select: {
      quantity: true,
      product: {
        select: {
          name: true,
          variants: {
            orderBy: [{ isDefault: "desc" as const }, { createdAt: "asc" as const }],
            select: {
              id: true,
              isDefault: true,
              inventory: {
                select: {
                  quantity: true,
                },
              },
            },
          },
        },
      },
      productVariant: {
        select: {
          id: true,
        },
      },
    },
  },
} satisfies Prisma.DealSelect;

type SelectedAdminDealList = Prisma.DealGetPayload<{ select: typeof adminDealListSelect }>;

const adminDealFormSelect = {
  id: true,
  title: true,
  slug: true,
  shortDescription: true,
  description: true,
  status: true,
  categoryId: true,
  price: true,
  compareAtPrice: true,
  metadata: true,
  seoTitle: true,
  seoDescription: true,
  seoCanonicalUrl: true,
  seoOgTitle: true,
  seoOgDescription: true,
  seoImageUrl: true,
  seoNoIndex: true,
  seoSchemaNotes: true,
  createdAt: true,
  updatedAt: true,
  images: {
    orderBy: { position: "asc" as const },
    select: {
      url: true,
      alt: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  products: {
    orderBy: { position: "asc" as const },
    select: {
      id: true,
      quantity: true,
      productVariantId: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          categoryId: true,
          variants: {
            orderBy: [{ isDefault: "desc" as const }, { createdAt: "asc" as const }],
            select: {
              id: true,
              title: true,
              price: true,
              compareAtPrice: true,
              isDefault: true,
              inventory: {
                select: {
                  quantity: true,
                },
              },
            },
          },
        },
      },
    },
  },
  specifications: {
    orderBy: { position: "asc" as const },
    select: {
      key: true,
      value: true,
    },
  },
} satisfies Prisma.DealSelect;

type SelectedAdminDealForm = Prisma.DealGetPayload<{ select: typeof adminDealFormSelect }>;

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
    return DEFAULT_ADMIN_DEAL_PAGE_SIZE;
  }

  return Math.min(MAX_ADMIN_DEAL_PAGE_SIZE, Math.max(1, Math.floor(value ?? DEFAULT_ADMIN_DEAL_PAGE_SIZE)));
}

/**
 * Resolves the effective variant for a deal product: the explicitly linked
 * variant, or the product's default variant (falling back to the first).
 */
function resolveEffectiveVariant<T extends { id: string; isDefault: boolean }>(
  variants: T[],
  linkedVariantId: string | null | undefined,
): T | null {
  if (linkedVariantId) {
    return variants.find((variant) => variant.id === linkedVariantId) ?? null;
  }

  return variants.find((variant) => variant.isDefault) ?? variants[0] ?? null;
}

function computeVariantStock(
  variant: { inventory?: { quantity: number } | null } | null | undefined,
) {
  return variant?.inventory?.quantity ?? 0;
}

function buildProductSummary(names: string[]) {
  if (names.length === 0) {
    return "No products";
  }

  if (names.length === 1) {
    return names[0] ?? "Product";
  }

  if (names.length === 2) {
    return `${names[0] ?? ""} + ${names[1] ?? ""}`;
  }

  return `${names.slice(0, 2).join(" + ")} +${names.length - 2} more`;
}

function mapAdminDealListItem(record: SelectedAdminDealList): AdminDealListItem {
  const stocks = record.products.map((row) => {
    const effectiveVariant = resolveEffectiveVariant(row.product.variants, row.productVariant?.id);
    return computeVariantStock(effectiveVariant);
  });
  const availableStock = stocks.length === 0 ? 0 : Math.min(...stocks);

  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    status: record.status,
    categoryName: record.category?.name ?? null,
    productSummary: buildProductSummary(record.products.map((row) => row.product.name)),
    itemCount: record.products.length,
    availableStock,
    isAvailable: availableStock > 0,
    isLowStock: availableStock > 0 && availableStock <= DEAL_LOW_STOCK_THRESHOLD,
    updatedAt: record.updatedAt,
  };
}

function parseDealMetadata(metadata: Prisma.JsonValue | null | undefined) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { relatedDealIds: [] as string[] };
  }

  const source = metadata as Record<string, unknown>;
  const rawRelated = source.relatedDealIds;

  return {
    relatedDealIds: Array.isArray(rawRelated) ? rawRelated.map((item) => `${item}`).filter(Boolean) : [],
  };
}

function mapAdminDealFormRecord(record: SelectedAdminDealForm): AdminDealFormRecord {
  const metadata = parseDealMetadata(record.metadata);
  const products: AdminDealFormProduct[] = record.products.map((row) => {
    const effectiveVariant = resolveEffectiveVariant(row.product.variants, row.productVariantId);
    return {
      productId: row.product.id,
      productName: row.product.name,
      productSlug: row.product.slug,
      variantId: row.productVariantId ?? null,
      variantTitle: effectiveVariant ? getDisplayVariantLabel(effectiveVariant.title) : null,
      quantity: row.quantity,
      availableStock: computeVariantStock(effectiveVariant),
      price: effectiveVariant?.price ?? 0,
      compareAtPrice: effectiveVariant?.compareAtPrice ?? null,
    };
  });
  const availableStock = products.length === 0 ? 0 : Math.min(...products.map((product) => product.availableStock));

  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    shortDescription: record.shortDescription ?? "",
    description: record.description ?? "",
    status: record.status,
    categoryId: record.categoryId ?? "",
    categoryName: record.category?.name ?? null,
    categorySlug: record.category?.slug ?? null,
    price: record.price,
    comparePrice: record.compareAtPrice ?? null,
    products,
    images: record.images.map((image) => ({
      url: image.url,
      alt: image.alt ?? "",
    })),
    specifications: record.specifications.map((specification) => ({
      key: specification.key,
      value: specification.value,
    })),
    relatedDealIds: metadata.relatedDealIds,
    seoTitle: record.seoTitle ?? "",
    seoDescription: record.seoDescription ?? "",
    seoCanonicalUrl: record.seoCanonicalUrl ?? "",
    seoOgTitle: record.seoOgTitle ?? "",
    seoOgDescription: record.seoOgDescription ?? "",
    seoImageUrl: record.seoImageUrl ?? "",
    seoNoIndex: record.seoNoIndex ?? false,
    seoSchemaNotes: record.seoSchemaNotes ?? "",
    availableStock,
    isAvailable: availableStock > 0,
    isLowStock: availableStock > 0 && availableStock <= DEAL_LOW_STOCK_THRESHOLD,
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
      return new AppError("Deal slug must be unique.", "DEAL_SLUG_TAKEN", {
        statusCode: 409,
        userMessage: "This slug is already used by another deal.",
      });
    }
  }

  if (error.code === "P2003") {
    return new AppError("Deal references a missing product or variant.", "DEAL_REFERENCE_INVALID", {
      statusCode: 400,
      userMessage: "The selected product or variant is no longer available.",
    });
  }

  if (error.code === "P2025") {
    return new AppError("Deal not found.", "DEAL_NOT_FOUND", {
      statusCode: 404,
      userMessage: "The selected deal no longer exists.",
    });
  }

  return null;
}

async function writeDealAuditLog(tx: any, input: {
  action: "deal.created" | "deal.updated" | "deal.deleted";
  actor: AuditActorInput;
  dealId: string;
  changes: Record<string, unknown>;
}) {
  await tx.auditLog.create({
    data: {
      actorId: input.actor.actorId,
      action: input.action,
      model: "Deal",
      modelId: input.dealId,
      changes: {
        actorRole: input.actor.actorRole ?? null,
        ...input.changes,
      },
    },
  });
}

type LoadedDealProductContext = {
  product: {
    id: string;
    name: string;
    categoryId: string | null;
    variants: Array<{
      id: string;
      title: string | null;
      isDefault: boolean;
      price: number;
      compareAtPrice: number | null;
      inventory?: { quantity: number } | null;
    }>;
  };
  effectiveVariant: {
    id: string;
    title: string | null;
    isDefault: boolean;
    price: number;
    compareAtPrice: number | null;
    inventory?: { quantity: number } | null;
  } | null;
  availableStock: number;
};

/**
 * Validates that a deal's included products all belong to the selected
 * category, that any linked variant belongs to its product, and that each
 * product's quantity does not exceed its effective variant's available stock.
 * Returns the resolved contexts (in input order) for reuse.
 */
async function loadDealProductContexts(
  input: { categoryId: string; products: AdminDealProductInput[] },
  dbClient: DealDbClient = getPrismaClient(),
): Promise<LoadedDealProductContext[]> {
  if (input.products.length === 0) {
    return [];
  }

  const category = await dbClient.category.findUnique({
    where: { id: input.categoryId },
    select: { id: true },
  });

  if (!category) {
    throw new AppError("Deal category is invalid.", "DEAL_CATEGORY_INVALID", {
      statusCode: 400,
      userMessage: "Choose a valid category before saving the deal.",
    });
  }

  const productIds = [...new Set(input.products.map((product) => product.productId))];
  const products = await dbClient.product.findMany({
    where: {
      id: { in: productIds },
    },
    select: {
      id: true,
      name: true,
      categoryId: true,
      variants: {
        orderBy: [{ isDefault: "desc" as const }, { createdAt: "asc" as const }],
        select: {
          id: true,
          title: true,
          price: true,
          compareAtPrice: true,
          isDefault: true,
          inventory: {
            select: {
              quantity: true,
            },
          },
        },
      },
    },
  });

  const productById = new Map(products.map((product) => [product.id, product]));

  return input.products.map((entry) => {
    const product = productById.get(entry.productId);

    if (!product) {
      throw new AppError("Deal product is invalid.", "DEAL_PRODUCT_INVALID", {
        statusCode: 400,
        userMessage: "One of the selected products is no longer available.",
      });
    }

    if (product.categoryId !== input.categoryId) {
      throw new AppError("Deal product does not belong to the selected category.", "DEAL_PRODUCT_CATEGORY_MISMATCH", {
        statusCode: 400,
        userMessage: "Every included product must belong to the selected category.",
      });
    }

    if (entry.variantId && !product.variants.some((variant) => variant.id === entry.variantId)) {
      throw new AppError("Deal variant does not belong to the selected product.", "DEAL_VARIANT_INVALID", {
        statusCode: 400,
        userMessage: "One of the selected variants does not belong to its product.",
      });
    }

    const effectiveVariant = resolveEffectiveVariant(product.variants, entry.variantId);
    const availableStock = computeVariantStock(effectiveVariant);

    if (entry.quantity > availableStock) {
      throw new AppError("Deal quantity exceeds available stock.", "DEAL_STOCK_EXCEEDED", {
        statusCode: 400,
        userMessage: `Quantity (${entry.quantity}) for "${product.name}" exceeds available stock (${availableStock}). Reduce the quantity or restock the product.`,
      });
    }

    return {
      product,
      effectiveVariant,
      availableStock,
    };
  });
}

async function normalizeRelatedDealIds(
  ids: string[] | undefined,
  options: { dbClient?: DealDbClient; excludeId?: string } = {},
) {
  const dbClient = options.dbClient ?? getPrismaClient();
  const uniqueIds = [...new Set((ids ?? []).map((id) => id.trim()).filter(Boolean))].filter((id) => id !== options.excludeId);

  if (uniqueIds.length === 0) {
    return [];
  }

  const matches = await dbClient.deal.findMany({
    where: {
      id: {
        in: uniqueIds,
      },
    },
    select: {
      id: true,
    },
  });

  if (matches.length !== uniqueIds.length) {
    throw new AppError("One or more related deals are invalid.", "DEAL_RELATED_INVALID", {
      statusCode: 400,
      userMessage: "One or more related deals are no longer available.",
    });
  }

  return matches.map((item) => item.id);
}

async function createDealImages(tx: any, dealId: string, images: AdminDealImageInput[] | undefined) {
  if (!images || images.length === 0) {
    return;
  }

  await tx.dealImage.createMany({
    data: images.map((image, index) => ({
      dealId,
      url: image.url,
      alt: image.alt ?? null,
      position: index,
    })),
  });
}

async function createDealProducts(tx: any, dealId: string, products: AdminDealProductInput[] | undefined) {
  if (!products || products.length === 0) {
    return;
  }

  await tx.dealProduct.createMany({
    data: products.map((product, index) => ({
      dealId,
      productId: product.productId,
      productVariantId: product.variantId ?? null,
      quantity: product.quantity,
      position: index,
    })),
  });
}

async function createDealSpecifications(tx: any, dealId: string, specifications: AdminDealSpecificationInput[] | undefined) {
  if (!specifications || specifications.length === 0) {
    return;
  }

  await tx.dealSpecification.createMany({
    data: specifications.map((specification, index) => ({
      dealId,
      key: specification.key,
      value: specification.value,
      position: index,
    })),
  });
}

export async function listAdminDeals(filters: AdminDealListFilters = {}): Promise<AdminDealListItem[]> {
  const db = getPrismaClient();
  const query = filters.query?.trim();
  const status = isKnownStatus(filters.status) ? filters.status : undefined;
  const page = normalizePage(filters.page);
  const pageSize = normalizePageSize(filters.pageSize);
  const conditions: Prisma.DealWhereInput[] = [];

  if (status) {
    conditions.push({ status });
  }

  if (query) {
    conditions.push({
      OR: [
        {
          title: {
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
          products: {
            some: {
              product: {
                name: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },
        },
      ],
    });
  }

  const records = await db.deal.findMany({
    ...(conditions.length > 0 ? { where: { AND: conditions } } : {}),
    select: adminDealListSelect,
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return records.map(mapAdminDealListItem);
}

/**
 * Categories available for deal products. Reuses the product admin category
 * options so the deals picker stays consistent with the catalog.
 */
export async function listAdminDealCategories(): Promise<AdminDealCategoryOption[]> {
  return listAdminProductCategories();
}

/**
 * Products (with variants + stock) for a given category. Used by the deal form
 * product rows and the `GET /api/admin/deals/products` route.
 */
export async function listAdminDealProducts(categoryId: string): Promise<AdminDealProductOption[]> {
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
      variants: {
        orderBy: [{ isDefault: "desc" as const }, { createdAt: "asc" as const }],
        select: {
          id: true,
          title: true,
          sku: true,
          price: true,
          compareAtPrice: true,
          isDefault: true,
          inventory: {
            select: {
              quantity: true,
            },
          },
        },
      },
    },
  });

  return records.map((record) => ({
    id: record.id,
    name: record.name,
    slug: record.slug,
    hasMultipleVariants: record.variants.length > 1,
    variants: record.variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      stock: variant.inventory?.quantity ?? 0,
      isDefault: variant.isDefault,
    })),
  }));
}

/**
 * Deals for the related-deals picker (debounced client search). Selected ids
 * are pinned to the top, mirroring the related-products picker.
 */
export async function listAdminRelatedDeals(
  filter: AdminRelatedDealsFilter = {},
): Promise<AdminRelatedDealOption[]> {
  const db = getPrismaClient();

  const { excludeDealId, categoryId, query, take = 20, selectedIds = [] } = filter;
  const conditions: Prisma.DealWhereInput[] = [];

  if (excludeDealId) {
    conditions.push({ NOT: { id: excludeDealId } });
  }

  if (categoryId) {
    conditions.push({ categoryId });
  }

  const normalizedQuery = query?.trim();
  if (normalizedQuery) {
    conditions.push({
      OR: [
        {
          title: {
            contains: normalizedQuery,
            mode: "insensitive",
          },
        },
        {
          slug: {
            contains: normalizedQuery,
            mode: "insensitive",
          },
        },
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
            ...(excludeDealId ? { NOT: { id: excludeDealId } } : {}),
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

export async function getAdminDealById(dealId: string): Promise<AdminDealFormRecord | null> {
  const db = getPrismaClient();
  const record = await db.deal.findUnique({
    where: { id: dealId },
    select: adminDealFormSelect,
  });

  if (!record) {
    return null;
  }

  return mapAdminDealFormRecord(record);
}

function buildDealMutationData(data: AdminDealCreateInput) {
  return {
    title: data.title,
    slug: data.slug,
    shortDescription: data.shortDescription ?? null,
    description: data.description ?? null,
    status: data.status,
    categoryId: data.categoryId,
    price: data.price,
    compareAtPrice: data.comparePrice ?? null,
    metadata: {
      relatedDealIds: data.relatedDealIds,
    },
    seoTitle: data.seoTitle ?? null,
    seoDescription: data.seoDescription ?? null,
    seoCanonicalUrl: data.seoCanonicalUrl ?? null,
    seoOgTitle: data.seoOgTitle ?? null,
    seoOgDescription: data.seoOgDescription ?? null,
    seoImageUrl: data.seoImageUrl ?? null,
    seoNoIndex: data.seoNoIndex ?? false,
    seoSchemaNotes: data.seoSchemaNotes ?? null,
  };
}

export async function createAdminDeal(input: {
  data: AdminDealCreateInput;
  actor: AuditActorInput;
}): Promise<AdminDealFormRecord> {
  const db = getPrismaClient();

  try {
    return await db.$transaction(async (tx) => {
      // Backend stock validation: every included product's quantity cannot
      // exceed its effective variant's stock, and all products must belong to
      // the selected category.
      await loadDealProductContexts(
        {
          categoryId: input.data.categoryId,
          products: input.data.products,
        },
        tx,
      );

      const relatedDealIds = await normalizeRelatedDealIds(input.data.relatedDealIds, { dbClient: tx });

      const created = await tx.deal.create({
        data: {
          ...buildDealMutationData(input.data),
          metadata: {
            relatedDealIds,
          },
        },
        select: {
          id: true,
        },
      });

      await createDealProducts(tx, created.id, input.data.products);
      await createDealImages(tx, created.id, input.data.images);
      await createDealSpecifications(tx, created.id, input.data.specifications);

      await writeDealAuditLog(tx, {
        action: "deal.created",
        actor: input.actor,
        dealId: created.id,
        changes: {
          after: {
            title: input.data.title,
            slug: input.data.slug,
            status: input.data.status,
            categoryId: input.data.categoryId,
            productCount: input.data.products.length,
            price: input.data.price,
            relatedDealIds,
          },
        },
      });

      const record = await tx.deal.findUnique({
        where: { id: created.id },
        select: adminDealFormSelect,
      });

      if (!record) {
        throw new AppError("Deal could not be reloaded after creation.", "DEAL_NOT_FOUND", {
          statusCode: 500,
          userMessage: "The saved deal could not be reloaded.",
        });
      }

      return mapAdminDealFormRecord(record);
    });
  } catch (error) {
    const mutationError = buildMutationError(error);
    if (mutationError) {
      throw mutationError;
    }

    throw error;
  }
}

export async function updateAdminDeal(input: {
  data: AdminDealUpdateInput;
  actor: AuditActorInput;
}): Promise<AdminDealFormRecord> {
  const db = getPrismaClient();
  const previous = await db.deal.findUnique({
    where: { id: input.data.id },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
    },
  });

  if (!previous) {
    throw new AppError("Deal not found.", "DEAL_NOT_FOUND", {
      statusCode: 404,
      userMessage: "The selected deal no longer exists.",
    });
  }

  try {
    return await db.$transaction(async (tx) => {
      await loadDealProductContexts(
        {
          categoryId: input.data.categoryId,
          products: input.data.products,
        },
        tx,
      );

      const relatedDealIds = await normalizeRelatedDealIds(input.data.relatedDealIds, {
        dbClient: tx,
        excludeId: input.data.id,
      });

      await tx.deal.update({
        where: { id: input.data.id },
        data: {
          ...buildDealMutationData(input.data),
          metadata: {
            relatedDealIds,
          },
        },
      });

      await tx.dealProduct.deleteMany({
        where: { dealId: input.data.id },
      });
      await createDealProducts(tx, input.data.id, input.data.products);

      await tx.dealImage.deleteMany({
        where: { dealId: input.data.id },
      });
      await createDealImages(tx, input.data.id, input.data.images);

      await tx.dealSpecification.deleteMany({
        where: { dealId: input.data.id },
      });
      await createDealSpecifications(tx, input.data.id, input.data.specifications);

      const updated = await tx.deal.findUnique({
        where: { id: input.data.id },
        select: adminDealFormSelect,
      });

      if (!updated) {
        throw new AppError("Deal not found after update.", "DEAL_NOT_FOUND", {
          statusCode: 404,
          userMessage: "The saved deal could not be reloaded.",
        });
      }

      await writeDealAuditLog(tx, {
        action: "deal.updated",
        actor: input.actor,
        dealId: input.data.id,
        changes: {
          before: {
            title: previous.title,
            slug: previous.slug,
            status: previous.status,
          },
          after: {
            title: updated.title,
            slug: updated.slug,
            status: updated.status,
            categoryId: updated.categoryId,
            productCount: updated.products.length,
            price: updated.price,
            relatedDealIds,
          },
        },
      });

      return mapAdminDealFormRecord(updated);
    });
  } catch (error) {
    const mutationError = buildMutationError(error);
    if (mutationError) {
      throw mutationError;
    }

    throw error;
  }
}

export async function deleteAdminDeal(input: {
  dealId: string;
  actor: AuditActorInput;
}) {
  const db = getPrismaClient();

  const deal = await db.deal.findUnique({
    where: { id: input.dealId },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
    },
  });

  if (!deal) {
    throw new AppError("Deal not found.", "DEAL_NOT_FOUND", {
      statusCode: 404,
      userMessage: "The selected deal no longer exists.",
    });
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.dealImage.deleteMany({
        where: { dealId: deal.id },
      });
      await tx.dealProduct.deleteMany({
        where: { dealId: deal.id },
      });
      await tx.dealSpecification.deleteMany({
        where: { dealId: deal.id },
      });

      await tx.deal.delete({
        where: { id: deal.id },
      });

      await writeDealAuditLog(tx, {
        action: "deal.deleted",
        actor: input.actor,
        dealId: deal.id,
        changes: {
          before: {
            title: deal.title,
            slug: deal.slug,
            status: deal.status,
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
