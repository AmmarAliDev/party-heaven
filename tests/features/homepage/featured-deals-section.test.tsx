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

import { FeaturedDealsSectionBlock } from "@/features/homepage/components/featured-deals-section";
import { HOMEPAGE_CAROUSEL_MAX_ITEMS } from "@/features/homepage/components/homepage-carousel-config";
import type { FeaturedDealItem, FeaturedDealsSection } from "@/features/homepage/types";

function buildDeal(id: string): FeaturedDealItem {
  return {
    id,
    slug: id,
    title: `Deal ${id}`,
    href: `/deals/${id}`,
    price: 100,
    productSummary: `Product ${id}`,
    itemCount: 1,
    isAvailable: true,
  };
}

function buildSection(
  deals: FeaturedDealItem[],
  overrides?: Partial<FeaturedDealsSection>,
): FeaturedDealsSection {
  return {
    id: "featured-deals",
    kind: "featured-deals",
    title: "Featured Deals",
    deals,
    ctaLabel: "View all deals",
    ctaHref: "/deals",
    placeholderMessage: "No deals available right now.",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("FeaturedDealsSectionBlock", () => {
  it("renders deal cards inside a carousel when deals are present", () => {
    render(<FeaturedDealsSectionBlock section={buildSection([buildDeal("d1"), buildDeal("d2")])} />);

    expect(screen.getByTestId("carousel")).toBeInTheDocument();
    expect(screen.getByText("Deal d1")).toBeInTheDocument();
    expect(screen.getByText("Deal d2")).toBeInTheDocument();
  });

  it("renders each deal card as a full clickable link to the deal page", () => {
    render(<FeaturedDealsSectionBlock section={buildSection([buildDeal("d1")])} />);

    const link = screen.getByRole("link", { name: "View Deal d1" });
    expect(link).toHaveAttribute("href", "/deals/d1");
    expect(link).toContainElement(screen.getByText("Deal d1"));
  });

  it("shows the included product summary on the deal card", () => {
    render(<FeaturedDealsSectionBlock section={buildSection([buildDeal("d1")])} />);

    expect(screen.getByText("Product d1")).toBeInTheDocument();
  });

  it("marks out-of-stock deals with an availability badge", () => {
    render(
      <FeaturedDealsSectionBlock
        section={buildSection([{ ...buildDeal("d1"), isAvailable: false }])}
      />,
    );

    expect(screen.getByText("Out of stock")).toBeInTheDocument();
  });

  it("always shows the View All CTA when deals are present", () => {
    render(<FeaturedDealsSectionBlock section={buildSection([buildDeal("d1")])} />);

    const link = screen.getByRole("link", { name: "View all deals" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/deals");
  });

  it("hides the section entirely when no deals are available", () => {
    const { container } = render(<FeaturedDealsSectionBlock section={buildSection([])} />);

    // The section must not render at all (no empty state, no CTA, no carousel)
    // when there are no active deals.
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("No Featured Deals right now")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View all deals" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("carousel")).not.toBeInTheDocument();
  });

  it("caps carousel items at HOMEPAGE_CAROUSEL_MAX_ITEMS when there are more deals", () => {
    const deals = Array.from({ length: 12 }, (_, i) => buildDeal(`d${i + 1}`));
    render(<FeaturedDealsSectionBlock section={buildSection(deals)} />);

    expect(screen.getAllByTestId("carousel-item")).toHaveLength(HOMEPAGE_CAROUSEL_MAX_ITEMS);
  });

  it("applies responsive sizes to featured deal images", () => {
    render(
      <FeaturedDealsSectionBlock
        section={buildSection([
          {
            ...buildDeal("d-image"),
            imageUrl: "https://cdn.example.com/deals/d-image.jpg",
            imageAlt: "Deal d-image",
          },
        ])}
      />,
    );

    const image = screen.getByTestId("storefront-deal-card-image-d-image");
    expect(image).toHaveAttribute(
      "sizes",
      "(max-width: 639px) 85vw, (max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, (max-width: 1535px) 20vw, 17vw",
    );
  });
});
