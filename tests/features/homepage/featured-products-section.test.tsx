// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/carousel", () => ({
  Carousel: ({ children }: { children: ReactNode }) => <div data-testid="carousel">{children}</div>,
  CarouselContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CarouselItem: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="carousel-item" className={className}>
      {children}
    </div>
  ),
  CarouselPrevious: () => <button type="button">Previous slide</button>,
  CarouselNext: () => <button type="button">Next slide</button>,
}));

import { FeaturedProductsSectionBlock } from "@/features/homepage/components/featured-products-section";
import { HOMEPAGE_CAROUSEL_MAX_ITEMS } from "@/features/homepage/components/homepage-carousel-config";
import type { FeaturedProductItem,FeaturedProductsSection } from "@/features/homepage/types";

function buildProduct(id: string): FeaturedProductItem {
  return { id, name: `Product ${id}`, href: `/products/${id}`, price: 100 };
}

function buildSection(
  products: FeaturedProductItem[],
  overrides?: Partial<FeaturedProductsSection>,
): FeaturedProductsSection {
  return {
    id: "featured-products",
    kind: "featured-products",
    title: "Top picks",
    products,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("FeaturedProductsSectionBlock", () => {
  it("renders product cards inside a carousel", () => {
    render(
      <FeaturedProductsSectionBlock
        section={buildSection([buildProduct("p1"), buildProduct("p2")])}
      />,
    );

    expect(screen.getByTestId("carousel")).toBeInTheDocument();
    expect(screen.getByText("Product p1")).toBeInTheDocument();
    expect(screen.getByText("Product p2")).toBeInTheDocument();
  });

  it("renders each product card as a full clickable link", () => {
    render(
      <FeaturedProductsSectionBlock
        section={buildSection([buildProduct("p1")])}
      />,
    );

    const link = screen.getByRole("link", { name: "View Product p1" });
    expect(link).toHaveAttribute("href", "/products/p1");
    expect(link).toContainElement(screen.getByText("Product p1"));
  });

  it("renders an add-to-cart button for available products with a slug", () => {
    render(
      <FeaturedProductsSectionBlock
        section={buildSection([{ ...buildProduct("p1"), slug: "p1", inventoryQuantity: 5 }])}
      />,
    );

    const button = screen.getByRole("button", { name: "Add to cart: Product p1" });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it("renders a disabled out-of-stock add-to-cart button when inventory is zero", () => {
    render(
      <FeaturedProductsSectionBlock
        section={buildSection([{ ...buildProduct("p1"), slug: "p1", inventoryQuantity: 0 }])}
      />,
    );

    expect(screen.getByRole("button", { name: "Out of stock: Product p1" })).toBeDisabled();
  });

  it("omits the add-to-cart button when a product has no slug", () => {
    render(<FeaturedProductsSectionBlock section={buildSection([buildProduct("p1")])} />);

    expect(screen.queryByRole("button", { name: /add to cart/i })).not.toBeInTheDocument();
  });

  it("renders a friendly empty state when products are missing", () => {
    render(<FeaturedProductsSectionBlock section={buildSection([])} />);

    expect(screen.getByText("No featured products yet")).toBeInTheDocument();
    expect(screen.queryByTestId("carousel")).not.toBeInTheDocument();
  });

  it("caps carousel items at HOMEPAGE_CAROUSEL_MAX_ITEMS when there are more products", () => {
    const products = Array.from({ length: 12 }, (_, i) => buildProduct(`p${i + 1}`));
    render(<FeaturedProductsSectionBlock section={buildSection(products)} />);

    expect(screen.getAllByTestId("carousel-item")).toHaveLength(HOMEPAGE_CAROUSEL_MAX_ITEMS);
  });

  it("shows a View All link with custom label when viewAllHref is provided", () => {
    const products = Array.from({ length: 3 }, (_, i) => buildProduct(`p${i + 1}`));
    render(
      <FeaturedProductsSectionBlock
        section={buildSection(products, {
          viewAllHref: "/categories/all",
          viewAllLabel: "Browse all",
        })}
      />,
    );

    const link = screen.getByRole("link", { name: "Browse all" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/categories/all");
  });

  it("does not show a View All link when products fit within cap and no explicit viewAllHref", () => {
    const products = Array.from({ length: 4 }, (_, i) => buildProduct(`p${i + 1}`));
    render(<FeaturedProductsSectionBlock section={buildSection(products)} />);

    expect(screen.queryByRole("link", { name: /view all/i })).not.toBeInTheDocument();
  });

  it("renders optional product description when provided", () => {
    render(
      <FeaturedProductsSectionBlock
        section={buildSection([{ ...buildProduct("p1"), description: "A great item" }])}
      />,
    );

    expect(screen.getByText("A great item")).toBeInTheDocument();
  });

  it("applies responsive sizes to product card images", () => {
    render(
      <FeaturedProductsSectionBlock
        section={buildSection([
          {
            ...buildProduct("p-image"),
            images: [
              {
                url: "https://cdn.example.com/products/p-image.jpg",
                alt: "Product p-image",
                isPrimary: true,
              },
            ],
          },
        ])}
      />,
    );

    const image = screen.getByTestId("storefront-product-card-image-p-image");
    expect(image).toHaveAttribute(
      "sizes",
      "(max-width: 639px) 85vw, (max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, (max-width: 1535px) 20vw, 17vw",
    );
  });
});
