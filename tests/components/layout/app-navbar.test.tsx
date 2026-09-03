// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { CatalogCategory } from "@/features/catalog";

const mockGetCatalogCategories = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());
const mockStorefrontNavbarCarousel = vi.hoisted(() => vi.fn());

vi.mock("@/features/catalog", () => ({
  getCatalogCategories: (...args: unknown[]) => mockGetCatalogCategories(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

vi.mock("@/components/layout/storefront-navbar-carousel", () => ({
  StorefrontNavbarCarousel: mockStorefrontNavbarCarousel,
}));

import AppNavbar from "@/components/layout/app-navbar";

const categories: CatalogCategory[] = [
  {
    id: "1",
    slug: "home-care",
    name: "Home Care",
    description: "",
    productCount: 18,
    href: "/categories/home-care",
  },
  {
    id: "2",
    slug: "grocery",
    name: "Grocery",
    description: "",
    productCount: 22,
    href: "/categories/grocery",
  },
];

beforeAll(() => {
  mockGetCatalogCategories.mockResolvedValue(categories);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockGetCatalogCategories.mockResolvedValue(categories);
});

describe("AppNavbar (server)", () => {
  it("renders a Categories nav and hands the sorted pills to the carousel", async () => {
    render(await AppNavbar());

    const nav = screen.getByRole("navigation", { name: "Categories" });
    expect(nav).toBeInTheDocument();

    const items = mockStorefrontNavbarCarousel.mock.calls[0]![0].items;
    expect(items.map((item: { title: string }) => item.title)).toEqual([
      "Grocery",
      "Home Care",
    ]);
  });

  it("renders nothing when the catalog has no published categories", async () => {
    mockGetCatalogCategories.mockResolvedValue([]);
    render(await AppNavbar());

    expect(screen.queryByRole("navigation", { name: "Categories" })).not.toBeInTheDocument();
    expect(mockStorefrontNavbarCarousel).not.toHaveBeenCalled();
  });

  it("renders nothing and logs when categories fail to load", async () => {
    mockGetCatalogCategories.mockRejectedValue(new Error("db down"));
    render(await AppNavbar());

    expect(screen.queryByRole("navigation", { name: "Categories" })).not.toBeInTheDocument();
    expect(mockLoggerError).toHaveBeenCalledWith(
      "Failed to load header categories",
      expect.objectContaining({ code: "HEADER_CATEGORY_NAV_LOAD_FAILED" }),
    );
    expect(mockStorefrontNavbarCarousel).not.toHaveBeenCalled();
  });
});
