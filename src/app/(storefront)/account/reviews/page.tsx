import Link from "next/link";
import { MessageSquareText } from "lucide-react";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { getReviewErrorMessage, getReviewNoticeMessage } from "@/features/reviews/flash";
import { listCustomerReviews } from "@/features/reviews/service";
import { logger } from "@/lib/logger";

type AccountReviewsPageProps = {
  searchParams?: Promise<{
    reviewNotice?: string;
    reviewError?: string;
  }>;
};

const statusVariantMap = {
  PENDING: "secondary",
  APPROVED: "success",
  REJECTED: "warning",
  HIDDEN: "outline",
} as const;

const reviewsPageLogger = logger.child("account-reviews-page");

export const metadata = buildMetadata({
  title: "Your Reviews",
  path: routes.storefront.accountReviews,
  description: "Track and manage your product reviews.",
});

export default async function AccountReviewsPage({ searchParams }: AccountReviewsPageProps) {
  const params = (await searchParams) ?? {};
  const noticeMessage = getReviewNoticeMessage(params.reviewNotice);
  const errorMessage = getReviewErrorMessage(params.reviewError);
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <EmptyState
        icon={MessageSquareText}
        title="Review history unavailable"
        description="Please sign in again to load your reviews."
      />
    );
  }

  let reviewResult = null;

  try {
    reviewResult = await listCustomerReviews(userId, {
      page: 1,
      pageSize: 20,
    });
  } catch (error) {
    reviewsPageLogger.error("failed to load customer review history", {
      userId,
      error,
    });
  }

  if (!reviewResult) {
    return (
      <EmptyState
        icon={MessageSquareText}
        title="Review history unavailable"
        description="We could not load your reviews right now. Please refresh and try again shortly."
      />
    );
  }

  if (reviewResult.items.length === 0) {
    return (
      <EmptyState
        icon={MessageSquareText}
        title="No reviews yet"
        description="Your submitted product reviews and moderation status will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {noticeMessage ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900">
          {noticeMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      {reviewResult.items.map((review) => {
        const storefrontHref = review.deal
          ? routes.storefront.deal(review.deal.slug)
          : review.product?.categorySlug
            ? routes.storefront.product(review.product.categorySlug, review.product.slug)
            : null;

        return (
          <Card key={review.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  {review.deal ? review.deal.title : (review.product?.name ?? "Unknown item")}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariantMap[review.status]}>{review.statusLabel}</Badge>
                  <Badge variant={review.storefrontVisible ? "success" : "secondary"}>
                    {review.storefrontVisible ? "Visible on storefront" : "Hidden from storefront"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">Submitted {review.createdAt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
              <p>
                Rating: <span className="font-medium">{review.rating}/5</span>
              </p>
              <p className="font-medium">{review.title ?? "Untitled review"}</p>
              <p className="text-muted-foreground">{review.body ?? "No written comment provided."}</p>
              {review.moderationReason ? (
                <p className="text-xs text-muted-foreground">Moderation reason: {review.moderationReason}</p>
              ) : null}
              {storefrontHref ? (
                <Link href={storefrontHref} className="text-xs font-medium underline underline-offset-4">
                  {review.deal ? "View deal" : "View product"}
                </Link>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}