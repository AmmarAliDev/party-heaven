"use client";

import { useEffect, useState } from "react";
import { Loader2, PackageSearch } from "lucide-react";

import type { AdminDealProductOption } from "../service";

type DealProductRowPickerProps = {
  categoryId: string;
  productId: string;
  variantId: string | null;
  onProductChange: (productId: string) => void;
  onVariantChange: (variantId: string | null) => void;
  disabled?: boolean;
  productError?: string;
  variantError?: string;
};

export function useDealProductOptions(categoryId: string) {
  const [products, setProducts] = useState<AdminDealProductOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // No category → the picker renders its "select a category first" state
    // without touching products state.
    if (!categoryId.trim()) {
      return;
    }

    let cancelled = false;

    // Mark loading on the next microtask so we never call setState
    // synchronously within the effect body (react-hooks/set-state-in-effect).
    queueMicrotask(() => {
      if (!cancelled) {
        setIsLoading(true);
      }
    });

    fetch(`/api/admin/deals/products?categoryId=${encodeURIComponent(categoryId)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        return response.json() as Promise<{ ok: boolean; products: AdminDealProductOption[] }>;
      })
      .then((data) => {
        if (!cancelled) {
          setProducts(Array.isArray(data.products) ? data.products : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  return { products, isLoading };
}

function selectClassName() {
  return "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
}

/**
 * Product + variant selection for ONE deal product row, driven by the selected
 * category. Multi-variant products show a variant select; the effective stock
 * for the picked variant is surfaced so the form can size the quantity safely.
 */
export function DealProductRowPicker({
  categoryId,
  productId,
  variantId,
  onProductChange,
  onVariantChange,
  disabled = false,
  productError,
  variantError,
}: DealProductRowPickerProps) {
  const { products, isLoading } = useDealProductOptions(categoryId);

  const selectedProduct = products.find((product) => product.id === productId);
  const showVariantSelect = Boolean(selectedProduct?.hasMultipleVariants);
  const selectedVariant = selectedProduct
    ? (selectedProduct.variants.find((variant) => variant.id === variantId) ??
      selectedProduct.variants.find((variant) => variant.isDefault) ??
      selectedProduct.variants[0])
    : null;
  const availableStock = selectedVariant?.stock ?? 0;

  if (!categoryId) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <PackageSearch className="size-4" />
        Select a category first to choose products.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading products…
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <PackageSearch className="size-4" />
        No products found in this category.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={`deal-product-${productId || "new"}`}>
          Product
        </label>
        <select
          id={`deal-product-${productId || "new"}`}
          value={productId}
          onChange={(event) => {
            const nextProductId = event.target.value;
            onProductChange(nextProductId);
            // A new product invalidates any previously selected variant.
            onVariantChange(null);
          }}
          onBlur={() => undefined}
          aria-invalid={Boolean(productError)}
          disabled={disabled}
          className={selectClassName()}
        >
          <option value="">Select a product</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
        {productError ? <p className="text-sm text-destructive">{productError}</p> : null}
      </div>

      {showVariantSelect ? (
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor={`deal-variant-${productId || "new"}`}>
            Variant
          </label>
          <select
            id={`deal-variant-${productId || "new"}`}
            value={variantId ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              onVariantChange(raw === "" ? null : raw);
            }}
            onBlur={() => undefined}
            aria-invalid={Boolean(variantError)}
            disabled={disabled}
            className={selectClassName()}
          >
            <option value="">Default variant</option>
            {selectedProduct?.variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.title?.trim() || variant.sku || variant.id.slice(0, 8)}
              </option>
            ))}
          </select>
          {variantError ? <p className="text-sm text-destructive">{variantError}</p> : null}
        </div>
      ) : (
        <div className="hidden md:block" aria-hidden="true" />
      )}

      {selectedProduct ? (
        <p className="text-muted-foreground text-xs md:col-span-2">
          Available stock: <span className="font-medium">{availableStock}</span> unit
          {availableStock === 1 ? "" : "s"}
          {selectedVariant?.title ? ` (${selectedVariant.title})` : ""}. Quantity cannot exceed this.
        </p>
      ) : null}
    </div>
  );
}
