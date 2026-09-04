import Link from "next/link";
import { CalendarHeart, Plus } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { AdminPageHeader } from "@/features/admin/components/admin-page-patterns";
import { getOccasionErrorMessage, getOccasionNoticeMessage, listAdminOccasions } from "@/features/admin/occasions";
import { AdminOccasionFiltersForm } from "@/features/admin/occasions/components/admin-occasion-filters-form";
import { AdminOccasionsTable } from "@/features/admin/occasions/components/admin-occasions-table";
import { requireRouteAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";

type OccasionStatusFilter = "ALL" | "DRAFT" | "PUBLISHED" | "ARCHIVED";
type OccasionKindFilter = "ALL" | "SPECIAL" | "NORMAL";

type AdminOccasionsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    kind?: string;
    page?: string;
    notice?: string;
    error?: string;
  }>;
};

function normalizeStatusFilter(value?: string): OccasionStatusFilter {
  if (value === "DRAFT" || value === "PUBLISHED" || value === "ARCHIVED") {
    return value;
  }

  return "ALL";
}

function normalizeKindFilter(value?: string): OccasionKindFilter {
  if (value === "SPECIAL" || value === "NORMAL") {
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
  title: "Admin Occasions",
  path: routes.admin.occasions,
  description: "Curate themed occasion collections of products and deals.",
});

export default async function AdminOccasionsPage({ searchParams }: AdminOccasionsPageProps) {
  await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess, rbacPermissions.catalogRead],
    from: routes.admin.occasions,
  });

  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const status = normalizeStatusFilter(params.status);
  const kind = normalizeKindFilter(params.kind);
  const page = normalizePageParam(params.page);

  const occasions = await listAdminOccasions({
    query,
    status,
    kind,
    page,
    pageSize: 20,
  });

  const noticeMessage = getOccasionNoticeMessage(params.notice);
  const errorMessage = getOccasionErrorMessage(params.error);

  return (
    <PageShell className="gap-8">
      <AdminPageHeader
        eyebrow="Special Occasions"
        title="Occasions"
        description="Curate themed collections (Birthday, Wedding, Baby Shower) that re-surface existing products and deals on the storefront."
        actions={
          <Link href={routes.admin.occasionCreate} className={buttonVariants({ size: "sm" })}>
            <Plus className="size-4" />
            Add occasion
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
          <AdminOccasionFiltersForm query={query} status={status} kind={kind} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Occasion list</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminOccasionsTable
            occasions={occasions}
            emptyTitle="No occasions found"
            emptyDescription="Create your first occasion or adjust the current filters."
          />
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <CalendarHeart className="mt-0.5 size-4" />
          <p>
            Occasions appear at /occasions/&lt;slug&gt;. Special occasions carry a badge and are treated as
            seasonal/high-visibility content; normal occasions are everyday collections. Products and deals
            keep living in their own categories — this page simply curates them.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
