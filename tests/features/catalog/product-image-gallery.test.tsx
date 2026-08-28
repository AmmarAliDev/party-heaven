// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentPropsWithoutRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductImageGallery } from "@/features/catalog/components/product-image-gallery";

vi.mock("next/image", () => ({
  default: function MockNextImage(props: ComponentPropsWithoutRef<"img">) {
    const { fill: _fill, ...imgProps } = props as ComponentPropsWithoutRef<"img"> & {
      fill?: boolean;
    };

    // eslint-disable-next-line jsx-a11y/alt-text
    return <img {...imgProps} />;
  },
}));

afterEach(() => {
  cleanup();
});

describe("ProductImageGallery LCP loading behavior", () => {
  it("marks the initially active image as eager even when no explicit primary flag exists", () => {
    render(
      <ProductImageGallery
        productName="Laundry Bag"
        images={[
          {
            id: "img-1",
            label: "Front view",
            tone: "slate",
            url: "https://cdn.example.com/laundry-bag-front.webp",
            isPrimary: false,
          },
          {
            id: "img-2",
            label: "Side view",
            tone: "slate",
            url: "https://cdn.example.com/laundry-bag-side.webp",
            isPrimary: false,
          },
        ]}
      />,
    );

    const mainImage = document.querySelector(
      'img[alt="Front view"][sizes="(max-width: 768px) 100vw, 50vw"]',
    );
    expect(mainImage).not.toBeNull();
    expect(mainImage).toHaveAttribute("loading", "eager");
    expect(mainImage).toHaveAttribute("fetchpriority", "high");
  });

  it("switches to lazy loading for non-initial images selected from thumbnails", () => {
    render(
      <ProductImageGallery
        productName="Laundry Bag"
        images={[
          {
            id: "img-1",
            label: "Front view",
            tone: "slate",
            url: "https://cdn.example.com/laundry-bag-front.webp",
            isPrimary: false,
          },
          {
            id: "img-2",
            label: "Side view",
            tone: "slate",
            url: "https://cdn.example.com/laundry-bag-side.webp",
            isPrimary: false,
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "View Side view" }));

    const mainImage = document.querySelector(
      'img[alt="Side view"][sizes="(max-width: 768px) 100vw, 50vw"]',
    );
    expect(mainImage).not.toBeNull();
    expect(mainImage).toHaveAttribute("loading", "lazy");
    expect(mainImage).toHaveAttribute("fetchpriority", "auto");
  });

  it("shows the selected variant's primary image on first render", () => {
    render(
      <ProductImageGallery
        productName="Detergent"
        selectedVariantId="var-1kg"
        images={[
          {
            id: "img-500g",
            label: "500g pack",
            tone: "slate",
            url: "https://cdn.example.com/500g.webp",
            isPrimary: true,
            variantId: "var-500g",
            variantLabel: "500g",
          },
          {
            id: "img-1kg",
            label: "1kg pack",
            tone: "slate",
            url: "https://cdn.example.com/1kg.webp",
            isPrimary: true,
            variantId: "var-1kg",
            variantLabel: "1kg",
          },
        ]}
      />,
    );

    const mainImage = document.querySelector(
      'img[alt="1kg pack"][sizes="(max-width: 768px) 100vw, 50vw"]',
    );
    expect(mainImage).not.toBeNull();
  });

  it("selects the owning variant when a variant-specific thumbnail is tapped", () => {
    const onSelectVariant = vi.fn();
    render(
      <ProductImageGallery
        productName="Detergent"
        selectedVariantId="var-500g"
        onSelectVariant={onSelectVariant}
        images={[
          {
            id: "img-500g",
            label: "500g pack",
            tone: "slate",
            url: "https://cdn.example.com/500g.webp",
            isPrimary: true,
            variantId: "var-500g",
            variantLabel: "500g",
          },
          {
            id: "img-1kg",
            label: "1kg pack",
            tone: "slate",
            url: "https://cdn.example.com/1kg.webp",
            isPrimary: true,
            variantId: "var-1kg",
            variantLabel: "1kg",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "View 1kg pack (1kg)" }));

    expect(onSelectVariant).toHaveBeenCalledWith("var-1kg");
  });

  it("switches to the new variant's image when the selected variant changes", async () => {
    const { rerender } = render(
      <ProductImageGallery
        productName="Detergent"
        selectedVariantId="var-500g"
        images={[
          {
            id: "img-500g",
            label: "500g pack",
            tone: "slate",
            url: "https://cdn.example.com/500g.webp",
            isPrimary: true,
            variantId: "var-500g",
            variantLabel: "500g",
          },
          {
            id: "img-1kg",
            label: "1kg pack",
            tone: "slate",
            url: "https://cdn.example.com/1kg.webp",
            isPrimary: true,
            variantId: "var-1kg",
            variantLabel: "1kg",
          },
        ]}
      />,
    );

    rerender(
      <ProductImageGallery
        productName="Detergent"
        selectedVariantId="var-1kg"
        images={[
          {
            id: "img-500g",
            label: "500g pack",
            tone: "slate",
            url: "https://cdn.example.com/500g.webp",
            isPrimary: true,
            variantId: "var-500g",
            variantLabel: "500g",
          },
          {
            id: "img-1kg",
            label: "1kg pack",
            tone: "slate",
            url: "https://cdn.example.com/1kg.webp",
            isPrimary: true,
            variantId: "var-1kg",
            variantLabel: "1kg",
          },
        ]}
      />,
    );

    await waitFor(() => {
      const mainImage = document.querySelector(
        'img[alt="1kg pack"][sizes="(max-width: 768px) 100vw, 50vw"]',
      );
      expect(mainImage).not.toBeNull();
    });
  });
});
