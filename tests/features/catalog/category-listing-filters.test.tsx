// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CategoryListingFilters } from "@/features/catalog/components/category-listing-filters";
import type { CatalogCategoryListing } from "@/features/catalog/types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

function makeListing(overrides?: Partial<CatalogCategoryListing>): CatalogCategoryListing {
  return {
    category: {
      id: "cat-1",
      name: "Kitchen",
      slug: "kitchen",
      description: "Daily kitchen picks",
      productCount: 8,
      href: "/categories/kitchen",
    },
    products: [],
    filteredProductCount: 0,
    totalProductCount: 0,
    filters: {
      minPrice: 100,
      maxPrice: 1200,
      availability: "in-stock",
      rating: "4-up",
      discount: "on-sale",
      sort: "price-desc",
      attribute: "glass",
      page: 3,
      pageSize: 6,
    },
    pagination: {
      currentPage: 3,
      pageSize: 6,
      totalItems: 12,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    },
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("CategoryListingFilters mobile sheet behavior", () => {
  beforeEach(() => {
    pushMock.mockReset();
  });

  it("renders a mobile trigger and opens and closes the filter sheet", async () => {
    const user = userEvent.setup();

    render(<CategoryListingFilters listing={makeListing()} />);

    expect(screen.getByTestId("catalog-mobile-filter-trigger-wrap").className).toContain("lg:hidden");
    expect(screen.getByTestId("catalog-desktop-filter-panel").className).toContain("lg:block");

    const trigger = screen.getByRole("button", { name: /open filters and sorting panel/i });

    await user.click(trigger);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply filters/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /close panel/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("preserves filter and sort query behavior when applying from the mobile sheet", async () => {
    const user = userEvent.setup();

    render(<CategoryListingFilters listing={makeListing()} />);

    await user.click(screen.getByRole("button", { name: /open filters and sorting panel/i }));
    await user.click(screen.getAllByRole("button", { name: /apply filters/i })[0]!);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        "/categories/kitchen?minPrice=100&maxPrice=1200&availability=in-stock&rating=4-up&discount=on-sale&sort=price-desc&attribute=glass",
      );
    });
  });

  it("resyncs form values when listing filters change after navigation", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CategoryListingFilters listing={makeListing()} />);

    rerender(
      <CategoryListingFilters
        listing={makeListing({
          filters: {
            minPrice: 300,
            maxPrice: 1500,
            availability: "out-of-stock",
            rating: "3-up",
            discount: "20-up",
            sort: "rating-desc",
            attribute: "steel",
            page: 1,
            pageSize: 6,
          },
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: /open filters and sorting panel/i }));
    await user.click(screen.getAllByRole("button", { name: /apply filters/i })[0]!);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        "/categories/kitchen?minPrice=300&maxPrice=1500&availability=out-of-stock&rating=3-up&discount=20-up&sort=rating-desc&attribute=steel",
      );
    });
  });
});
