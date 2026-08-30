"use client";

import type { z } from "zod";

import { DynamicForm, type DynamicFormFieldConfig, useAppForm, useServerActionSubmit } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { AdminImageUploadInput } from "@/features/admin/uploads";

import { adminBannerMutationSchema } from "../validation";
import { buildDateTimeField, toDateTimeLocalInputValue } from "./form-helpers";

type AdminBannerFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  returnTo: string;
  bannerId?: string;
  initialValues?: {
    title?: string;
    imageUrl?: string;
    href?: string;
    position?: number;
    active?: boolean;
    startAt?: Date | string | null;
    endAt?: Date | string | null;
  };
};

type AdminBannerFormValues = {
  title: string;
  imageUrl: string;
  href: string;
  position: number;
  active: boolean;
  startAt: string;
  endAt: string;
};

const bannerFields: DynamicFormFieldConfig<AdminBannerFormValues>[] = [
  {
    id: "banner-title",
    name: "title",
    type: "text",
    label: "Title",
    placeholder: "Weekend mega sale",
    required: true,
  },
  {
    id: "banner-image-url",
    name: "imageUrl",
    type: "custom",
    label: "Image",
    placeholder: "https://example.com/banner.jpg",
    required: true,
    description: "Upload the banner artwork or paste an existing absolute URL.",
    render: ({ field, fieldState, inputId, describedBy, disabled }) => (
      <AdminImageUploadInput
        inputId={inputId}
        value={typeof field.value === "string" ? field.value : ""}
        onChange={(nextValue) => {
          field.onChange(nextValue);
        }}
        onBlur={field.onBlur}
        purpose="banner"
        placeholder="https://example.com/banner.jpg"
        describedBy={describedBy}
        disabled={disabled}
        invalid={Boolean(fieldState.error)}
      />
    ),
  },
  {
    id: "banner-href",
    name: "href",
    type: "text",
    label: "Link target",
    placeholder: "/categories",
  },
  {
    id: "banner-position",
    name: "position",
    type: "number",
    label: "Order",
    min: 0,
    required: true,
  },
  buildDateTimeField<AdminBannerFormValues>({
    id: "banner-start-at",
    name: "startAt",
    label: "Start time",
  }),
  buildDateTimeField<AdminBannerFormValues>({
    id: "banner-end-at",
    name: "endAt",
    label: "End time",
  }),
  {
    id: "banner-active",
    name: "active",
    type: "checkbox",
    label: "Enabled on storefront",
    description: "Only active banners can surface on the homepage.",
    containerClassName: "md:col-span-2",
  },
];

function buildBannerFormData(
  values: AdminBannerFormValues,
  input: { returnTo: string; bannerId?: string },
) {
  const formData = new FormData();

  if (input.bannerId) {
    formData.set("id", input.bannerId);
  }

  formData.set("returnTo", input.returnTo);
  formData.set("title", values.title);
  formData.set("imageUrl", values.imageUrl);
  formData.set("href", values.href ?? "");
  formData.set("position", String(values.position ?? 0));
  formData.set("startAt", toDateTimeLocalInputValue(values.startAt));
  formData.set("endAt", toDateTimeLocalInputValue(values.endAt));

  if (values.active) {
    formData.set("active", "true");
  }

  return formData;
}

export function AdminBannerForm({ action, submitLabel, returnTo, bannerId, initialValues }: AdminBannerFormProps) {
  const form = useAppForm<AdminBannerFormValues>({
    schema: adminBannerMutationSchema as unknown as z.ZodType<AdminBannerFormValues>,
    defaultValues: {
      title: initialValues?.title ?? "",
      imageUrl: initialValues?.imageUrl ?? "",
      href: initialValues?.href ?? "",
      position: initialValues?.position ?? 0,
      active: initialValues?.active ?? true,
      startAt: toDateTimeLocalInputValue(initialValues?.startAt),
      endAt: toDateTimeLocalInputValue(initialValues?.endAt),
    },
  });

  const { isPending, submitWithAction } = useServerActionSubmit(form);

  return (
    <DynamicForm
      form={form}
      fields={bannerFields}
      fieldsClassName="grid gap-4 md:grid-cols-2"
      formErrorTitle="Please review the banner details"
      onSubmit={async (values) => {
        await submitWithAction(
          action,
          buildBannerFormData(values, {
            returnTo,
            ...(bannerId ? { bannerId } : {}),
          }),
        );
      }}
      actions={
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : submitLabel}
          </Button>
        </div>
      }
    />
  );
}
