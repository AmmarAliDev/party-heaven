"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldError } from "@/components/ui/field";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { Input } from "@/components/ui/input";

import type { AdminRelatedDealOption } from "../service";

type RelatedDealPickerProps = {
  selectedIds: string[];
  onChangeIds: (ids: string[]) => void;
  categoryId: string;
  excludeDealId?: string;
  disabled?: boolean;
  errorMessage?: string;
};

type RelatedDealsResponse = {
  deals: AdminRelatedDealOption[];
};

const DEBOUNCE_MS = 300;
const DEFAULT_TAKE = 20;

/**
 * Multi-select picker for the deal's "Related deals" cross-sell. Mirrors the
 * related-products picker: selected deals stay pinned on top, results are
 * fetched from `GET /api/admin/deals/related-search`.
 */
export function RelatedDealPicker({
  selectedIds,
  onChangeIds,
  categoryId,
  excludeDealId,
  disabled,
  errorMessage,
}: RelatedDealPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<AdminRelatedDealOption[]>([]);
  const [knownDeals, setKnownDeals] = useState<Record<string, AdminRelatedDealOption>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const normalizedQuery = searchQuery.trim();

    const runFetch = async () => {
      const params = new URLSearchParams();

      if (normalizedQuery) {
        params.set("q", normalizedQuery);
      }

      if (categoryId) {
        params.set("categoryId", categoryId);
      }

      if (excludeDealId) {
        params.set("excludeDealId", excludeDealId);
      }

      params.set("take", `${DEFAULT_TAKE}`);

      selectedIdsRef.current.forEach((id) => {
        params.append("selectedIds", id);
      });

      try {
        const response = await fetch(`/api/admin/deals/related-search?${params.toString()}`);

        if (!response.ok) {
          throw new Error("Related deals request failed.");
        }

        const data = (await response.json()) as RelatedDealsResponse;
        const deals = Array.isArray(data.deals) ? data.deals : [];

        if (!cancelled) {
          setResults(deals);
          setKnownDeals((previous) => {
            const next = { ...previous };
            deals.forEach((deal) => {
              next[deal.id] = deal;
            });
            return next;
          });
          setHasLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load related deals. Please try again.");
          setResults([]);
          setHasLoaded(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    const timer = normalizedQuery ? setTimeout(runFetch, DEBOUNCE_MS) : undefined;
    if (!timer) {
      void runFetch();
    }

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [searchQuery, categoryId, excludeDealId]);

  const selectedOptions = useMemo(
    () =>
      selectedIds
        .map((id) => knownDeals[id])
        .filter((deal): deal is AdminRelatedDealOption => Boolean(deal)),
    [selectedIds, knownDeals],
  );
  const resultOptions = useMemo(
    () => results.filter((deal) => !selectedIds.includes(deal.id)),
    [results, selectedIds],
  );

  const selectedIdsSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleDeal = (deal: AdminRelatedDealOption, checked: boolean) => {
    const nextValues = checked ? [...selectedIds, deal.id] : selectedIds.filter((selectedId) => selectedId !== deal.id);

    setKnownDeals((previous) => ({
      ...previous,
      [deal.id]: deal,
    }));
    onChangeIds(nextValues);
  };

  const isEmpty = !isLoading && hasLoaded && !error && selectedOptions.length === 0 && resultOptions.length === 0;

  return (
    <Field data-invalid={Boolean(errorMessage)}>
      <FieldContent className="gap-3">
        <Input
          type="search"
          aria-label="Search related deals"
          placeholder="Search by title or slug..."
          value={searchQuery}
          disabled={disabled}
          onChange={(event) => setSearchQuery(event.target.value)}
        />

        {isLoading ? (
          <InlineSpinner label="Loading deals..." />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}

        {selectedOptions.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {selectedOptions.map((item) => {
              const checked = selectedIdsSet.has(item.id);

              return (
                <label key={item.id} className="flex gap-3 rounded-xl border p-3 text-sm">
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(value) => {
                      toggleDeal(item, value === true);
                    }}
                  />
                  <span>
                    <span className="block font-medium">{item.title}</span>
                    <span className="text-muted-foreground block text-xs">
                      /{item.slug}
                      {item.categoryName ? ` • ${item.categoryName}` : ""}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        ) : null}

        {resultOptions.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {resultOptions.map((item) => (
              <label key={item.id} className="flex gap-3 rounded-xl border p-3 text-sm">
                <Checkbox
                  checked={false}
                  disabled={disabled}
                  onCheckedChange={(value) => {
                    toggleDeal(item, value === true);
                  }}
                />
                <span>
                  <span className="block font-medium">{item.title}</span>
                  <span className="text-muted-foreground block text-xs">
                    /{item.slug}
                    {item.categoryName ? ` • ${item.categoryName}` : ""}
                  </span>
                </span>
              </label>
            ))}
          </div>
        ) : null}

        {isEmpty ? (
          <p className="text-sm text-muted-foreground">No deals found.</p>
        ) : null}

        <FieldError
          {...(errorMessage ? { errors: [{ message: errorMessage }] } : {})}
        />
      </FieldContent>
    </Field>
  );
}
