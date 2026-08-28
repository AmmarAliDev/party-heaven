"use client";

import { WishlistToggleButton } from "@/features/wishlist/components/wishlist-toggle-button";

import { resolveActiveOption } from "../lib/variant-selection";
import type { CatalogProductDetail } from "../types";
import { ProductAddToCart } from "./product-add-to-cart";
import { ProductInfoBlock } from "./product-info-block";
import { ProductVariantPicker } from "./product-variant-picker";

type ProductPanelProps = {
  product: CatalogProductDetail;
  /** Per-group variant selections — owned by `ProductOverview`. */
  selectedOptionIds: Record<string, string>;
  onSelect: (groupId: string, optionId: string) => void;
  initialWishlistedSkus?: readonly string[];
};

export function ProductPanel({
  product,
  selectedOptionIds,
  onSelect,
  initialWishlistedSkus = [],
}: ProductPanelProps) {
  const activeOption = resolveActiveOption(product, selectedOptionIds);

  const effectivePrice = activeOption?.price ?? product.price;
  const effectiveCompareAt = activeOption?.compareAt ?? product.compareAt;
  const effectiveSku = activeOption?.sku ?? product.sku;
  const effectiveInventory = activeOption?.inventoryQuantity ?? product.inventoryQuantity;
  const effectiveOptionId = activeOption?.id;
  const isInitiallyWishlisted = Boolean(effectiveSku && initialWishlistedSkus.includes(effectiveSku));

  return (
    <div className="space-y-6">
      <ProductInfoBlock
        product={product}
        effectivePrice={effectivePrice}
        {...(typeof effectiveCompareAt === "number" ? { effectiveCompareAt } : {})}
        effectiveSku={effectiveSku}
        effectiveInventory={effectiveInventory}
      />

      {product.variantGroups.length > 0 ? (
        <div className="border-t border-border/50 pt-5">
          <ProductVariantPicker
            variantGroups={product.variantGroups}
            selectedOptionIds={selectedOptionIds}
            onSelect={onSelect}
          />
        </div>
      ) : null}

      <div className="border-t border-border/50 pt-5">
        <ProductAddToCart
          productSlug={product.slug}
          {...(effectiveOptionId ? { optionId: effectiveOptionId } : {})}
          sku={effectiveSku}
          productName={product.name}
          isAvailable={effectiveInventory > 0}
        />
      </div>

      <WishlistToggleButton
        productSlug={product.slug}
        {...(effectiveOptionId ? { optionId: effectiveOptionId } : {})}
        sku={effectiveSku}
        productName={product.name}
        initiallyWishlisted={isInitiallyWishlisted}
      />
    </div>
  );
}
