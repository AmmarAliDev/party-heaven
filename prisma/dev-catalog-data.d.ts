/**
 * Type declarations for the CommonJS `dev-catalog-data.js` module.
 *
 * The module itself is plain JavaScript (executed directly with `node`), so
 * this declaration file keeps TypeScript consumers (tests) fully typed.
 */

export type DevCatalogCategoryRecord = {
  key: string;
  name: string;
  slug: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  seoImageUrl: string;
};

export type DevCatalogVariantRecord = {
  title: string | null;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  isDefault: boolean;
  inventory: { quantity: number; safetyStock: number };
};

export type DevCatalogProductRecord = {
  slug: string;
  name: string;
  seoTitle: string;
  seoDescription: string;
  seoCanonicalUrl: string;
  seoImageUrl: string;
  images: string[];
  variant: DevCatalogVariantRecord;
};

export type DevCatalogCategoryProductsEntry = {
  category: DevCatalogCategoryRecord;
  products: DevCatalogProductRecord[];
};

export type DevCatalogDataSet = {
  categories: DevCatalogCategoryRecord[];
  categoryProducts: DevCatalogCategoryProductsEntry[];
  totals: {
    products: number;
    partyHeavenEligibleProducts: number;
  };
};

export const CATEGORY_KEYS: string[];
export const PARTY_HEAVEN_MAX_PRICE_PKR: number;

export function createDeterministicDevCatalogData(): DevCatalogDataSet;
