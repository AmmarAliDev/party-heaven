// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DealSpotlightSectionBlock } from "@/features/homepage/components/deal-spotlight-section";
import type { DealSpotlightSection } from "@/features/homepage/types";

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

function buildSection(overrides?: Partial<DealSpotlightSection>): DealSpotlightSection {
  return {
    id: "deal-spotlight-weekly",
    kind: "deal-spotlight",
    title: "Weekly deal",
    description: "Save on this week's featured product.",
    dealLabel: "Weekly deal",
    price: 799,
    compareAt: 999,
    ctaLabel: "Shop now",
    ctaHref: "/categories/home-care/flash-cleaner",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("DealSpotlightSectionBlock", () => {
  it("renders campaign image when a valid image URL exists", () => {
    render(
      <DealSpotlightSectionBlock
        section={buildSection({
          image: {
            url: "https://store.public.blob.vercel-storage.com/admin/content/campaign.png",
            alt: "Featured campaign product",
          },
        })}
      />,
    );

    expect(screen.getByRole("img", { name: "Featured campaign product" })).toBeInTheDocument();
  });

  it("renders internal CTA links as regular navigation", () => {
    render(<DealSpotlightSectionBlock section={buildSection()} />);

    const cta = screen.getByRole("link", { name: "Shop now" });
    expect(cta).toHaveAttribute("href", "/categories/home-care/flash-cleaner");
    expect(cta).not.toHaveAttribute("target");
  });

  it("renders external CTA links with safe rel and target attributes", () => {
    render(
      <DealSpotlightSectionBlock
        section={buildSection({
          ctaHref: "https://example.com/deals/flash-cleaner",
        })}
      />,
    );

    const cta = screen.getByRole("link", { name: "Shop now" });
    expect(cta).toHaveAttribute("href", "https://example.com/deals/flash-cleaner");
    expect(cta).toHaveAttribute("target", "_blank");
    expect(cta).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders a non-clickable CTA fallback when the link is invalid", () => {
    render(
      <DealSpotlightSectionBlock
        section={buildSection({
          ctaHref: "javascript:alert(1)",
        })}
      />,
    );

    expect(screen.queryByRole("link", { name: "Shop now" })).not.toBeInTheDocument();
    expect(screen.getByText("Shop now")).toHaveAttribute("aria-disabled", "true");
  });

  it("renders campaign prices using the shared storefront currency formatting", () => {
    render(
      <DealSpotlightSectionBlock
        section={buildSection({
          price: 1799,
          compareAt: 2199,
        })}
      />,
    );

    expect(screen.getByText("Rs. 1,799")).toBeInTheDocument();
    expect(screen.getByText("Rs. 2,199")).toBeInTheDocument();
  });
});
