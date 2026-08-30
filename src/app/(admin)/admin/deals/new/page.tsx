import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { AdminPageHeader } from "@/features/admin/components/admin-page-patterns";
import {
  createAdminDealAction,
  getDealErrorMessage,
  getDealNoticeMessage,
  listAdminDealCategories,
} from "@/features/admin/deals";
import { AdminDealForm } from "@/features/admin/deals/components/admin-deal-form";
import { requireRouteAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";

type NewAdminDealPageProps = {
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

export const metadata = buildMetadata({
  title: "Create Deal",
  path: routes.admin.dealCreate,
  description: "Create a new Featured Deal linked to a catalog product.",
});

export default async function NewAdminDealPage({ searchParams }: NewAdminDealPageProps) {
  await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess, rbacPermissions.catalogWrite],
    from: routes.admin.deals,
  });

  const query = (await searchParams) ?? {};
  const categories = await listAdminDealCategories();
  const noticeMessage = getDealNoticeMessage(query.notice);
  const errorMessage = getDealErrorMessage(query.error, "The deal could not be created. Please try again.");

  return (
    <PageShell className="gap-8">
      <AdminPageHeader
        eyebrow="Featured Deals"
        title="Create deal"
        description="Add the products included in the deal (with quantities), set deal pricing, images, specifications, and related deals."
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
            <p className="text-muted-foreground">Deals need a category so included products can be picked from the catalog.</p>
            <Link href={routes.admin.categories} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Go to categories
            </Link>
          </CardContent>
        </Card>
      ) : (
        <AdminDealForm
          mode="create"
          action={createAdminDealAction}
          returnTo={routes.admin.dealCreate}
          submitLabel="Save deal"
          categories={categories}
        />
      )}
    </PageShell>
  );
}
