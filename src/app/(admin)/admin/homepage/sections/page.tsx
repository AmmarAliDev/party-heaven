import Link from "next/link";
import { FileJson, Sparkles } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { AdminPageHeader } from "@/features/admin/components/admin-page-patterns";
import {
  createAdminHomepageSectionAction,
  getHomepageContentErrorMessage,
  getHomepageContentNoticeMessage,
  listAdminHomepageSections,
  seedAdminHomepageSectionsAction,
  updateAdminHomepageSectionAction,
} from "@/features/admin/homepage";
import { AdminHomepageSectionEditPanel } from "@/features/admin/homepage/components/admin-homepage-section-edit-panel";
import { AdminHomepageSectionForm } from "@/features/admin/homepage/components/admin-homepage-section-form";
import { adminHomepageSectionKindValues, type AdminHomepageSectionType } from "@/features/admin/homepage/validation";
import { requireRouteAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";

export const metadata = buildMetadata({
  title: "Homepage Sections",
  path: routes.admin.homepageSections,
  description: "Manage homepage section content, ordering, and scheduling.",
});

type AdminHomepageSectionsPageProps = {
  searchParams?: Promise<{ notice?: string; error?: string }>;
};

function getTypeLabel(value: string) {
  return value.replaceAll("-", " ");
}

function isAdminHomepageSectionType(value: string): value is AdminHomepageSectionType {
  return adminHomepageSectionKindValues.some((candidate) => candidate === value);
}

export default async function AdminHomepageSectionsPage({ searchParams }: AdminHomepageSectionsPageProps) {
  await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess, rbacPermissions.settingsManage],
    from: routes.admin.homepageSections,
  });

  const params = (await searchParams) ?? {};
  const sections = await listAdminHomepageSections();
  const noticeMessage = getHomepageContentNoticeMessage(params.notice);
  const errorMessage = getHomepageContentErrorMessage(params.error);

  return (
    <PageShell className="gap-8">
      <AdminPageHeader
        eyebrow="Homepage"
        title="Sections"
        description="Manage the section contract the storefront homepage renders from. Ordering, enablement, JSON content, and scheduling live here."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={routes.admin.homepage} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Overview
            </Link>
            <Link href={routes.admin.homepageBanners} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Banners
            </Link>
            <Link href={routes.admin.homepageCampaigns} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Campaigns
            </Link>
          </div>
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
          <CardTitle>Seed current storefront defaults</CardTitle>
          <CardDescription>
            If this is your first content pass, copy the existing fallback homepage into editable admin records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={seedAdminHomepageSectionsAction}>
            <input type="hidden" name="returnTo" value={routes.admin.homepageSections} />
            <button type="submit" className={buttonVariants({ size: "sm" })}>
              <Sparkles className="size-4" />
              Seed defaults
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create new section</CardTitle>
          <CardDescription>
            Announcement bar support is available through the announcement-bar section type.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminHomepageSectionForm
            action={createAdminHomepageSectionAction}
            submitLabel="Save new section"
            returnTo={routes.admin.homepageSections}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {sections.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No admin-managed sections yet. Seed the fallback content or create a new section above.
            </CardContent>
          </Card>
        ) : (
          sections.map((section) => (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>
                  {getTypeLabel(section.type)} • Last updated {section.updatedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminHomepageSectionEditPanel
                  action={updateAdminHomepageSectionAction}
                  sectionId={section.id}
                  sectionTitle={section.title}
                  returnTo={routes.admin.homepageSections}
                  initialValues={{
                    key: section.key,
                    title: section.title,
                    type: isAdminHomepageSectionType(section.type) ? section.type : "announcement-bar",
                    position: section.position,
                    active: section.active,
                    startAt: section.startAt,
                    endAt: section.endAt,
                    content: section.contentJson,
                  }}
                />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <FileJson className="mt-0.5 size-4" />
          <p>
            Keep JSON payloads aligned with the homepage section contract. Invalid shapes are blocked in admin and safely skipped on storefront reads.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
