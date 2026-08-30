"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { z } from "zod";

import { DynamicFormField, useAppForm } from "@/components/forms";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { routes } from "@/config/routes";

import { buildCategoryListingHref } from "../filters";
import type { CatalogCategoryListing } from "../types";
import {
  availabilityFilterOptions,
  catalogSortOptions,
  discountFilterOptions,
  ratingFilterOptions,
} from "../types";

function parseOptionalNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  const raw = `${value ?? ""}`.trim();
  if (raw.length === 0) {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : value;
}

const categoryListingFilterSchema = z
  .object({
    sort: z.string().trim().default("featured"),
    minPrice: z.preprocess(parseOptionalNumber, z.number().min(0, "Minimum price cannot be negative.").optional()),
    maxPrice: z.preprocess(parseOptionalNumber, z.number().min(0, "Maximum price cannot be negative.").optional()),
    availability: z.string().trim().default("all"),
    rating: z.string().trim().default("all"),
    discount: z.string().trim().default("all"),
    attribute: z.string().trim().max(80, "Attribute filter must stay under 80 characters.").optional().default(""),
  })
  .superRefine((values, ctx) => {
    if (
      typeof values.minPrice === "number" &&
      typeof values.maxPrice === "number" &&
      values.maxPrice < values.minPrice
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maxPrice"],
        message: "Maximum price must be greater than or equal to minimum price.",
      });
    }
  });

type CategoryListingFilterValues = z.infer<typeof categoryListingFilterSchema>;

function toCategoryListingFilterValues(filters: CatalogCategoryListing["filters"]): CategoryListingFilterValues {
  return {
    sort: filters.sort,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    availability: filters.availability,
    rating: filters.rating,
    discount: filters.discount,
    attribute: filters.attribute,
  };
}

type CategoryListingFilterFormProps = {
  form: ReturnType<typeof useAppForm<CategoryListingFilterValues>>;
  onSubmit: (values: CategoryListingFilterValues) => void;
  slug: string;
  filters: CatalogCategoryListing["filters"];
  fieldIdPrefix: string;
  /** Called when the form triggers a navigation (reset or previous page), so mobile overlays can close. */
  onNavigate?: () => void;
};

function CategoryListingFilterForm({ form, onSubmit, slug, filters, fieldIdPrefix, onNavigate }: CategoryListingFilterFormProps) {
  return (
    <form className="space-y-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <FormErrorSummary errors={form.formState.errors} title="Please review the selected filters" />

      <DynamicFormField
        control={form.control}
        fieldConfig={{
          id: `${fieldIdPrefix}-sort`,
          name: "sort",
          type: "select",
          label: "Sort by",
          options: catalogSortOptions.map((option) => ({ value: option.value, label: option.label })),
        }}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <DynamicFormField
          control={form.control}
          fieldConfig={{
            id: `${fieldIdPrefix}-minPrice`,
            name: "minPrice",
            type: "number",
            label: "Min price",
            min: 0,
            placeholder: "0",
          }}
        />

        <DynamicFormField
          control={form.control}
          fieldConfig={{
            id: `${fieldIdPrefix}-maxPrice`,
            name: "maxPrice",
            type: "number",
            label: "Max price",
            min: 0,
            placeholder: "3000",
          }}
        />
      </div>

      <DynamicFormField
        control={form.control}
        fieldConfig={{
          id: `${fieldIdPrefix}-availability`,
          name: "availability",
          type: "select",
          label: "Availability",
          options: availabilityFilterOptions.map((option) => ({ value: option.value, label: option.label })),
        }}
      />

      <DynamicFormField
        control={form.control}
        fieldConfig={{
          id: `${fieldIdPrefix}-rating`,
          name: "rating",
          type: "select",
          label: "Rating",
          options: ratingFilterOptions.map((option) => ({ value: option.value, label: option.label })),
        }}
      />

      <DynamicFormField
        control={form.control}
        fieldConfig={{
          id: `${fieldIdPrefix}-discount`,
          name: "discount",
          type: "select",
          label: "Discount",
          options: discountFilterOptions.map((option) => ({ value: option.value, label: option.label })),
        }}
      />

      <DynamicFormField
        control={form.control}
        fieldConfig={{
          id: `${fieldIdPrefix}-attribute`,
          name: "attribute",
          type: "text",
          label: "Variant-aware attributes",
          description: "",
          placeholder: "Color / size / scent placeholder",
        }}
      />

      <div className="flex flex-wrap gap-3">
        <Button type="submit">Apply filters</Button>
        <Link
          href={routes.storefront.category(slug)}
          className={buttonVariants({ variant: "outline" })}
          {...(onNavigate ? { onClick: onNavigate } : {})}
        >
          Reset
        </Link>
        {(filters.page ?? 1) > 1 ? (
          <Link
            href={buildCategoryListingHref(slug, filters, {
              page: Math.max(1, (filters.page ?? 1) - 1),
            })}
            className={buttonVariants({ variant: "ghost" })}
            {...(onNavigate ? { onClick: onNavigate } : {})}
          >
            Previous page
          </Link>
        ) : null}
      </div>
    </form>
  );
}

export function CategoryListingFilters({ listing }: { listing: CatalogCategoryListing }) {
  const { category, filters } = listing;
  const router = useRouter();
  const [isMobileSheetOpen, setMobileSheetOpen] = useState(false);
  const initialFormValues = toCategoryListingFilterValues(filters);

  const desktopForm = useAppForm<CategoryListingFilterValues>({
    schema: categoryListingFilterSchema,
    defaultValues: initialFormValues,
  });

  const mobileForm = useAppForm<CategoryListingFilterValues>({
    schema: categoryListingFilterSchema,
    defaultValues: initialFormValues,
  });
  const resetDesktopForm = desktopForm.reset;
  const resetMobileForm = mobileForm.reset;

  useEffect(() => {
    const nextValues = toCategoryListingFilterValues(filters);
    resetDesktopForm(nextValues);
    resetMobileForm(nextValues);
  }, [filters, resetDesktopForm, resetMobileForm]);

  function pushFilters(values: CategoryListingFilterValues) {
    router.push(
      buildCategoryListingHref(category.slug, {
        ...filters,
        sort: values.sort as typeof filters.sort,
        minPrice: values.minPrice,
        maxPrice: values.maxPrice,
        availability: values.availability as typeof filters.availability,
        rating: values.rating as typeof filters.rating,
        discount: values.discount as typeof filters.discount,
        attribute: values.attribute ?? "",
        page: 1,
      }),
    );
  }

  return (
    <>
      <div className="lg:hidden" data-testid="catalog-mobile-filter-trigger-wrap">
        <Sheet open={isMobileSheetOpen} onOpenChange={setMobileSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="justify-start gap-2" aria-label="Open filters and sorting panel">
              <SlidersHorizontal className="size-4" />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-full sm:max-w-md">
            <SheetHeader className="px-4 pb-0">
              <SheetTitle className="flex items-center gap-2 text-base">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                Filters and sorting
              </SheetTitle>
              {/* <SheetDescription>Narrow results by price or sort to find the best deals.</SheetDescription> */}
            </SheetHeader>

            <div className="overflow-y-auto px-4 pb-6">
              <CategoryListingFilterForm
                form={mobileForm}
                onSubmit={(values) => {
                  setMobileSheetOpen(false);
                  pushFilters(values);
                }}
                slug={category.slug}
                filters={filters}
                fieldIdPrefix="mobile-catalog-filter"
                onNavigate={() => setMobileSheetOpen(false)}
              />

              <div className="mt-4">
                <SheetClose asChild>
                  <Button type="button" variant="ghost" className="w-full">
                    Close panel
                  </Button>
                </SheetClose>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Card className="hidden border-border/70 shadow-(--shadow-soft) lg:block" data-testid="catalog-desktop-filter-panel">
        <CardHeader className="space-y-3 p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary rounded-2xl p-2" aria-hidden="true">
              <SlidersHorizontal className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base ">Filters and sorting</CardTitle>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          <CategoryListingFilterForm
            form={desktopForm}
            onSubmit={pushFilters}
            slug={category.slug}
            filters={filters}
            fieldIdPrefix="desktop-catalog-filter"
          />
        </CardContent>
      </Card>
    </>
  );
}
