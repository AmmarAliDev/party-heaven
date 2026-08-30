"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";

import { DeleteAdminDealCampaignButton } from "./delete-admin-deal-campaign-button";

const AdminDealCampaignForm = dynamic(
  () => import("./admin-deal-campaign-form").then((mod) => mod.AdminDealCampaignForm),
  {
    loading: () => <p className="text-sm text-muted-foreground">Loading editor...</p>,
  },
);

type AdminDealCampaignEditPanelProps = {
  action: (formData: FormData) => void | Promise<void>;
  campaignId: string;
  campaignName: string;
  returnTo: string;
  initialValues: {
    name?: string;
    description?: string;
    price?: number | null;
    compareAt?: number | null;
    targetHref?: string;
    imageUrl?: string;
    imageAlt?: string;
    startsAt?: Date | string | null;
    endsAt?: Date | string | null;
    active?: boolean;
  };
};

export function AdminDealCampaignEditPanel({
  action,
  campaignId,
  campaignName,
  returnTo,
  initialValues,
}: AdminDealCampaignEditPanelProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing((current) => !current)}>
          {isEditing ? "Close editor" : "Edit campaign"}
        </Button>
        <DeleteAdminDealCampaignButton campaignId={campaignId} campaignName={campaignName} returnTo={returnTo} />
      </div>

      {isEditing ? (
        <AdminDealCampaignForm
          action={action}
          submitLabel="Save changes"
          returnTo={returnTo}
          campaignId={campaignId}
          initialValues={initialValues}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Editor is loaded on demand to keep this page responsive.</p>
      )}
    </div>
  );
}
