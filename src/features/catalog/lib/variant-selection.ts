import type { CatalogProductDetail, ProductVariantOption } from "../types";

/**
 * Resolves the currently active variant option from per-group selections.
 *
 * Each `ProductVariantGroup` option carries the underlying variant id, so the
 * selection in the first group is used as the source of truth for the active
 * variant (and thus its images, price, SKU, and inventory).
 */
export function resolveActiveOption(
  product: CatalogProductDetail,
  selectedOptionIds: Record<string, string>,
): ProductVariantOption | null {
  if (product.variantGroups.length === 0) {
    return null;
  }

  const firstGroup = product.variantGroups[0];
  if (!firstGroup) {
    return null;
  }

  const selectedId = selectedOptionIds[firstGroup.id];

  return firstGroup.options.find((option) => option.id === selectedId) ?? null;
}

/**
 * Builds the initial per-group selections for a product.
 *
 * Pre-selects the first in-stock option per group (falling back to the first
 * option) so the PDP opens on a buyable variant.
 */
export function buildDefaultSelections(product: CatalogProductDetail): Record<string, string> {
  const defaults: Record<string, string> = {};

  for (const group of product.variantGroups) {
    const inStock = group.options.find((option) => option.inventoryQuantity > 0);
    const first = group.options[0];
    const chosen = inStock ?? first;

    if (chosen) {
      defaults[group.id] = chosen.id;
    }
  }

  return defaults;
}

/**
 * Selects the given variant across every group that contains it.
 *
 * Used when a shopper taps a variant-specific image: the gallery asks for the
 * owning variant, and we sync every option group that has that variant so the
 * picker, price, and SKU stay consistent with the image shown.
 */
export function selectVariantAcrossGroups(
  product: CatalogProductDetail,
  selectedOptionIds: Record<string, string>,
  variantId: string,
): Record<string, string> {
  const next = { ...selectedOptionIds };

  for (const group of product.variantGroups) {
    const matching = group.options.find((option) => option.id === variantId);
    if (matching) {
      next[group.id] = matching.id;
    }
  }

  return next;
}
