import { Currency, Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import { formatPrice } from "@/lib/currency";
import { AppError } from "@/lib/errors/app-error";
import { getPrismaClient } from "@/server/db";

import type {
  AdminProductCreateInput,
  AdminProductImageInput,
  AdminProductSpecificationInput,
  AdminProductUpdateInput,
} from "./validation";

type AuditActorInput = {
  actorId: string;
  actorRole?: string | null;
};

type ProductDbClient = ReturnType<typeof getPrismaClient> | Prisma.TransactionClient;

const DEFAULT_ADMIN_PRODUCT_PAGE_SIZE = 20;
const MAX_ADMIN_PRODUCT_PAGE_SIZE = 100;

export type AdminProductListFilters = {
  query?: string;
  status?: "ALL" | "DRAFT" | "PUBLISHED" | "ARCHIVED";
  type?: "ALL" | "SIMPLE" | "VARIANT";
  page?: number;
  pageSize?: number;
};

export type AdminProductListItem = {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  categoryName: string | null;
  seoTitle: string | null;
  updatedAt: Date;
  priceLabel: string;
  inventoryTotal: number;
  variantCount: number;
  type: "SIMPLE" | "VARIANT";
};

export type AdminProductVariantRecord = {
  title: string;
  sku: string;
  price: number;
  comparePrice: number | null;
  stock: number;
  options: Record<string, string>;
  isDefault: boolean;
};

export type AdminProductFormRecord = {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  categoryId: string;
  categoryName: string | null;
  categorySlug: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  sku: string;
  price: number;
  comparePrice: number | null;
  stock: number;
  variantsEnabled: boolean;
  variants: AdminProductVariantRecord[];
  /**
   * Product images. `variantIndex` is the index into `variants` when the image
   * belongs to a specific variant, or `null` when it is product-level (shared).
   */
  images: Array<{ url: string; alt: string; variantIndex: number | null }>;
  specifications: Array<{ key: string; value: string }>;
  relatedProductIds: string[];
  seoTitle: string;
  seoDescription: string;
  seoCanonicalUrl: string;
  seoOgTitle: string;
  seoOgDescription: string;
  seoImageUrl: string;
  seoNoIndex: boolean;
  seoSchemaNotes: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminProductCategoryOption = {
  id: string;
  name: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
};

export type AdminRelatedProductOption = {
  id: string;
  title: string;
  slug: string;
  categoryName: string | null;
};

export type AdminRelatedProductsFilter = {
  excludeProductId?: string;
  categoryId?: string;
  query?: string;
  take?: number;
  selectedIds?: string[];
};

const adminProductSelect = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  description: true,
  status: true,
  masterSku: true,
  seoTitle: true,
  seoDescription: true,
  seoCanonicalUrl: true,
  seoOgTitle: true,
  seoOgDescription: true,
  seoImageUrl: true,
  seoNoIndex: true,
  seoSchemaNotes: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  images: {
    orderBy: { position: "asc" },
    select: {
      url: true,
      alt: true,
      position: true,
      productVariantId: true,
    },
  },
  specifications: {
    orderBy: { position: "asc" },
    select: {
      key: true,
      value: true,
      position: true,
    },
  },
  variants: {
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      sku: true,
      options: true,
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
} satisfies Prisma.ProductSelect;

const adminProductListSelect = {
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
  variants: {
    select: {
      price: true,
      inventory: {
        select: {
          quantity: true,
        },
      },
    },
  },
} satisfies Prisma.ProductSelect;

type SelectedAdminProduct = Prisma.ProductGetPayload<{ select: typeof adminProductSelect }>;
type SelectedAdminProductList = Prisma.ProductGetPayload<{ select: typeof adminProductListSelect }>;

function isKnownStatus(value: string | undefined): value is "DRAFT" | "PUBLISHED" | "ARCHIVED" {
  return value === "DRAFT" || value === "PUBLISHED" || value === "ARCHIVED";
}

function isKnownType(value: string | undefined): value is "SIMPLE" | "VARIANT" {
  return value === "SIMPLE" || value === "VARIANT";
}

function normalizePage(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.floor(value ?? 1));
}

function normalizePageSize(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return DEFAULT_ADMIN_PRODUCT_PAGE_SIZE;
  }

  return Math.min(MAX_ADMIN_PRODUCT_PAGE_SIZE, Math.max(1, Math.floor(value ?? DEFAULT_ADMIN_PRODUCT_PAGE_SIZE)));
}

function parseProductMetadata(metadata: Prisma.JsonValue | null | undefined) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {
      variantsEnabled: false,
      relatedProductIds: [] as string[],
    };
  }

  const source = metadata as Record<string, unknown>;
  const rawRelated = source.relatedProductIds;

  return {
    variantsEnabled: source.variantsEnabled === true,
    relatedProductIds: Array.isArray(rawRelated)
      ? rawRelated.map((item) => `${item}`).filter(Boolean)
      : [],
  };
}

function mapVariantOptions(options: Prisma.JsonValue | null | undefined): Record<string, string> {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(options as Record<string, unknown>).flatMap(([key, value]) => {
      const normalizedKey = key.trim();
      const normalizedValue = `${value ?? ""}`.trim();
      return normalizedKey && normalizedValue ? [[normalizedKey, normalizedValue]] : [];
    }),
  );
}

function buildVariantPayload(data: AdminProductCreateInput | AdminProductUpdateInput): AdminProductVariantRecord[] {
  if (data.variantsEnabled) {
    const requestedDefaultIndex = data.variants.findIndex((variant) => variant.isDefault);
    const defaultIndex = requestedDefaultIndex >= 0 ? requestedDefaultIndex : 0;

    return data.variants.map((variant, index) => ({
      title: variant.title,
      sku: variant.sku,
      price: variant.price,
      comparePrice: variant.comparePrice ?? null,
      stock: variant.stock,
      options: variant.options,
      isDefault: index === defaultIndex,
    }));
  }

  return [
    {
      title: "Default",
      sku: data.sku,
      price: data.price,
      comparePrice: data.comparePrice ?? null,
      stock: data.stock,
      options: {},
      isDefault: true,
    },
  ];
}

function summarizePriceLabel(variants: AdminProductVariantRecord[]) {
  if (variants.length === 0) {
    return "No price set";
  }

  const prices = variants.map((variant) => variant.price).sort((left, right) => left - right);
  const minPrice = prices[0] ?? 0;
  const maxPrice = prices[prices.length - 1] ?? minPrice;

  return minPrice === maxPrice ? formatPrice(minPrice) : `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`;
}

function getInventoryTotal(variants: Array<{ inventory?: { quantity: number } | null }>) {
  return variants.reduce((total, variant) => total + (variant.inventory?.quantity ?? 0), 0);
}

function mapAdminProduct(record: SelectedAdminProduct): AdminProductFormRecord {
  const metadata = parseProductMetadata(record.metadata);
  const defaultVariant = record.variants.find((variant) => variant.isDefault) ?? record.variants[0] ?? null;
  const variantIndexById = new Map(record.variants.map((variant, index) => [variant.id, index]));

  return {
    id: record.id,
    title: record.name,
    slug: record.slug,
    shortDescription: record.shortDescription ?? "",
    description: record.description ?? "",
    categoryId: record.category?.id ?? "",
    categoryName: record.category?.name ?? null,
    categorySlug: record.category?.slug ?? null,
    status: record.status,
    sku: record.masterSku ?? defaultVariant?.sku ?? "",
    price: defaultVariant?.price ?? 0,
    comparePrice: defaultVariant?.compareAtPrice ?? null,
    stock: defaultVariant?.inventory?.quantity ?? 0,
    variantsEnabled: metadata.variantsEnabled || record.variants.length > 1,
    variants: record.variants.map((variant) => ({
      title: variant.title ?? "",
      sku: variant.sku ?? "",
      price: variant.price,
      comparePrice: variant.compareAtPrice ?? null,
      stock: variant.inventory?.quantity ?? 0,
      options: mapVariantOptions(variant.options),
      isDefault: variant.isDefault,
    })),
    images: record.images.map((image) => ({
      url: image.url,
      alt: image.alt ?? "",
      variantIndex: image.productVariantId ? (variantIndexById.get(image.productVariantId) ?? null) : null,
    })),
    specifications: record.specifications.map((specification) => ({
      key: specification.key,
      value: specification.value,
    })),
    relatedProductIds: metadata.relatedProductIds,
    seoTitle: record.seoTitle ?? "",
    seoDescription: record.seoDescription ?? "",
    seoCanonicalUrl: record.seoCanonicalUrl ?? "",
    seoOgTitle: record.seoOgTitle ?? "",
    seoOgDescription: record.seoOgDescription ?? "",
    seoImageUrl: record.seoImageUrl ?? "",
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
      return new AppError("Product slug must be unique.", "PRODUCT_SLUG_TAKEN", {
        statusCode: 409,
        userMessage: "This slug is already used by another product.",
      });
    }

    if (targets.some((target) => target.includes("sku") || target.includes("master_sku"))) {
      return new AppError("Product or variant SKU must be unique.", "PRODUCT_SKU_TAKEN", {
        statusCode: 409,
        userMessage: "This SKU is already used by another product or variant.",
      });
    }
  }

  if (error.code === "P2003") {
    return new AppError("Product has related records that prevent this save.", "PRODUCT_IN_USE", {
      statusCode: 409,
      userMessage: "This product has related records preventing that save pattern.",
    });
  }

  if (error.code === "P2025") {
    return new AppError("Product not found.", "PRODUCT_NOT_FOUND", {
      statusCode: 404,
      userMessage: "The selected product no longer exists.",
    });
  }

  return null;
}

async function ensureCategoryExists(categoryId: string, dbClient: ProductDbClient = getPrismaClient()) {
  const category = await dbClient.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });

  if (!category) {
    throw new AppError("Product category is invalid.", "PRODUCT_CATEGORY_INVALID", {
      statusCode: 400,
      userMessage: "Choose a valid category before saving the product.",
    });
  }
}

async function normalizeRelatedProductIds(
  ids: string[],
  options: { dbClient?: ProductDbClient; excludeId?: string } = {},
) {
  const dbClient = options.dbClient ?? getPrismaClient();
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].filter((id) => id !== options.excludeId);

  if (uniqueIds.length === 0) {
    return [];
  }

  const matches = await dbClient.product.findMany({
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
    throw new AppError("One or more related products are invalid.", "PRODUCT_RELATED_INVALID", {
      statusCode: 400,
      userMessage: "One or more related products are no longer available.",
    });
  }

  return matches.map((item) => item.id);
}

async function writeProductAuditLog(tx: any, input: {
  action: "product.created" | "product.updated" | "product.deleted";
  actor: AuditActorInput;
  productId: string;
  changes: Record<string, unknown>;
}) {
  await tx.auditLog.create({
    data: {
      actorId: input.actor.actorId,
      action: input.action,
      model: "Product",
      modelId: input.productId,
      changes: {
        actorRole: input.actor.actorRole ?? null,
        ...input.changes,
      },
    },
  });
}

/**
 * Persists product images.
 *
 * Each image can be attached to:
 *  - the product itself (`productId`) — shared across all variants, or
 *  - a specific variant (`productVariantId`) via `image.variantIndex`.
 *
 * `variantRecords` must be ordered exactly like the product's `variants` input
 * array so `variantIndex` maps to the correct created/updated variant id.
 * When `variantIndex` is out of range the image safely falls back to
 * product-level, and the DB CHECK constraint
 * (`product_id IS NOT NULL OR product_variant_id IS NOT NULL`) keeps the row valid.
 */
async function createImages(
  tx: any,
  productId: string,
  images: AdminProductImageInput[],
  variantRecords: Array<{ id: string }> = [],
) {
  if (images.length === 0) {
    return;
  }

  await tx.productImage.createMany({
    data: images.map((image, index) => {
      const variantId =
        typeof image.variantIndex === "number" ? variantRecords[image.variantIndex]?.id : undefined;

      return {
        ...(variantId ? { productVariantId: variantId } : { productId }),
        url: image.url,
        alt: image.alt ?? null,
        position: index,
      };
    }),
  });
}

async function createSpecifications(
  tx: any,
  productId: string,
  specifications: AdminProductSpecificationInput[],
) {
  if (specifications.length === 0) {
    return;
  }

  await tx.productSpecification.createMany({
    data: specifications.map((specification, index) => ({
      productId,
      key: specification.key,
      value: specification.value,
      position: index,
    })),
  });
}

async function createVariantRecord(tx: any, productId: string, variant: AdminProductVariantRecord) {
  const createdVariant = await tx.productVariant.create({
    data: {
      productId,
      sku: variant.sku,
      title: variant.title,
      options: Object.keys(variant.options).length > 0 ? variant.options : Prisma.JsonNull,
      price: variant.price,
      compareAtPrice: variant.comparePrice,
      currency: Currency.PKR,
      isDefault: variant.isDefault,
    },
    select: {
      id: true,
    },
  });

  await tx.inventory.create({
    data: {
      productVariantId: createdVariant.id,
      quantity: variant.stock,
    },
  });

  return { id: createdVariant.id };
}

/**
 * Creates all variants and returns their ids in input order.
 * The returned array is used by `createImages` to attach images to variants.
 */
async function createVariants(
  tx: any,
  productId: string,
  variants: AdminProductVariantRecord[],
): Promise<Array<{ id: string }>> {
  const created: Array<{ id: string }> = [];

  for (const variant of variants) {
    created.push(await createVariantRecord(tx, productId, variant));
  }

  return created;
}

/**
 * Upserts variants by SKU and returns their ids in input order.
 * Removed variants (present in DB but not in the incoming list) have their
 * dependent rows (wishlist, cart, images, inventory) cleared before deletion.
 *
 * The returned array is used by `createImages` to attach images to variants.
 */
async function upsertVariants(
  tx: any,
  productId: string,
  variants: AdminProductVariantRecord[],
): Promise<Array<{ id: string }>> {
  const existingVariants: Array<{ id: string; sku: string | null }> = await tx.productVariant.findMany({
    where: { productId },
    select: {
      id: true,
      sku: true,
    },
  });

  const existingBySku = new Map<string, { id: string; sku: string | null }>(
    existingVariants.map((variant) => [variant.sku ?? "", variant]),
  );
  const incomingSkus = new Set(variants.map((variant) => variant.sku));
  const removedVariantIds = existingVariants.filter((variant) => !variant.sku || !incomingSkus.has(variant.sku)).map((variant) => variant.id);

  if (removedVariantIds.length > 0) {
    await tx.wishlistItem.deleteMany({
      where: {
        productVariantId: {
          in: removedVariantIds,
        },
      },
    });

    await tx.cartItem.deleteMany({
      where: {
        productVariantId: {
          in: removedVariantIds,
        },
      },
    });

    await tx.productImage.deleteMany({
      where: {
        productVariantId: {
          in: removedVariantIds,
        },
      },
    });

    await tx.inventory.deleteMany({
      where: {
        productVariantId: {
          in: removedVariantIds,
        },
      },
    });

    await tx.productVariant.deleteMany({
      where: {
        id: {
          in: removedVariantIds,
        },
      },
    });
  }

  const resolved: Array<{ id: string }> = [];

  for (const variant of variants) {
    const existing = existingBySku.get(variant.sku);

    if (!existing) {
      resolved.push(await createVariantRecord(tx, productId, variant));
      continue;
    }

    await tx.productVariant.update({
      where: { id: existing.id },
      data: {
        sku: variant.sku,
        title: variant.title,
        options: Object.keys(variant.options).length > 0 ? variant.options : Prisma.JsonNull,
        price: variant.price,
        compareAtPrice: variant.comparePrice,
        currency: Currency.PKR,
        isDefault: variant.isDefault,
      },
    });

    await tx.inventory.upsert({
      where: {
        productVariantId: existing.id,
      },
      update: {
        quantity: variant.stock,
      },
      create: {
        productVariantId: existing.id,
        quantity: variant.stock,
      },
    });

    resolved.push({ id: existing.id });
  }

  return resolved;
}

export async function listAdminProducts(filters: AdminProductListFilters = {}): Promise<AdminProductListItem[]> {
  const db = getPrismaClient();
  const query = filters.query?.trim();
  const status = isKnownStatus(filters.status) ? filters.status : undefined;
  const type = isKnownType(filters.type) ? filters.type : undefined;
  const page = normalizePage(filters.page);
  const pageSize = normalizePageSize(filters.pageSize);
  const conditions: Prisma.ProductWhereInput[] = [];

  if (status) {
    conditions.push({ status });
  }

  if (query) {
    conditions.push({
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
          shortDescription: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          masterSku: {
            contains: query,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (type === "VARIANT") {
    conditions.push({
      metadata: {
        path: ["variantsEnabled"],
        equals: true,
      },
    });
  }

  if (type === "SIMPLE") {
    conditions.push({
      OR: [
        {
          metadata: {
            path: ["variantsEnabled"],
            equals: false,
          },
        },
        {
          metadata: {
            equals: Prisma.JsonNull,
          },
        },
        {
          metadata: {
            equals: Prisma.DbNull,
          },
        },
      ],
    });
  }

  const records = await db.product.findMany({
    ...(conditions.length > 0 ? { where: { AND: conditions } } : {}),
    select: adminProductListSelect,
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return records.map((record: SelectedAdminProductList) => {
    const metadata = parseProductMetadata(record.metadata);
    const variants = record.variants;
    const itemType = metadata.variantsEnabled || variants.length > 1 ? "VARIANT" : "SIMPLE";

    return {
      id: record.id,
      title: record.name,
      slug: record.slug,
      shortDescription: record.shortDescription || null,
      status: record.status,
      categoryName: record.category?.name ?? null,
      seoTitle: record.seoTitle || null,
      updatedAt: record.updatedAt,
      priceLabel: summarizePriceLabel(
        variants.map((variant) => ({
          title: "",
          sku: "",
          price: variant.price,
          comparePrice: null,
          stock: variant.inventory?.quantity ?? 0,
          options: {},
          isDefault: false,
        })),
      ),
      inventoryTotal: getInventoryTotal(variants),
      variantCount: variants.length,
      type: itemType,
    } satisfies AdminProductListItem;
  });
}

export async function listAdminProductCategories(): Promise<AdminProductCategoryOption[]> {
  const db = getPrismaClient();

  return db.category.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
    },
  });
}

export async function listAdminRelatedProducts(
  filter: AdminRelatedProductsFilter = {},
): Promise<AdminRelatedProductOption[]> {
  const db = getPrismaClient();

  const { excludeProductId, categoryId, query, take = 20, selectedIds = [] } = filter;
  const conditions: Prisma.ProductWhereInput[] = [];

  if (excludeProductId) {
    conditions.push({ NOT: { id: excludeProductId } });
  }

  if (categoryId) {
    conditions.push({ categoryId });
  }

  const normalizedQuery = query?.trim();
  if (normalizedQuery) {
    conditions.push({
      OR: [
        {
          name: {
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
    db.product.findMany({
      ...(conditions.length > 0 ? { where: { AND: conditions } } : {}),
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
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
      ? db.product.findMany({
          where: {
            id: { in: selectedIds },
            ...(excludeProductId ? { NOT: { id: excludeProductId } } : {}),
          },
          select: {
            id: true,
            name: true,
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
    title: item.name,
    slug: item.slug,
    categoryName: item.category?.name ?? null,
  }));
}

export async function getAdminProductById(productId: string): Promise<AdminProductFormRecord | null> {
  const db = getPrismaClient();
  const record = await db.product.findUnique({
    where: { id: productId },
    select: adminProductSelect,
  });

  if (!record) {
    return null;
  }

  // `Product.images` only returns product-level rows (productId set). Variant
  // products store their media per variant (productVariantId set, productId
  // null), so those images are fetched separately and merged into the form
  // record — otherwise the admin edit form would show an empty image list for
  // products whose images are all variant-specific.
  const variantImages = await db.productImage.findMany({
    where: {
      productVariant: {
        productId,
      },
    },
    orderBy: { position: "asc" },
    select: {
      url: true,
      alt: true,
      position: true,
      productVariantId: true,
    },
  });

  return mapAdminProduct({
    ...record,
    images: [...record.images, ...variantImages],
  });
}

export async function createAdminProduct(input: {
  data: AdminProductCreateInput;
  actor: AuditActorInput;
}): Promise<AdminProductFormRecord> {
  const db = getPrismaClient();

  try {
    return await db.$transaction(async (tx) => {
      await ensureCategoryExists(input.data.categoryId, tx);
      const relatedProductIds = await normalizeRelatedProductIds(input.data.relatedProductIds, { dbClient: tx });
      const variants = buildVariantPayload(input.data);

      const created = await tx.product.create({
        data: {
          name: input.data.title,
          slug: input.data.slug,
          shortDescription: input.data.shortDescription ?? null,
          description: input.data.description ?? null,
          categoryId: input.data.categoryId,
          status: input.data.status,
          masterSku: input.data.sku,
          seoTitle: input.data.seoTitle ?? null,
          seoDescription: input.data.seoDescription ?? null,
          seoCanonicalUrl: input.data.seoCanonicalUrl ?? null,
          seoOgTitle: input.data.seoOgTitle ?? null,
          seoOgDescription: input.data.seoOgDescription ?? null,
          seoImageUrl: input.data.seoImageUrl ?? null,
          seoNoIndex: input.data.seoNoIndex,
          seoSchemaNotes: input.data.seoSchemaNotes ?? null,
          metadata: {
            variantsEnabled: input.data.variantsEnabled,
            relatedProductIds,
          },
        },
        select: {
          id: true,
        },
      });

      // Variants must be created before images so variant-linked images can
      // reference the newly created variant ids.
      const variantRecords = await createVariants(tx, created.id, variants);
      await createImages(tx, created.id, input.data.images, variantRecords);
      await createSpecifications(tx, created.id, input.data.specifications);

      await writeProductAuditLog(tx, {
        action: "product.created",
        actor: input.actor,
        productId: created.id,
        changes: {
          after: {
            title: input.data.title,
            slug: input.data.slug,
            status: input.data.status,
            variantsEnabled: input.data.variantsEnabled,
          },
        },
      });

      const record = await tx.product.findUnique({
        where: { id: created.id },
        select: adminProductSelect,
      });

      if (!record) {
        return {
          id: created.id,
          title: input.data.title,
          slug: input.data.slug,
          shortDescription: input.data.shortDescription ?? "",
          description: input.data.description ?? "",
          categoryId: input.data.categoryId,
          categoryName: null,
          categorySlug: null,
          status: input.data.status,
          sku: input.data.sku,
          price: variants[0]?.price ?? 0,
          comparePrice: variants[0]?.comparePrice ?? null,
          stock: variants[0]?.stock ?? 0,
          variantsEnabled: input.data.variantsEnabled,
          variants,
          images: input.data.images.map((image) => ({
            url: image.url,
            alt: image.alt ?? "",
            variantIndex: image.variantIndex ?? null,
          })),
          specifications: input.data.specifications.map((specification) => ({
            key: specification.key,
            value: specification.value,
          })),
          relatedProductIds,
          seoTitle: input.data.seoTitle ?? "",
          seoDescription: input.data.seoDescription ?? "",
          seoCanonicalUrl: input.data.seoCanonicalUrl ?? "",
          seoOgTitle: input.data.seoOgTitle ?? "",
          seoOgDescription: input.data.seoOgDescription ?? "",
          seoImageUrl: input.data.seoImageUrl ?? "",
          seoNoIndex: input.data.seoNoIndex,
          seoSchemaNotes: input.data.seoSchemaNotes ?? "",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      return mapAdminProduct(record);
    });
  } catch (error) {
    const mutationError = buildMutationError(error);
    if (mutationError) {
      throw mutationError;
    }

    throw error;
  }
}

export async function updateAdminProduct(input: {
  data: AdminProductUpdateInput;
  actor: AuditActorInput;
}): Promise<AdminProductFormRecord> {
  const db = getPrismaClient();
  const previous = await db.product.findUnique({
    where: { id: input.data.id },
    select: adminProductSelect,
  });

  if (!previous) {
    throw new AppError("Product not found.", "PRODUCT_NOT_FOUND", {
      statusCode: 404,
      userMessage: "The selected product no longer exists.",
    });
  }

  try {
    return await db.$transaction(async (tx) => {
      await ensureCategoryExists(input.data.categoryId, tx);
      const relatedProductIds = await normalizeRelatedProductIds(input.data.relatedProductIds, {
        dbClient: tx,
        excludeId: input.data.id,
      });
      const variants = buildVariantPayload(input.data);

      await tx.product.update({
        where: { id: input.data.id },
        data: {
          name: input.data.title,
          slug: input.data.slug,
          shortDescription: input.data.shortDescription ?? null,
          description: input.data.description ?? null,
          categoryId: input.data.categoryId,
          status: input.data.status,
          masterSku: input.data.sku,
          seoTitle: input.data.seoTitle ?? null,
          seoDescription: input.data.seoDescription ?? null,
          seoCanonicalUrl: input.data.seoCanonicalUrl ?? null,
          seoOgTitle: input.data.seoOgTitle ?? null,
          seoOgDescription: input.data.seoOgDescription ?? null,
          seoImageUrl: input.data.seoImageUrl ?? null,
          seoNoIndex: input.data.seoNoIndex,
          seoSchemaNotes: input.data.seoSchemaNotes ?? null,
          metadata: {
            variantsEnabled: input.data.variantsEnabled,
            relatedProductIds,
          },
        },
      });

      // Clear all product images — both product-level and any previously
      // attached to this product's variants — so the incoming image list fully
      // replaces the stored one (including variant reassignments).
      await tx.productImage.deleteMany({
        where: { productId: input.data.id },
      });

      const existingVariantIds: Array<{ id: string }> = await tx.productVariant.findMany({
        where: { productId: input.data.id },
        select: { id: true },
      });
      if (existingVariantIds.length > 0) {
        await tx.productImage.deleteMany({
          where: {
            productVariantId: {
              in: existingVariantIds.map((variant) => variant.id),
            },
          },
        });
      }

      await tx.productSpecification.deleteMany({
        where: { productId: input.data.id },
      });

      // Variants must be upserted before images so variant-linked images can
      // reference the resolved (existing or newly created) variant ids.
      const variantRecords = await upsertVariants(tx, input.data.id, variants);
      await createImages(tx, input.data.id, input.data.images, variantRecords);
      await createSpecifications(tx, input.data.id, input.data.specifications);

      const updated = await tx.product.findUnique({
        where: { id: input.data.id },
        select: adminProductSelect,
      });

      if (!updated) {
        throw new AppError("Product not found after update.", "PRODUCT_NOT_FOUND", {
          statusCode: 404,
          userMessage: "The saved product could not be reloaded.",
        });
      }

      await writeProductAuditLog(tx, {
        action: "product.updated",
        actor: input.actor,
        productId: input.data.id,
        changes: {
          before: {
            title: previous.name,
            slug: previous.slug,
            status: previous.status,
            variantsEnabled: parseProductMetadata(previous.metadata).variantsEnabled,
          },
          after: {
            title: updated.name,
            slug: updated.slug,
            status: updated.status,
            variantsEnabled: parseProductMetadata(updated.metadata).variantsEnabled,
          },
        },
      });

      return mapAdminProduct(updated);
    });
  } catch (error) {
    const mutationError = buildMutationError(error);
    if (mutationError) {
      throw mutationError;
    }

    throw error;
  }
}

export async function deleteAdminProduct(input: {
  productId: string;
  actor: AuditActorInput;
}) {
  const db = getPrismaClient();

  const product = await db.product.findUnique({
    where: { id: input.productId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      categoryId: true,
    },
  });

  if (!product) {
    throw new AppError("Product not found.", "PRODUCT_NOT_FOUND", {
      statusCode: 404,
      userMessage: "The selected product no longer exists.",
    });
  }

  try {
    await db.$transaction(async (tx) => {
      const variants = await tx.productVariant.findMany({
        where: { productId: product.id },
        select: { id: true },
      });
      const variantIds = variants.map((variant) => variant.id);

      if (variantIds.length > 0) {
        await tx.wishlistItem.deleteMany({
          where: {
            productVariantId: {
              in: variantIds,
            },
          },
        });

        await tx.cartItem.deleteMany({
          where: {
            productVariantId: {
              in: variantIds,
            },
          },
        });

        await tx.productImage.deleteMany({
          where: {
            productVariantId: {
              in: variantIds,
            },
          },
        });

        await tx.inventory.deleteMany({
          where: {
            productVariantId: {
              in: variantIds,
            },
          },
        });

        await tx.productVariant.deleteMany({
          where: {
            id: {
              in: variantIds,
            },
          },
        });
      }

      await tx.productImage.deleteMany({
        where: {
          productId: product.id,
        },
      });

      await tx.productSpecification.deleteMany({
        where: {
          productId: product.id,
        },
      });

      await tx.review.deleteMany({
        where: {
          productId: product.id,
        },
      });

      await tx.dealCampaignProduct.deleteMany({
        where: {
          productId: product.id,
        },
      });

      await tx.product.delete({
        where: {
          id: product.id,
        },
      });

      await writeProductAuditLog(tx, {
        action: "product.deleted",
        actor: input.actor,
        productId: product.id,
        changes: {
          before: {
            title: product.name,
            slug: product.slug,
            status: product.status,
            categoryId: product.categoryId,
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
