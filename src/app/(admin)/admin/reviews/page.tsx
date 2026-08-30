import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { AdminPageHeader, AdminTablePattern } from "@/features/admin/components/admin-page-patterns";
import { moderateAdminReviewAction } from "@/features/admin/reviews/actions";
import { AdminReviewFiltersForm } from "@/features/admin/reviews/components/admin-review-filters-form";
import { getAdminReviewErrorMessage, getAdminReviewNoticeMessage } from "@/features/admin/reviews/flash";
import { listAdminReviewProductOptions, listAdminReviews } from "@/features/admin/reviews/service";
import { requireRouteAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";
import { isReviewModerationStatus } from "@/lib/reviews/moderation";

type ReviewStatusFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN";

type AdminReviewsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    product?: string;
    notice?: string;
    error?: string;
  }>;
};

const statusBadgeVariantMap: Record<Exclude<ReviewStatusFilter, "ALL">, "secondary" | "success" | "warning" | "outline"> = {
  PENDING: "secondary",
  APPROVED: "success",
  REJECTED: "warning",
  HIDDEN: "outline",
};

function normalizeStatusFilter(value?: string): ReviewStatusFilter {
  return isReviewModerationStatus(value) ? value : "ALL";
}

function buildReturnTo(query: string, status: ReviewStatusFilter, productId: string) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (status !== "ALL") {
    params.set("status", status);
  }

  if (productId) {
    params.set("product", productId);
  }

  const queryString = params.toString();
  return queryString ? `${routes.admin.reviews}?${queryString}` : routes.admin.reviews;
}

export const metadata = buildMetadata({
  title: "Admin Reviews",
  path: routes.admin.reviews,
  description: "Moderate customer reviews and storefront visibility from the admin workspace.",
});

export default async function AdminReviewsPage({ searchParams }: AdminReviewsPageProps) {
  await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess, rbacPermissions.catalogRead],
    from: routes.admin.reviews,
  });

  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const status = normalizeStatusFilter(params.status);
  const productId = params.product?.trim() ?? "";

  const [reviewResult, productOptions] = await Promise.all([
    listAdminReviews({
      query,
      status,
      productId,
      page: 1,
      pageSize: 20,
    }),
    listAdminReviewProductOptions(),
  ]);

  const returnTo = buildReturnTo(query, status, productId);
  const noticeMessage = getAdminReviewNoticeMessage(params.notice);
  const errorMessage = getAdminReviewErrorMessage(params.error);

  return (
    <PageShell className="gap-8">
      <AdminPageHeader
        eyebrow="Community"
        title="Review moderation"
        description="Approve, reject, or hide customer feedback before it appears on the storefront."
      />

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

      {reviewResult.usesLegacySchemaFallback ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950">
          Review moderation is running in compatibility mode because the latest database migration is not applied yet. Browsing stays available, and the full action set becomes available after migrations are applied.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Search and filters</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminReviewFiltersForm query={query} status={status} productId={productId} productOptions={productOptions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Moderation queue</CardTitle>
        </CardHeader>
        <CardContent>
          {reviewResult.items.length === 0 ? (
            <AdminTablePattern
              state="empty"
              emptyTitle="No reviews found"
              emptyDescription="There are no customer reviews for the current filters yet."
              errorDescription="Could not load reviews."
            />
          ) : (
            <div className="space-y-4">
              {reviewResult.items.map((review) => {
                const storefrontHref =
                  review.target.kind === "deal"
                    ? routes.storefront.deal(review.target.slug)
                    : review.target.categorySlug
                      ? routes.storefront.product(review.target.categorySlug, review.target.slug)
                      : null;

                return (
                  <article key={review.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{review.target.name}</p>
                          <Badge variant="secondary">
                            {review.target.kind === "deal" ? "Deal review" : "Product review"}
                          </Badge>
                          <Badge variant={statusBadgeVariantMap[review.status]}>{review.statusLabel}</Badge>
                          <Badge variant={review.storefrontVisible ? "success" : "secondary"}>
                            {review.storefrontVisible ? "Visible on storefront" : "Hidden from storefront"}
                          </Badge>
                        </div>

                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>
                            Reviewer: <span className="font-medium text-foreground">{review.reviewer.displayName}</span>
                            {review.reviewer.maskedEmail ? ` • ${review.reviewer.maskedEmail}` : ""}
                          </p>
                          <p>
                            Rating: <span className="font-medium text-foreground">{review.rating}/5</span>
                          </p>
                          <p>
                            Submitted: {review.createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                          {review.moderatedAt ? (
                            <p>
                              Last moderated: {review.moderatedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                            </p>
                          ) : null}
                        </div>

                        <div className="space-y-1">
                          <p className="text-sm font-medium">{review.title ?? "Untitled review"}</p>
                          <p className="text-sm text-muted-foreground">{review.body ?? "No written comment provided."}</p>
                          {review.moderationReason ? (
                            <p className="text-xs text-muted-foreground">Moderation note: {review.moderationReason}</p>
                          ) : null}
                        </div>

                        {storefrontHref ? (
                          <Link href={storefrontHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                            {review.target.kind === "deal" ? "View deal" : "View product"}
                          </Link>
                        ) : null}
                      </div>

                      <form action={moderateAdminReviewAction} className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
                        <input type="hidden" name="reviewId" value={review.id} />
                        <input type="hidden" name="returnTo" value={returnTo} />

                        <Button
                          type="submit"
                          size="sm"
                          name="nextStatus"
                          value="APPROVED"
                          disabled={reviewResult.usesLegacySchemaFallback || review.status === "APPROVED"}
                        >
                          Approve
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          variant="secondary"
                          name="nextStatus"
                          value="REJECTED"
                          disabled={reviewResult.usesLegacySchemaFallback || review.status === "REJECTED"}
                        >
                          Reject
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          name="nextStatus"
                          value="HIDDEN"
                          disabled={reviewResult.usesLegacySchemaFallback || review.status === "HIDDEN"}
                        >
                          Hide
                        </Button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Reviewer emails are masked for safer admin browsing, and each moderation change is recorded in the audit log.
        </CardContent>
      </Card>
    </PageShell>
  );
}
