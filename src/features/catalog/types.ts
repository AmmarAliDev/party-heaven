import type { ReviewModerationStatus } from "@/lib/reviews/moderation";
import type { PaginationMeta } from "@/server/db/pagination";

// ---------------------------------------------------------------------------
// Product image placeholder
// ---------------------------------------------------------------------------

export type ProductImage = {
  id: string;
  /**
   * Real image URL from the database. When present, the UI renders an <img>.
   * When absent, the legacy gradient placeholder (label + tone) is used.
   */
  url?: string;
  /** Alt text or product name — used as the visible label in placeholder mode. */
  label: string;
  tone: CatalogProductImageTone;
  isPrimary: boolean;
  /**
   * When the image is attached to a specific variant (variant products), this
   * holds the variant id. Tapping such an image on the PDP also selects that
   * variant. Product-level (shared) images omit this field.
   */
  variantId?: string;
  /** Human-readable label for the owning variant (e.g. "Small / Blue"). */
  variantLabel?: string;
};

// ---------------------------------------------------------------------------
// Product specifications
// ---------------------------------------------------------------------------

export type ProductSpec = {
  label: string;
  value: string;
};

// ---------------------------------------------------------------------------
// Product variants
// ---------------------------------------------------------------------------

export type ProductVariantOption = {
  id: string;
  label: string;
  sku: string;
  price?: number;
  compareAt?: number;
  inventoryQuantity: number;
};

export type ProductVariantGroup = {
  id: string;
  name: string; // e.g. "Size", "Scent"
  options: ProductVariantOption[];
};

// ---------------------------------------------------------------------------
// Product reviews
// ---------------------------------------------------------------------------

export type ProductReview = {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string; // ISO 8601 date string
  verified: boolean;
  status?: ReviewModerationStatus;
};

export type ProductReviewSummary = {
  averageRating: number;
  totalCount: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

// ---------------------------------------------------------------------------
// Full product detail (used on PDP)
// ---------------------------------------------------------------------------

export type CatalogProductDetail = CatalogProductCard & {
  sku: string;
  shortDescription: string;
  longDescription: string;
  images: ProductImage[];
  specifications: ProductSpec[];
  variantGroups: ProductVariantGroup[];
  reviews: ProductReview[];
  reviewSummary: ProductReviewSummary;
  href: string;
};

export const catalogSortOptions = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating-desc", label: "Top rated" },
  { value: "discount-desc", label: "Biggest discount" },
] as const;

export const availabilityFilterOptions = [
  { value: "all", label: "All stock states" },
  { value: "in-stock", label: "In stock" },
  { value: "low-stock", label: "Low stock" },
  { value: "out-of-stock", label: "Out of stock" },
] as const;

export const ratingFilterOptions = [
  { value: "all", label: "All ratings" },
  { value: "4-up", label: "4.0 and above" },
  { value: "3-up", label: "3.0 and above" },
] as const;

export const discountFilterOptions = [
  { value: "all", label: "All pricing" },
  { value: "on-sale", label: "On sale" },
  { value: "20-up", label: "20% off or more" },
] as const;

export type CatalogSortValue = (typeof catalogSortOptions)[number]["value"];
export type AvailabilityFilterValue = (typeof availabilityFilterOptions)[number]["value"];
export type RatingFilterValue = (typeof ratingFilterOptions)[number]["value"];
export type DiscountFilterValue = (typeof discountFilterOptions)[number]["value"];

export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  cardImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoCanonicalUrl?: string;
  seoOgTitle?: string;
  seoOgDescription?: string;
  seoImageUrl?: string;
  seoKeywords?: string;
  seoNoIndex?: boolean;
  productCount: number;
  href: string;
};

export type CatalogProductImageTone = "sky" | "emerald" | "amber" | "rose" | "slate";

export type CatalogProductCard = {
  id: string;
  slug: string;
  name: string;
  description: string;
  categorySlug: string;
  /** Selling price in whole PKR (integer, e.g. 899 = PKR 899). */
  price: number;
  /** Original / compare-at price in whole PKR (integer); present only when the item is on sale. */
  compareAt?: number;
  inventoryQuantity: number;
  averageRating: number;
  reviewCount: number;
  /** Validated storefront image URL for card media; undefined means fallback placeholder mode. */
  imageUrl?: string;
  imageLabel: string;
  imageTone: CatalogProductImageTone;
  attributeSummary: string[];
  /** Resolved storefront URL for this product. */
  href: string;
};

export type CatalogListingFilters = {
  minPrice: number | undefined;
  maxPrice: number | undefined;
  availability: AvailabilityFilterValue;
  rating: RatingFilterValue;
  discount: DiscountFilterValue;
  sort: CatalogSortValue;
  attribute: string;
  page: number;
  pageSize: number;
};

export type CatalogCategoryListing = {
  category: CatalogCategory;
  products: CatalogProductCard[];
  filteredProductCount: number;
  totalProductCount: number;
  filters: CatalogListingFilters;
  pagination: PaginationMeta;
};

export type CatalogSearchResponse = {
  query: string;
  total: number;
  items: CatalogProductCard[];
  /** "db" — live Prisma-backed results; "seed" — legacy fallback; "external" — future dedicated search engine. */
  source: "db" | "seed" | "external";
};
