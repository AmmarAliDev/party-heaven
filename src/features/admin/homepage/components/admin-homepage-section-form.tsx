"use client";

import { useEffect } from "react";
import type { z } from "zod";

import { DynamicForm, type DynamicFormFieldConfig, useAppForm, useServerActionSubmit } from "@/components/forms";
import { Button } from "@/components/ui/button";

import {
  adminHomepageSectionKindValues,
  adminHomepageSectionMutationSchema,
  type AdminHomepageSectionType,
  getHomepageSectionContentTemplate,
} from "../validation";
import { buildDateTimeField, toDateTimeLocalInputValue } from "./form-helpers";

type AdminHomepageSectionFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  returnTo: string;
  sectionId?: string;
  initialValues?: {
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

type AdminHomepageSectionFormValues = {
  key: string;
  title: string;
  type: AdminHomepageSectionType;
  position: number;
  active: boolean;
  startAt: string;
  endAt: string;
  content: string | Record<string, unknown>;
};

const typeOptions = adminHomepageSectionKindValues.map((value) => ({
  value,
  label: value.replaceAll("-", " "),
}));

const sectionContentGuidance: Record<AdminHomepageSectionType, string> = {
  "announcement-bar": "Fields: message, href?, label?",
  "featured-categories": "Fields: description?, categories[]",
  "featured-deals": "Fields: description?, ctaLabel, ctaHref, placeholderMessage",
  "featured-products": "Fields: description?, products[]",
  "deal-spotlight": "Fields: description, dealLabel, price, compareAt, ctaLabel, ctaHref, image? { url, alt }",
};

const sectionFields: DynamicFormFieldConfig<AdminHomepageSectionFormValues>[] = [
  {
    id: "homepage-section-key",
    name: "key",
    type: "text",
    label: "Internal key",
    placeholder: "announcement-primary",
    required: true,
  },
  {
    id: "homepage-section-title",
    name: "title",
    type: "text",
    label: "Admin title",
    placeholder: "Announcement bar",
    required: true,
  },
  {
    id: "homepage-section-type",
    name: "type",
    type: "select",
    label: "Section type",
    options: typeOptions,
    required: true,
  },
  {
    id: "homepage-section-position",
    name: "position",
    type: "number",
    label: "Display order",
    min: 0,
    required: true,
  },
  buildDateTimeField<AdminHomepageSectionFormValues>({
    id: "homepage-section-start-at",
    name: "startAt",
    label: "Start time",
  }),
  buildDateTimeField<AdminHomepageSectionFormValues>({
    id: "homepage-section-end-at",
    name: "endAt",
    label: "End time",
  }),
  {
    id: "homepage-section-active",
    name: "active",
    type: "checkbox",
    label: "Enabled on storefront",
    description: "Disabled sections stay editable without rendering live.",
    containerClassName: "md:col-span-2",
  },
  {
    id: "homepage-section-content",
    name: "content",
    type: "textarea",
    label: "Content JSON",
    description: "Keep the payload aligned with the selected section type.",
    rows: 14,
    required: true,
    containerClassName: "md:col-span-2",
    controlClassName: "font-mono text-xs",
  },
];

function buildHomepageSectionFormData(
  values: AdminHomepageSectionFormValues,
  input: { returnTo: string; sectionId?: string },
) {
  const formData = new FormData();

  if (input.sectionId) {
    formData.set("id", input.sectionId);
  }

  formData.set("returnTo", input.returnTo);
  formData.set("key", values.key);
  formData.set("title", values.title);
  formData.set("type", values.type);
  formData.set("position", String(values.position ?? 0));
  formData.set("startAt", toDateTimeLocalInputValue(values.startAt));
  formData.set("endAt", toDateTimeLocalInputValue(values.endAt));
  formData.set(
    "content",
    typeof values.content === "string" ? values.content : JSON.stringify(values.content, null, 2),
  );

  if (values.active) {
    formData.set("active", "true");
  }

  return formData;
}

export function AdminHomepageSectionForm({
  action,
  submitLabel,
  returnTo,
  sectionId,
  initialValues,
}: AdminHomepageSectionFormProps) {
  const initialType = initialValues?.type ?? "announcement-bar";
  const form = useAppForm<AdminHomepageSectionFormValues>({
    schema: adminHomepageSectionMutationSchema as unknown as z.ZodType<AdminHomepageSectionFormValues>,
    defaultValues: {
      key: initialValues?.key ?? "",
      title: initialValues?.title ?? "",
      type: initialType,
      position: initialValues?.position ?? 0,
      active: initialValues?.active ?? true,
      startAt: toDateTimeLocalInputValue(initialValues?.startAt),
      endAt: toDateTimeLocalInputValue(initialValues?.endAt),
      content: initialValues?.content ?? getHomepageSectionContentTemplate(initialType),
    },
  });

  const { isPending, submitWithAction } = useServerActionSubmit(form);
  const selectedType = form.watch("type");

  useEffect(() => {
    const currentContent = form.getValues("content");
    const knownTemplates = adminHomepageSectionKindValues.map((value) => getHomepageSectionContentTemplate(value));

    if (typeof currentContent !== "string" || !knownTemplates.includes(currentContent)) {
      return;
    }

    form.setValue("content", getHomepageSectionContentTemplate(selectedType), {
      shouldDirty: currentContent !== getHomepageSectionContentTemplate(selectedType),
      shouldValidate: true,
    });
  }, [form, selectedType]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        <span>Need a starting point for this section type?</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            form.setValue("content", getHomepageSectionContentTemplate(selectedType), {
              shouldDirty: true,
              shouldValidate: true,
            });
          }}
        >
          Load example JSON
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{sectionContentGuidance[selectedType]}</p>

      <DynamicForm
        form={form}
        fields={sectionFields}
        fieldsClassName="grid gap-4 md:grid-cols-2"
        formErrorTitle="Please review the section details"
        onSubmit={async (values) => {
          await submitWithAction(
            action,
            buildHomepageSectionFormData(values, {
              returnTo,
              ...(sectionId ? { sectionId } : {}),
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
    </div>
  );
}
