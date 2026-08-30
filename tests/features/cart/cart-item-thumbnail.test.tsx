// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CartItemThumbnail } from "@/features/cart/components/cart-item-thumbnail";

vi.mock("next/image", () => ({
  default: function MockNextImage(props: ComponentPropsWithoutRef<"img">) {
    const { fill, ...imgProps } = props as ComponentPropsWithoutRef<"img"> & {
      fill?: boolean;
    };
    void fill;

    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element -- intentional test double for next/image
    return <img {...imgProps} />;
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
});

describe("CartItemThumbnail", () => {
  it("renders a placeholder when no image URL is provided", () => {
    render(<CartItemThumbnail productName="Snow Spray Large" />);

    expect(
      screen.getByRole("img", { name: "Snow Spray Large image placeholder" }),
    ).toBeInTheDocument();
  });

  it("renders a placeholder for unsafe image URLs", () => {
    render(<CartItemThumbnail productName="Snow Spray Large" imageUrl="javascript:alert(1)" />);

    expect(
      screen.getByRole("img", { name: "Snow Spray Large image placeholder" }),
    ).toBeInTheDocument();
  });

  it("renders the product image when a safe URL is provided", () => {
    render(
      <CartItemThumbnail
        productName="Snow Spray Large"
        imageUrl="/images/snow-spray.jpg"
        imageAlt="A can of snow spray"
      />,
    );

    const img = screen.getByRole("img", { name: "A can of snow spray" });
    expect(img).toHaveAttribute("src", "/images/snow-spray.jpg");
  });

  it("links to the product page when href is provided", () => {
    render(
      <CartItemThumbnail
        productName="Snow Spray Large"
        imageUrl="/images/snow-spray.jpg"
        href="/categories/decorations/snow-spray-large"
      />,
    );

    expect(screen.getByRole("link", { name: "View Snow Spray Large" })).toHaveAttribute(
      "href",
      "/categories/decorations/snow-spray-large",
    );
  });
});
