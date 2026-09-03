import { routes } from "@/config/routes";

type CategoryMenuInput = {
  name: string;
  href: string;
};

export type StorefrontCategoryMenuItem = {
  title: string;
  href: string;
  kind: "category" | "all-categories";
};

export function buildStorefrontCategoryMenu(
  categories: readonly CategoryMenuInput[],
): StorefrontCategoryMenuItem[] {
  const sortedCategories = [...categories].sort((left, right) =>
    left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
  );

  return [
    ...sortedCategories.map((category) => ({
      title: category.name,
      href: category.href,
      kind: "category" as const,
    })),
    {
      title: "All Categories",
      href: routes.storefront.categories,
      kind: "all-categories",
    },
  ];
}

/**
 * Number of categories shown as text quick links in the storefront footer's
 * "Quick Links" column before the rest fold into its "More" dropdown.
 */
export const NAVBAR_DIRECT_CATEGORY_LIMIT = 6;

export type StorefrontNavbarCategoryMenu = {
  /** Categories rendered directly in the navbar (never include "All Categories"). */
  directCategories: StorefrontCategoryMenuItem[];
  /** Categories that did not fit in the navbar; rendered inside the "More" dropdown. */
  moreCategories: StorefrontCategoryMenuItem[];
  /** The "All Categories" link; always the last item in the "More" dropdown. */
  allCategories: StorefrontCategoryMenuItem;
};

/**
 * Splits the canonical storefront category menu into a quick-links layout:
 * a capped set of direct links plus a "More" dropdown that holds the
 * remaining categories and always ends with "All Categories".
 *
 * Used by the storefront footer for its "Quick Links" column.
 */
export function buildStorefrontNavbarCategoryMenu(
  categories: readonly CategoryMenuInput[],
  directLimit: number = NAVBAR_DIRECT_CATEGORY_LIMIT,
): StorefrontNavbarCategoryMenu {
  const allItems = buildStorefrontCategoryMenu(categories);
  const categoryItems = allItems.filter((item) => item.kind !== "all-categories");
  const allCategories = allItems.find((item) => item.kind === "all-categories") ?? {
    title: "All Categories",
    href: routes.storefront.categories,
    kind: "all-categories" as const,
  };

  return {
    directCategories: categoryItems.slice(0, directLimit),
    moreCategories: categoryItems.slice(directLimit),
    allCategories,
  };
}
