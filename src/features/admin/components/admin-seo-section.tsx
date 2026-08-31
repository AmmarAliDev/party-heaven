"use client";

import { Globe2, SearchCheck, Sparkles } from "lucide-react";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import { DynamicFormField } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminImageUploadInput } from "@/features/admin/uploads";

import { buildAdminSeoPreview, createSlugCandidate, SEO_CHARACTER_LIMITS } from "../seo/schema";

type AdminSeoSectionProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  disabled?: boolean;
  entityLabel: string;
  titleField: FieldPath<TFieldValues>;
  slugField: FieldPath<TFieldValues>;
  descriptionField?: FieldPath<TFieldValues>;
  previewBasePath?: string;
  seoTitleField: FieldPath<TFieldValues>;
  seoDescriptionField: FieldPath<TFieldValues>;
  seoCanonicalUrlField?: FieldPath<TFieldValues>;
  seoOgTitleField?: FieldPath<TFieldValues>;
  seoOgDescriptionField?: FieldPath<TFieldValues>;
  seoKeywordsField?: FieldPath<TFieldValues>;
  seoImageUrlField?: FieldPath<TFieldValues>;
  seoNoIndexField?: FieldPath<TFieldValues>;
  seoSchemaNotesField?: FieldPath<TFieldValues>;
};

function readNestedValue(source: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, source);
}

function getTextValue(source: unknown, path?: string) {
  if (!path) {
    return "";
  }

  const value = readNestedValue(source, path);
  return typeof value === "string" ? value : "";
}

function getBooleanValue(source: unknown, path?: string) {
  if (!path) {
    return false;
  }

  return readNestedValue(source, path) === true;
}

export function AdminSeoSection<TFieldValues extends FieldValues>({
  form,
  disabled = false,
  entityLabel,
  titleField,
  slugField,
  descriptionField,
  previewBasePath,
  seoTitleField,
  seoDescriptionField,
  seoCanonicalUrlField,
  seoOgTitleField,
  seoOgDescriptionField,
  seoKeywordsField,
  seoImageUrlField,
  seoNoIndexField,
  seoSchemaNotesField,
}: AdminSeoSectionProps<TFieldValues>) {
  const watchedValues = useWatch({ control: form.control });

  const title = getTextValue(watchedValues, titleField);
  const slug = getTextValue(watchedValues, slugField);
  const description = getTextValue(watchedValues, descriptionField);
  const seoTitle = getTextValue(watchedValues, seoTitleField);
  const seoDescription = getTextValue(watchedValues, seoDescriptionField);
  const canonicalUrl = getTextValue(watchedValues, seoCanonicalUrlField);
  const ogTitle = getTextValue(watchedValues, seoOgTitleField);
  const ogDescription = getTextValue(watchedValues, seoOgDescriptionField);
  const ogImageUrl = getTextValue(watchedValues, seoImageUrlField);
  const seoNoIndex = getBooleanValue(watchedValues, seoNoIndexField);
  const suggestedSlug = createSlugCandidate(title);
  const preview = buildAdminSeoPreview({
    title,
    slug,
    description,
    seoTitle,
    seoDescription,
    canonicalUrl,
    seoNoIndex,
    basePath: previewBasePath,
  });

  const titleVariant = preview.title.length > SEO_CHARACTER_LIMITS.title ? "warning" : "secondary";
  const descriptionVariant = preview.description.length > SEO_CHARACTER_LIMITS.description ? "warning" : "secondary";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4" />
          SEO settings
        </CardTitle>
        <CardDescription>
          Keep this {entityLabel.toLowerCase()} easy for non-technical teammates to manage. Use plain language, stable URLs, and short summaries.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <DynamicFormField
            control={form.control}
            disabled={disabled}
            fieldConfig={{
              id: `${entityLabel.toLowerCase().replace(/\s+/g, "-")}-slug`,
              name: slugField,
              type: "text",
              label: "Page address (slug)",
              placeholder: "daily-face-wash",
              description: "Use lowercase words with hyphens only. Keep this stable after publishing.",
              required: true,
            }}
          />

          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Suggested slug</p>
            <p className="text-muted-foreground mt-1 break-all">{suggestedSlug || "Add a title first to generate a friendly suggestion."}</p>
            {suggestedSlug && suggestedSlug !== slug ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                className="mt-3"
                onClick={() => {
                  form.setValue(slugField, suggestedSlug as never, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                }}
              >
                Use suggested slug
              </Button>
            ) : null}
          </div>

          <DynamicFormField
            control={form.control}
            disabled={disabled}
            fieldConfig={{
              id: `${entityLabel.toLowerCase().replace(/\s+/g, "-")}-seo-title`,
              name: seoTitleField,
              type: "text",
              label: "Meta title",
              placeholder: "Daily Face Wash | Party Heaven",
              description: "Aim for 50–70 characters so the result stays readable in search.",
            }}
          />

          {seoCanonicalUrlField ? (
            <DynamicFormField
              control={form.control}
              disabled={disabled}
              fieldConfig={{
                id: `${entityLabel.toLowerCase().replace(/\s+/g, "-")}-seo-canonical`,
                name: seoCanonicalUrlField,
                type: "text",
                label: "Canonical URL override",
                placeholder: "/categories/personal-care/daily-face-wash",
                description: "Optional. Use only when search engines should treat another URL as the primary version.",
              }}
            />
          ) : null}

          <div className="md:col-span-2">
            <DynamicFormField
              control={form.control}
              disabled={disabled}
              fieldConfig={{
                id: `${entityLabel.toLowerCase().replace(/\s+/g, "-")}-seo-description`,
                name: seoDescriptionField,
                type: "textarea",
                label: "Meta description",
                placeholder: "Explain what makes this page useful in one short, natural summary.",
                rows: 4,
                description: "Aim for 120–160 characters. Focus on clarity, not keyword stuffing.",
              }}
            />
          </div>

          {seoOgTitleField ? (
            <div className="col-span-2">
              <DynamicFormField
                control={form.control}
                disabled={disabled}
                fieldConfig={{
                  id: `${entityLabel.toLowerCase().replace(/\s+/g, "-")}-seo-og-title`,
                  name: seoOgTitleField,
                  type: "text",
                  label: "OG title",
                  placeholder: "Social share title",
                  description: "Optional social-sharing headline. Leave blank to reuse the meta title.",
                }}
              />
            </div>
          ) : null}

          {seoKeywordsField ? (
            <div className="md:col-span-2">
              <DynamicFormField
                control={form.control}
                disabled={disabled}
                fieldConfig={{
                  id: `${entityLabel.toLowerCase().replace(/\s+/g, "-")}-seo-keywords`,
                  name: seoKeywordsField,
                  type: "textarea",
                  label: "Meta keywords",
                  placeholder: "party supplies, birthday decorations, balloons",
                  rows: 2,
                  description: `Optional. Comma-separated keywords that summarize this page. Keep under ${SEO_CHARACTER_LIMITS.keywords} characters; avoid keyword stuffing.`,
                }}
              />
            </div>
          ) : null}

          {seoImageUrlField ? (
            <div className="col-span-2">
              <DynamicFormField
                control={form.control}
                disabled={disabled}
                fieldConfig={{
                  id: `${entityLabel.toLowerCase().replace(/\s+/g, "-")}-seo-image`,
                  name: seoImageUrlField,
                  type: "custom",
                  label: "OG image",
                  placeholder: "https://example.com/seo-image.jpg",
                  description: "Optional image for social shares. A clear square or wide image works best.",
                  render: ({ field, fieldState, inputId, describedBy, disabled: fieldDisabled }) => (
                    <AdminImageUploadInput
                      inputId={inputId}
                      value={typeof field.value === "string" ? field.value : ""}
                      onChange={(nextValue) => {
                        field.onChange(nextValue);
                      }}
                      onBlur={field.onBlur}
                      purpose="seo"
                      placeholder="https://example.com/seo-image.jpg"
                      describedBy={describedBy}
                      disabled={fieldDisabled}
                      invalid={Boolean(fieldState.error)}
                    />
                  ),
                }}
              />
            </div>
          ) : null}

          {seoOgDescriptionField ? (
            <div className="md:col-span-2">
              <DynamicFormField
                control={form.control}
                disabled={disabled}
                fieldConfig={{
                  id: `${entityLabel.toLowerCase().replace(/\s+/g, "-")}-seo-og-description`,
                  name: seoOgDescriptionField,
                  type: "textarea",
                  label: "OG description",
                  placeholder: "Optional social summary shown when this page is shared.",
                  rows: 3,
                }}
              />
            </div>
          ) : null}

          {seoNoIndexField ? (
            <div className="md:col-span-2">
              <DynamicFormField
                control={form.control}
                disabled={disabled}
                fieldConfig={{
                  id: `${entityLabel.toLowerCase().replace(/\s+/g, "-")}-seo-noindex`,
                  name: seoNoIndexField,
                  type: "checkbox",
                  label: "Hide this page from search results (noindex)",
                  description: "Use this for duplicate, temporary, or internal-only pages.",
                }}
              />
            </div>
          ) : null}

          {seoSchemaNotesField ? (
            <div className="md:col-span-2">
              <DynamicFormField
                control={form.control}
                disabled={disabled}
                fieldConfig={{
                  id: `${entityLabel.toLowerCase().replace(/\s+/g, "-")}-seo-schema-notes`,
                  name: seoSchemaNotesField,
                  type: "textarea",
                  label: "Structured data notes",
                  placeholder: "Optional notes for future schema markup, FAQs, product facts, or review highlights.",
                  rows: 4,
                  description: "This helps future content ops and AI workflows prepare JSON-LD safely.",
                }}
              />
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border bg-muted/20 p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={seoNoIndex ? "warning" : "info"}>{seoNoIndex ? "Noindex enabled" : "Search visible"}</Badge>
              <Badge variant={titleVariant}>{preview.title.length}/{SEO_CHARACTER_LIMITS.title} title</Badge>
              <Badge variant={descriptionVariant}>{preview.description.length}/{SEO_CHARACTER_LIMITS.description} description</Badge>
            </div>

            <p className="mt-3 flex items-center gap-2 font-medium text-sky-700">
              <SearchCheck className="size-4" />
              Search preview
            </p>
            <p className="mt-2 text-base font-semibold text-sky-950">{preview.title}</p>
            <p className="text-emerald-700 break-all">{preview.url}</p>
            <p className="text-muted-foreground mt-1">{preview.description}</p>
            {preview.warnings.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1 pl-4 text-amber-700">
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="rounded-xl border bg-muted/20 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium text-sky-700">
              <Globe2 className="size-4" />
              Social preview notes
            </p>
            <p className="mt-2 font-medium">{ogTitle || preview.title}</p>
            <p className="text-muted-foreground mt-1">{ogDescription || preview.description}</p>
            <p className="text-muted-foreground mt-2 break-all">{ogImageUrl || "No OG image set yet. Add one when social sharing matters for this page."}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
