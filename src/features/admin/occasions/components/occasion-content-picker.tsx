"use client";

import { useEffect, useMemo, useState } from "react";
import { Gift, Loader2, PackagePlus, Plus, Search, Tag, Trash2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray, useWatch } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { Input } from "@/components/ui/input";

import type {
  AdminOccasionCategoryOption,
  AdminOccasionDealOption,
  AdminOccasionFormDeal,
  AdminOccasionFormProduct,
  AdminOccasionFormRecord,
  AdminOccasionProductOption,
  AdminOccasionSearchResult,
} from "../service";
import type { AdminOccasionCreateInput } from "../validation";

export type AdminOccasionFormValues = AdminOccasionCreateInput & { id?: string };

type OccasionContentPickerProps = {
  form: UseFormReturn<AdminOccasionFormValues>;
  categories: AdminOccasionCategoryOption[];
  disabled?: boolean;
  /** Passed in edit mode so the selected items keep their display metadata. */
  occasion: AdminOccasionFormRecord | null | undefined;
};

type DealsResponse = { deals: AdminOccasionDealOption[] };

const QUICK_SEARCH_DEBOUNCE_MS = 300;
const DEAL_SEARCH_DEBOUNCE_MS = 300;
const QUICK_SEARCH_MIN_LENGTH = 2;

function selectClassName() {
  return "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
}

/**
 * Curated content picker for an occasion — products (added by choosing a
 * category, then a product within it) and deals (added via search), plus a
 * single quick-search field that finds deals, categories, and products at once.
 */
export function OccasionContentPicker({
  form,
  categories,
  disabled = false,
  occasion,
}: OccasionContentPickerProps) {
  const productsArray = useFieldArray({
    control: form.control,
    name: "products",
  });
  const watchedDealIds = useWatch({
    control: form.control,
    name: "dealIds",
    defaultValue: [] as string[],
  });

  // Display metadata for the currently selected products/deals (names, slugs,
  // categories). Kept in local state because the form only stores ids; the
  // edit form seeds it from the persisted occasion.
  const [productMeta, setProductMeta] = useState<Record<string, AdminOccasionFormProduct>>(() => {
    const initial: Record<string, AdminOccasionFormProduct> = {};
    for (const product of occasion?.products ?? []) {
      initial[product.productId] = product;
    }
    return initial;
  });
  const [dealMeta, setDealMeta] = useState<Record<string, AdminOccasionFormDeal>>(() => {
    const initial: Record<string, AdminOccasionFormDeal> = {};
    for (const deal of occasion?.deals ?? []) {
      initial[deal.dealId] = deal;
    }
    return initial;
  });

  // --- Add-a-product-by-category state -------------------------------
  const [categoryId, setCategoryId] = useState("");
  const [availableProducts, setAvailableProducts] = useState<AdminOccasionProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");

  useEffect(() => {
    if (!categoryId.trim()) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setProductsLoading(true);
      }
    });

    fetch(`/api/admin/occasions/products?categoryId=${encodeURIComponent(categoryId)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        return response.json() as Promise<{ ok: boolean; products: AdminOccasionProductOption[] }>;
      })
      .then((data) => {
        if (!cancelled) {
          setAvailableProducts(Array.isArray(data.products) ? data.products : []);
          setSelectedProductId("");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableProducts([]);
          setSelectedProductId("");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProductsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  // --- Quick search (deals + categories + products) ------------------
  const [quickQuery, setQuickQuery] = useState("");
  const [quickResults, setQuickResults] = useState<AdminOccasionSearchResult | null>(null);
  const [quickLoading, setQuickLoading] = useState(false);

  useEffect(() => {
    const normalizedQuery = quickQuery.trim();

    if (normalizedQuery.length < QUICK_SEARCH_MIN_LENGTH) {
      return;
    }

    let cancelled = false;

    const runFetch = () => {
      queueMicrotask(() => {
        if (!cancelled) {
          setQuickLoading(true);
        }
      });

      fetch(`/api/admin/occasions/search?q=${encodeURIComponent(normalizedQuery)}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
          }
          return response.json() as Promise<{ ok: boolean } & AdminOccasionSearchResult>;
        })
        .then((data) => {
          if (!cancelled) {
            setQuickResults({
              categories: data.categories ?? [],
              products: data.products ?? [],
              deals: data.deals ?? [],
            });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setQuickResults({ categories: [], products: [], deals: [] });
          }
        })
        .finally(() => {
          if (!cancelled) {
            setQuickLoading(false);
          }
        });
    };

    const timer = setTimeout(runFetch, QUICK_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [quickQuery]);

  // --- Deals search (add deals) --------------------------------------
  const [dealQuery, setDealQuery] = useState("");
  const [dealResults, setDealResults] = useState<AdminOccasionDealOption[]>([]);
  const [dealLoading, setDealLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const runFetch = () => {
      queueMicrotask(() => {
        if (!cancelled) {
          setDealLoading(true);
        }
      });

      const params = new URLSearchParams();
      const normalizedQuery = dealQuery.trim();
      if (normalizedQuery) {
        params.set("q", normalizedQuery);
      }
      params.set("take", "12");
      watchedDealIds.forEach((id) => params.append("selectedIds", id));

      fetch(`/api/admin/occasions/deals?${params.toString()}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
          }
          return response.json() as Promise<{ ok: boolean } & DealsResponse>;
        })
        .then((data) => {
          if (!cancelled) {
            setDealResults(Array.isArray(data.deals) ? data.deals : []);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setDealResults([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setDealLoading(false);
          }
        });
    };

    const timer = dealQuery.trim() ? setTimeout(runFetch, DEAL_SEARCH_DEBOUNCE_MS) : undefined;
    if (!timer) {
      runFetch();
    }

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [dealQuery, watchedDealIds]);

  const selectedProductIds = useMemo(
    () => new Set((productsArray.fields ?? []).map((field) => (field as { productId: string }).productId)),
    [productsArray.fields],
  );
  const selectedDealIds = useMemo(() => new Set(watchedDealIds), [watchedDealIds]);

  function addProduct(product: AdminOccasionProductOption, sourceCategoryId?: string) {
    const effectiveCategoryId = sourceCategoryId ?? product.categoryId ?? "";
    const alreadySelected = (productsArray.fields ?? []).some(
      (field) => (field as { productId: string }).productId === product.id,
    );

    if (alreadySelected) {
      return;
    }

    const category = categories.find((candidate) => candidate.id === effectiveCategoryId);
    setProductMeta((previous) => ({
      ...previous,
      [product.id]: {
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        categoryId: effectiveCategoryId || null,
        categoryName: product.categoryName ?? category?.name ?? null,
      },
    }));
    productsArray.append({ productId: product.id, categoryId: effectiveCategoryId });
  }

  function removeProduct(productId: string) {
    const index = (productsArray.fields ?? []).findIndex(
      (field) => (field as { productId: string }).productId === productId,
    );
    if (index >= 0) {
      productsArray.remove(index);
    }
    setProductMeta((previous) => {
      const next = { ...previous };
      delete next[productId];
      return next;
    });
  }

  function addDeal(deal: AdminOccasionDealOption) {
    if (selectedDealIds.has(deal.id)) {
      return;
    }

    setDealMeta((previous) => ({
      ...previous,
      [deal.id]: {
        dealId: deal.id,
        dealTitle: deal.title,
        dealSlug: deal.slug,
      },
    }));
    form.setValue("dealIds", [...watchedDealIds, deal.id], { shouldDirty: true });
  }

  function removeDeal(dealId: string) {
    form.setValue(
      "dealIds",
      watchedDealIds.filter((id) => id !== dealId),
      { shouldDirty: true },
    );
    setDealMeta((previous) => {
      const next = { ...previous };
      delete next[dealId];
      return next;
    });
  }

  const selectedProductRows = (productsArray.fields ?? []).flatMap((field) => {
    const productId = (field as { productId: string }).productId;
    return productId && productMeta[productId] ? [productMeta[productId]] : [];
  });
  const selectedDealRows = watchedDealIds.flatMap((dealId) =>
    dealMeta[dealId] ? [dealMeta[dealId]] : [],
  );

  const quickQueryLength = quickQuery.trim().length;
  const hasValidQuickQuery = quickQueryLength >= QUICK_SEARCH_MIN_LENGTH;
  const quickEmpty =
    hasValidQuickQuery &&
    !quickLoading &&
    Boolean(quickResults) &&
    quickResults?.categories.length === 0 &&
    quickResults?.products.length === 0 &&
    quickResults?.deals.length === 0;

  const addProductByCategory = () => {
    const product = availableProducts.find((candidate) => candidate.id === selectedProductId);
    if (product) {
      addProduct(product, categoryId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick search across deals, categories and products */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">Quick search the catalog</p>
        </div>
        <Input
          type="search"
          aria-label="Search deals, categories and products"
          placeholder="Search deals, categories and products… (min 2 characters)"
          value={quickQuery}
          disabled={disabled}
          onChange={(event) => setQuickQuery(event.target.value)}
        />

        {hasValidQuickQuery && quickLoading ? <InlineSpinner label="Searching the catalog..." /> : null}

        {hasValidQuickQuery && !quickLoading && quickResults ? (
          <div className="space-y-4">
            {quickResults.products.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Products</p>
                <ul className="space-y-1.5">
                  {quickResults.products.map((product) => {
                    const added = selectedProductIds.has(product.id);
                    return (
                      <li key={product.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{product.name}</span>
                          <span className="text-muted-foreground block text-xs">
                            /{product.slug}
                            {product.categoryName ? ` • ${product.categoryName}` : ""}
                          </span>
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={disabled || added}
                          onClick={() => addProduct(product)}
                        >
                          {added ? "Added" : "Add"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {quickResults.deals.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Deals</p>
                <ul className="space-y-1.5">
                  {quickResults.deals.map((deal) => {
                    const added = selectedDealIds.has(deal.id);
                    return (
                      <li key={deal.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{deal.title}</span>
                          <span className="text-muted-foreground block text-xs">/deals/{deal.slug}</span>
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={disabled || added}
                          onClick={() => addDeal(deal)}
                        >
                          {added ? "Added" : "Add"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {quickResults.categories.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Categories</p>
                <ul className="space-y-1.5">
                  {quickResults.categories.map((category) => {
                    const isActive = category.id === categoryId;
                    return (
                      <li key={category.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{category.name}</span>
                          <span className="text-muted-foreground block text-xs">/categories/{category.slug}</span>
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={disabled}
                          onClick={() => {
                            setCategoryId(category.id);
                            setQuickQuery("");
                          }}
                        >
                          {isActive ? "Browsing" : "Browse"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {quickEmpty ? (
              <p className="text-sm text-muted-foreground">No matching products, deals, or categories.</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Add products by category */}
        <section className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center gap-2">
            <PackagePlus className="size-4 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">Add products by category</p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="occasion-category">
                Category
              </label>
              <select
                id="occasion-category"
                value={categoryId}
                disabled={disabled}
                onChange={(event) => setCategoryId(event.target.value)}
                className={selectClassName()}
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.status !== "PUBLISHED" ? ` (${category.status.toLowerCase()})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="occasion-product">
                Product
              </label>
              {!categoryId ? (
                <p className="text-muted-foreground text-sm">Select a category first to choose products.</p>
              ) : productsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading products…
                </div>
              ) : availableProducts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No products found in this category.</p>
              ) : (
                <select
                  id="occasion-product"
                  value={selectedProductId}
                  disabled={disabled}
                  onChange={(event) => setSelectedProductId(event.target.value)}
                  className={selectClassName()}
                >
                  <option value="">Select a product</option>
                  {availableProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full"
              disabled={disabled || !selectedProductId}
              onClick={addProductByCategory}
            >
              <Plus className="size-4" />
              Add product
            </Button>
          </div>
        </section>

        {/* Add deals by search */}
        <section className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center gap-2">
            <Tag className="size-4 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">Add deals</p>
          </div>
          <Input
            type="search"
            aria-label="Search deals"
            placeholder="Search deals by title or slug…"
            value={dealQuery}
            disabled={disabled}
            onChange={(event) => setDealQuery(event.target.value)}
          />
          {dealLoading ? <InlineSpinner label="Loading deals..." /> : null}
          {!dealLoading && dealResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deals found.</p>
          ) : null}
          <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {dealResults.map((deal) => {
              const added = selectedDealIds.has(deal.id);
              return (
                <li key={deal.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{deal.title}</span>
                    <span className="text-muted-foreground block text-xs">
                      /deals/{deal.slug}
                      {deal.categoryName ? ` • ${deal.categoryName}` : ""}
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled || added}
                    onClick={() => addDeal(deal)}
                  >
                    {added ? "Added" : "Add"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Selected items summary */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <PackagePlus className="size-4 text-muted-foreground" aria-hidden="true" />
              Selected products
              <Badge variant="secondary">{selectedProductRows.length}</Badge>
            </p>
          </div>
          {selectedProductRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No products selected yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {selectedProductRows.map((product) => (
                <li key={product.productId} className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{product.productName}</span>
                    <span className="text-muted-foreground block text-xs">
                      {product.categoryName ? `Category: ${product.categoryName}` : "Category: —"}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    onClick={() => removeProduct(product.productId)}
                    aria-label={`Remove ${product.productName}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Gift className="size-4 text-muted-foreground" aria-hidden="true" />
              Selected deals
              <Badge variant="secondary">{selectedDealRows.length}</Badge>
            </p>
          </div>
          {selectedDealRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deals selected yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {selectedDealRows.map((deal) => (
                <li key={deal.dealId} className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{deal.dealTitle}</span>
                    <span className="text-muted-foreground block text-xs">/deals/{deal.dealSlug}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    onClick={() => removeDeal(deal.dealId)}
                    aria-label={`Remove ${deal.dealTitle}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
