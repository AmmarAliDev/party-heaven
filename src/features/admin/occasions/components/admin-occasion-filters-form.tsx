"use client";

import { useRouter } from "next/navigation";
import { z } from "zod";

import { DynamicFormField, useAppForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";

const occasionFilterSchema = z.object({
  q: z.string().trim().max(120).optional().default(""),
  status: z.enum(["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"]).default("ALL"),
  kind: z.enum(["ALL", "SPECIAL", "NORMAL"]).default("ALL"),
});

type AdminOccasionFiltersFormProps = {
  query: string;
  status: "ALL" | "DRAFT" | "PUBLISHED" | "ARCHIVED";
  kind: "ALL" | "SPECIAL" | "NORMAL";
};

type OccasionFilterValues = z.infer<typeof occasionFilterSchema>;

function buildOccasionFilterHref(values: OccasionFilterValues) {
  const params = new URLSearchParams();

  if (values.q.trim().length > 0) {
    params.set("q", values.q.trim());
  }

  if (values.status !== "ALL") {
    params.set("status", values.status);
  }

  if (values.kind !== "ALL") {
    params.set("kind", values.kind);
  }

  const queryString = params.toString();
  return queryString ? `${routes.admin.occasions}?${queryString}` : routes.admin.occasions;
}

export function AdminOccasionFiltersForm({ query, status, kind }: AdminOccasionFiltersFormProps) {
  const router = useRouter();
  const form = useAppForm<OccasionFilterValues>({
    schema: occasionFilterSchema,
    defaultValues: {
      q: query,
      status,
      kind,
    },
  });

  return (
    <form
      className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto] md:items-end"
      noValidate
      onSubmit={form.handleSubmit((values) => {
        router.push(buildOccasionFilterHref(values));
      })}
    >
      <DynamicFormField
        control={form.control}
        fieldConfig={{
          id: "occasions-search",
          name: "q",
          type: "text",
          label: "Search",
          placeholder: "Occasion name, slug, product, or deal",
        }}
      />

      <DynamicFormField
        control={form.control}
        fieldConfig={{
          id: "occasions-status",
          name: "status",
          type: "select",
          label: "Status",
          options: [
            { value: "ALL", label: "All statuses" },
            { value: "DRAFT", label: "Draft" },
            { value: "PUBLISHED", label: "Published" },
            { value: "ARCHIVED", label: "Archived" },
          ],
        }}
      />

      <DynamicFormField
        control={form.control}
        fieldConfig={{
          id: "occasions-kind",
          name: "kind",
          type: "select",
          label: "Type",
          options: [
            { value: "ALL", label: "All types" },
            { value: "SPECIAL", label: "Special occasions" },
            { value: "NORMAL", label: "Normal occasions" },
          ],
        }}
      />

      <Button type="submit" size="sm">
        Apply filters
      </Button>
    </form>
  );
}
