import { describe, expect, it } from 'vitest';

import {
  CATEGORY_KEYS,
  PARTY_HEAVEN_MAX_PRICE_PKR,
  createDeterministicDevCatalogData,
} from '../../prisma/dev-catalog-data.js';

describe('dev catalog data generator', () => {
  it('is deterministic and uses the expected category set', () => {
    const first = createDeterministicDevCatalogData();
    const second = createDeterministicDevCatalogData();

    expect(first).toEqual(second);
    expect(first.categories.map((category) => category.key)).toEqual(CATEGORY_KEYS);
  });

  it('creates 4 to 8 products per category with required SEO and image fields', () => {
    const dataset = createDeterministicDevCatalogData();

    for (const entry of dataset.categoryProducts) {
      expect(entry.products.length).toBeGreaterThanOrEqual(4);
      expect(entry.products.length).toBeLessThanOrEqual(8);

      expect(entry.category.seoTitle).toBeTruthy();
      expect(entry.category.seoDescription).toBeTruthy();
      expect(entry.category.seoImageUrl).toMatch(/^https:\/\//);

      for (const product of entry.products) {
        expect(product.slug).toBeTruthy();
        expect(product.seoTitle).toBeTruthy();
        expect(product.seoDescription).toBeTruthy();
        expect(product.seoCanonicalUrl).toMatch(/^\/categories\//);
        expect(product.images.length).toBeGreaterThanOrEqual(2);
        expect(product.images.every((url) => url.startsWith('https://'))).toBe(true);
      }
    }
  });

  it('ensures each category has at least one Party Heaven eligible product and one above threshold', () => {
    const dataset = createDeterministicDevCatalogData();

    for (const entry of dataset.categoryProducts) {
      const prices = entry.products.map((product) => product.variant.price);
      const hasEligible = prices.some((price) => price <= PARTY_HEAVEN_MAX_PRICE_PKR);
      const hasAboveThreshold = prices.some((price) => price > PARTY_HEAVEN_MAX_PRICE_PKR);

      expect(hasEligible).toBe(true);
      expect(hasAboveThreshold).toBe(true);
    }

    expect(dataset.totals.partyHeavenEligibleProducts).toBeGreaterThan(0);
    expect(dataset.totals.products).toBe(
      dataset.categoryProducts.reduce((sum, entry) => sum + entry.products.length, 0),
    );
  });
});
