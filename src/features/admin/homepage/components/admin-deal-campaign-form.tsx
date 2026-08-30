"use client";

import { z } from "zod";

import { DynamicForm, type DynamicFormFieldConfig, useAppForm, useServerActionSubmit } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { AdminImageUploadInput } from "@/features/admin/uploads";

import { adminDealCampaignMutationSchema } from "../validation";
import { buildDateTimeField, toDateTimeLocalInputValue } from "./form-helpers";

type AdminDealCampaignFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  returnTo: string;
  campaignId?: string;
  initialValues?: {
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

type AdminDealCampaignFormValues = {
  name: string;
  description: string;
  price: string;
  compareAt: string;
  targetHref: string;
  imageUrl: string;
  imageAlt: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
};

const campaignFields: DynamicFormFieldConfig<AdminDealCampaignFormValues>[] = [
  {
    id: "campaign-name",
    name: "name",
    type: "text",
    label: "Campaign name",
    placeholder: "48-hour flash deal",
    required: true,
    containerClassName: "md:col-span-2",
  },
  {
    id: "campaign-description",
    name: "description",
    type: "textarea",
    label: "Description",
    placeholder: "Short supporting copy for the storefront deal block.",
    rows: 4,
    containerClassName: "md:col-span-2",
  },
  {
    id: "campaign-price",
    name: "price",
    type: "number",
    label: "Campaign price (Rs.)",
    placeholder: "1599",
    description: "Optional manual campaign price. When omitted, storefront derives pricing from linked campaign product data.",
  },
  {
    id: "campaign-compare-at",
    name: "compareAt",
    type: "number",
    label: "Campaign compare-at (Rs.)",
    placeholder: "1999",
    description: "Optional compare-at value. Must be greater than or equal to campaign price when both are set.",
  },
  {
    id: "campaign-target-href",
    name: "targetHref",
    type: "text",
    label: "Target link",
    placeholder: "/categories/grocery/flash-cleaner",
    description: "Optional explicit destination. Falls back to the first linked campaign product.",
    containerClassName: "md:col-span-2",
  },
  {
    id: "campaign-image-url",
    name: "imageUrl",
    type: "custom",
    label: "Spotlight image",
    placeholder: "https://example.com/deal.jpg",
    description: "Optional image shown above the spotlight details.",
    containerClassName: "md:col-span-2",
    render: ({ field, fieldState, inputId, describedBy, disabled }) => (
      <AdminImageUploadInput
        inputId={inputId}
        value={typeof field.value === "string" ? field.value : ""}
        onChange={(nextValue) => {
          field.onChange(nextValue);
        }}
        onBlur={field.onBlur}
        purpose="content"
        placeholder="https://example.com/deal.jpg"
        describedBy={describedBy}
        disabled={disabled}
        invalid={Boolean(fieldState.error)}
      />
    ),
  },
  {
    id: "campaign-image-alt",
    name: "imageAlt",
    type: "text",
    label: "Image alt text",
    placeholder: "Featured products for this campaign",
    description: "Required only when a spotlight image URL is set.",
    containerClassName: "md:col-span-2",
  },
  buildDateTimeField<AdminDealCampaignFormValues>({
    id: "campaign-start-at",
    name: "startsAt",
    label: "Start time",
  }),
  buildDateTimeField<AdminDealCampaignFormValues>({
    id: "campaign-end-at",
    name: "endsAt",
    label: "End time",
  }),
  {
    id: "campaign-active",
    name: "active",
    type: "checkbox",
    label: "Enabled on storefront",
    description: "Inactive campaigns remain saved but do not render promotion blocks.",
    containerClassName: "md:col-span-2",
  },
];

function buildDealCampaignFormData(
  values: AdminDealCampaignFormValues,
  input: { returnTo: string; campaignId?: string },
) {
  const formData = new FormData();

  if (input.campaignId) {
    formData.set("id", input.campaignId);
  }

  formData.set("returnTo", input.returnTo);
  formData.set("name", values.name);
  formData.set("description", values.description ?? "");
  formData.set("price", values.price ?? "");
  formData.set("compareAt", values.compareAt ?? "");
  formData.set("targetHref", values.targetHref ?? "");
  formData.set("imageUrl", values.imageUrl ?? "");
  formData.set("imageAlt", values.imageAlt ?? "");
  formData.set("startsAt", toDateTimeLocalInputValue(values.startsAt));
  formData.set("endsAt", toDateTimeLocalInputValue(values.endsAt));

  if (values.active) {
    formData.set("active", "true");
  }

  return formData;
}

export function AdminDealCampaignForm({
  action,
  submitLabel,
  returnTo,
  campaignId,
  initialValues,
}: AdminDealCampaignFormProps) {
  const form = useAppForm<AdminDealCampaignFormValues>({
    schema: adminDealCampaignMutationSchema as unknown as z.ZodType<AdminDealCampaignFormValues>,
    defaultValues: {
      name: initialValues?.name ?? "",
      description: initialValues?.description ?? "",
      price: typeof initialValues?.price === "number" ? `${initialValues.price}` : "",
      compareAt: typeof initialValues?.compareAt === "number" ? `${initialValues.compareAt}` : "",
      targetHref: initialValues?.targetHref ?? "",
      imageUrl: initialValues?.imageUrl ?? "",
      imageAlt: initialValues?.imageAlt ?? "",
      startsAt: toDateTimeLocalInputValue(initialValues?.startsAt),
      endsAt: toDateTimeLocalInputValue(initialValues?.endsAt),
      active: initialValues?.active ?? true,
    },
  });

  const { isPending, submitWithAction } = useServerActionSubmit(form);

  return (
    <DynamicForm
      form={form}
      fields={campaignFields}
      fieldsClassName="grid gap-4 md:grid-cols-2"
      formErrorTitle="Please review the campaign details"
      onSubmit={async (values) => {
        await submitWithAction(
          action,
          buildDealCampaignFormData(values, {
            returnTo,
            ...(campaignId ? { campaignId } : {}),
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
