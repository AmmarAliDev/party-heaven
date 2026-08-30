import { describe, expect, it } from "vitest";

import {
  calculateCartSubtotal,
  type CartSummary,
  resolveCartSeedSelection,
  validateCartStock,
} from "@/features/cart";

describe("cart service helpers", () => {
  it("resolves explicit variant selections for variant products", () => {
    const selection = resolveCartSeedSelection({
      productSlug: "ultra-wash-detergent-1kg",
      optionId: "vo-2kg",
    });

    expect(selection.sku).toBe("UWD-2KG-001");
    expect(selection.optionLabel).toBe("2 kg");
    expect(selection.price).toBe(1599);
  });

  it("supports non-variant products by using product-level sku", () => {
    const selection = resolveCartSeedSelection({
      productSlug: "citrus-floor-cleaner-900ml",
    });

    expect(selection.sku).toBe("CFC-900ML-001");
    expect(selection.optionLabel).toBeNull();
    expect(selection.price).toBe(499);
  });

  it("calculates subtotal from quantity and unit price", () => {
    const subtotal = calculateCartSubtotal([
      { quantity: 2, unitPrice: 400 },
      { quantity: 1, unitPrice: 250 },
      { quantity: 3, unitPrice: 100 },
    ]);

    expect(subtotal).toBe(1350);
  });

  it("flags stock issues before checkout", () => {
    const cart: CartSummary = {
      id: "cart-1",
      token: "token-1",
      itemCount: 4,
      subtotal: 2200,
      items: [
        {
          id: "item-ok",
          productName: "Hydra Care Face Wash",
          productSlug: "hydra-care-face-wash",
          categorySlug: "personal-care",
          sku: "HCF-100ML-001",
          optionLabel: null,
          quantity: 1,
          unitPrice: 700,
          compareAtPrice: null,
          lineSubtotal: 700,
          availableQuantity: 9,
          href: "/categories/personal-care/hydra-care-face-wash",
          imageUrl: null,
          imageAlt: null,
        },
        {
          id: "item-issue",
          productName: "Ultra Wash Detergent",
          productSlug: "ultra-wash-detergent-1kg",
          categorySlug: "home-care",
          sku: "UWD-2KG-001",
          optionLabel: "2 kg",
          quantity: 3,
          unitPrice: 500,
          compareAtPrice: null,
          lineSubtotal: 1500,
          availableQuantity: 2,
          href: "/categories/home-care/ultra-wash-detergent-1kg",
          imageUrl: null,
          imageAlt: null,
        },
      ],
      dealItems: [],
    };

    const result = validateCartStock(cart);

    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.cartItemId).toBe("item-issue");
    expect(result.issues[0]?.availableQuantity).toBe(2);
  });
});
