"use client";

import Link from "next/link";
import { Eye, Images, Layers3, Plus, SearchCheck, Trash2 } from "lucide-react";
import { Controller, type FieldPath, useFieldArray, useWatch } from "react-hook-form";

import { DynamicFormField, useAppForm, useServerActionSubmit } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import { Input } from "@/components/ui/input";
import { routes } from "@/config/routes";
import { AdminSeoSection } from "@/features/admin/components/admin-seo-section";
import { AdminImageUploadInput } from "@/features/admin/uploads";
import { formatPrice } from "@/lib/currency";

import type { AdminProductCategoryOption, AdminProductFormRecord } from "../service";
import { type AdminProductCreateInput, adminProductMutationSchema } from "../validation";
import { AdminProductSeoGenerator } from "./admin-product-seo-generator";
import { RelatedProductPicker } from "./related-product-picker";

type AdminProductFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => void | Promise<void>;
  returnTo: string;
  submitLabel: string;
  categories: AdminProductCategoryOption[];
  product?: AdminProductFormRecord | null;
};

type AdminProductFormValues = AdminProductCreateInput;

const statusOptions = [
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

function formatOptions(options: Record<string, string>) {
  return Object.entries(options)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
}

function parseOptionsInput(value: string) {
  return Object.fromEntries(
    value
      .split(/[\n,;]+/)
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => {
        const [rawKey, ...rawValueParts] = segment.split(/[:=]/);
        const key = rawKey?.trim() ?? "";
        const parsedValue = rawValueParts.join(":").trim();
        return [key, parsedValue] as const;
      })
      .filter(([key, parsedValue]) => key.length > 0 && parsedValue.length > 0),
  );
}

function fieldPath(path: string) {
  return path as FieldPath<AdminProductFormValues>;
}

function buildDefaultValues(categories: AdminProductCategoryOption[], product?: AdminProductFormRecord | null): AdminProductFormValues {
  if (!product) {
    return {
      title: "",
      slug: "",
      shortDescription: "",
      description: "",
      categoryId: categories[0]?.id ?? "",
      status: "DRAFT",
      sku: "",
      price: 0,
      comparePrice: undefined,
      stock: 0,
      variantsEnabled: false,
      variants: [],
      images: [],
      specifications: [],
      relatedProductIds: [],
      seoTitle: "",
      seoDescription: "",
      seoCanonicalUrl: "",
      seoOgTitle: "",
      seoOgDescription: "",
      seoImageUrl: "",
      seoNoIndex: false,
      seoSchemaNotes: "",
    };
  }

  return {
    title: product.title,
    slug: product.slug,
    shortDescription: product.shortDescription,
    description: product.description,
    categoryId: product.categoryId,
    status: product.status,
    sku: product.sku,
    price: product.price,
    comparePrice: product.comparePrice ?? undefined,
    stock: product.stock,
    variantsEnabled: product.variantsEnabled,
    variants: product.variantsEnabled
      ? product.variants.map((variant) => ({
          title: variant.title,
          sku: variant.sku,
          price: variant.price,
          comparePrice: variant.comparePrice ?? undefined,
          stock: variant.stock,
          options: variant.options,
          isDefault: variant.isDefault,
        }))
      : [],
    images: product.images.map((image) => ({
      url: image.url,
      alt: image.alt,
      ...(image.variantIndex != null ? { variantIndex: image.variantIndex } : {}),
    })),
    specifications: product.specifications.map((specification) => ({
      key: specification.key,
      value: specification.value,
    })),
    relatedProductIds: product.relatedProductIds,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    seoCanonicalUrl: product.seoCanonicalUrl,
    seoOgTitle: product.seoOgTitle,
    seoOgDescription: product.seoOgDescription,
    seoImageUrl: product.seoImageUrl,
    seoNoIndex: product.seoNoIndex,
    seoSchemaNotes: product.seoSchemaNotes,
  };
}

function buildProductFormData(values: AdminProductFormValues, input: { returnTo: string; productId?: string }) {
  const formData = new FormData();

  if (input.productId) {
    formData.set("id", input.productId);
  }

  formData.set("returnTo", input.returnTo);
  formData.set("title", values.title);
  formData.set("slug", values.slug);
  formData.set("shortDescription", values.shortDescription ?? "");
  formData.set("description", values.description ?? "");
  formData.set("categoryId", values.categoryId);
  formData.set("status", values.status);
  formData.set("sku", values.sku);
  formData.set("price", `${values.price}`);
  formData.set("comparePrice", values.comparePrice === undefined ? "" : `${values.comparePrice}`);
  formData.set("stock", `${values.stock}`);

  if (values.variantsEnabled) {
    formData.set("variantsEnabled", "on");
  }

  const defaultVariantIndex = values.variants.findIndex((variant) => variant.isDefault);
  formData.set("variantDefaultIndex", `${defaultVariantIndex >= 0 ? defaultVariantIndex : 0}`);

  values.variants.forEach((variant) => {
    formData.append("variantTitle", variant.title);
    formData.append("variantSku", variant.sku);
    formData.append("variantOptions", formatOptions(variant.options));
    formData.append("variantPrice", `${variant.price}`);
    formData.append("variantComparePrice", variant.comparePrice === undefined ? "" : `${variant.comparePrice}`);
    formData.append("variantStock", `${variant.stock}`);
  });

  values.images.forEach((image) => {
    formData.append("imageUrl", image.url);
    formData.append("imageAlt", image.alt ?? "");
    // Empty string = product-level image (shared across variants).
    formData.append("imageVariantIndex", image.variantIndex == null ? "" : `${image.variantIndex}`);
  });

  values.specifications.forEach((specification) => {
    formData.append("specKey", specification.key);
    formData.append("specValue", specification.value);
  });

  values.relatedProductIds.forEach((relatedProductId) => {
    formData.append("relatedProductIds", relatedProductId);
  });

  formData.set("seoTitle", values.seoTitle ?? "");
  formData.set("seoDescription", values.seoDescription ?? "");
  formData.set("seoCanonicalUrl", values.seoCanonicalUrl ?? "");
  formData.set("seoOgTitle", values.seoOgTitle ?? "");
  formData.set("seoOgDescription", values.seoOgDescription ?? "");
  formData.set("seoImageUrl", values.seoImageUrl ?? "");
  formData.set("seoSchemaNotes", values.seoSchemaNotes ?? "");

  if (values.seoNoIndex) {
    formData.set("seoNoIndex", "on");
  }

  return formData;
}

export function AdminProductForm({ mode, action, returnTo, submitLabel, categories, product }: AdminProductFormProps) {
  const form = useAppForm<AdminProductFormValues>({
    schema: adminProductMutationSchema,
    defaultValues: buildDefaultValues(categories, product),
  });
  const { isPending, submitWithAction } = useServerActionSubmit(form);

  const variants = useFieldArray({
    control: form.control,
    name: "variants",
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
  const selectedCategory = categories.find((category) => category.id === watchedValues.categoryId);
  const watchedVariants = watchedValues.variants ?? [];
  const configuredVariantPrices = watchedVariants
    .map((variant) => variant.price)
    .filter((price): price is number => typeof price === "number");

  const storefrontHref = selectedCategory?.slug && watchedValues.slug
    ? routes.storefront.product(selectedCategory.slug, watchedValues.slug)
    : null;
  const previewPrice = watchedValues.variantsEnabled && configuredVariantPrices.length > 0
    ? `${formatPrice(Math.min(...configuredVariantPrices))} - ${formatPrice(Math.max(...configuredVariantPrices))}`
    : formatPrice(watchedValues.price ?? 0);

  return (
    <form
      className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]"
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        const submitTarget = mode === "edit" && product?.id ? { returnTo, productId: product.id } : { returnTo };
        await submitWithAction(action, buildProductFormData(values, submitTarget));
      })}
    >
      <div className="space-y-6">
        <FormErrorSummary errors={form.formState.errors} title="Please review the product details" />

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
                  id: "product-title",
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
                id: "product-status",
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

            <div className="md:col-span-2">
              <DynamicFormField
                control={form.control}
                disabled={isPending}
                fieldConfig={{
                  id: "product-short-description",
                  name: "shortDescription",
                  type: "textarea",
                  label: "Short description",
                  placeholder: "Shown on cards and quick previews.",
                  rows: 3,
                }}
              />
            </div>

            <div className="md:col-span-2">
              <DynamicFormField
                control={form.control}
                disabled={isPending}
                fieldConfig={{
                  id: "product-description",
                  name: "description",
                  type: "textarea",
                  label: "Full description",
                  placeholder: "Explain benefits, use cases, and care instructions in customer-friendly language.",
                  rows: 6,
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing, stock, and category</CardTitle>
            <CardDescription>For simple products, fill the standard fields. For variants, keep the toggle on and complete the rows below.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <DynamicFormField
              control={form.control}
              disabled={isPending}
              fieldConfig={{
                id: "product-category",
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

            <DynamicFormField
              control={form.control}
              disabled={isPending}
              fieldConfig={{
                id: "product-sku",
                name: "sku",
                type: "text",
                label: "SKU or master code",
                required: true,
              }}
            />

            <DynamicFormField
              control={form.control}
              disabled={isPending}
              fieldConfig={{
                id: "product-price",
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
                id: "product-compare-price",
                name: "comparePrice",
                type: "number",
                label: "Compare price (Rs.)",
                min: 0,
                step: 1,
              }}
            />

            <DynamicFormField
              control={form.control}
              disabled={isPending}
              fieldConfig={{
                id: "product-stock",
                name: "stock",
                type: "number",
                label: "Stock quantity",
                min: 0,
                step: 1,
                required: true,
              }}
            />

            <div className="md:col-span-2">
              <DynamicFormField
                control={form.control}
                disabled={isPending}
                fieldConfig={{
                  id: "product-variants-enabled",
                  name: "variantsEnabled",
                  type: "checkbox",
                  label: "This product has variants",
                  description: "Turn this on for sizes, colors, bundles, or other option combinations with separate stock.",
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Layers3 className="size-4" />
                  Variant combinations
                </CardTitle>
                <CardDescription>Use one row per sellable variation. Leave this section empty for simple products.</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                className="text-nowrap"
                onClick={() => {
                  variants.append({
                    title: "",
                    sku: "",
                    price: 0,
                    comparePrice: undefined,
                    stock: 0,
                    options: {},
                    isDefault: variants.fields.length === 0,
                  });
                  form.setValue("variantsEnabled", true, { shouldDirty: true, shouldValidate: true });
                }}
              >
                <Plus className="size-4" />
                Add variant
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {variants.fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">No variant rows yet. Add one if this product needs option-specific pricing or stock.</p>
            ) : (
              variants.fields.map((variant, index) => (
                <div key={variant.id} className="grid gap-3 rounded-xl border p-4 md:grid-cols-6">
                  <div className="md:col-span-2">
                    <DynamicFormField
                      control={form.control}
                      disabled={isPending}
                      fieldConfig={{
                        id: `variant-title-${index}`,
                        name: fieldPath(`variants.${index}.title`),
                        type: "text",
                        label: "Variant title",
                        placeholder: "Small / Blue",
                      }}
                    />
                  </div>

                  <DynamicFormField
                    control={form.control}
                    disabled={isPending}
                    fieldConfig={{
                      id: `variant-sku-${index}`,
                      name: fieldPath(`variants.${index}.sku`),
                      type: "text",
                      label: "Variant SKU",
                      placeholder: "TEE-S-BLU",
                    }}
                  />

                  <DynamicFormField
                    control={form.control}
                    disabled={isPending}
                    fieldConfig={{
                      id: `variant-price-${index}`,
                      name: fieldPath(`variants.${index}.price`),
                      type: "number",
                      label: "Price",
                      min: 0,
                      step: 1,
                    }}
                  />

                  <DynamicFormField
                    control={form.control}
                    disabled={isPending}
                    fieldConfig={{
                      id: `variant-compare-price-${index}`,
                      name: fieldPath(`variants.${index}.comparePrice`),
                      type: "number",
                      label: "Compare",
                      min: 0,
                      step: 1,
                    }}
                  />

                  <DynamicFormField
                    control={form.control}
                    disabled={isPending}
                    fieldConfig={{
                      id: `variant-stock-${index}`,
                      name: fieldPath(`variants.${index}.stock`),
                      type: "number",
                      label: "Stock",
                      min: 0,
                      step: 1,
                    }}
                  />

                  <div className="md:col-span-5">
                    <DynamicFormField
                      control={form.control}
                      disabled={isPending}
                      fieldConfig={{
                        id: `variant-options-${index}`,
                        name: fieldPath(`variants.${index}.options`),
                        type: "custom",
                        label: "Options",
                        description: "Use a plain format such as Size: Small, Color: Blue.",
                        render: ({ field, fieldState, inputId, describedBy, disabled }) => (
                          <Input
                            id={inputId}
                            value={formatOptions((field.value as Record<string, string> | undefined) ?? {})}
                            onChange={(event) => field.onChange(parseOptionsInput(event.target.value))}
                            onBlur={field.onBlur}
                            aria-describedby={describedBy}
                            aria-invalid={Boolean(fieldState.error)}
                            disabled={disabled}
                            placeholder="Size: Small, Color: Blue"
                          />
                        ),
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 md:col-span-1 md:self-end">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="product-default-variant"
                        checked={Boolean(watchedVariants[index]?.isDefault)}
                        disabled={isPending}
                        onChange={() => {
                          watchedVariants.forEach((_, variantIndex) => {
                            form.setValue(fieldPath(`variants.${variantIndex}.isDefault`), variantIndex === index, {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                          });
                        }}
                      />
                      Default
                    </label>

                    <Button type="button" variant="ghost" size="icon" disabled={isPending} onClick={() => variants.remove(index)}>
                      <Trash2 className="size-4" />
                      <span className="sr-only">Remove variant</span>
                    </Button>
                  </div>
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
            <CardDescription>These details help shoppers understand the product quickly.</CardDescription>
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
                  onClick={() =>
                    images.append({
                      url: "",
                      alt: "",
                      // For variant products default new images to the first
                      // variant so admins explicitly assign per-variant media.
                      ...(watchedValues.variantsEnabled && watchedVariants.length > 0
                        ? { variantIndex: 0 }
                        : {}),
                    })
                  }
                >
                  <Plus className="size-4" />
                  Add image
                </Button>
              </div>

              {watchedValues.variantsEnabled && watchedVariants.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  For variant products, attach each image to the variant it shows, or choose
                  &ldquo;All variants&rdquo; for a shared image. Shoppers can switch variants by
                  tapping an image on the product page.
                </p>
              ) : null}

              {images.fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">No images added yet.</p>
              ) : (
                images.fields.map((image, index) => (
                  <div
                    key={image.id}
                    className="grid gap-3 md:grid-cols-[1fr_1fr_auto] lg:grid-cols-[1fr_1fr_1fr_auto]"
                  >
                    <DynamicFormField
                      control={form.control}
                      disabled={isPending}
                      fieldConfig={{
                        name: fieldPath(`images.${index}.url`),
                        type: "custom",
                        label: index === 0 ? "Image URL" : undefined,
                        placeholder: "https://example.com/product-image.jpg",
                        render: ({ field, fieldState, inputId, describedBy, disabled }) => (
                          <AdminImageUploadInput
                            inputId={inputId}
                            value={typeof field.value === "string" ? field.value : ""}
                            onChange={(nextValue) => {
                              field.onChange(nextValue);
                            }}
                            onBlur={field.onBlur}
                            purpose="product"
                            placeholder="https://example.com/product-image.jpg"
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
                    {watchedValues.variantsEnabled && watchedVariants.length > 0 ? (
                      <DynamicFormField
                        control={form.control}
                        disabled={isPending}
                        fieldConfig={{
                          name: fieldPath(`images.${index}.variantIndex`),
                          type: "custom",
                          label: index === 0 ? "Variant" : undefined,
                          render: ({ field, fieldState, inputId, describedBy, disabled }) => (
                            <select
                              id={inputId}
                              value={field.value == null ? "" : String(field.value)}
                              onChange={(event) => {
                                const raw = event.target.value;
                                field.onChange(raw === "" ? null : Number(raw));
                              }}
                              onBlur={field.onBlur}
                              aria-describedby={describedBy}
                              aria-invalid={Boolean(fieldState.error)}
                              disabled={disabled}
                              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value="">All variants (shared)</option>
                              {watchedVariants.map((variant, variantIndex) => (
                                <option key={`${image.id}-${variantIndex}`} value={variantIndex}>
                                  {variant.title?.trim() || `Variant ${variantIndex + 1}`}
                                </option>
                              ))}
                            </select>
                          ),
                        }}
                      />
                    ) : null}
                    <div className="flex items-end">
                      <Button type="button" variant="ghost" size="icon" disabled={isPending} onClick={() => images.remove(index)}>
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
                        placeholder: "Material",
                      }}
                    />
                    <DynamicFormField
                      control={form.control}
                      disabled={isPending}
                      fieldConfig={{
                        name: fieldPath(`specifications.${index}.value`),
                        type: "text",
                        label: index === 0 ? "Value" : undefined,
                        placeholder: "100% Cotton",
                      }}
                    />
                    <div className="flex items-end">
                      <Button type="button" variant="ghost" size="icon" disabled={isPending} onClick={() => specifications.remove(index)}>
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
              Related products
            </CardTitle>
            <CardDescription>Select helpful cross-sell items when available.</CardDescription>
          </CardHeader>
          <CardContent>
            <Controller
              control={form.control}
              name="relatedProductIds"
              render={({ field, fieldState }) => (
                <RelatedProductPicker
                  selectedIds={field.value ?? []}
                  onChangeIds={field.onChange}
                  categoryId={watchedValues.categoryId ?? ""}
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
          <Link href={routes.admin.products} className={buttonVariants({ variant: "ghost" })}>
            Back to products
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
              <Badge variant="outline">{watchedValues.variantsEnabled ? "Variant product" : "Simple product"}</Badge>
            </div>

            <div>
              <p className="text-lg font-semibold">{watchedValues.title || "Product title preview"}</p>
              <p className="text-muted-foreground mt-1">{watchedValues.shortDescription || "A short summary will appear here after you save the product."}</p>
            </div>

            <div className="rounded-xl border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Expected storefront URL</p>
              <p className="mt-1 break-all">{storefrontHref ?? "Save a category and slug to generate the preview link."}</p>
              {storefrontHref ? (
                <Link href={storefrontHref} className="text-primary mt-2 inline-flex text-sm font-medium hover:underline">
                  Open storefront preview
                </Link>
              ) : null}
            </div>

            <div className="rounded-xl border p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pricing snapshot</p>
              <p className="mt-1 text-base font-semibold">{previewPrice}</p>
              <p className="text-muted-foreground mt-1">
                {watchedValues.variantsEnabled ? `${watchedVariants.length} variants configured` : `${watchedValues.stock ?? 0} units available`}
              </p>
            </div>
          </CardContent>
        </Card>

        <AdminSeoSection
          form={form}
          disabled={isPending}
          entityLabel="Product"
          titleField="title"
          slugField="slug"
          descriptionField="shortDescription"
          previewBasePath={selectedCategory?.slug ? `/categories/${selectedCategory.slug}` : "/categories"}
          seoTitleField="seoTitle"
          seoDescriptionField="seoDescription"
          seoCanonicalUrlField="seoCanonicalUrl"
          seoOgTitleField="seoOgTitle"
          seoOgDescriptionField="seoOgDescription"
          seoImageUrlField="seoImageUrl"
          seoNoIndexField="seoNoIndex"
          seoSchemaNotesField="seoSchemaNotes"
        />

        <AdminProductSeoGenerator
          form={form}
          disabled={isPending}
          categoryName={selectedCategory?.name}
        />
      </div>
    </form>
  );
}
