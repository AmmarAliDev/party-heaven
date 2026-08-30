import Link from "next/link";
import { Megaphone } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { AdminPageHeader } from "@/features/admin/components/admin-page-patterns";
import {
  createAdminBannerAction,
  getHomepageContentErrorMessage,
  getHomepageContentNoticeMessage,
  listAdminBanners,
  updateAdminBannerAction,
} from "@/features/admin/homepage";
import { AdminBannerEditPanel } from "@/features/admin/homepage/components/admin-banner-edit-panel";
import { AdminBannerForm } from "@/features/admin/homepage/components/admin-banner-form";
import { requireRouteAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";

export const metadata = buildMetadata({
  title: "Homepage Banners",
  path: routes.admin.homepageBanners,
  description: "Manage homepage banner scheduling and storefront announcement visibility.",
});

type AdminHomepageBannersPageProps = {
  searchParams?: Promise<{ notice?: string; error?: string }>;
};

export default async function AdminHomepageBannersPage({ searchParams }: AdminHomepageBannersPageProps) {
  await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess, rbacPermissions.settingsManage],
    from: routes.admin.homepageBanners,
  });

  const params = (await searchParams) ?? {};
  const banners = await listAdminBanners();
  const noticeMessage = getHomepageContentNoticeMessage(params.notice);
  const errorMessage = getHomepageContentErrorMessage(params.error);

  return (
    <PageShell className="gap-8">
      <AdminPageHeader
        eyebrow="Homepage"
        title="Banners"
        description="Banner records support enablement, ordering, and scheduling. Active banners surface as storefront announcement-style promos during their live windows."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={routes.admin.homepage} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Overview
            </Link>
            <Link href={routes.admin.homepageSections} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Sections
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
          <CardTitle>Create banner</CardTitle>
          <CardDescription>Add a new banner with an optional live window.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminBannerForm
            action={createAdminBannerAction}
            submitLabel="Save banner"
            returnTo={routes.admin.homepageBanners}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {banners.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">No banners yet. Create one above to start announcing offers.</CardContent>
          </Card>
        ) : (
          banners.map((banner) => (
            <Card key={banner.id}>
              <CardHeader>
                <CardTitle>{banner.title}</CardTitle>
                <CardDescription>
                  Updated {banner.updatedAt.toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminBannerEditPanel
                  action={updateAdminBannerAction}
                  bannerId={banner.id}
                  bannerTitle={banner.title}
                  returnTo={routes.admin.homepageBanners}
                  initialValues={{
                    title: banner.title,
                    imageUrl: banner.imageUrl,
                    href: banner.href,
                    position: banner.position,
                    active: banner.active,
                    startAt: banner.startAt,
                    endAt: banner.endAt,
                  }}
                />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <Megaphone className="mt-0.5 size-4" />
          <p>Use banners for short-form promos and announcements. Scheduling helps keep expired messaging off the storefront automatically.</p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
