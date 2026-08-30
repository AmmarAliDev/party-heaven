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

import {
  FEATURED_CATEGORIES_CAROUSEL_ITEM_CLASS,
  FEATURED_CATEGORIES_CAROUSEL_OPTIONS,
} from "@/features/homepage/components/featured-categories-carousel-config";
import { FeaturedCategoriesSectionBlock } from "@/features/homepage/components/featured-categories-section";
import {
  HOMEPAGE_CAROUSEL_ITEM_CLASS,
  HOMEPAGE_CAROUSEL_MAX_ITEMS,
  HOMEPAGE_CAROUSEL_OPTIONS,
} from "@/features/homepage/components/homepage-carousel-config";
import type { FeaturedCategoriesSection } from "@/features/homepage/types";

function buildCategory(
  id: string,
  overrides?: Partial<FeaturedCategoriesSection["categories"][number]>,
): FeaturedCategoriesSection["categories"][number] {
  return { id, name: `Category ${id}`, description: `Description ${id}`, href: `/categories/${id}`, ...overrides };
}

function buildSection(
  categories: FeaturedCategoriesSection["categories"],
  overrides?: Partial<FeaturedCategoriesSection>,
): FeaturedCategoriesSection {
  return {
    id: "featured-categories",
    kind: "featured-categories",
    title: "Featured categories",
    description: "Shop by category",
    categories,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("FeaturedCategoriesSectionBlock", () => {
  it("renders category cards inside carousel structure", () => {
    render(
      <FeaturedCategoriesSectionBlock
        section={buildSection([
          { id: "cat-1", name: "Home care", description: "Cleaning and essentials", href: "/categories/home-care" },
          { id: "cat-2", name: "Grocery", description: "Pantry basics", href: "/categories/grocery" },
        ])}
      />,
    );

    expect(screen.getByTestId("carousel")).toBeInTheDocument();
    expect(screen.getByText("Home care")).toBeInTheDocument();
    expect(screen.getByText("Grocery")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /browse .* category/i })).toHaveLength(2);
    expect(screen.getByText("Home care").closest("a")).toHaveAttribute("href", "/categories/home-care");
    expect(screen.getByText("Grocery").closest("a")).toHaveAttribute("href", "/categories/grocery");
  });

  it("does not render add-to-cart buttons on category cards", () => {
    render(
      <FeaturedCategoriesSectionBlock
        section={buildSection([
          { id: "cat-1", name: "Home care", description: "Cleaning and essentials", href: "/categories/home-care" },
        ])}
      />,
    );

    expect(screen.queryByRole("button", { name: /add to cart/i })).not.toBeInTheDocument();
  });

  it("renders a friendly empty state when categories are missing", () => {
    render(<FeaturedCategoriesSectionBlock section={buildSection([])} />);

    expect(screen.getByText("No featured categories yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse all categories" })).toBeInTheDocument();
    expect(screen.queryByTestId("carousel")).not.toBeInTheDocument();
  });

  it("caps carousel items at HOMEPAGE_CAROUSEL_MAX_ITEMS when there are more categories", () => {
    // Build 10 categories — only 8 should appear in the carousel.
    const categories = Array.from({ length: 10 }, (_, i) => buildCategory(`cat-${i + 1}`));
    render(<FeaturedCategoriesSectionBlock section={buildSection(categories)} />);

    expect(screen.getAllByTestId("carousel-item")).toHaveLength(HOMEPAGE_CAROUSEL_MAX_ITEMS);
  });

  it("renders the category image when cardImageUrl is present", () => {
    render(
      <FeaturedCategoriesSectionBlock
        section={buildSection([
          buildCategory("home-care", {
            slug: "home-care",
            cardImageUrl: "https://cdn.example.com/categories/home-care.jpg",
          }),
        ])}
      />,
    );

    expect(screen.getByTestId("storefront-category-card-image-home-care")).toBeInTheDocument();
    expect(screen.getByAltText("Category home-care")).toHaveAttribute(
      "src",
      expect.stringContaining(encodeURIComponent("https://cdn.example.com/categories/home-care.jpg")),
    );
    expect(screen.getByAltText("Category home-care")).toHaveAttribute(
      "sizes",
      "(max-width: 639px) 85vw, (max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw",
    );
    expect(screen.queryByTestId("storefront-category-card-fallback-home-care")).not.toBeInTheDocument();
  });

  it("renders the fallback artwork when category image data is missing", () => {
    render(
      <FeaturedCategoriesSectionBlock
        section={buildSection([
          buildCategory("home-care", {
            slug: "home-care",
          }),
        ])}
      />,
    );

    expect(screen.getByTestId("storefront-category-card-fallback-home-care")).toBeInTheDocument();
    expect(screen.queryByTestId("storefront-category-card-image-home-care")).not.toBeInTheDocument();
  });

  it("shows a View All link when categories are capped", () => {
    const categories = Array.from({ length: 10 }, (_, i) => buildCategory(`cat-${i + 1}`));
    render(<FeaturedCategoriesSectionBlock section={buildSection(categories)} />);

    expect(screen.getByRole("link", { name: /view all categories/i })).toBeInTheDocument();
  });

  it("shows a View All link with custom label when viewAllHref is provided", () => {
    const categories = Array.from({ length: 3 }, (_, i) => buildCategory(`cat-${i + 1}`));
    render(
      <FeaturedCategoriesSectionBlock
        section={buildSection(categories, {
          viewAllHref: "/categories",
          viewAllLabel: "Explore all",
        })}
      />,
    );

    const link = screen.getByRole("link", { name: "Explore all" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/categories");
  });

  it("does not show a View All link when categories are within the cap and no explicit viewAllHref", () => {
    const categories = Array.from({ length: 5 }, (_, i) => buildCategory(`cat-${i + 1}`));
    render(<FeaturedCategoriesSectionBlock section={buildSection(categories)} />);

    expect(screen.queryByRole("link", { name: /view all/i })).not.toBeInTheDocument();
  });

  it("applies featured categories carousel item class to each slide", () => {
    const categories = Array.from({ length: 2 }, (_, i) => buildCategory(`cat-${i + 1}`));
    render(<FeaturedCategoriesSectionBlock section={buildSection(categories)} />);

    const items = screen.getAllByTestId("carousel-item");
    for (const item of items) {
      expect(item).toHaveClass("basis-[85%]");
    }
  });
});

describe("homepage carousel config (shared)", () => {
  it("enforces start alignment and correct responsive basis classes", () => {
    expect(HOMEPAGE_CAROUSEL_OPTIONS).toMatchObject({ align: "start" });
    expect(HOMEPAGE_CAROUSEL_ITEM_CLASS).toContain("basis-[85%]");
    expect(HOMEPAGE_CAROUSEL_ITEM_CLASS).toContain("sm:basis-1/2");
    expect(HOMEPAGE_CAROUSEL_ITEM_CLASS).toContain("md:basis-1/3");
    expect(HOMEPAGE_CAROUSEL_ITEM_CLASS).toContain("xl:basis-1/4");
    expect(HOMEPAGE_CAROUSEL_ITEM_CLASS).toContain("2xl:basis-1/5!");
  });

  it("sets max items to 8", () => {
    expect(HOMEPAGE_CAROUSEL_MAX_ITEMS).toBe(8);
  });
});

describe("featured categories carousel config (legacy re-exports)", () => {
  it("re-uses shared options but keeps a roomier large-screen item class", () => {
    expect(FEATURED_CATEGORIES_CAROUSEL_OPTIONS).toBe(HOMEPAGE_CAROUSEL_OPTIONS);
    expect(FEATURED_CATEGORIES_CAROUSEL_ITEM_CLASS).toContain("basis-[85%]");
    expect(FEATURED_CATEGORIES_CAROUSEL_ITEM_CLASS).toContain("sm:basis-1/2");
    expect(FEATURED_CATEGORIES_CAROUSEL_ITEM_CLASS).toContain("md:basis-1/3");
    expect(FEATURED_CATEGORIES_CAROUSEL_ITEM_CLASS).toContain("xl:basis-1/4!");
    expect(FEATURED_CATEGORIES_CAROUSEL_ITEM_CLASS).toContain("2xl:basis-1/5!");
    expect(FEATURED_CATEGORIES_CAROUSEL_ITEM_CLASS).not.toBe(HOMEPAGE_CAROUSEL_ITEM_CLASS);
  });
});
