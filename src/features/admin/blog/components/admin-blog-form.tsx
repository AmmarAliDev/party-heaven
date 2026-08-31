"use client";

import type { z } from "zod";

import { DynamicFormField, useAppForm, useServerActionSubmit } from "@/components/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import { AdminSeoSection } from "@/features/admin/components/admin-seo-section";
import { AdminImageUploadInput } from "@/features/admin/uploads";

import type { AdminBlogRecord } from "../service";
import { adminBlogMutationSchema } from "../validation";

type AdminBlogFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void> | void;
  returnTo: string;
  submitLabel: string;
  post?: AdminBlogRecord | null;
};

type AdminBlogFormValues = z.infer<typeof adminBlogMutationSchema>;

const statusOptions = [
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

function buildDefaultValues(post?: AdminBlogRecord | null): AdminBlogFormValues {
  if (!post) {
    return {
      locale: "en",
      title: "",
      slug: "",
      excerpt: "",
      contentJson: JSON.stringify([{ type: "paragraph", text: "" }], null, 2),
      coverImageUrl: "",
      coverImageAlt: "",
      coverImageWidth: undefined,
      coverImageHeight: undefined,
      status: "DRAFT",
      publishedAt: undefined,
      seoTitle: "",
      seoDescription: "",
      seoCanonicalUrl: "",
      seoOgTitle: "",
      seoOgDescription: "",
      seoImageUrl: "",
      seoKeywords: "",
      seoNoIndex: false,
      seoSchemaNotes: "",
    };
  }

  return {
    locale: post.locale,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    contentJson: JSON.stringify(post.content, null, 2),
    coverImageUrl: post.coverImageUrl ?? "",
    coverImageAlt: post.coverImageAlt ?? "",
    coverImageWidth: post.coverImageWidth ?? undefined,
    coverImageHeight: post.coverImageHeight ?? undefined,
    status: post.status,
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : undefined,
    seoTitle: post.seoTitle ?? "",
    seoDescription: post.seoDescription ?? "",
    seoCanonicalUrl: post.seoCanonicalUrl ?? "",
    seoOgTitle: post.seoOgTitle ?? "",
    seoOgDescription: post.seoOgDescription ?? "",
    seoImageUrl: post.seoImageUrl ?? "",
    seoKeywords: post.seoKeywords ?? "",
    seoNoIndex: post.seoNoIndex,
    seoSchemaNotes: post.seoSchemaNotes ?? "",
  };
}

function buildBlogFormData(values: AdminBlogFormValues, input: { returnTo: string; blogPostId?: string }) {
  const formData = new FormData();

  if (input.blogPostId) {
    formData.set("id", input.blogPostId);
  }

  formData.set("returnTo", input.returnTo);
  formData.set("locale", values.locale ?? "en");
  formData.set("title", values.title ?? "");
  formData.set("slug", values.slug ?? "");
  formData.set("excerpt", values.excerpt ?? "");
  formData.set("contentJson", values.contentJson ?? "");
  formData.set("coverImageUrl", values.coverImageUrl ?? "");
  formData.set("coverImageAlt", values.coverImageAlt ?? "");
  formData.set("coverImageWidth", values.coverImageWidth === undefined ? "" : `${values.coverImageWidth}`);
  formData.set("coverImageHeight", values.coverImageHeight === undefined ? "" : `${values.coverImageHeight}`);
  formData.set("status", values.status ?? "DRAFT");
  formData.set("publishedAt", values.publishedAt ?? "");
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

export function AdminBlogForm({ mode, action, returnTo, submitLabel, post }: AdminBlogFormProps) {
  const form = useAppForm<AdminBlogFormValues>({
    schema: adminBlogMutationSchema,
    defaultValues: buildDefaultValues(post),
  });
  const { isPending, submitWithAction } = useServerActionSubmit(form);

  return (
    <form
      className="grid gap-6"
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        const submitTarget = mode === "edit" && post?.id ? { returnTo, blogPostId: post.id } : { returnTo };
        await submitWithAction(action, buildBlogFormData(values, submitTarget));
      })}
    >
      <FormErrorSummary errors={form.formState.errors} title="Please review the blog post details" />

      <Card>
        <CardHeader>
          <CardTitle>Article details</CardTitle>
          <CardDescription>Draft the post body, publication state, and publish date in one place.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <DynamicFormField
            control={form.control}
            disabled={isPending}
            fieldConfig={{
              id: "blog-locale",
              name: "locale",
              type: "text",
              label: "Locale",
              placeholder: "en",
              required: true,
            }}
          />

          <DynamicFormField
            control={form.control}
            disabled={isPending}
            fieldConfig={{
              id: "blog-status",
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
                id: "blog-title",
                name: "title",
                type: "text",
                label: "Title",
                required: true,
              }}
            />
          </div>

          <div className="md:col-span-2">
            <DynamicFormField
              control={form.control}
              disabled={isPending}
              fieldConfig={{
                id: "blog-slug",
                name: "slug",
                type: "text",
                label: "Slug",
                required: true,
              }}
            />
          </div>

          <div className="md:col-span-2">
            <DynamicFormField
              control={form.control}
              disabled={isPending}
              fieldConfig={{
                id: "blog-excerpt",
                name: "excerpt",
                type: "textarea",
                label: "Excerpt",
                rows: 3,
                required: true,
              }}
            />
          </div>

          <div className="md:col-span-2">
            <DynamicFormField
              control={form.control}
              disabled={isPending}
              fieldConfig={{
                id: "blog-content-json",
                name: "contentJson",
                type: "textarea",
                label: "Content blocks (JSON)",
                rows: 12,
                required: true,
                description:
                  "Use an array of supported blocks: paragraph, heading, list, and quote. Future rich-text editing is planned.",
              }}
            />
          </div>

          <DynamicFormField
            control={form.control}
            disabled={isPending}
            fieldConfig={{
              id: "blog-published-at",
              name: "publishedAt",
              type: "text",
              label: "Publish date (ISO)",
              placeholder: "2026-04-26T10:30:00.000Z",
              description: "Leave blank for unscheduled published content.",
            }}
          />

          <DynamicFormField
            control={form.control}
            disabled={isPending}
            fieldConfig={{
              id: "blog-cover-image-url",
              name: "coverImageUrl",
              type: "custom",
              label: "Cover image",
              placeholder: "/blog/my-cover-image.svg",
              description: "Upload a cover image or paste an existing URL/path.",
              render: ({ field, fieldState, inputId, describedBy, disabled }) => (
                <AdminImageUploadInput
                  inputId={inputId}
                  value={typeof field.value === "string" ? field.value : ""}
                  onChange={(nextValue) => {
                    field.onChange(nextValue);
                  }}
                  onBlur={field.onBlur}
                  purpose="blog"
                  placeholder="https://example.com/blog-cover.jpg"
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
              id: "blog-cover-image-alt",
              name: "coverImageAlt",
              type: "text",
              label: "Cover image alt text",
            }}
          />

          <DynamicFormField
            control={form.control}
            disabled={isPending}
            fieldConfig={{
              id: "blog-cover-image-width",
              name: "coverImageWidth",
              type: "number",
              label: "Cover image width",
              min: 1,
              step: 1,
            }}
          />

          <DynamicFormField
            control={form.control}
            disabled={isPending}
            fieldConfig={{
              id: "blog-cover-image-height",
              name: "coverImageHeight",
              type: "number",
              label: "Cover image height",
              min: 1,
              step: 1,
            }}
          />
        </CardContent>
      </Card>

      <AdminSeoSection
        form={form}
        disabled={isPending}
        entityLabel="Blog post"
        titleField="title"
        slugField="slug"
        descriptionField="excerpt"
        previewBasePath="/blog"
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

      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isPending}
        >
          {isPending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
