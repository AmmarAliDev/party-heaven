// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProductRelatedGrid } from "@/features/catalog/components/product-related-grid";
import type { CatalogProductCard } from "@/features/catalog/types";

function makeProduct(overrides?: Partial<CatalogProductCard>): CatalogProductCard {
  return {
    id: "prod-1",
    slug: "snow-spray-large",
    name: "Snow Spray Large",
    description: "Festive snow spray container.",
    categorySlug: "decorations",
    price: 150,
    inventoryQuantity: 50,
    averageRating: 4.8,
    reviewCount: 32,
    imageUrl: "https://example.com/snow-spray.jpeg",
    imageLabel: "Snow Spray",
    imageTone: "sky",
    attributeSummary: ["Large", "500ml"],
    href: "/categories/decorations/snow-spray-large",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("ProductRelatedGrid component", () => {
  it("renders section header and badge", () => {
    render(<ProductRelatedGrid products={[]} />);

    expect(screen.getByRole("heading", { level: 2, name: "Related Products" })).toBeInTheDocument();
    expect(screen.getByText("More like this")).toBeInTheDocument();
  });

  it("renders empty state message when no products are provided", () => {
    render(<ProductRelatedGrid products={[]} />);

    expect(screen.getByText("No related products are available right now.")).toBeInTheDocument();
  });

  it("renders product cards with backgroundImage style matching product.imageUrl", () => {
    const products = [
      makeProduct({ id: "prod-1", name: "Snow Spray Large", imageUrl: "https://example.com/snow.jpg" }),
      makeProduct({ id: "prod-2", name: "Party Popper", href: "/categories/decorations/party-popper", imageUrl: "https://example.com/popper.jpg" }),
    ];

    render(<ProductRelatedGrid products={products} />);

    expect(screen.queryByText("No related products are available right now.")).not.toBeInTheDocument();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]!).toHaveAttribute("href", "/categories/decorations/snow-spray-large");
    expect(links[1]!).toHaveAttribute("href", "/categories/decorations/party-popper");

    expect(screen.getByText("Snow Spray Large")).toBeInTheDocument();
    expect(screen.getByText("Party Popper")).toBeInTheDocument();

    // Verify background image container
    const articles = screen.getAllByRole("article");
    expect(articles).toHaveLength(2);

    const firstBgDiv = articles[0]!.querySelector("div[aria-hidden]");
    expect(firstBgDiv).toHaveStyle({
      backgroundImage: "url(https://example.com/snow.jpg)",
      backgroundSize: "cover",
      backgroundPosition: "center",
    });
  });

  it("renders an add to cart button for each related product card", () => {
    const products = [
      makeProduct({ id: "prod-1", name: "Snow Spray Large" }),
      makeProduct({ id: "prod-2", name: "Party Popper", href: "/categories/decorations/party-popper" }),
    ];

    render(<ProductRelatedGrid products={products} />);

    const addButtons = screen.getAllByRole("button", { name: /add to cart/i });
    expect(addButtons).toHaveLength(2);
  });
});
