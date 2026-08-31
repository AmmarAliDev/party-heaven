"use client";

import Link from "next/link";

import { DynamicFormField, useAppForm, useServerActionSubmit } from "@/components/forms";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import { routes } from "@/config/routes";
import { AdminSeoSection } from "@/features/admin/components/admin-seo-section";
import { AdminImageUploadInput } from "@/features/admin/uploads";

import { type CategoryCreateInput, categoryMutationSchema } from "../validation";

type AdminCategoryFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  returnTo: string;
  categoryId?: string;
  cancelHref?: string;
  initialValues?: Partial<CategoryCreateInput>;
};

type AdminCategoryFormValues = CategoryCreateInput;

function buildCategoryFormData(values: AdminCategoryFormValues, input: { returnTo: string; categoryId?: string }) {
  const formData = new FormData();

  if (input.categoryId) {
    formData.set("id", input.categoryId);
  }

  formData.set("returnTo", input.returnTo);
  formData.set("name", values.name);
  formData.set("slug", values.slug);
  formData.set("description", values.description ?? "");
  formData.set("categoryCardImageUrl", values.categoryCardImageUrl ?? "");
  formData.set("status", values.status);
  formData.set("seoTitle", values.seoTitle ?? "");
  formData.set("seoDescription", values.seoDescription ?? "");
  formData.set("seoCanonicalUrl", values.seoCanonicalUrl ?? "");
  formData.set("seoOgTitle", values.seoOgTitle ?? "");
  formData.set("seoOgDescription", values.seoOgDescription ?? "");
  formData.set("seoImageUrl", values.seoImageUrl ?? "");
  formData.set("seoKeywords", values.seoKeywords ?? "");
  formData.set("seoSchemaNotes", values.seoSchemaNotes ?? "");

  if (values.seoNoIndex) {
    formData.set("seoNoIndex", "on");
  }

  return formData;
}

export function AdminCategoryForm({
  action,
  submitLabel,
  returnTo,
  categoryId,
  cancelHref = routes.admin.categories,
  initialValues,
}: AdminCategoryFormProps) {
  const form = useAppForm<AdminCategoryFormValues>({
    schema: categoryMutationSchema,
    defaultValues: {
      name: initialValues?.name ?? "",
      slug: initialValues?.slug ?? "",
      description: initialValues?.description ?? "",
      categoryCardImageUrl: initialValues?.categoryCardImageUrl ?? "",
      status: initialValues?.status ?? "DRAFT",
      seoTitle: initialValues?.seoTitle ?? "",
      seoDescription: initialValues?.seoDescription ?? "",
      seoCanonicalUrl: initialValues?.seoCanonicalUrl ?? "",
      seoOgTitle: initialValues?.seoOgTitle ?? "",
      seoOgDescription: initialValues?.seoOgDescription ?? "",
      seoImageUrl: initialValues?.seoImageUrl ?? "",
      seoKeywords: initialValues?.seoKeywords ?? "",
      seoNoIndex: initialValues?.seoNoIndex ?? false,
      seoSchemaNotes: initialValues?.seoSchemaNotes ?? "",
    },
  });

  const { isPending, submitWithAction } = useServerActionSubmit(form);

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        const submitTarget = categoryId ? { returnTo, categoryId } : { returnTo };
        await submitWithAction(action, buildCategoryFormData(values, submitTarget));
      })}
    >
      <FormErrorSummary errors={form.formState.errors} title="Please review the category details" />

      <div className="grid gap-4 md:grid-cols-2">
        <DynamicFormField
          control={form.control}
          disabled={isPending}
          fieldConfig={{
            id: "category-name",
            name: "name",
            type: "text",
            label: "Name",
            placeholder: "Home Care",
            required: true,
          }}
        />

        <DynamicFormField
          control={form.control}
          disabled={isPending}
          fieldConfig={{
            id: "category-status",
            name: "status",
            type: "select",
            label: "Status",
            options: [
              { value: "DRAFT", label: "Draft" },
              { value: "PUBLISHED", label: "Published" },
              { value: "ARCHIVED", label: "Archived" },
            ],
            required: true,
          }}
        />

        <div className="md:col-span-2">
          <DynamicFormField
            control={form.control}
            disabled={isPending}
            fieldConfig={{
              id: "category-description",
              name: "description",
              type: "textarea",
              label: "Description",
              placeholder: "Short summary shown in admin and listings.",
              rows: 4,
            }}
          />
        </div>

        <div className="md:col-span-2">
          <DynamicFormField
            control={form.control}
            disabled={isPending}
            fieldConfig={{
              id: "category-card-image",
              name: "categoryCardImageUrl",
              type: "custom",
              label: "Category card image",
              placeholder: "https://example.com/category-card.jpg",
              description: "Optional background image used on storefront category cards. Leave empty to use the default fallback style.",
              render: ({ field, fieldState, inputId, describedBy, disabled }) => (
                <AdminImageUploadInput
                  inputId={inputId}
                  value={typeof field.value === "string" ? field.value : ""}
                  onChange={(nextValue) => {
                    field.onChange(nextValue);
                  }}
                  onBlur={field.onBlur}
                  purpose="category"
                  placeholder="https://example.com/category-card.jpg"
                  describedBy={describedBy}
                  disabled={disabled}
                  invalid={Boolean(fieldState.error)}
                />
              ),
            }}
          />
        </div>
      </div>

      <AdminSeoSection
        form={form}
        disabled={isPending}
        entityLabel="Category"
        titleField="name"
        slugField="slug"
        descriptionField="description"
        previewBasePath="/categories"
        seoTitleField="seoTitle"
        seoDescriptionField="seoDescription"
        seoCanonicalUrlField="seoCanonicalUrl"
        seoOgTitleField="seoOgTitle"
        seoOgDescriptionField="seoOgDescription"
        seoKeywordsField="seoKeywords"
        seoImageUrlField="seoImageUrl"
        seoNoIndexField="seoNoIndex"
        seoSchemaNotesField="seoSchemaNotes"
      />

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : submitLabel}
        </Button>
        <Link href={cancelHref} className={buttonVariants({ variant: "ghost" })}>
          Back to categories
        </Link>
      </div>
    </form>
  );
}
