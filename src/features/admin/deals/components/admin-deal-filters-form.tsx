"use client";

import { useRouter } from "next/navigation";
import { z } from "zod";

import { DynamicFormField, useAppForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";

const dealFilterSchema = z.object({
  q: z.string().trim().max(120).optional().default(""),
  status: z.enum(["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"]).default("ALL"),
});

type AdminDealFiltersFormProps = {
  query: string;
  status: "ALL" | "DRAFT" | "PUBLISHED" | "ARCHIVED";
};

type DealFilterValues = z.infer<typeof dealFilterSchema>;

function buildDealFilterHref(values: DealFilterValues) {
  const params = new URLSearchParams();

  if (values.q.trim().length > 0) {
    params.set("q", values.q.trim());
  }

  if (values.status !== "ALL") {
    params.set("status", values.status);
  }

  const queryString = params.toString();
  return queryString ? `${routes.admin.deals}?${queryString}` : routes.admin.deals;
}

export function AdminDealFiltersForm({ query, status }: AdminDealFiltersFormProps) {
  const router = useRouter();
  const form = useAppForm<DealFilterValues>({
    schema: dealFilterSchema,
    defaultValues: {
      q: query,
      status,
    },
  });

  return (
    <form
      className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end"
      noValidate
      onSubmit={form.handleSubmit((values) => {
        router.push(buildDealFilterHref(values));
      })}
    >
      <DynamicFormField
        control={form.control}
        fieldConfig={{
          id: "deals-search",
          name: "q",
          type: "text",
          label: "Search",
          placeholder: "Deal title, slug, or product name",
        }}
      />

      <DynamicFormField
        control={form.control}
        fieldConfig={{
          id: "deals-status",
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

      <Button type="submit" size="sm">
        Apply filters
      </Button>
    </form>
  );
}
