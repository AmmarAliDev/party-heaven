import { AppError } from "@/lib/errors/app-error";
import { createLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  getReviewStatusLabel,
  isReviewModerationStatus,
  isReviewVisibleOnStorefront,
  type ReviewModerationStatus,
} from "@/lib/reviews/moderation";
import { getPrismaClient } from "@/server/db";

const DEFAULT_CUSTOMER_REVIEW_PAGE_SIZE = 20;
const MAX_CUSTOMER_REVIEW_PAGE_SIZE = 50;
const MIN_REVIEW_RATING = 1;
const MAX_REVIEW_RATING = 5;

const reviewsServiceLogger = createLogger("reviews.service");

function ensureUserId(userId: string) {
  const normalized = userId.trim();

  if (!normalized) {
    throw new AppError("Review operations require an authenticated user id.", "REVIEW_AUTH_REQUIRED", {
      statusCode: 401,
      userMessage: "Please sign in to continue.",
    });
  }

  return normalized;
}

function ensureProductId(productId: string) {
  const normalized = productId.trim();

  if (!normalized) {
    throw new AppError("Review operations require a product id.", "REVIEW_INVALID_PRODUCT_ID", {
      statusCode: 400,
      userMessage: "Please choose a product and try again.",
    });
  }

  return normalized;
}

function ensureDealId(dealId: string) {
  const normalized = dealId.trim();

  if (!normalized) {
    throw new AppError("Review operations require a deal id.", "REVIEW_INVALID_DEAL_ID", {
      statusCode: 400,
      userMessage: "Please choose a deal and try again.",
    });
  }

  return normalized;
}

/**
 * Resolves the review target. A review must target exactly one subject — a
 * product OR a deal — never both and never neither.
 */
function ensureReviewTarget(input: { productId?: string; dealId?: string }) {
  const productId = input.productId?.trim();
  const dealId = input.dealId?.trim();

  if (productId && dealId) {
    throw new AppError("A review cannot target both a product and a deal.", "REVIEW_INVALID_TARGET", {
      statusCode: 400,
      userMessage: "Please choose either a product or a deal and try again.",
    });
  }

  if (!productId && !dealId) {
    throw new AppError("Review operations require a product or deal id.", "REVIEW_INVALID_TARGET", {
      statusCode: 400,
      userMessage: "Please choose a product or deal and try again.",
    });
  }

  return {
    productId: productId ? ensureProductId(productId) : undefined,
    dealId: dealId ? ensureDealId(dealId) : undefined,
  };
}

function ensureReviewRating(rating: number) {
  if (!Number.isInteger(rating) || rating < MIN_REVIEW_RATING || rating > MAX_REVIEW_RATING) {
    throw new AppError("Review submission contained an invalid rating value.", "REVIEW_INVALID_RATING", {
      statusCode: 400,
      userMessage: `Please choose a whole-star rating between ${MIN_REVIEW_RATING} and ${MAX_REVIEW_RATING}.`,
    });
  }

  return rating;
}

function normalizePage(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.floor(value ?? 1));
}

function normalizePageSize(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return DEFAULT_CUSTOMER_REVIEW_PAGE_SIZE;
  }

  return Math.min(MAX_CUSTOMER_REVIEW_PAGE_SIZE, Math.max(1, Math.floor(value ?? DEFAULT_CUSTOMER_REVIEW_PAGE_SIZE)));
}

function resolveReviewStatus(input: { status: string; approved: boolean }): ReviewModerationStatus {
  if (isReviewModerationStatus(input.status)) {
    return input.status;
  }

  return input.approved ? "APPROVED" : "PENDING";
}

export type CustomerReviewListItem = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: ReviewModerationStatus;
  statusLabel: string;
  storefrontVisible: boolean;
  // Customer-facing explanation shown in /account/reviews when moderation affects visibility.
  moderationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Product target — set when the review is for a product. */
  product: {
    id: string;
    name: string;
    slug: string;
    categorySlug: string | null;
  } | null;
  /** Deal target — set when the review is for a deal bundle. */
  deal: {
    id: string;
    title: string;
    slug: string;
  } | null;
};

export type CustomerReviewListResult = {
  items: CustomerReviewListItem[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
};

export async function listCustomerReviews(
  userId: string,
  options: {
    page?: number;
    pageSize?: number;
  } = {},
): Promise<CustomerReviewListResult> {
  const db = getPrismaClient();
  const safeUserId = ensureUserId(userId);
  const page = normalizePage(options.page);
  const pageSize = normalizePageSize(options.pageSize);

  const reviews = await db.review.findMany({
    where: {
      userId: safeUserId,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      status: true,
      approved: true,
      moderationReason: true,
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
    },
  });

  const hasNextPage = reviews.length > pageSize;
  const items = reviews.slice(0, pageSize).map((review) => {
    const status = resolveReviewStatus({
      status: review.status,
      approved: review.approved,
    });

    return {
      id: review.id,
      rating: review.rating,
      title: review.title ?? null,
      body: review.body ?? null,
      status,
      statusLabel: getReviewStatusLabel(status),
      storefrontVisible: isReviewVisibleOnStorefront(status),
      moderationReason: review.moderationReason ?? null,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      product: review.product
        ? {
            id: review.product.id,
            name: review.product.name,
            slug: review.product.slug,
            categorySlug: review.product.category?.slug ?? null,
          }
        : null,
      deal: review.deal
        ? {
            id: review.deal.id,
            title: review.deal.title,
            slug: review.deal.slug,
          }
        : null,
    } satisfies CustomerReviewListItem;
  });

  return {
    items,
    page,
    pageSize,
    hasNextPage,
  };
}

export type CustomerReviewComposerContext = {
  canSubmit: boolean;
  reason: "AUTH_REQUIRED" | "PURCHASE_REQUIRED" | null;
  existingReview: {
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    status: ReviewModerationStatus;
    statusLabel: string;
  } | null;
};

export async function getCustomerReviewComposerContext(input: {
  userId?: string | null;
  productId?: string;
  dealId?: string;
}): Promise<CustomerReviewComposerContext> {
  const userId = input.userId?.trim();
  const target = ensureReviewTarget({
    ...(input.productId ? { productId: input.productId } : {}),
    ...(input.dealId ? { dealId: input.dealId } : {}),
  });

  if (!userId) {
    return {
      canSubmit: false,
      reason: "AUTH_REQUIRED",
      existingReview: null,
    };
  }

  const db = getPrismaClient();

  if (target.dealId) {
    return getDealReviewComposerContext(db, userId, target.dealId);
  }

  return getProductReviewComposerContext(db, userId, target.productId as string);
}

function toComposerExistingReview(existingReview: {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: string;
  approved: boolean;
} | null): CustomerReviewComposerContext["existingReview"] {
  if (!existingReview) {
    return null;
  }

  const status = resolveReviewStatus({
    status: existingReview.status,
    approved: existingReview.approved,
  });

  return {
    id: existingReview.id,
    rating: existingReview.rating,
    title: existingReview.title ?? null,
    body: existingReview.body ?? null,
    status,
    statusLabel: getReviewStatusLabel(status),
  };
}

async function getProductReviewComposerContext(
  db: ReturnType<typeof getPrismaClient>,
  userId: string,
  productId: string,
): Promise<CustomerReviewComposerContext> {
  const [existingReview, deliveredOrder] = await Promise.all([
    db.review.findFirst({
      where: {
        userId,
        productId,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        status: true,
        approved: true,
      },
    }),
    db.order.findFirst({
      where: {
        userId,
        status: "DELIVERED",
        items: {
          some: {
            productId,
          },
        },
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (existingReview) {
    return {
      canSubmit: true,
      reason: null,
      existingReview: toComposerExistingReview(existingReview),
    };
  }

  return {
    canSubmit: Boolean(deliveredOrder),
    reason: deliveredOrder ? null : "PURCHASE_REQUIRED",
    existingReview: null,
  };
}

/**
 * True when the user has a delivered order containing any product included in
 * the deal. Deals expand into per-product order items at checkout, so a
 * delivered deal purchase is detected through its included products.
 */
async function hasDeliveredDealPurchase(
  db: ReturnType<typeof getPrismaClient>,
  userId: string,
  dealId: string,
): Promise<boolean> {
  const deal = await db.deal.findFirst({
    where: {
      id: dealId,
    },
    select: {
      id: true,
      products: {
        select: {
          productId: true,
        },
      },
    },
  });

  if (!deal) {
    return false;
  }

  const productIds = deal.products.map((product) => product.productId).filter((id): id is string => Boolean(id));

  if (productIds.length === 0) {
    return false;
  }

  const order = await db.order.findFirst({
    where: {
      userId,
      status: "DELIVERED",
      items: {
        some: {
          productId: {
            in: productIds,
          },
        },
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(order);
}

async function getDealReviewComposerContext(
  db: ReturnType<typeof getPrismaClient>,
  userId: string,
  dealId: string,
): Promise<CustomerReviewComposerContext> {
  const [existingReview, deliveredOrder] = await Promise.all([
    db.review.findFirst({
      where: {
        userId,
        dealId,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        status: true,
        approved: true,
      },
    }),
    hasDeliveredDealPurchase(db, userId, dealId),
  ]);

  if (existingReview) {
    return {
      canSubmit: true,
      reason: null,
      existingReview: toComposerExistingReview(existingReview),
    };
  }

  return {
    canSubmit: Boolean(deliveredOrder),
    reason: deliveredOrder ? null : "PURCHASE_REQUIRED",
    existingReview: null,
  };
}

export async function submitCustomerReview(input: {
  userId: string;
  productId?: string;
  dealId?: string;
  rating: number;
  title?: string;
  body: string;
}) {
  const db = getPrismaClient();
  const userId = ensureUserId(input.userId);
  const validatedRating = ensureReviewRating(input.rating);
  const target = ensureReviewTarget({
    ...(input.productId ? { productId: input.productId } : {}),
    ...(input.dealId ? { dealId: input.dealId } : {}),
  });

  if (target.dealId) {
    return submitDealReview(db, userId, validatedRating, input, target.dealId);
  }

  return submitProductReview(db, userId, validatedRating, input, target.productId as string);
}

function buildPendingReviewData(rating: number, title: string | null, body: string) {
  return {
    rating,
    title,
    body,
    approved: false,
    status: "PENDING" as const,
    moderationReason: null,
    moderatedAt: null,
    moderatedById: null,
  };
}

async function submitProductReview(
  db: ReturnType<typeof getPrismaClient>,
  userId: string,
  validatedRating: number,
  input: { title?: string; body: string },
  productId: string,
) {
  const product = await db.product.findFirst({
    where: {
      id: productId,
      status: "PUBLISHED",
    },
    select: {
      id: true,
      slug: true,
      category: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (!product || !product.category?.slug) {
    throw new AppError("Submitted review references a product that cannot be reviewed.", "REVIEW_PRODUCT_NOT_FOUND", {
      statusCode: 404,
      userMessage: "We could not find this product for reviewing.",
    });
  }

  const rateLimit = await checkRateLimit({
    action: "review:submit",
    identifier: `${userId}:${productId}`,
    limit: 5,
    windowMs: 15 * 60_000,
  });

  if (!rateLimit.success) {
    throw new AppError("Review submission was rate limited.", "RATE_LIMITED", {
      statusCode: 429,
      userMessage: "Too many review updates in a short time. Please wait a few minutes and try again.",
    });
  }

  const existingReview = await db.review.findFirst({
    where: {
      userId,
      productId,
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
    },
  });

  if (!existingReview) {
    const deliveredOrder = await db.order.findFirst({
      where: {
        userId,
        status: "DELIVERED",
        items: {
          some: {
            productId,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!deliveredOrder) {
      throw new AppError("Customer attempted to review without a delivered purchase.", "REVIEW_PURCHASE_REQUIRED", {
        statusCode: 403,
        userMessage: "Only customers with a delivered order for this product can leave a review.",
      });
    }
  }

  const title = input.title?.trim() ? input.title.trim() : null;
  const body = input.body.trim();
  const data = buildPendingReviewData(validatedRating, title, body);

  if (existingReview) {
    await db.review.update({
      where: {
        id: existingReview.id,
      },
      data,
    });

    return {
      action: "updated" as const,
      productSlug: product.slug,
      categorySlug: product.category.slug,
    };
  }

  await db.review.create({
    data: {
      ...data,
      productId,
      userId,
    },
  });

  return {
    action: "submitted" as const,
    productSlug: product.slug,
    categorySlug: product.category.slug,
  };
}

async function submitDealReview(
  db: ReturnType<typeof getPrismaClient>,
  userId: string,
  validatedRating: number,
  input: { title?: string; body: string },
  dealId: string,
) {
  const deal = await db.deal.findFirst({
    where: {
      id: dealId,
      status: "PUBLISHED",
    },
    select: {
      id: true,
      slug: true,
    },
  });

  if (!deal) {
    throw new AppError("Submitted review references a deal that cannot be reviewed.", "REVIEW_DEAL_NOT_FOUND", {
      statusCode: 404,
      userMessage: "We could not find this deal for reviewing.",
    });
  }

  const rateLimit = await checkRateLimit({
    action: "review:submit",
    identifier: `${userId}:${dealId}`,
    limit: 5,
    windowMs: 15 * 60_000,
  });

  if (!rateLimit.success) {
    throw new AppError("Review submission was rate limited.", "RATE_LIMITED", {
      statusCode: 429,
      userMessage: "Too many review updates in a short time. Please wait a few minutes and try again.",
    });
  }

  const existingReview = await db.review.findFirst({
    where: {
      userId,
      dealId,
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
    },
  });

  if (!existingReview) {
    const delivered = await hasDeliveredDealPurchase(db, userId, dealId);

    if (!delivered) {
      throw new AppError("Customer attempted to review without a delivered deal purchase.", "REVIEW_PURCHASE_REQUIRED", {
        statusCode: 403,
        userMessage: "Only customers with a delivered order for this deal can leave a review.",
      });
    }
  }

  const title = input.title?.trim() ? input.title.trim() : null;
  const body = input.body.trim();
  const data = buildPendingReviewData(validatedRating, title, body);

  if (existingReview) {
    await db.review.update({
      where: {
        id: existingReview.id,
      },
      data,
    });

    return {
      action: "updated" as const,
      dealSlug: deal.slug,
    };
  }

  await db.review.create({
    data: {
      ...data,
      dealId,
      userId,
    },
  });

  return {
    action: "submitted" as const,
    dealSlug: deal.slug,
  };
}

// ---------------------------------------------------------------------------
// Storefront deal review display
// ---------------------------------------------------------------------------

export type StorefrontDealReview = {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string; // ISO 8601 date string
  verified: boolean;
  status?: ReviewModerationStatus;
};

export type StorefrontDealReviewSummary = {
  averageRating: number;
  totalCount: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

export type StorefrontDealReviews = {
  reviews: StorefrontDealReview[];
  summary: StorefrontDealReviewSummary;
};

/**
 * Returns the storefront-visible (APPROVED) reviews for a deal plus an
 * aggregate summary, mirroring the product review display on the PDP.
 * Failures are non-fatal: the deal page renders an empty reviews section.
 */
export async function listPublishedDealReviews(dealId: string): Promise<StorefrontDealReviews> {
  const db = getPrismaClient();

  try {
    const reviews = await db.review.findMany({
      where: {
        dealId,
        status: "APPROVED",
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        approved: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (reviews.length === 0) {
      return {
        reviews: [],
        summary: {
          averageRating: 0,
          totalCount: 0,
          distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        },
      };
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    for (const review of reviews) {
      const star = Math.max(1, Math.min(5, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
      distribution[star] += 1;
    }

    return {
      reviews: reviews.map((review) => ({
        id: review.id,
        author: review.user?.name?.trim() || "Anonymous",
        rating: review.rating,
        comment: review.body ?? review.title ?? "",
        date: review.createdAt.toISOString(),
        verified: false,
        status: review.status,
      })),
      summary: {
        averageRating: Number((totalRating / reviews.length).toFixed(1)),
        totalCount: reviews.length,
        distribution,
      },
    };
  } catch (error) {
    reviewsServiceLogger.error("Failed to list published deal reviews.", error);
    return {
      reviews: [],
      summary: {
        averageRating: 0,
        totalCount: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      },
    };
  }
}