"use client";

import { useCallback, useEffect, useState } from "react";

import { trackEvent } from "@/features/analytics/lib";
import { testIds } from "@/lib/test-selectors";

import {
  buildDefaultSelections,
  resolveActiveOption,
  selectVariantAcrossGroups,
} from "../lib/variant-selection";
import type { CatalogProductDetail } from "../types";
import { ProductImageGallery } from "./product-image-gallery";
import { ProductPanel } from "./product-panel";

type ProductOverviewProps = {
  product: CatalogProductDetail;
};

/**
 * Client wrapper that owns the PDP variant selection state and keeps the image
 * gallery and the variant picker in sync.
 *
 * - Selecting a variant in the picker updates the gallery to that variant's images.
 * - Tapping a variant-specific thumbnail selects the owning variant too.
 * - Simple products (no variant groups) render exactly like before: a static
 *   gallery and the standard add-to-cart panel.
 */
export function ProductOverview({ product }: ProductOverviewProps) {
  const [selectedOptionIds, setSelectedOptionIds] = useState<Record<string, string>>(
    () => buildDefaultSelections(product),
  );

  const activeVariant = resolveActiveOption(product, selectedOptionIds);
  const activeVariantId = activeVariant?.id;

  // Fire the GTM/GA4 "view_item" event once per product page view.
  useEffect(() => {
    trackEvent({
      type: 'PRODUCT_VIEW',
      payload: {
        product: {
          id: product.id,
          name: product.name,
          price: activeVariant?.price ?? product.price,
          category: product.categorySlug,
          quantity: 1,
        },
      },
    });
    // Re-fire only when the underlying product changes (SPA navigation).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const handleSelectVariant = useCallback(
    (variantId: string) => {
      setSelectedOptionIds((prev) => selectVariantAcrossGroups(product, prev, variantId));
    },
    [product],
  );

  function handleSelect(groupId: string, optionId: string) {
    setSelectedOptionIds((prev) => ({ ...prev, [groupId]: optionId }));
  }

  return (
    <section
      aria-label="Product overview"
      className="grid gap-10 lg:grid-cols-2"
      data-testid={testIds.storefront.productOverview}
    >
      <ProductImageGallery
        images={product.images}
        productName={product.name}
        {...(activeVariantId ? { selectedVariantId: activeVariantId } : {})}
        onSelectVariant={handleSelectVariant}
      />
      <ProductPanel
        product={product}
        selectedOptionIds={selectedOptionIds}
        onSelect={handleSelect}
      />
    </section>
  );
}
