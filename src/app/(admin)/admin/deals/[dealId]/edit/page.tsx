import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { AdminPageHeader } from "@/features/admin/components/admin-page-patterns";
import {
  getAdminDealById,
  getDealErrorMessage,
  getDealNoticeMessage,
  listAdminDealCategories,
  updateAdminDealAction,
} from "@/features/admin/deals";
import { AdminDealForm } from "@/features/admin/deals/components/admin-deal-form";
import { DeleteDealButton } from "@/features/admin/deals/components/delete-deal-button";
import { requireRouteAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";

type EditAdminDealPageProps = {
  params: Promise<{ dealId: string }>;
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

export async function generateMetadata({ params }: EditAdminDealPageProps) {
  const { dealId } = await params;

  return buildMetadata({
    title: "Edit Deal",
    path: routes.admin.dealEdit(dealId),
    description: "Update deal content, linked product, quantity, and images.",
  });
}

export default async function EditAdminDealPage({ params, searchParams }: EditAdminDealPageProps) {
  await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess, rbacPermissions.catalogWrite],
    from: routes.admin.deals,
  });

  const { dealId } = await params;
  const query = (await searchParams) ?? {};

  const [deal, categories] = await Promise.all([
    getAdminDealById(dealId),
    listAdminDealCategories(),
  ]);

  if (!deal) {
    notFound();
  }

  const noticeMessage = getDealNoticeMessage(query.notice);
  const errorMessage = getDealErrorMessage(query.error, "The deal could not be updated. Please try again.");

  return (
    <PageShell className="gap-8">
      <AdminPageHeader
        eyebrow="Featured Deals"
        title={`Edit ${deal.title}`}
        description="Adjust the included products, quantities, pricing, specifications, related deals, and images in one place."
        actions={
          <DeleteDealButton
            dealId={deal.id}
            dealTitle={deal.title}
            returnTo={routes.admin.dealEdit(deal.id)}
          />
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

      <AdminDealForm
        mode="edit"
        action={updateAdminDealAction}
        returnTo={routes.admin.dealEdit(deal.id)}
        submitLabel="Save changes"
        categories={categories}
        deal={deal}
      />
    </PageShell>
  );
}
