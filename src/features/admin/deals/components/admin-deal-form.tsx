"use client";

import Link from "next/link";
import { Eye, Images, Layers3, Plus, SearchCheck, Trash2 } from "lucide-react";
import { Controller, type FieldPath, useFieldArray, useWatch } from "react-hook-form";

import { DynamicFormField, useAppForm, useServerActionSubmit } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import { routes } from "@/config/routes";
import { AdminSeoSection } from "@/features/admin/components/admin-seo-section";
import { AdminImageUploadInput } from "@/features/admin/uploads";
import { formatPrice } from "@/lib/currency";

import type { AdminDealCategoryOption, AdminDealFormRecord } from "../service";
import { type AdminDealCreateInput, adminDealMutationSchema } from "../validation";
import { AdminDealSeoGenerator } from "./admin-deal-seo-generator";
import { DealProductRowPicker } from "./deal-product-picker";
import { RelatedDealPicker } from "./related-deal-picker";

type AdminDealFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => void | Promise<void>;
  returnTo: string;
  submitLabel: string;
  categories: AdminDealCategoryOption[];
  deal?: AdminDealFormRecord | null;
};

type AdminDealFormValues = AdminDealCreateInput & { id?: string };

const statusOptions = [
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

function fieldPath(path: string) {
  return path as FieldPath<AdminDealFormValues>;
}

function buildDefaultValues(
  categories: AdminDealCategoryOption[],
  deal?: AdminDealFormRecord | null,
): AdminDealFormValues {
  if (!deal) {
    return {
      title: "",
      slug: "",
      shortDescription: undefined,
      description: undefined,
      status: "DRAFT",
      categoryId: categories[0]?.id ?? "",
      price: 0,
      comparePrice: undefined,
      products: [],
      images: [],
      specifications: [],
      relatedDealIds: [],
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
    id: deal.id,
    title: deal.title,
    slug: deal.slug,
    shortDescription: deal.shortDescription || undefined,
    description: deal.description || undefined,
    status: deal.status,
    categoryId: deal.categoryId,
    price: deal.price,
    comparePrice: deal.comparePrice ?? undefined,
    products: deal.products.map((product) => ({
      productId: product.productId,
      variantId: product.variantId ?? undefined,
      quantity: product.quantity,
    })),
    images: deal.images.map((image) => ({
      url: image.url,
      alt: image.alt,
    })),
    specifications: deal.specifications.map((specification) => ({
      key: specification.key,
      value: specification.value,
    })),
    relatedDealIds: deal.relatedDealIds,
    seoTitle: deal.seoTitle || undefined,
    seoDescription: deal.seoDescription || undefined,
    seoCanonicalUrl: deal.seoCanonicalUrl || undefined,
    seoOgTitle: deal.seoOgTitle || undefined,
    seoOgDescription: deal.seoOgDescription || undefined,
    seoImageUrl: deal.seoImageUrl || undefined,
    seoKeywords: deal.seoKeywords || undefined,
    seoNoIndex: deal.seoNoIndex,
    seoSchemaNotes: deal.seoSchemaNotes || undefined,
  };
}

function buildDealFormData(values: AdminDealFormValues, input: { returnTo: string; dealId?: string }) {
  const formData = new FormData();

  if (input.dealId) {
    formData.set("id", input.dealId);
  }

  formData.set("returnTo", input.returnTo);
  formData.set("title", values.title);
  formData.set("slug", values.slug);
  formData.set("shortDescription", values.shortDescription ?? "");
  formData.set("description", values.description ?? "");
  formData.set("status", values.status);
  formData.set("categoryId", values.categoryId);
  formData.set("price", `${values.price ?? 0}`);
  formData.set("comparePrice", values.comparePrice === undefined ? "" : `${values.comparePrice}`);

  values.products.forEach((product) => {
    formData.append("dealProductId", product.productId);
    formData.append("dealVariantId", product.variantId ?? "");
    formData.append("dealQuantity", `${product.quantity}`);
  });

  values.images.forEach((image) => {
    formData.append("imageUrl", image.url);
    formData.append("imageAlt", image.alt ?? "");
  });

  values.specifications.forEach((specification) => {
    formData.append("specKey", specification.key);
    formData.append("specValue", specification.value);
  });

  values.relatedDealIds.forEach((relatedDealId) => {
    formData.append("relatedDealIds", relatedDealId);
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

export function AdminDealForm({ mode, action, returnTo, submitLabel, categories, deal }: AdminDealFormProps) {
  const form = useAppForm<AdminDealFormValues>({
    schema: adminDealMutationSchema,
    defaultValues: buildDefaultValues(categories, deal),
  });
  const { isPending, submitWithAction } = useServerActionSubmit(form);

  const products = useFieldArray({
    control: form.control,
    name: "products",
  });
  const images = useFieldArray({
    control: form.control,
    name: "images",
  });
  const specifications = useFieldArray({
    control: form.control,
    name: "specifications",
  });

  const watchedValues = useWatch({ control: form.control });
  const categoryId = watchedValues.categoryId ?? "";
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const watchedProducts = watchedValues.products ?? [];
  const storefrontHref = watchedValues.slug ? routes.storefront.deal(watchedValues.slug) : null;
  const previewPrice = formatPrice(watchedValues.price ?? 0);
  const includedItemCount = watchedProducts.reduce((total, product) => total + (product.quantity ?? 0), 0);

  return (
    <form
      className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]"
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        form.clearErrors("products");
        const submitTarget = mode === "edit" && deal?.id ? { returnTo, dealId: deal.id } : { returnTo };
        await submitWithAction(action, buildDealFormData(values, submitTarget));
      })}
    >
      <div className="space-y-6">
        <FormErrorSummary errors={form.formState.errors} title="Please review the deal details" />

        <Card>
          <CardHeader>
            <CardTitle>Basic details</CardTitle>
            <CardDescription>Use plain language so the storefront stays easy to scan for shoppers.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <DynamicFormField
                control={form.control}
                disabled={isPending}
                fieldConfig={{
                  id: "deal-title",
                  name: "title",
                  type: "text",
                  label: "Title",
                  required: true,
                }}
              />
            </div>

            <DynamicFormField
              control={form.control}
              disabled={isPending}
              fieldConfig={{
                id: "deal-status",
                name: "status",
                type: "select",
                label: "Status",
                required: true,
                options: statusOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                })),
              }}
            />

            <DynamicFormField
              control={form.control}
              disabled={isPending}
              fieldConfig={{
                id: "deal-slug",
                name: "slug",
                type: "text",
                label: "URL slug",
                placeholder: "party-bundle-deal",
                required: true,
              }}
            />

            <div className="md:col-span-2">
              <DynamicFormField
                control={form.control}
                disabled={isPending}
                fieldConfig={{
                  id: "deal-short-description",
                  name: "shortDescription",
                  type: "textarea",
                  label: "Short description",
                  placeholder: "Shown on deal cards and quick previews.",
                  rows: 3,
                }}
              />
            </div>

            <div className="md:col-span-2">
              <DynamicFormField
                control={form.control}
                disabled={isPending}
                fieldConfig={{
                  id: "deal-description",
                  name: "description",
                  type: "textarea",
                  label: "Full description",
                  placeholder: "Explain what makes this bundle special for shoppers.",
                  rows: 5,
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category and pricing</CardTitle>
            <CardDescription>
              A deal belongs to one category (same as products) and carries its own deal-level price and
              compare-at price.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <DynamicFormField
              control={form.control}
              disabled={isPending}
              fieldConfig={{
                id: "deal-category",
                name: "categoryId",
                type: "select",
                label: "Category",
                required: true,
                options: categories.map((category) => ({
                  value: category.id,
                  label: `${category.name}${category.status !== "PUBLISHED" ? ` (${category.status.toLowerCase()})` : ""}`,
                })),
              }}
            />

            <div aria-hidden className="hidden md:block" />

            <DynamicFormField
              control={form.control}
              disabled={isPending}
              fieldConfig={{
                id: "deal-price",
                name: "price",
                type: "number",
                label: "Price (Rs.)",
                min: 0,
                step: 1,
                required: true,
              }}
            />

            <DynamicFormField
              control={form.control}
              disabled={isPending}
              fieldConfig={{
                id: "deal-compare-price",
                name: "comparePrice",
                type: "number",
                label: "Compare price (Rs.)",
                min: 0,
                step: 1,
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Layers3 className="size-4" />
                  Included products
                </CardTitle>
                <CardDescription>
                  Add every product that comes with this deal. Each row sets a product (optionally one
                  variant) and how many units are included. Quantity cannot exceed that product&rsquo;s
                  available stock.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                className="text-nowrap"
                onClick={() => products.append({ productId: "", variantId: undefined, quantity: 1 })}
              >
                <Plus className="size-4" />
                Add product
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {products.fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No products yet. Add at least one product to build the deal bundle.
              </p>
            ) : (
              products.fields.map((field, index) => (
                <div key={field.id} className="space-y-3 rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Product {index + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isPending}
                      onClick={() => products.remove(index)}
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Remove product</span>
                    </Button>
                  </div>

                  <Controller
                    control={form.control}
                    name={fieldPath(`products.${index}.productId`)}
                    render={({ field: productField, fieldState: productState }) => (
                      <Controller
                        control={form.control}
                        name={fieldPath(`products.${index}.variantId`)}
                        render={({ field: variantField, fieldState: variantState }) => (
                          <DealProductRowPicker
                            categoryId={categoryId}
                            productId={typeof productField.value === "string" ? productField.value : ""}
                            variantId={typeof variantField.value === "string" ? variantField.value : null}
                            onProductChange={(nextProductId) => {
                              productField.onChange(nextProductId);
                              variantField.onChange(undefined);
                            }}
                            onVariantChange={(nextVariantId) => variantField.onChange(nextVariantId ?? undefined)}
                            disabled={isPending}
                            {...(productState.error ? { productError: "Please choose a product." } : {})}
                            {...(variantState.error ? { variantError: "Please choose a valid variant." } : {})}
                          />
                        )}
                      />
                    )}
                  />

                  <DynamicFormField
                    control={form.control}
                    disabled={isPending}
                    fieldConfig={{
                      id: `deal-quantity-${index}`,
                      name: fieldPath(`products.${index}.quantity`),
                      type: "number",
                      label: "Quantity (Pcs)",
                      min: 1,
                      required: true,
                    }}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Images className="size-4" />
              Images and specifications
            </CardTitle>
            <CardDescription>These details help shoppers understand the deal quickly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Images</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => images.append({ url: "", alt: undefined })}
                >
                  <Plus className="size-4" />
                  Add image
                </Button>
              </div>

              {images.fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">No images added yet.</p>
              ) : (
                images.fields.map((image, index) => (
                  <div key={image.id} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                    <DynamicFormField
                      control={form.control}
                      disabled={isPending}
                      fieldConfig={{
                        name: fieldPath(`images.${index}.url`),
                        type: "custom",
                        label: index === 0 ? "Image URL" : undefined,
                        placeholder: "https://example.com/deal-image.jpg",
                        render: ({ field, fieldState, inputId, describedBy, disabled }) => (
                          <AdminImageUploadInput
                            inputId={inputId}
                            value={typeof field.value === "string" ? field.value : ""}
                            onChange={(nextValue) => {
                              field.onChange(nextValue);
                            }}
                            onBlur={field.onBlur}
                            purpose="content"
                            placeholder="https://example.com/deal-image.jpg"
                            describedBy={describedBy}
                            disabled={disabled}
                            invalid={Boolean(fieldState.error)}
                          />
                        ),
                      }}
                    />
                    <DynamicFormField
                      control={form.control}
                      disabled={isPending}
                      fieldConfig={{
                        name: fieldPath(`images.${index}.alt`),
                        type: "text",
                        label: index === 0 ? "Alt text" : undefined,
                        placeholder: "Plain-language image description",
                      }}
                    />
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={isPending}
                        onClick={() => images.remove(index)}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">Remove image</span>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Specifications</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => specifications.append({ key: "", value: "" })}
                >
                  <Plus className="size-4" />
                  Add specification
                </Button>
              </div>

              {specifications.fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">No specifications added yet.</p>
              ) : (
                specifications.fields.map((specification, index) => (
                  <div key={specification.id} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                    <DynamicFormField
                      control={form.control}
                      disabled={isPending}
                      fieldConfig={{
                        name: fieldPath(`specifications.${index}.key`),
                        type: "text",
                        label: index === 0 ? "Label" : undefined,
                        placeholder: "Included items",
                      }}
                    />
                    <DynamicFormField
                      control={form.control}
                      disabled={isPending}
                      fieldConfig={{
                        name: fieldPath(`specifications.${index}.value`),
                        type: "text",
                        label: index === 0 ? "Value" : undefined,
                        placeholder: "3-piece party bundle",
                      }}
                    />
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={isPending}
                        onClick={() => specifications.remove(index)}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">Remove specification</span>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SearchCheck className="size-4" />
              Related deals
            </CardTitle>
            <CardDescription>Select helpful cross-sell deals when available.</CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              control={form.control}
              name="relatedDealIds"
              render={({ field, fieldState }) => (
                <RelatedDealPicker
                  selectedIds={field.value ?? []}
                  onChangeIds={field.onChange}
                  categoryId={categoryId}
                  {...(deal?.id ? { excludeDealId: deal.id } : {})}
                  disabled={isPending}
                  {...(fieldState.error?.message ? { errorMessage: fieldState.error.message } : {})}
                />
              )}
            />
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : submitLabel}
          </Button>
          <Link href={routes.admin.deals} className={buttonVariants({ variant: "ghost" })}>
            Back to deals
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
            <CardDescription>This card mirrors the key details shoppers and search engines care about most.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant={watchedValues.status === "PUBLISHED" ? "info" : watchedValues.status === "ARCHIVED" ? "warning" : "secondary"}>
                {watchedValues.status}
              </Badge>
              <Badge variant="outline">
                {watchedProducts.length} product{watchedProducts.length === 1 ? "" : "s"} included
              </Badge>
            </div>

            <div>
              <p className="text-lg font-semibold">{watchedValues.title || "Deal title preview"}</p>
              <p className="text-muted-foreground mt-1">
                {watchedValues.shortDescription || "A short summary will appear here after you save the deal."}
              </p>
            </div>

            <div className="rounded-xl border p-3">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Expected storefront URL</p>
              <p className="mt-1 break-all">{storefrontHref ?? "Save a slug to generate the preview link."}</p>
              {storefrontHref ? (
                <Link href={storefrontHref} className="text-primary mt-2 inline-flex text-sm font-medium hover:underline">
                  Open storefront preview
                </Link>
              ) : null}
            </div>

            <div className="rounded-xl border p-3">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Pricing snapshot</p>
              <p className="mt-1 text-base font-semibold">{previewPrice}</p>
              <p className="text-muted-foreground mt-1">
                {includedItemCount > 0 ? `${includedItemCount} total Pcs across ${watchedProducts.length} product${watchedProducts.length === 1 ? "" : "s"}` : "No products added yet"}
              </p>
            </div>
          </CardContent>
        </Card>

        <AdminSeoSection
          form={form}
          disabled={isPending}
          entityLabel="Deal"
          titleField="title"
          slugField="slug"
          descriptionField="shortDescription"
          previewBasePath="/deals"
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

        <AdminDealSeoGenerator
          form={form}
          disabled={isPending}
          categoryName={selectedCategory?.name}
        />
      </div>
    </form>
  );
}
