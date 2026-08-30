// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CategoryOverviewCard } from "@/features/catalog/components/category-overview-card";
import type { CatalogCategory } from "@/features/catalog/types";

function makeCategory(overrides: Partial<CatalogCategory> = {}): CatalogCategory {
  return {
    id: "cat-home-care",
    name: "Home Care",
    slug: "home-care",
    description: "Cleaning and restock-friendly essentials.",
    productCount: 12,
    href: "/categories/home-care",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("CategoryOverviewCard media behavior", () => {
  it("renders the category card as a single full clickable link", () => {
    render(<CategoryOverviewCard category={makeCategory()} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/categories/home-care");
    expect(link).toContainElement(screen.getByText("Home Care"));
    expect(link.querySelector("article")).not.toBeNull();
  });

  it("clamps the category description to three lines", () => {
    render(<CategoryOverviewCard category={makeCategory()} />);

    const description = screen.getByText("Cleaning and restock-friendly essentials.");
    expect(description).toHaveClass("line-clamp-2");
  });

  it("renders the category card background image when image URL exists", () => {
    render(
      <CategoryOverviewCard
        category={makeCategory({
          cardImageUrl: "https://cdn.example.com/categories/home-care.jpg",
        })}
      />,
    );

    const media = document.querySelector('[data-testid="storefront-category-card-image-home-care"]');
    expect(media).toBeInTheDocument();
    expect(media).toHaveAttribute("src", expect.stringContaining("cdn.example.com%2Fcategories%2Fhome-care.jpg"));
    expect(media).toHaveAttribute("sizes", "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw");
  });

  it("uses eager loading when the card is marked as above the fold", () => {
    render(
      <CategoryOverviewCard
        category={makeCategory({
          cardImageUrl: "https://cdn.example.com/categories/home-care.jpg",
        })}
        eagerImage
      />,
    );

    const media = document.querySelector('[data-testid="storefront-category-card-image-home-care"]');
    expect(media).toHaveAttribute("loading", "eager");
    expect(media).toHaveAttribute("fetchpriority", "high");
  });

  it("renders a fallback visual when no category image exists", () => {
    render(<CategoryOverviewCard category={makeCategory()} />);

    expect(document.querySelector('[data-testid="storefront-category-card-image-home-care"]')).toBeNull();
    expect(document.querySelector('[data-testid="storefront-category-card-fallback-home-care"]')).toBeInTheDocument();
    expect(screen.getByText(/category preview/i)).toBeInTheDocument();
  });
});
