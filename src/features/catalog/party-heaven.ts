import { routes } from "@/config/routes";

import type { CatalogCategory } from "./types";

export const PARTY_HEAVEN_CATEGORY_SLUG = "party-heaven";
export const PARTY_HEAVEN_CATEGORY_LABEL = "Party Heaven";
export const PARTY_HEAVEN_MAX_PRICE_PKR = 280;

/** Default card/OG image for the Party Heaven virtual category. */
export const PARTY_HEAVEN_CATEGORY_IMAGE_URL =
  "https://7vmvuxle2dj9679q.public.blob.vercel-storage.com/admin/category/2026/05/one-dollar-5f2ffdb0.jpg";

const PARTY_HEAVEN_CATEGORY_ID = "system-party-heaven";

export function isPartyHeavenCategorySlug(slug: string): boolean {
  return slug.trim().toLocaleLowerCase("en-US") === PARTY_HEAVEN_CATEGORY_SLUG;
}

export function createPartyHeavenVirtualCategory(productCount: number): CatalogCategory {
  return {
    id: PARTY_HEAVEN_CATEGORY_ID,
    name: PARTY_HEAVEN_CATEGORY_LABEL,
    slug: PARTY_HEAVEN_CATEGORY_SLUG,
    description: `All published products priced at Rs. ${PARTY_HEAVEN_MAX_PRICE_PKR} or less.`,
    cardImageUrl: PARTY_HEAVEN_CATEGORY_IMAGE_URL,
    seoTitle: "Party Heaven Deals in Pakistan",
    seoDescription:
      "Shop Party Heaven picks across all categories. This special storefront collection automatically includes published products priced at Rs. 280 or less.",
    productCount,
    href: routes.storefront.category(PARTY_HEAVEN_CATEGORY_SLUG),
  };
}
