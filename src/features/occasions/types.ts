import type { CatalogProductCard } from "@/features/catalog";
import type { StorefrontDeal } from "@/features/deals";

/**
 * Storefront Occasion types.
 *
 * An Occasion is an editorial collection that curates EXISTING catalog
 * products and/or deals around a theme (Birthday, Wedding, Baby Shower).
 * Occasions are not categories: the curated items keep their own category,
 * status, and pricing — the occasion page simply re-surfaces them with the
 * same product/deal card grids used elsewhere on the storefront.
 */

export type StorefrontOccasionSummary = {
  id: string;
  slug: string;
  name: string;
  shortDescription?: string;
  coverImageUrl?: string;
  coverImageAlt?: string;
  /** Special occasions are seasonal/high-visibility collections. */
  isSpecial: boolean;
  productCount: number;
  dealCount: number;
  href: string;
};

export type StorefrontOccasionSeo = {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  imageUrl?: string;
  keywords?: string;
  noIndex: boolean;
};

export type StorefrontOccasionDetail = {
  id: string;
  slug: string;
  name: string;
  shortDescription?: string;
  description?: string;
  coverImageUrl?: string;
  coverImageAlt?: string;
  isSpecial: boolean;
  /** SEO overrides managed in the admin form (used for page metadata). */
  seo?: StorefrontOccasionSeo;
  /** Published products curated into this occasion (category-card ready). */
  products: CatalogProductCard[];
  /** Published deals curated into this occasion (deal-card ready). */
  deals: StorefrontDeal[];
};
