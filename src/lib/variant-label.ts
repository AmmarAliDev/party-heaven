/**
 * The title the admin product form assigns to the single variant of a product
 * created with variants disabled (see `buildVariantPayload` in
 * `src/features/admin/products/service.ts`). It is an internal placeholder
 * with no shopper-facing meaning, so storefront cards should hide it.
 */
export const DEFAULT_VARIANT_TITLE = "Default";

/**
 * Returns the shopper-facing variant label, or `null` when the variant carries
 * no meaningful title (missing, empty, or the internal "Default" placeholder).
 */
export function getDisplayVariantLabel(title: string | null | undefined): string | null {
  if (!title) {
    return null;
  }

  const trimmed = title.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === DEFAULT_VARIANT_TITLE.toLowerCase()) {
    return null;
  }

  return trimmed;
}
