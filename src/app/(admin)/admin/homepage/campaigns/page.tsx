import Link from "next/link";
import { Tags } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { AdminPageHeader } from "@/features/admin/components/admin-page-patterns";
import {
  createAdminDealCampaignAction,
  getHomepageContentErrorMessage,
  getHomepageContentNoticeMessage,
  listAdminDealCampaigns,
  updateAdminDealCampaignAction,
} from "@/features/admin/homepage";
import { AdminDealCampaignEditPanel } from "@/features/admin/homepage/components/admin-deal-campaign-edit-panel";
import { AdminDealCampaignForm } from "@/features/admin/homepage/components/admin-deal-campaign-form";
import { requireRouteAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";

export const metadata = buildMetadata({
  title: "Deal Campaigns",
  path: routes.admin.homepageCampaigns,
  description: "Manage homepage deal campaign timing and storefront promotional visibility.",
});

type AdminHomepageCampaignsPageProps = {
  searchParams?: Promise<{ notice?: string; error?: string }>;
};

export default async function AdminHomepageCampaignsPage({ searchParams }: AdminHomepageCampaignsPageProps) {
  await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess, rbacPermissions.settingsManage],
    from: routes.admin.homepageCampaigns,
  });

  const params = (await searchParams) ?? {};
  const campaigns = await listAdminDealCampaigns();
  const noticeMessage = getHomepageContentNoticeMessage(params.notice);
  const errorMessage = getHomepageContentErrorMessage(params.error);

  return (
    <PageShell className="gap-8">
      <AdminPageHeader
        eyebrow="Homepage"
        title="Deal campaigns"
        description="Manage campaign windows for short-term homepage promotions. Live campaigns can feed storefront deal spotlight blocks automatically."
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
          <CardTitle>Create campaign</CardTitle>
          <CardDescription>Add a live window for a new homepage promotion campaign.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminDealCampaignForm
            action={createAdminDealCampaignAction}
            submitLabel="Save campaign"
            returnTo={routes.admin.homepageCampaigns}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {campaigns.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">No deal campaigns yet. Create one above to schedule storefront promotions.</CardContent>
          </Card>
        ) : (
          campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader>
                <CardTitle>{campaign.name}</CardTitle>
                <CardDescription>
                  Updated {campaign.updatedAt.toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AdminDealCampaignEditPanel
                  action={updateAdminDealCampaignAction}
                  campaignId={campaign.id}
                  campaignName={campaign.name}
                  returnTo={routes.admin.homepageCampaigns}
                  initialValues={{
                    name: campaign.name,
                    description: campaign.description,
                    price: campaign.price,
                    compareAt: campaign.compareAt,
                    targetHref: campaign.targetHref,
                    imageUrl: campaign.imageUrl,
                    imageAlt: campaign.imageAlt,
                    startsAt: campaign.startsAt,
                    endsAt: campaign.endsAt,
                    active: campaign.active,
                  }}
                />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <Tags className="mt-0.5 size-4" />
          <p>Campaign scheduling prevents expired deal messaging from lingering on the homepage and keeps promotions easier to maintain.</p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
