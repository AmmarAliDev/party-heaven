import Link from "next/link";
import { Plus, Tag } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { AdminPageHeader } from "@/features/admin/components/admin-page-patterns";
import { getDealErrorMessage, getDealNoticeMessage, listAdminDeals } from "@/features/admin/deals";
import { AdminDealFiltersForm } from "@/features/admin/deals/components/admin-deal-filters-form";
import { AdminDealsTable } from "@/features/admin/deals/components/admin-deals-table";
import { requireRouteAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";

type DealStatusFilter = "ALL" | "DRAFT" | "PUBLISHED" | "ARCHIVED";

type AdminDealsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    page?: string;
    notice?: string;
    error?: string;
  }>;
};

function normalizeStatusFilter(value?: string): DealStatusFilter {
  if (value === "DRAFT" || value === "PUBLISHED" || value === "ARCHIVED") {
    return value;
  }

  return "ALL";
}

function normalizePageParam(value?: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return Math.floor(parsed);
}

export const metadata = buildMetadata({
  title: "Admin Deals",
  path: routes.admin.deals,
  description: "Manage Featured Deals, linked products, quantities, and availability.",
});

export default async function AdminDealsPage({ searchParams }: AdminDealsPageProps) {
  await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess, rbacPermissions.catalogRead],
    from: routes.admin.deals,
  });

  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const status = normalizeStatusFilter(params.status);
  const page = normalizePageParam(params.page);

  const deals = await listAdminDeals({
    query,
    status,
    page,
    pageSize: 20,
  });

  const noticeMessage = getDealNoticeMessage(params.notice);
  const errorMessage = getDealErrorMessage(params.error);

  return (
    <PageShell className="gap-8">
      <AdminPageHeader
        eyebrow="Featured Deals"
        title="Deals"
        description="Bundle multiple catalog products (with quantities) into deal-specific media, pricing, and bundles."
        actions={
          <Link href={routes.admin.dealCreate} className={buttonVariants({ size: "sm" })}>
            <Plus className="size-4" />
            Add deal
          </Link>
        }
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

      <Card>
        <CardHeader>
          <CardTitle>Search and filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AdminDealFiltersForm query={query} status={status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deal list</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminDealsTable
            deals={deals}
            emptyTitle="No deals found"
            emptyDescription="Create your first deal or adjust the current filters."
          />
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <Tag className="mt-0.5 size-4" />
          <p>
            Deals surface on the homepage &ldquo;Featured Deals&rdquo; section and at /deals/&lt;slug&gt;. A
            deal is out of stock whenever any of its included products runs out of stock.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
