import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  wishlist: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  category: {
    upsert: vi.fn(),
  },
  product: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
  productVariant: {
    upsert: vi.fn(),
  },
  wishlistItem: {
    upsert: vi.fn(),
  },
}));

vi.mock("@/server/db", () => ({
  getPrismaClient: () => prismaMock,
}));

import { addWishlistItemForUser, resolveWishlistSeedSelection } from "@/features/wishlist";

describe("wishlist service", () => {
  beforeEach(() => {
    prismaMock.wishlist.create.mockReset().mockResolvedValue({
      id: "wishlist-1",
      userId: "user-1",
    });
    prismaMock.wishlist.findFirst.mockReset().mockResolvedValue({
      id: "wishlist-1",
      userId: "user-1",
    });
    prismaMock.category.upsert.mockReset().mockResolvedValue({
      id: "category-1",
      slug: "cooking-oils",
      name: "Cooking Oils",
    });
    prismaMock.product.upsert.mockReset().mockResolvedValue({
      id: "product-1",
      slug: "olive-blend-cooking-oil-1l",
      name: "Olive Blend Cooking Oil 1L",
    });
    prismaMock.product.findFirst.mockReset().mockResolvedValue(null);
    prismaMock.productVariant.upsert.mockReset().mockResolvedValue({
      id: "variant-1",
      sku: "OBO-1L-001",
    });
    prismaMock.wishlistItem.upsert.mockReset().mockResolvedValue({
      id: "wishlist-item-1",
    });
  });

  it("creates the wishlist before adding an item", async () => {
    await addWishlistItemForUser("user-1", {
      productSlug: "olive-blend-cooking-oil-1l",
    });

    expect(prismaMock.wishlist.create).toHaveBeenCalledWith({
      data: { userId: "user-1" },
    });
  });

  it("resolves a live DB variant by option id (PDP passes the DB variant id)", async () => {
    prismaMock.product.findFirst.mockResolvedValue({
      id: "product-1",
      name: "Ultra Wash Detergent 1kg",
      slug: "ultra-wash-detergent-1kg",
      shortDescription: "Strong stain removal for everyday laundry loads.",
      description: "Long description.",
      masterSku: "UWD-1KG-001",
      category: { name: "Home Care", slug: "home-care" },
      variants: [
        {
          id: "variant-1kg",
          title: "1 kg",
          sku: "UWD-1KG-001",
          price: 899,
          compareAtPrice: 1099,
          isDefault: true,
          inventory: { quantity: 18, reserved: 0, safetyStock: 0 },
        },
        {
          id: "variant-2kg",
          title: "2 kg",
          sku: "UWD-2KG-001",
          price: 1599,
          compareAtPrice: 1999,
          isDefault: false,
          inventory: { quantity: 7, reserved: 0, safetyStock: 0 },
        },
      ],
    });

    await addWishlistItemForUser("user-1", {
      productSlug: "ultra-wash-detergent-1kg",
      optionId: "variant-2kg",
    });

    expect(prismaMock.wishlistItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          wishlistId_productVariantId: {
            wishlistId: "wishlist-1",
            productVariantId: "variant-2kg",
          },
        },
      }),
    );
  });
});

describe("wishlist seed selection", () => {
  it("resolves default SKU for products without an explicit option", () => {
    const selection = resolveWishlistSeedSelection({
      productSlug: "olive-blend-cooking-oil-1l",
    });

    expect(selection.productSlug).toBe("olive-blend-cooking-oil-1l");
    expect(selection.sku).toBe("OBO-1L-001");
    expect(selection.optionId).toBe("vo-1l");
  });

  it("resolves selected variant option by option id", () => {
    const selection = resolveWishlistSeedSelection({
      productSlug: "ultra-wash-detergent-1kg",
      optionId: "vo-2kg",
    });

    expect(selection.optionLabel).toBe("2 kg");
    expect(selection.sku).toBe("UWD-2KG-001");
    expect(selection.price).toBe(1599);
  });

  it("throws for unknown products", () => {
    expect(() =>
      resolveWishlistSeedSelection({
        productSlug: "missing-product-slug",
      }),
    ).toThrowError(/Wishlist product not found/);
  });
});