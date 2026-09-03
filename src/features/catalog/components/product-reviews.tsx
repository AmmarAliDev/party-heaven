import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { isReviewVisibleOnStorefront } from "@/lib/reviews/moderation";

import type { ProductReview, ProductReviewSummary } from "../types";

type ProductReviewsProps = {
  reviews: ProductReview[];
  summary: ProductReviewSummary;
  /** Optional review composer (Add review button + dialog) shown in the header. */
  composer?: ReactNode;
};

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  const clamped = Math.max(0, Math.min(max, Math.round(rating)));
  return (
    <span className="text-amber-500" aria-label={`${rating} out of ${max} stars`}>
      {"★".repeat(clamped)}
      {"☆".repeat(max - clamped)}
    </span>
  );
}

function RatingBar({ count, total, label }: { count: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-10 shrink-0 text-right text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 shrink-0 text-muted-foreground text-right">{count}</span>
    </div>
  );
}

export function ProductReviews({ reviews, summary, composer }: ProductReviewsProps) {
  const visibleReviews = reviews.filter((review) => isReviewVisibleOnStorefront(review.status ?? "APPROVED"));
  const visibleTotal = visibleReviews.length;
  const visibleAverage =
    visibleTotal > 0
      ? visibleReviews.reduce((sum, review) => sum + (review.rating ?? 0), 0) / visibleTotal
      : 0;
  const visibleDistribution = {
    ...summary.distribution,
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  };

  for (const review of visibleReviews) {
    const star = Math.max(1, Math.min(5, Math.round(review.rating ?? 0))) as 1 | 2 | 3 | 4 | 5;
    visibleDistribution[star] += 1;
  }

  return (
    <section aria-labelledby="reviews-heading">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-3">
          <Badge variant="secondary">Community</Badge>
          <h2 id="reviews-heading" className="text-2xl font-semibold tracking-tight">
            Reviews
          </h2>
        </div>
        {composer}
      </div>

      {visibleTotal === 0 ? (
        <p className="text-muted-foreground text-sm">No reviews for this product yet.</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          {/* Summary panel */}
          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <span className="text-5xl font-bold tracking-tight">{visibleAverage.toFixed(1)}</span>
              <div className="pb-1">
                <StarRating rating={visibleAverage} />
                <p className="text-muted-foreground text-xs mt-1">{visibleTotal} reviews</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {([5, 4, 3, 2, 1] as const).map((star) => (
                <RatingBar
                  key={star}
                  label={`${star}★`}
                  count={visibleDistribution[star]}
                  total={visibleTotal}
                />
              ))}
            </div>
          </div>

          {/* Review list */}
          <div className="space-y-5">
            {visibleReviews.map((review) => (
              <article
                key={review.id}
                className="rounded-lg border border-border/70 p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{review.author}</p>
                      {review.verified ? (
                        <Badge variant="success" className="text-xxs">
                          Verified purchase
                        </Badge>
                      ) : null}
                    </div>
                    <StarRating rating={review.rating} />
                  </div>
                  <time dateTime={review.date} className="text-muted-foreground text-xs shrink-0">
                    {new Date(review.date).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </div>
                <p className="text-sm leading-relaxed">{review.comment}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
