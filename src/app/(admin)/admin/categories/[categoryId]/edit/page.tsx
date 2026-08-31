import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { getAdminCategoryById, updateAdminCategoryAction } from "@/features/admin/categories";
import { AdminCategoryForm } from "@/features/admin/categories/components/admin-category-form";
import { getCategoryErrorMessage, getCategoryNoticeMessage } from "@/features/admin/categories/flash";
import { AdminPageHeader } from "@/features/admin/components/admin-page-patterns";
import { requireRouteAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";

type EditAdminCategoryPageProps = {
  params: Promise<{ categoryId: string }>;
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

export async function generateMetadata({ params }: EditAdminCategoryPageProps) {
  const { categoryId } = await params;

  return buildMetadata({
    title: "Edit Category",
    path: routes.admin.categoryEdit(categoryId),
    description: "Update category details and SEO fields.",
  });
}

export default async function EditAdminCategoryPage({ params, searchParams }: EditAdminCategoryPageProps) {
  await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess, rbacPermissions.catalogWrite],
    from: routes.admin.categories,
  });

  const { categoryId } = await params;
  const query = (await searchParams) ?? {};

  const category = await getAdminCategoryById(categoryId);
  if (!category) {
    notFound();
  }

  const returnTo = routes.admin.categoryEdit(category.id);
  const noticeMessage = getCategoryNoticeMessage(query.notice);
  const errorMessage = getCategoryErrorMessage(query.error);

  return (
    <PageShell className="gap-8">
      <AdminPageHeader
        eyebrow="Catalog"
        title={`Edit ${category.name}`}
        description="Adjust category copy, SEO fields, and publication status."
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
          <CardTitle>Category details</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminCategoryForm
            action={updateAdminCategoryAction}
            returnTo={returnTo}
            categoryId={category.id}
            submitLabel="Save changes"
            initialValues={{
              name: category.name,
              slug: category.slug,
              description: category.description ?? "",
              categoryCardImageUrl: category.cardImageUrl ?? "",
              status: category.status,
              seoTitle: category.seoTitle ?? "",
              seoDescription: category.seoDescription ?? "",
              seoCanonicalUrl: category.seoCanonicalUrl ?? "",
              seoOgTitle: category.seoOgTitle ?? "",
              seoOgDescription: category.seoOgDescription ?? "",
              seoImageUrl: category.seoImageUrl ?? "",
              seoKeywords: category.seoKeywords ?? "",
              seoNoIndex: category.seoNoIndex,
              seoSchemaNotes: category.seoSchemaNotes ?? "",
            }}
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}
