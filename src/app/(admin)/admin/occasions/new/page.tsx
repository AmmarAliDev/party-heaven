import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { AdminPageHeader } from "@/features/admin/components/admin-page-patterns";
import {
  createAdminOccasionAction,
  getOccasionErrorMessage,
  getOccasionNoticeMessage,
  listAdminOccasionCategories,
} from "@/features/admin/occasions";
import { AdminOccasionForm } from "@/features/admin/occasions/components/admin-occasion-form";
import { requireRouteAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";

type NewAdminOccasionPageProps = {
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

export const metadata = buildMetadata({
  title: "Create Occasion",
  path: routes.admin.occasionCreate,
  description: "Create a new themed occasion collection of products and deals.",
});

export default async function NewAdminOccasionPage({ searchParams }: NewAdminOccasionPageProps) {
  await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess, rbacPermissions.catalogWrite],
    from: routes.admin.occasions,
  });

  const query = (await searchParams) ?? {};
  const categories = await listAdminOccasionCategories();
  const noticeMessage = getOccasionNoticeMessage(query.notice);
  const errorMessage = getOccasionErrorMessage(query.error, "The occasion could not be created. Please try again.");

  return (
    <PageShell className="gap-8">
      <AdminPageHeader
        eyebrow="Special Occasions"
        title="Create occasion"
        description="Add a title, cover image, and curate existing products and deals into the occasion."
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

      {categories.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-6 text-sm">
            <p className="font-medium">Create a category first</p>
            <p className="text-muted-foreground">
              Occasions curate products that belong to categories, so you need at least one category with
              products before you can build an occasion.
            </p>
            <Link href={routes.admin.categories} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Go to categories
            </Link>
          </CardContent>
        </Card>
      ) : (
        <AdminOccasionForm
          mode="create"
          action={createAdminOccasionAction}
          returnTo={routes.admin.occasionCreate}
          submitLabel="Save occasion"
          categories={categories}
        />
      )}
    </PageShell>
  );
}
