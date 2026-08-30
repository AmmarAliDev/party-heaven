import type { Prisma } from "@prisma/client";

import { AppError } from "@/lib/errors/app-error";
import {
  getReviewStatusLabel,
  isReviewModerationStatus,
  isReviewVisibleOnStorefront,
  type ReviewModerationStatus,
} from "@/lib/reviews/moderation";
import { getPrismaClient } from "@/server/db";

type AuditActorInput = {
  actorId: string;
  actorRole?: string | null;
};

type ReviewDbClient = ReturnType<typeof getPrismaClient> | Prisma.TransactionClient;

const DEFAULT_ADMIN_REVIEW_PAGE_SIZE = 20;
const MAX_ADMIN_REVIEW_PAGE_SIZE = 100;

export type AdminReviewStatusFilter = "ALL" | ReviewModerationStatus;

export type AdminReviewListFilters = {
  query?: string;
  status?: AdminReviewStatusFilter;
  productId?: string;
  page?: number;
  pageSize?: number;
};

export type AdminReviewProductOption = {
  id: string;
  name: string;
  slug: string;
  reviewCount: number;
};

export type AdminReviewListItem = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: ReviewModerationStatus;
  statusLabel: string;
  createdAt: Date;
  moderatedAt: Date | null;
  moderationReason: string | null;
  storefrontVisible: boolean;
  /** Review subject — a product or a deal bundle. */
  target: {
    kind: "product" | "deal";
    id: string;
    name: string;
    slug: string;
    categorySlug: string | null;
  };
  reviewer: {
    id: string | null;
    displayName: string;
    maskedEmail: string | null;
  };
};

export type AdminReviewListResult = {
  items: AdminReviewListItem[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  usesLegacySchemaFallback: boolean;
};

const adminReviewSelect = {
  id: true,
  rating: true,
  title: true,
  body: true,
  status: true,
  approved: true,
  moderationReason: true,
  moderatedAt: true,
  createdAt: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      category: {
        select: {
          slug: true,
        },
      },
    },
  },
  deal: {
    select: {
      id: true,
      title: true,
      slug: true,
    },
  },
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.ReviewSelect;

type SelectedAdminReview = Prisma.ReviewGetPayload<{ select: typeof adminReviewSelect }>;

type LegacyAdminReviewRecord = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  approved: boolean;
  createdAt: Date;
  updatedAt: Date;
  product: {
    id: string;
    name: string;
    slug: string;
    category: {
      slug: string;
    } | null;
  } | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

function isKnownStatus(value: string | undefined): value is ReviewModerationStatus {
  return isReviewModerationStatus(value);
}

function isReviewModerationSchemaMissing(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    meta?: {
      column?: unknown;
    };
  };

  if (candidate.code !== "P2022") {
    return false;
  }

  const column = typeof candidate.meta?.column === "string" ? candidate.meta.column : "";

  return ["Review.status", "Review.moderationReason", "Review.moderatedAt", "Review.moderatedById", "moderation_reason", "moderated_at", "moderated_by_id", "status"].some((name) =>
    column.includes(name),
  );
}

function sanitizeModerationReason(reason: string | undefined) {
  if (!reason?.trim()) {
    return null;
  }

  return reason
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePage(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.floor(value ?? 1));
}

function normalizePageSize(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return DEFAULT_ADMIN_REVIEW_PAGE_SIZE;
  }

  return Math.min(MAX_ADMIN_REVIEW_PAGE_SIZE, Math.max(1, Math.floor(value ?? DEFAULT_ADMIN_REVIEW_PAGE_SIZE)));
}

function maskEmail(email: string | null | undefined) {
  if (!email) {
    return null;
  }

  const normalized = email.trim().toLowerCase();
  const [localPart, domain] = normalized.split("@");

  if (!localPart || !domain) {
    return null;
  }

  return `${localPart.slice(0, 1)}***@${domain}`;
}

function getSafeReviewerInfo(user: SelectedAdminReview["user"]) {
  const maskedEmail = maskEmail(user?.email);
  const displayName = user?.name?.trim() || maskedEmail || "Guest reviewer";

  return {
    id: user?.id ?? null,
    displayName,
    maskedEmail,
  };
}

function resolveAdminReviewTarget(record: SelectedAdminReview): AdminReviewListItem["target"] {
  if (record.deal) {
    return {
      kind: "deal",
      id: record.deal.id,
      name: record.deal.title,
      slug: record.deal.slug,
      categorySlug: null,
    };
  }

  if (record.product) {
    return {
      kind: "product",
      id: record.product.id,
      name: record.product.name,
      slug: record.product.slug,
      categorySlug: record.product.category?.slug ?? null,
    };
  }

  return {
    kind: "product",
    id: "",
    name: "Unknown item",
    slug: "",
    categorySlug: null,
  };
}

function mapAdminReview(record: SelectedAdminReview): AdminReviewListItem {
  const status = isKnownStatus(record.status) ? record.status : record.approved ? "APPROVED" : "PENDING";

  return {
    id: record.id,
    rating: record.rating,
    title: record.title ?? null,
    body: record.body ?? null,
    status,
    statusLabel: getReviewStatusLabel(status),
    createdAt: record.createdAt,
    moderatedAt: record.moderatedAt ?? null,
    moderationReason: record.moderationReason ?? null,
    storefrontVisible: isReviewVisibleOnStorefront(status),
    target: resolveAdminReviewTarget(record),
    reviewer: getSafeReviewerInfo(record.user),
  };
}

function mapLegacyAdminReview(record: LegacyAdminReviewRecord): AdminReviewListItem {
  const status: ReviewModerationStatus = record.approved ? "APPROVED" : "PENDING";

  return {
    id: record.id,
    rating: record.rating,
    title: record.title,
    body: record.body,
    status,
    statusLabel: getReviewStatusLabel(status),
    createdAt: record.createdAt,
    moderatedAt: null,
    moderationReason: null,
    storefrontVisible: isReviewVisibleOnStorefront(status),
    target: record.product
      ? {
          kind: "product",
          id: record.product.id,
          name: record.product.name,
          slug: record.product.slug,
          categorySlug: record.product.category?.slug ?? null,
        }
      : {
          kind: "product",
          id: "",
          name: "Unknown item",
          slug: "",
          categorySlug: null,
        },
    reviewer: getSafeReviewerInfo(record.user),
  };
}

function ensureReviewId(reviewId: string) {
  const normalized = reviewId.trim();

  if (!normalized) {
    throw new AppError("Review moderation requires a valid review id.", "REVIEW_INVALID_ID", {
      statusCode: 400,
      userMessage: "Please choose a review and try again.",
    });
  }

  return normalized;
}

function ensureReviewStatus(status: string): ReviewModerationStatus {
  if (!isKnownStatus(status)) {
    throw new AppError("Unsupported review moderation status.", "REVIEW_INVALID_STATUS", {
      statusCode: 400,
      userMessage: "That moderation action is not available.",
    });
  }

  return status;
}

async function writeReviewAuditLog(
  db: ReviewDbClient,
  input: {
    reviewId: string;
    actor: AuditActorInput;
    beforeStatus: ReviewModerationStatus;
    afterStatus: ReviewModerationStatus;
    rating: number;
    target: { kind: "product" | "deal"; id: string; name: string };
    reason: string | null;
  },
) {
  await db.auditLog.create({
    data: {
      actorId: input.actor.actorId,
      action: "review.moderated",
      model: "Review",
      modelId: input.reviewId,
      changes: {
        actorRole: input.actor.actorRole ?? null,
        beforeStatus: input.beforeStatus,
        afterStatus: input.afterStatus,
        storefrontVisible: isReviewVisibleOnStorefront(input.afterStatus),
        rating: input.rating,
        targetKind: input.target.kind,
        targetId: input.target.id,
        targetName: input.target.name,
        reason: input.reason,
      },
    },
  });
}

export async function listAdminReviewProductOptions(): Promise<AdminReviewProductOption[]> {
  const db = getPrismaClient();

  const products = await db.product.findMany({
    where: {
      reviews: {
        some: {},
      },
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      _count: {
        select: {
          reviews: true,
        },
      },
    },
  });

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    reviewCount: product._count.reviews,
  }));
}

export async function listAdminReviews(filters: AdminReviewListFilters = {}): Promise<AdminReviewListResult> {
  const db = getPrismaClient();
  const query = filters.query?.trim();
  const productId = filters.productId?.trim();
  const status = isKnownStatus(filters.status) ? filters.status : undefined;
  const page = normalizePage(filters.page);
  const pageSize = normalizePageSize(filters.pageSize);
  const conditions: Prisma.ReviewWhereInput[] = [];

  if (status) {
    conditions.push({ status });
  }

  if (productId) {
    conditions.push({ productId });
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
          body: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          product: {
            name: {
              contains: query,
              mode: "insensitive",
            },
          },
        },
        {
          deal: {
            is: {
              title: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
        },
        {
          user: {
            is: {
              name: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
        },
        {
          user: {
            is: {
              email: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
        },
      ],
    });
  }

  try {
    const reviews = await db.review.findMany({
      ...(conditions.length > 0 ? { where: { AND: conditions } } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
      select: adminReviewSelect,
    });

    const hasNextPage = reviews.length > pageSize;

    return {
      items: reviews.slice(0, pageSize).map(mapAdminReview),
      page,
      pageSize,
      hasNextPage,
      usesLegacySchemaFallback: false,
    };
  } catch (error) {
    if (!isReviewModerationSchemaMissing(error)) {
      throw error;
    }

    if (status === "REJECTED" || status === "HIDDEN") {
      return {
        items: [],
        page,
        pageSize,
        hasNextPage: false,
        usesLegacySchemaFallback: true,
      };
    }

    const legacyConditions: Prisma.ReviewWhereInput[] = [];

    if (status === "APPROVED") {
      legacyConditions.push({ approved: true });
    }

    if (status === "PENDING") {
      legacyConditions.push({ approved: false });
    }

    if (productId) {
      legacyConditions.push({ productId });
    }

    if (query) {
      legacyConditions.push({
        OR: [
          {
            title: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            body: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            product: {
              name: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
          {
            user: {
              is: {
                name: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            user: {
              is: {
                email: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            },
          },
        ],
      });
    }

    const legacyReviews = (await db.review.findMany({
      ...(legacyConditions.length > 0 ? { where: { AND: legacyConditions } } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        approved: true,
        createdAt: true,
        updatedAt: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            category: {
              select: {
                slug: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })) as LegacyAdminReviewRecord[];

    const hasNextPage = legacyReviews.length > pageSize;

    return {
      items: legacyReviews.slice(0, pageSize).map(mapLegacyAdminReview),
      page,
      pageSize,
      hasNextPage,
      usesLegacySchemaFallback: true,
    };
  }
}

export async function moderateAdminReview(input: {
  reviewId: string;
  nextStatus: ReviewModerationStatus;
  reason?: string;
  actor: AuditActorInput;
}): Promise<AdminReviewListItem> {
  const db = getPrismaClient();
  const reviewId = ensureReviewId(input.reviewId);
  const nextStatus = ensureReviewStatus(input.nextStatus);
  const reason = sanitizeModerationReason(input.reason);

  if (typeof db.$transaction !== "function") {
    throw new AppError("Review moderation requires transaction support.", "REVIEW_TRANSACTION_UNAVAILABLE", {
      statusCode: 500,
      userMessage: "This review could not be updated right now. Please try again.",
    });
  }

  try {
    return db.$transaction(async (tx) => {
    const existing = await tx.review.findUnique({
      where: { id: reviewId },
      select: adminReviewSelect,
    });

    if (!existing) {
      throw new AppError("Review was not found for moderation.", "REVIEW_NOT_FOUND", {
        statusCode: 404,
        userMessage: "This review could not be found. It may already have been removed.",
      });
    }

    const previousStatus = isKnownStatus(existing.status) ? existing.status : existing.approved ? "APPROVED" : "PENDING";

    const updated = await tx.review.update({
      where: { id: reviewId },
      data: {
        status: nextStatus,
        approved: nextStatus === "APPROVED",
        moderationReason: nextStatus === "APPROVED" ? null : reason,
        moderatedAt: new Date(),
        moderatedById: input.actor.actorId,
      },
      select: adminReviewSelect,
    });

    const target = resolveAdminReviewTarget(updated);

    await writeReviewAuditLog(tx, {
      reviewId,
      actor: input.actor,
      beforeStatus: previousStatus,
      afterStatus: nextStatus,
      rating: updated.rating,
      target: { kind: target.kind, id: target.id, name: target.name },
      reason: updated.moderationReason ?? null,
    });

    return mapAdminReview(updated);
    });
  } catch (error) {
    if (isReviewModerationSchemaMissing(error)) {
      throw new AppError("Review moderation columns are missing from the current database.", "REVIEW_SCHEMA_OUTDATED", {
        statusCode: 503,
        userMessage: "Review moderation needs the latest database migration. Please apply migrations and refresh this page.",
      });
    }

    throw error;
  }
}

export { isReviewVisibleOnStorefront };
