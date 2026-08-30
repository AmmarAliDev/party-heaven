"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";

import { type AdminHomepageSectionType } from "../validation";
import { DeleteAdminHomepageSectionButton } from "./delete-admin-homepage-section-button";

const AdminHomepageSectionForm = dynamic(
  () => import("./admin-homepage-section-form").then((mod) => mod.AdminHomepageSectionForm),
  {
    loading: () => <p className="text-sm text-muted-foreground">Loading editor...</p>,
  },
);

type AdminHomepageSectionEditPanelProps = {
  action: (formData: FormData) => void | Promise<void>;
  sectionId: string;
  sectionTitle: string;
  returnTo: string;
  initialValues: {
    key?: string;
    title?: string;
    type?: AdminHomepageSectionType;
    position?: number;
    active?: boolean;
    startAt?: Date | string | null;
    endAt?: Date | string | null;
    content?: string;
  };
};

export function AdminHomepageSectionEditPanel({
  action,
  sectionId,
  sectionTitle,
  returnTo,
  initialValues,
}: AdminHomepageSectionEditPanelProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing((current) => !current)}>
          {isEditing ? "Close editor" : "Edit section"}
        </Button>
        <DeleteAdminHomepageSectionButton sectionId={sectionId} sectionTitle={sectionTitle} returnTo={returnTo} />
      </div>

      {isEditing ? (
        <AdminHomepageSectionForm
          action={action}
          submitLabel="Save changes"
          returnTo={returnTo}
          sectionId={sectionId}
          initialValues={initialValues}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Editor is loaded on demand to keep this page responsive.</p>
      )}
    </div>
  );
}
