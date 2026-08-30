import { describe, expect, it } from 'vitest';

import {
  createProductionCatalogData,
  PARTY_HEAVEN_MAX_PRICE_PKR,
} from '../../prisma/production-catalog-data.js';

const forbiddenCopyPattern = /\bdev(?:elopment)?\b|\bdemo\b/i;

describe('production catalog data generator', () => {
  it('is deterministic and produces a substantial storefront-ready catalog', () => {
    const first = createProductionCatalogData();
    const second = createProductionCatalogData();

    expect(first).toEqual(second);
    expect(first.totals.categories).toBeGreaterThanOrEqual(8);
    expect(first.totals.products).toBeGreaterThanOrEqual(32);
  });

  it('fills category and product SEO fields without dev/demo copy', () => {
    const dataset = createProductionCatalogData();

    for (const entry of dataset.categoryProducts) {
      expect(entry.category.name).toBeTruthy();
      expect(entry.category.slug).toBeTruthy();
      expect(entry.category.description).toBeTruthy();
      expect(entry.category.cardImageUrl).toMatch(/^https:\/\//);
      expect(entry.category.seoTitle).toBeTruthy();
      expect(entry.category.seoDescription).toBeTruthy();
      expect(entry.category.seoCanonicalUrl).toMatch(/^\/categories\//);
      expect(entry.category.seoImageUrl).toMatch(/^https:\/\//);

      const serializedCategory = JSON.stringify(entry.category);
      expect(serializedCategory).not.toMatch(forbiddenCopyPattern);

      for (const product of entry.products) {
        expect(product.masterSku).toMatch(/^OD-/);
        expect(product.slug).toBeTruthy();
        expect(product.shortDescription).toBeTruthy();
        expect(product.description).toBeTruthy();
        expect(product.weightGram).toBeGreaterThan(0);
        expect(product.widthMm).toBeGreaterThan(0);
        expect(product.heightMm).toBeGreaterThan(0);
        expect(product.depthMm).toBeGreaterThan(0);
        expect(product.images.length).toBeGreaterThanOrEqual(3);
        expect(product.images.every((url) => url.startsWith('https://'))).toBe(true);
        expect(product.specifications.length).toBeGreaterThanOrEqual(4);
        expect(product.seoTitle).toBeTruthy();
        expect(product.seoDescription).toBeTruthy();
        expect(product.seoCanonicalUrl).toMatch(/^\/categories\//);
        expect(product.seoImageUrl).toMatch(/^https:\/\//);
        expect(product.metadata?.source).toBe('production-catalog-seed');
        expect(product.variant.sku).toMatch(/^OD-/);
        expect(product.variant.title).toBeTruthy();
        expect(product.variant.options).toBeTruthy();
        expect(product.variant.inventory.quantity).toBeGreaterThan(0);
        expect(product.variant.inventory.safetyStock).toBeGreaterThan(0);

        const serializedProduct = JSON.stringify(product);
        expect(serializedProduct).not.toMatch(forbiddenCopyPattern);
      }
    }
  });

  it('keeps Party Heaven storefront eligibility present alongside higher-value catalog items', () => {
    const dataset = createProductionCatalogData();

    for (const entry of dataset.categoryProducts) {
      const prices = entry.products.map((product) => product.variant.price);
      expect(prices.some((price) => price <= PARTY_HEAVEN_MAX_PRICE_PKR)).toBe(true);
      expect(prices.some((price) => price > PARTY_HEAVEN_MAX_PRICE_PKR)).toBe(true);
    }

    expect(dataset.totals.partyHeavenEligibleProducts).toBeGreaterThan(0);
    expect(dataset.totals.products).toBe(
      dataset.categoryProducts.reduce((sum, entry) => sum + entry.products.length, 0),
    );
  });
});