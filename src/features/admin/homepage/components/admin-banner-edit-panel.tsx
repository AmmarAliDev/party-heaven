"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";

import { DeleteAdminBannerButton } from "./delete-admin-banner-button";

const AdminBannerForm = dynamic(
  () => import("./admin-banner-form").then((mod) => mod.AdminBannerForm),
  {
    loading: () => <p className="text-sm text-muted-foreground">Loading editor...</p>,
  },
);

type AdminBannerEditPanelProps = {
  action: (formData: FormData) => void | Promise<void>;
  bannerId: string;
  bannerTitle: string;
  returnTo: string;
  initialValues: {
    title?: string;
    imageUrl?: string;
    href?: string;
    position?: number;
    active?: boolean;
    startAt?: Date | string | null;
    endAt?: Date | string | null;
  };
};

export function AdminBannerEditPanel({ action, bannerId, bannerTitle, returnTo, initialValues }: AdminBannerEditPanelProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing((current) => !current)}>
          {isEditing ? "Close editor" : "Edit banner"}
        </Button>
        <DeleteAdminBannerButton bannerId={bannerId} bannerTitle={bannerTitle} returnTo={returnTo} />
      </div>

      {isEditing ? (
        <AdminBannerForm
          action={action}
          submitLabel="Save changes"
          returnTo={returnTo}
          bannerId={bannerId}
          initialValues={initialValues}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Editor is loaded on demand to keep this page responsive.</p>
      )}
    </div>
  );
}
