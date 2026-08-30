/**
 * Storefront Deal types.
 *
 * A deal bundles multiple catalog products (each with its own quantity, and
 * optionally a specific variant) under deal-specific media, deal-level pricing,
 * and a short description. Deals never define their own variant set —
 * availability always derives from the included products'/variants' inventory,
 * and a deal is available when every included product is in stock.
 */

export type StorefrontDealImage = {
  url: string;
  alt: string;
};

export type StorefrontDealProduct = {
  id: string;
  name: string;
  slug: string;
  href: string;
  /** Shopper-facing variant label, or null for the internal "Default" placeholder. */
  variantTitle: string | null;
  /**
   * The effective variant's DB id (linked variant or the product's default).
   * Used as the cart/wishlist `optionId` when adding deal products.
   */
  variantId: string | null;
  /** The effective variant's SKU (used for cart/wishlist matching). */
  sku: string | null;
  /** Number of units of this product included in the deal. */
  quantity: number;
  /** Available stock on the effective variant (linked variant or default). */
  availableStock: number;
  isAvailable: boolean;
};

export type StorefrontDealSpec = {
  label: string;
  value: string;
};

export type StorefrontDealSeo = {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  imageUrl?: string;
  noIndex: boolean;
};

export type StorefrontDeal = {
  id: string;
  slug: string;
  title: string;
  shortDescription?: string;
  description?: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  /** The deal's primary category slug (null when unassigned). */
  categorySlug: string | null;
  /** SEO overrides managed in the admin form (used for page metadata). */
  seo?: StorefrontDealSeo;
  /** Deal-level selling price in whole PKR. */
  price: number;
  /** Original / compare-at price in whole PKR; present only when on sale. */
  compareAt?: number;
  /** Deal-specific images, ordered by position. */
  images: StorefrontDealImage[];
  /** The published products included in the deal, ordered by position. */
  products: StorefrontDealProduct[];
  specifications: StorefrontDealSpec[];
  /** Ids of related deals (admin-managed cross-sell). */
  relatedDealIds: string[];
  /** Available stock on the least-available included product. */
  availableStock: number;
  isAvailable: boolean;
  isLowStock: boolean;
};
