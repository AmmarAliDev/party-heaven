import { routes } from "@/config/routes";
import type { CatalogCategory } from "@/features/catalog";

/** A single pill rendered in the storefront navbar carousel. */
export type StorefrontNavbarCategory =
  | {
      kind: "category";
      /** Category slug — also used as the product-dropdown cache key. */
      slug: string;
      title: string;
      /** URL of the category listing page (the circular image links here). */
      href: string;
      /** Validated storefront image URL, or `null` when no image is set. */
      cardImageUrl: string | null;
      productCount: number;
    }

/**
 * Number of products fetched (and shown) inside one category's navbar
 * dropdown. The dropdown body scrolls when a category has more products.
 */
export const NAVBAR_CATEGORY_DROPDOWN_PRODUCT_LIMIT = 8;

/**
 * Builds the full, ordered list of navbar pills: live catalog categories
 * sorted alphabetically.
 */
export function buildStorefrontNavbarCategories(
  categories: readonly CatalogCategory[],
): StorefrontNavbarCategory[] {
  const sortedCategories = [...categories].sort((left, right) =>
    left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
  );

  return [
    ...sortedCategories.map((category) => ({
      kind: "category" as const,
      slug: category.slug,
      title: category.name,
      href: category.href,
      cardImageUrl: category.cardImageUrl ?? null,
      productCount: category.productCount,
    })),
  ];
}
