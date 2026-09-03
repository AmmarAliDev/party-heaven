import { describe, expect, it } from "vitest";

import {
  buildStorefrontNavbarCategories,
  NAVBAR_CATEGORY_DROPDOWN_PRODUCT_LIMIT,
} from "@/components/layout/storefront-navbar-categories";
import type { CatalogCategory } from "@/features/catalog";

function category(
  overrides: Partial<
    Pick<CatalogCategory, "slug" | "name" | "href" | "productCount" | "cardImageUrl">
  >,
): CatalogCategory {
  const slug = overrides.slug ?? "";
  return {
    id: `cat-${slug}`,
    slug,
    name: overrides.name ?? "",
    description: "",
    href: overrides.href ?? `/categories/${slug}`,
    productCount: overrides.productCount ?? 0,
    ...(overrides.cardImageUrl ? { cardImageUrl: overrides.cardImageUrl } : {}),
  };
}

describe("NAVBAR_CATEGORY_DROPDOWN_PRODUCT_LIMIT", () => {
  it("caps the per-category product dropdown at a small number", () => {
    expect(NAVBAR_CATEGORY_DROPDOWN_PRODUCT_LIMIT).toBe(8);
  });
});

describe("buildStorefrontNavbarCategories", () => {
  it("sorts categories alphabetically and maps display fields", () => {
    const items = buildStorefrontNavbarCategories([
      category({ slug: "home-care", name: "Home Care", productCount: 4 }),
      category({ slug: "grocery", name: "Grocery", productCount: 9 }),
      category({
        slug: "baby-care",
        name: "Baby Care",
        productCount: 2,
        cardImageUrl: "https://cdn.example.com/baby.jpg",
      }),
    ]);

    expect(items.map((item) => item.title)).toEqual([
      "Baby Care",
      "Grocery",
      "Home Care",
    ]);

    expect(items[0]).toMatchObject({
      kind: "category",
      slug: "baby-care",
      title: "Baby Care",
      href: "/categories/baby-care",
      cardImageUrl: "https://cdn.example.com/baby.jpg",
      productCount: 2,
    });
  });

  it("normalizes missing card images to null", () => {
    const items = buildStorefrontNavbarCategories([
      category({ slug: "home-care", name: "Home Care" }),
    ]);

    expect(items[0]).toMatchObject({ kind: "category", cardImageUrl: null });
  });

  it("keeps every category reachable", () => {
    const categories = [
      category({ slug: "home-care", name: "Home Care" }),
      category({ slug: "grocery", name: "Grocery" }),
    ];

    const items = buildStorefrontNavbarCategories(categories);

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.href)).toEqual([
      "/categories/grocery",
      "/categories/home-care",
    ]);
  });

});
