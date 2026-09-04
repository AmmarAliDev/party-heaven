import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { AdminPageHeader } from "@/features/admin/components/admin-page-patterns";
import {
  getAdminOccasionById,
  getOccasionErrorMessage,
  getOccasionNoticeMessage,
  listAdminOccasionCategories,
  updateAdminOccasionAction,
} from "@/features/admin/occasions";
import { AdminOccasionForm } from "@/features/admin/occasions/components/admin-occasion-form";
import { DeleteOccasionButton } from "@/features/admin/occasions/components/delete-occasion-button";
import { requireRouteAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";

type EditAdminOccasionPageProps = {
  params: Promise<{ occasionId: string }>;
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

export async function generateMetadata({ params }: EditAdminOccasionPageProps) {
  const { occasionId } = await params;

  return buildMetadata({
    title: "Edit Occasion",
    path: routes.admin.occasionEdit(occasionId),
    description: "Update occasion content, curated products and deals.",
  });
}

export default async function EditAdminOccasionPage({ params, searchParams }: EditAdminOccasionPageProps) {
  await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess, rbacPermissions.catalogWrite],
    from: routes.admin.occasions,
  });

  const { occasionId } = await params;
  const query = (await searchParams) ?? {};

  const [occasion, categories] = await Promise.all([
    getAdminOccasionById(occasionId),
    listAdminOccasionCategories(),
  ]);

  if (!occasion) {
    notFound();
  }

  const noticeMessage = getOccasionNoticeMessage(query.notice);
  const errorMessage = getOccasionErrorMessage(query.error, "The occasion could not be updated. Please try again.");

  return (
    <PageShell className="gap-8">
      <AdminPageHeader
        eyebrow="Special Occasions"
        title={`Edit ${occasion.name}`}
        description="Adjust the cover image, details, curated products, deals, and SEO in one place."
        actions={
          <DeleteOccasionButton
            occasionId={occasion.id}
            occasionName={occasion.name}
            returnTo={routes.admin.occasionEdit(occasion.id)}
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

      <AdminOccasionForm
        mode="edit"
        action={updateAdminOccasionAction}
        returnTo={routes.admin.occasionEdit(occasion.id)}
        submitLabel="Save changes"
        categories={categories}
        occasion={occasion}
      />
    </PageShell>
  );
}
