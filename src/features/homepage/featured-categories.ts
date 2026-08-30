import { normalizeCatalogImageUrl } from "@/features/catalog/lib/product-image-url";
import { PARTY_HEAVEN_CATEGORY_SLUG } from "@/features/catalog/party-heaven";
import type { CatalogCategory } from "@/features/catalog/types";

import type { FeaturedCategoryItem } from "./types";

type LegacyFeaturedCategoryItem = {
  id: string;
  name?: string;
  title?: string;
  description: string;
  href: string;
  slug?: string;
  cardImageUrl?: string;
  imageUrl?: string;
};

function resolveFeaturedCategoryCardImageUrl(
  category: Pick<LegacyFeaturedCategoryItem, "cardImageUrl" | "imageUrl">,
): string | undefined {
  return normalizeCatalogImageUrl(category.cardImageUrl) ?? normalizeCatalogImageUrl(category.imageUrl);
}

export function toFeaturedCategoryItem(category: CatalogCategory): FeaturedCategoryItem {
  const cardImageUrl = resolveFeaturedCategoryCardImageUrl(category);

  return {
    id: category.id,
    name: category.name,
    description: category.description,
    href: category.href,
    ...(category.slug ? { slug: category.slug } : {}),
    ...(cardImageUrl ? { cardImageUrl } : {}),
  };
}

export function normalizeFeaturedCategoryItem(
  category: LegacyFeaturedCategoryItem,
): FeaturedCategoryItem | null {
  const name = category.name?.trim() || category.title?.trim();
  const cardImageUrl = resolveFeaturedCategoryCardImageUrl(category);

  if (!name) {
    return null;
  }

  return {
    id: category.id,
    name,
    description: category.description,
    href: category.href,
    ...(category.slug ? { slug: category.slug } : {}),
    ...(cardImageUrl ? { cardImageUrl } : {}),
  };
}

export function normalizeFeaturedCategoryItems(
  categories: readonly LegacyFeaturedCategoryItem[],
): FeaturedCategoryItem[] {
  return categories
    .map((category) => normalizeFeaturedCategoryItem(category))
    .filter((category): category is FeaturedCategoryItem => category !== null);
}

export function mapCatalogCategoriesToFeaturedCategoryItems(
  categories: readonly CatalogCategory[],
): FeaturedCategoryItem[] {
  return categories
    .filter((category) => category.slug !== PARTY_HEAVEN_CATEGORY_SLUG)
    .map((category) => toFeaturedCategoryItem(category));
}