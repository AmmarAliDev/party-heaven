/**
 * Type declarations for the CommonJS `production-catalog-data.js` module.
 *
 * The module itself is plain JavaScript (executed directly with `node`), so
 * this declaration file keeps TypeScript consumers (tests) fully typed.
 */

export type ProductionCatalogCategoryRecord = {
  name: string;
  slug: string;
  description: string;
  cardImageUrl: string;
  seoTitle: string;
  seoDescription: string;
  seoCanonicalUrl: string;
  seoImageUrl: string;
};

export type ProductionCatalogVariantRecord = {
  sku: string;
  title: string;
  options: Record<string, string>;
  price: number;
  compareAtPrice: number | null;
  inventory: { quantity: number; safetyStock: number };
};

export type ProductionCatalogProductRecord = {
  masterSku: string;
  slug: string;
  shortDescription: string;
  description: string;
  weightGram: number;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  images: string[];
  specifications: Array<{ key: string; value: string }>;
  seoTitle: string;
  seoDescription: string;
  seoCanonicalUrl: string;
  seoImageUrl: string;
  metadata: { source: string };
  variant: ProductionCatalogVariantRecord;
};

export type ProductionCatalogCategoryProductsEntry = {
  category: ProductionCatalogCategoryRecord;
  products: ProductionCatalogProductRecord[];
};

export type ProductionCatalogDataSet = {
  categories: ProductionCatalogCategoryRecord[];
  categoryProducts: ProductionCatalogCategoryProductsEntry[];
  totals: {
    categories: number;
    products: number;
    partyHeavenEligibleProducts: number;
  };
};

export const PARTY_HEAVEN_MAX_PRICE_PKR: number;

export function createProductionCatalogData(): ProductionCatalogDataSet;
