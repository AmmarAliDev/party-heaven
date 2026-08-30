import { routes } from "@/config/routes";
import { PARTY_HEAVEN_CATEGORY_SLUG } from "@/features/catalog/party-heaven";

type CategoryMenuInput = {
  name: string;
  href: string;
};

export type StorefrontCategoryMenuItem = {
  title: string;
  href: string;
  kind: "party-heaven" | "category" | "all-categories";
};

const PARTY_HEAVEN_LABEL = "Party Heaven";

function normalizeLabel(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

export function buildStorefrontCategoryMenu(
  categories: readonly CategoryMenuInput[],
): StorefrontCategoryMenuItem[] {
  const partyHeavenCategory = categories.find(
    (category) => normalizeLabel(category.name) === normalizeLabel(PARTY_HEAVEN_LABEL),
  );

  const otherCategories = categories
    .filter((category) => normalizeLabel(category.name) !== normalizeLabel(PARTY_HEAVEN_LABEL))
    .sort((left, right) => left.name.localeCompare(right.name, "en", { sensitivity: "base" }));

  return [
    {
      title: PARTY_HEAVEN_LABEL,
      href: partyHeavenCategory?.href ?? routes.storefront.category(PARTY_HEAVEN_CATEGORY_SLUG),
      kind: "party-heaven",
    },
    ...otherCategories.map((category) => ({
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
 * Number of categories shown directly in the desktop storefront navbar before
 * the remaining categories are folded into the "More" dropdown.
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
 * Splits the canonical storefront category menu into a navbar layout:
 * a capped set of direct links plus a "More" dropdown that holds the
 * remaining categories and always ends with "All Categories".
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
