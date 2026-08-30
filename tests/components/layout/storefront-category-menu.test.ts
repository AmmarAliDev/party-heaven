import { describe, expect, it } from "vitest";

import {
  buildStorefrontCategoryMenu,
  buildStorefrontNavbarCategoryMenu,
  NAVBAR_DIRECT_CATEGORY_LIMIT,
} from "@/components/layout/storefront-category-menu";

describe("buildStorefrontCategoryMenu", () => {
  it("sorts categories alphabetically and appends All Categories", () => {
    const menu = buildStorefrontCategoryMenu([
      { name: "Home Care", href: "/categories/home-care" },
      { name: "Grocery", href: "/categories/grocery" },
    ]);

    expect(menu.map((item) => item.title)).toEqual([
      "Grocery",
      "Home Care",
      "All Categories",
    ]);

    expect(menu.at(-1)).toMatchObject({
      title: "All Categories",
      href: "/categories",
      kind: "all-categories",
    });
  });

  it("does not include a reserved Party Heaven entry", () => {
    const menu = buildStorefrontCategoryMenu([
      { name: "Personal Care", href: "/categories/personal-care" },
    ]);

    expect(menu.some((item) => item.title === "Party Heaven")).toBe(false);
    expect(menu.map((item) => item.title)).toEqual(["Personal Care", "All Categories"]);
  });
});

describe("buildStorefrontNavbarCategoryMenu", () => {
  const categories = [
    { name: "Home Care", href: "/categories/home-care" },
    { name: "Beverages", href: "/categories/beverages" },
    { name: "Grocery", href: "/categories/grocery" },
    { name: "Personal Care", href: "/categories/personal-care" },
    { name: "Cleaning Supplies", href: "/categories/cleaning-supplies" },
    { name: "Kitchen & Dining", href: "/categories/kitchen-dining" },
    { name: "Baby Care", href: "/categories/baby-care" },
    { name: "Pet Supplies", href: "/categories/pet-supplies" },
  ];

  it("renders a capped set of categories directly in the navbar", () => {
    const menu = buildStorefrontNavbarCategoryMenu(categories);

    expect(menu.directCategories.map((item) => item.title)).toEqual([
      "Baby Care",
      "Beverages",
      "Cleaning Supplies",
      "Grocery",
      "Home Care",
      "Kitchen & Dining",
    ]);
    expect(menu.directCategories).toHaveLength(NAVBAR_DIRECT_CATEGORY_LIMIT);
    expect(menu.directCategories.some((item) => item.kind === "all-categories")).toBe(false);
  });

  it("puts remaining categories inside the More dropdown", () => {
    const menu = buildStorefrontNavbarCategoryMenu(categories);

    expect(menu.moreCategories.map((item) => item.title)).toEqual([
      "Personal Care",
      "Pet Supplies",
    ]);
  });

  it("always appends All Categories as the last More dropdown item", () => {
    const menu = buildStorefrontNavbarCategoryMenu(categories);

    expect(menu.allCategories).toMatchObject({
      title: "All Categories",
      href: "/categories",
      kind: "all-categories",
    });
    expect(menu.moreCategories.some((item) => item.kind === "all-categories")).toBe(false);
  });

  it("avoids duplicate links between the navbar and the More dropdown", () => {
    const menu = buildStorefrontNavbarCategoryMenu(categories);

    const directHrefs = new Set(menu.directCategories.map((item) => item.href));
    const moreHrefs = new Set([
      ...menu.moreCategories.map((item) => item.href),
      menu.allCategories.href,
    ]);

    [...directHrefs].forEach((href) => {
      expect(moreHrefs.has(href)).toBe(false);
    });
  });

  it("keeps every category reachable across the navbar and More dropdown", () => {
    const menu = buildStorefrontNavbarCategoryMenu(categories);

    const reachableHrefs = new Set([
      ...menu.directCategories.map((item) => item.href),
      ...menu.moreCategories.map((item) => item.href),
      menu.allCategories.href,
    ]);

    categories.forEach((category) => {
      expect(reachableHrefs.has(category.href)).toBe(true);
    });
  });

  it("handles fewer categories than the direct limit without duplication", () => {
    const menu = buildStorefrontNavbarCategoryMenu([
      { name: "Grocery", href: "/categories/grocery" },
      { name: "Beverages", href: "/categories/beverages" },
    ]);

    expect(menu.directCategories.map((item) => item.title)).toEqual(["Beverages", "Grocery"]);
    expect(menu.moreCategories).toEqual([]);
    expect(menu.allCategories.title).toBe("All Categories");
  });
});

