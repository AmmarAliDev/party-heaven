"use client";

import Link from "next/link";
import { CalendarHeart, Eye, ImageIcon } from "lucide-react";
import { useWatch } from "react-hook-form";

import { DynamicFormField, useAppForm, useServerActionSubmit } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import { routes } from "@/config/routes";
import { AdminSeoSection } from "@/features/admin/components/admin-seo-section";
import { AdminImageUploadInput } from "@/features/admin/uploads";

import type { AdminOccasionCategoryOption, AdminOccasionFormRecord } from "../service";
import { adminOccasionMutationSchema } from "../validation";
import { type AdminOccasionFormValues,OccasionContentPicker } from "./occasion-content-picker";

type AdminOccasionFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => void | Promise<void>;
  returnTo: string;
  submitLabel: string;
  categories: AdminOccasionCategoryOption[];
  occasion?: AdminOccasionFormRecord | null;
};

function buildDefaultValues(occasion?: AdminOccasionFormRecord | null): AdminOccasionFormValues {
  if (!occasion) {
    return {
      name: "",
      slug: "",
      shortDescription: undefined,
      description: undefined,
      coverImageUrl: undefined,
      coverImageAlt: undefined,
      status: "DRAFT",
      isSpecial: false,
      products: [],
      dealIds: [],
      seoTitle: undefined,
      seoDescription: undefined,
      seoCanonicalUrl: undefined,
      seoOgTitle: undefined,
      seoOgDescription: undefined,
      seoImageUrl: undefined,
      seoKeywords: undefined,
      seoNoIndex: false,
      seoSchemaNotes: undefined,
    };
  }

  return {
    id: occasion.id,
    name: occasion.name,
    slug: occasion.slug,
    shortDescription: occasion.shortDescription || undefined,
    description: occasion.description || undefined,
    coverImageUrl: occasion.coverImageUrl || undefined,
    coverImageAlt: occasion.coverImageAlt || undefined,
    status: occasion.status,
    isSpecial: occasion.isSpecial,
    products: occasion.products.map((product) => ({
      productId: product.productId,
      categoryId: product.categoryId ?? "",
    })),
    dealIds: occasion.deals.map((deal) => deal.dealId),
    seoTitle: occasion.seoTitle || undefined,
    seoDescription: occasion.seoDescription || undefined,
    seoCanonicalUrl: occasion.seoCanonicalUrl || undefined,
    seoOgTitle: occasion.seoOgTitle || undefined,
    seoOgDescription: occasion.seoOgDescription || undefined,
    seoImageUrl: occasion.seoImageUrl || undefined,
    seoKeywords: occasion.seoKeywords || undefined,
    seoNoIndex: occasion.seoNoIndex,
    seoSchemaNotes: occasion.seoSchemaNotes || undefined,
  };
}

function buildOccasionFormData(values: AdminOccasionFormValues, input: { returnTo: string; occasionId?: string }) {
  const formData = new FormData();

  if (input.occasionId) {
    formData.set("id", input.occasionId);
  }

  formData.set("returnTo", input.returnTo);
  formData.set("name", values.name);
  formData.set("slug", values.slug);
  formData.set("shortDescription", values.shortDescription ?? "");
  formData.set("description", values.description ?? "");
  formData.set("coverImageUrl", values.coverImageUrl ?? "");
  formData.set("coverImageAlt", values.coverImageAlt ?? "");
  formData.set("status", values.status);

  if (values.isSpecial) {
    formData.set("isSpecial", "on");
  }

  values.products.forEach((product) => {
    formData.append("occasionProductId", product.productId);
    formData.append("occasionCategoryId", product.categoryId ?? "");
  });

  values.dealIds.forEach((dealId) => {
    formData.append("occasionDealId", dealId);
  });

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

export function AdminOccasionForm({
  mode,
  action,
  returnTo,
  submitLabel,
  categories,
  occasion,
}: AdminOccasionFormProps) {
  const form = useAppForm<AdminOccasionFormValues>({
    schema: adminOccasionMutationSchema,
    defaultValues: buildDefaultValues(occasion),
  });
  const { isPending, submitWithAction } = useServerActionSubmit(form);

  const watchedValues = useWatch({ control: form.control });
  const storefrontHref = watchedValues.slug ? routes.storefront.occasion(watchedValues.slug) : null;
  const productCount = watchedValues.products?.length ?? 0;
  const dealCount = watchedValues.dealIds?.length ?? 0;

  return (
    <form
      className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]"
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        form.clearErrors("root");
        const submitTarget = mode === "edit" && occasion?.id ? { returnTo, occasionId: occasion.id } : { returnTo };
        await submitWithAction(action, buildOccasionFormData(values, submitTarget));
      })}
    >
      <div className="space-y-6">
        <FormErrorSummary errors={form.formState.errors} title="Please review the occasion details" />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarHeart className="size-4" />
              Basic details
            </CardTitle>
            <CardDescription>
              Use plain language so the storefront stays easy to scan for shoppers (e.g. &ldquo;Birthday&rdquo;,
              &ldquo;Wedding&rdquo;, &ldquo;Baby Shower&rdquo;).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <DynamicFormField
                control={form.control}
                disabled={isPending}
                fieldConfig={{
                  id: "occasion-name",
                  name: "name",
                  type: "text",
                  label: "Name",
                  placeholder: "Birthday",
                  required: true,
                }}
              />
            </div>

            <DynamicFormField
              control={form.control}
              disabled={isPending}
              fieldConfig={{
                id: "occasion-status",
                name: "status",
                type: "select",
                label: "Status",
                required: true,
                options: [
                  { value: "DRAFT", label: "Draft" },
                  { value: "PUBLISHED", label: "Published" },
                  { value: "ARCHIVED", label: "Archived" },
                ],
              }}
            />

            <DynamicFormField
              control={form.control}
              disabled={isPending}
              fieldConfig={{
                id: "occasion-slug",
                name: "slug",
                type: "text",
                label: "URL slug",
                placeholder: "birthday",
                required: true,
              }}
            />

            <div className="md:col-span-2">
              <DynamicFormField
                control={form.control}
                disabled={isPending}
                fieldConfig={{
                  id: "occasion-is-special",
                  name: "isSpecial",
                  type: "checkbox",
                  label: "Mark as a special occasion",
                  description:
                    "Special occasions (Birthday, Wedding, …) are surfaced as seasonal/high-visibility content and carry a badge on the storefront. Normal occasions are everyday collections.",
                }}
              />
            </div>

            <div className="md:col-span-2">
              <DynamicFormField
                control={form.control}
                disabled={isPending}
                fieldConfig={{
                  id: "occasion-short-description",
                  name: "shortDescription",
                  type: "textarea",
                  label: "Short description",
                  placeholder: "Shown on occasion cards and quick previews.",
                  rows: 3,
                }}
              />
            </div>

            <div className="md:col-span-2">
              <DynamicFormField
                control={form.control}
                disabled={isPending}
                fieldConfig={{
                  id: "occasion-description",
                  name: "description",
                  type: "textarea",
                  label: "Full description",
                  placeholder: "Explain what makes this collection special for shoppers.",
                  rows: 5,
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="size-4" />
              Cover image
            </CardTitle>
            <CardDescription>
              A wide cover image shown at the top of the occasion page. Leave empty to use the default
              fallback style.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <DynamicFormField
                control={form.control}
                disabled={isPending}
                fieldConfig={{
                  id: "occasion-cover-image",
                  name: "coverImageUrl",
                  type: "custom",
                  label: "Cover image",
                  placeholder: "https://example.com/occasion-cover.jpg",
                  render: ({ field, fieldState, inputId, describedBy, disabled }) => (
                    <AdminImageUploadInput
                      inputId={inputId}
                      value={typeof field.value === "string" ? field.value : ""}
                      onChange={(nextValue) => {
                        field.onChange(nextValue);
                      }}
                      onBlur={field.onBlur}
                      purpose="occasion"
                      placeholder="https://example.com/occasion-cover.jpg"
                      describedBy={describedBy}
                      disabled={disabled}
                      invalid={Boolean(fieldState.error)}
                    />
                  ),
                }}
              />
            </div>

            <div className="md:col-span-2">
              <DynamicFormField
                control={form.control}
                disabled={isPending}
                fieldConfig={{
                  id: "occasion-cover-alt",
                  name: "coverImageAlt",
                  type: "text",
                  label: "Cover image alt text",
                  placeholder: "Plain-language description of the cover image",
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarHeart className="size-4" />
              Curated products and deals
            </CardTitle>
            <CardDescription>
              Add existing catalog products (choose a category, then pick products from it) and deals to
              this occasion. The quick search finds products, deals, and categories in one place.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OccasionContentPicker
              form={form}
              categories={categories}
              disabled={isPending}
              occasion={occasion}
            />
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : submitLabel}
          </Button>
          <Link href={routes.admin.occasions} className={buttonVariants({ variant: "ghost" })}>
            Back to occasions
          </Link>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="size-4" />
              Preview-friendly summary
            </CardTitle>
            <CardDescription>
              This card mirrors the key details shoppers and search engines care about most.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={
                  watchedValues.status === "PUBLISHED"
                    ? "info"
                    : watchedValues.status === "ARCHIVED"
                      ? "warning"
                      : "secondary"
                }
              >
                {watchedValues.status}
              </Badge>
              {watchedValues.isSpecial ? <Badge variant="danger">Special occasion</Badge> : null}
              <Badge variant="outline">
                {productCount} product{productCount === 1 ? "" : "s"} · {dealCount} deal
                {dealCount === 1 ? "" : "s"}
              </Badge>
            </div>

            <div>
              <p className="text-lg font-semibold">{watchedValues.name || "Occasion title preview"}</p>
              <p className="text-muted-foreground mt-1">
                {watchedValues.shortDescription || "A short summary will appear here after you save the occasion."}
              </p>
            </div>

            <div className="rounded-xl border p-3">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Expected storefront URL</p>
              <p className="mt-1 break-all">{storefrontHref ?? "Save a slug to generate the preview link."}</p>
              {storefrontHref ? (
                <Link
                  href={storefrontHref}
                  className="text-primary mt-2 inline-flex text-sm font-medium hover:underline"
                >
                  Open storefront preview
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <AdminSeoSection
          form={form}
          disabled={isPending}
          entityLabel="Occasion"
          titleField="name"
          slugField="slug"
          descriptionField="shortDescription"
          previewBasePath="/occasions"
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
      </div>
    </form>
  );
}
