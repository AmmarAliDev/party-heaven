import type { CatalogCategory } from "@/features/catalog/types";

export type HomepageSectionKind =
  | "announcement-bar"
  | "featured-categories"
  | "featured-deals"
  | "featured-products"
  | "deal-spotlight";

export type AnnouncementBarSection = {
  id: string;
  kind: "announcement-bar";
  enabled?: boolean;
  displayOrder?: number;
  message: string;
  href?: string;
  label?: string;
};

export type FeaturedCategoryItem = Pick<CatalogCategory, "id" | "name" | "description" | "href"> & {
  slug?: CatalogCategory["slug"];
  cardImageUrl?: CatalogCategory["cardImageUrl"];
};

export type FeaturedProductImage = {
  url: string;
  alt?: string;
  isPrimary?: boolean;
};

export type FeaturedCategoriesSection = {
  id: string;
  kind: "featured-categories";
  enabled?: boolean;
  displayOrder?: number;
  title: string;
  description?: string;
  categories: FeaturedCategoryItem[];
  /** Optional label for the "View All" CTA shown when categories are capped. */
  viewAllLabel?: string;
  /** Optional href for the "View All" CTA. Falls back to the categories route. */
  viewAllHref?: string;
};

export type FeaturedProductItem = {
  id: string;
  slug?: string;
  name: string;
  description?: string;
  href: string;
  price: number;
  compareAt?: number;
  badge?: string;
  images?: FeaturedProductImage[];
  /** Total available inventory across variants; absent for fallback/placeholder items. */
  inventoryQuantity?: number;
};

export type FeaturedProductsSection = {
  id: string;
  kind: "featured-products";
  enabled?: boolean;
  displayOrder?: number;
  title: string;
  description?: string;
  products: FeaturedProductItem[];
  /** Optional label for the "View All" CTA shown when products are capped. */
  viewAllLabel?: string;
  /** Optional href for the "View All" CTA. Falls back to the products/categories route. */
  viewAllHref?: string;
};

/**
 * Featured Deals section — displays admin-managed deals (see the Deals admin
 * feature). Deals link an existing catalog product (optionally one variant)
 * to deal-specific media and a bundle quantity. The section is hydrated at
 * runtime from the published deals; the shell (title, description, CTA,
 * placeholder) is admin-configurable.
 */
export type FeaturedDealItem = {
  id: string;
  slug: string;
  title: string;
  href: string;
  price: number;
  compareAt?: number;
  imageUrl?: string;
  imageAlt?: string;
  /** Compact subtitle built from the included product names (e.g. "A + B +1 more"). */
  productSummary: string;
  /** Number of products included in the deal. */
  itemCount: number;
  isAvailable: boolean;
};

export type FeaturedDealsSection = {
  id: string;
  kind: "featured-deals";
  enabled?: boolean;
  displayOrder?: number;
  title: string;
  description?: string;
  /**
   * Deals hydrated from the live Deal records (status PUBLISHED). Empty until
   * hydration runs; the component hides the section when this is empty.
   */
  deals: FeaturedDealItem[];
  /** Label for the "View all" CTA linking to the deals listing. */
  ctaLabel: string;
  /** Href for the "View all" CTA (typically /deals). */
  ctaHref: string;
  /** Shown when no deals are available in the catalog. */
  placeholderMessage: string;
};

export type DealSpotlightSection = {
  id: string;
  kind: "deal-spotlight";
  enabled?: boolean;
  displayOrder?: number;
  title: string;
  description: string;
  dealLabel: string;
  price: number;
  compareAt: number;
  ctaLabel: string;
  ctaHref: string;
  image?: {
    url: string;
    alt: string;
  };
};

export type HomepageSection =
  | AnnouncementBarSection
  | FeaturedCategoriesSection
  | FeaturedDealsSection
  | FeaturedProductsSection
  | DealSpotlightSection;

export type HomepageContent = {
  sections: HomepageSection[];
};

export type HomepageContentResult = {
  sections: HomepageSection[];
  source: "cms" | "fallback";
};
