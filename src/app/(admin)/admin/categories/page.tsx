import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { listAdminCategories } from "@/features/admin/categories";
import { createAdminCategoryAction } from "@/features/admin/categories/actions";
import { AdminCategoriesTable } from "@/features/admin/categories/components/admin-categories-table";
import { AdminCategoryFiltersForm } from "@/features/admin/categories/components/admin-category-filters-form";
import { AdminCategoryForm } from "@/features/admin/categories/components/admin-category-form";
import { getCategoryErrorMessage, getCategoryNoticeMessage } from "@/features/admin/categories/flash";
import { AdminPageHeader } from "@/features/admin/components/admin-page-patterns";
import { requireRouteAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";

type CategoryStatusFilter = "ALL" | "DRAFT" | "PUBLISHED" | "ARCHIVED";

type AdminCategoriesPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    notice?: string;
    error?: string;
  }>;
};

function normalizeStatusFilter(value?: string): CategoryStatusFilter {
  if (value === "DRAFT" || value === "PUBLISHED" || value === "ARCHIVED") {
    return value;
  }

  return "ALL";
}

export const metadata = buildMetadata({
  title: "Admin Categories",
  path: routes.admin.categories,
  description: "Manage storefront categories, status, and SEO metadata.",
});

export default async function AdminCategoriesPage({ searchParams }: AdminCategoriesPageProps) {
  await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess, rbacPermissions.catalogRead],
    from: routes.admin.categories,
  });

  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const status = normalizeStatusFilter(params.status);

  const categories = await listAdminCategories({
    query,
    status,
  });

  const returnTo = `${routes.admin.categories}?q=${encodeURIComponent(query)}&status=${status}`;
  const noticeMessage = getCategoryNoticeMessage(params.notice);
  const errorMessage = getCategoryErrorMessage(params.error);

  return (
    <PageShell className="gap-8">
      <AdminPageHeader
        eyebrow="Catalog"
        title="Categories"
        description="Create, update, and retire simple storefront categories with SEO controls."
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
          <CardTitle>Create category</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminCategoryForm action={createAdminCategoryAction} returnTo={returnTo} submitLabel="Create category" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Category list</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AdminCategoryFiltersForm query={query} status={status} />
          <AdminCategoriesTable categories={categories} returnTo={returnTo} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
