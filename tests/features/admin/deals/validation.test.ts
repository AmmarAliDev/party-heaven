import { describe, expect, it } from "vitest";

import { validateAdminDealCreateInput, validateAdminDealUpdateInput } from "@/features/admin/deals";

const baseInput = {
  title: "Flash Cleaner Deal",
  slug: "flash-cleaner-deal",
  status: "PUBLISHED",
  categoryId: "category-1",
  price: "950",
  comparePrice: "1200",
  products: [{ productId: "product-1", quantity: "3" }],
  images: [],
  specifications: [],
  relatedDealIds: [],
};

describe("admin deal validation", () => {
  it("accepts a valid create payload", () => {
    const result = validateAdminDealCreateInput(baseInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.products).toHaveLength(1);
      expect(result.data.products[0]?.quantity).toBe(3);
      expect(result.data.products[0]?.variantId).toBeUndefined();
      expect(result.data.price).toBe(950);
      expect(result.data.comparePrice).toBe(1200);
    }
  });

  it("accepts multiple products with explicit variants", () => {
    const result = validateAdminDealCreateInput({
      ...baseInput,
      products: [
        { productId: "product-1", variantId: "variant-2", quantity: "2" },
        { productId: "product-2", quantity: "1" },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.products).toHaveLength(2);
      expect(result.data.products[0]?.variantId).toBe("variant-2");
    }
  });

  it("coerces an empty variant id to undefined", () => {
    const result = validateAdminDealCreateInput({
      ...baseInput,
      products: [{ productId: "product-1", variantId: "", quantity: "3" }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.products[0]?.variantId).toBeUndefined();
    }
  });

  it("requires a title, slug, category, price, and at least one product", () => {
    const result = validateAdminDealCreateInput({
      ...baseInput,
      title: "",
      slug: "",
      categoryId: "",
      price: "",
      products: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects quantity below 1", () => {
    const result = validateAdminDealCreateInput({
      ...baseInput,
      products: [{ productId: "product-1", quantity: "0" }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects non-integer quantities", () => {
    const result = validateAdminDealCreateInput({
      ...baseInput,
      products: [{ productId: "product-1", quantity: "2.5" }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid slugs", () => {
    const result = validateAdminDealCreateInput({ ...baseInput, slug: "Invalid Slug!" });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate products in the same deal", () => {
    const result = validateAdminDealCreateInput({
      ...baseInput,
      products: [
        { productId: "product-1", quantity: "1" },
        { productId: "product-1", quantity: "2" },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a compare price below the price", () => {
    const result = validateAdminDealCreateInput({ ...baseInput, price: "500", comparePrice: "400" });

    expect(result.success).toBe(false);
  });

  it("accepts SEO fields", () => {
    const result = validateAdminDealCreateInput({
      ...baseInput,
      seoTitle: "Flash Cleaner Deal | Party Heaven",
      seoDescription: "A short meta description.",
      seoNoIndex: "on",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.seoTitle).toBe("Flash Cleaner Deal | Party Heaven");
      expect(result.data.seoNoIndex).toBe(true);
    }
  });

  it("requires an id for updates", () => {
    const result = validateAdminDealUpdateInput(baseInput);

    expect(result.success).toBe(false);
  });

  it("accepts a valid update payload with an id", () => {
    const result = validateAdminDealUpdateInput({ ...baseInput, id: "deal-1" });

    expect(result.success).toBe(true);
  });
});
