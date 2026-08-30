// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentPropsWithoutRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductGridCard } from "@/features/catalog/components/product-grid-card";
import type { CatalogProductCard } from "@/features/catalog/types";

vi.mock("next/image", () => ({
  default: function MockNextImage(props: ComponentPropsWithoutRef<"img">) {
    const { fill, ...imgProps } = props as ComponentPropsWithoutRef<"img"> & {
      fill?: boolean;
    };
    void fill;

    // Render a plain img in tests so we can simulate load/error behavior.
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element -- intentional test double for next/image
    return <img {...imgProps} />;
  },
}));

function makeProduct(overrides?: Partial<CatalogProductCard>): CatalogProductCard {
  return {
    id: "prod-1",
    slug: "daily-face-wash",
    name: "Daily Face Wash",
    description: "Gentle daily cleanser.",
    categorySlug: "personal-care",
    price: 280,
    inventoryQuantity: 12,
    averageRating: 4.6,
    reviewCount: 18,
    imageUrl: "https://placehold.co/800x600/png",
    imageLabel: "Daily Face Wash",
    imageTone: "rose",
    attributeSummary: ["Foam", "100ml"],
    href: "/categories/personal-care/daily-face-wash",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("ProductGridCard media behavior", () => {
  it("renders the product card as a single full clickable link", () => {
    render(<ProductGridCard product={makeProduct()} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/categories/personal-care/daily-face-wash");
    expect(link).toContainElement(screen.getByText("Daily Face Wash"));
    expect(link.querySelector("article")).not.toBeNull();
  });

  it("clamps the product description to three lines", () => {
    render(<ProductGridCard product={makeProduct()} />);

    const description = screen.getByText("Gentle daily cleanser.");
    expect(description).toHaveClass("line-clamp-2");
  });

  it("renders the product image area when a valid image URL exists", () => {
    render(<ProductGridCard product={makeProduct()} />);

    expect(screen.getByRole("img", { name: /daily face wash catalog image/i })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /daily face wash image placeholder/i })).not.toBeInTheDocument();
  });

  it("uses eager loading when the card is marked as above the fold", () => {
    render(<ProductGridCard product={makeProduct()} eagerImage />);

    const image = screen.getByRole("img", { name: /daily face wash catalog image/i });
    expect(image).toHaveAttribute("loading", "eager");
    expect(image).toHaveAttribute("fetchpriority", "high");
  });

  it("falls back to gradient placeholder when image URL is missing", () => {
    const product = makeProduct();
    delete product.imageUrl;
    render(<ProductGridCard product={product} />);

    const placeholder = screen.getByRole("img", { name: /daily face wash image placeholder/i });
    expect(placeholder).toBeInTheDocument();
    expect(within(placeholder).getByText("Catalog image")).toBeInTheDocument();
    expect(within(placeholder).getByText("Daily Face Wash")).toBeInTheDocument();
  });

  it("switches to gradient placeholder if image loading fails", async () => {
    render(<ProductGridCard product={makeProduct()} />);

    const image = screen.getByRole("img", { name: /daily face wash catalog image/i });
    fireEvent.error(image);

    await waitFor(() => {
      expect(screen.getByRole("img", { name: /daily face wash image placeholder/i })).toBeInTheDocument();
    });
  });

  it("renders an add to cart button while keeping the card as a single link", () => {
    render(<ProductGridCard product={makeProduct()} />);

    expect(screen.getByRole("button", { name: /add to cart/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("disables the add to cart button when the product is out of stock", () => {
    render(<ProductGridCard product={makeProduct({ inventoryQuantity: 0 })} />);

    expect(screen.getByRole("button", { name: /out of stock/i })).toBeDisabled();
  });
});
