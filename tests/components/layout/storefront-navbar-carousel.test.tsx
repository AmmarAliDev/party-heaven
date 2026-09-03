// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { StorefrontNavbarCategory } from "@/components/layout/storefront-navbar-categories";

const embla = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const api = {
    canScrollPrev: () => false,
    canScrollNext: () => false,
    scrollPrev: vi.fn(),
    scrollNext: vi.fn(),
    on: vi.fn((_event: string, cb: () => void) => {
      listeners.add(cb);
      return api;
    }),
    off: vi.fn((_event: string, cb: () => void) => {
      listeners.delete(cb);
      return api;
    }),
  };
  return api;
});

vi.mock("embla-carousel-react", () => ({
  default: () => [() => {}, embla],
}));

vi.mock("embla-carousel-autoplay", () => ({
  default: () => ({
    play: vi.fn(),
    stop: vi.fn(),
    reset: vi.fn(),
    isPlaying: () => false,
  }),
}));

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt?: string }) => (
    <div data-testid="mock-image" aria-label={alt ?? ""} {...props} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import {
  __resetNavbarCategoryProductsCacheForTests,
  StorefrontNavbarCarousel,
} from "@/components/layout/storefront-navbar-carousel";

const items: StorefrontNavbarCategory[] = [
  {
    kind: "category",
    slug: "grocery",
    title: "Grocery",
    href: "/categories/grocery",
    cardImageUrl: "https://cdn.example.com/grocery.jpg",
    productCount: 12,
  },
  {
    kind: "category",
    slug: "home-care",
    title: "Home Care",
    href: "/categories/home-care",
    cardImageUrl: null,
    productCount: 3,
  },
  {
    kind: "all-categories",
    slug: "all-categories",
    title: "All Categories",
    href: "/categories",
    cardImageUrl: null,
    productCount: 0,
  },
];

const emptyProductsResponse = () => ({
  ok: true,
  json: async () => ({ products: [], pagination: { totalItems: 0 } }),
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("PointerEvent", class PointerEventMock extends MouseEvent {});

  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  window.HTMLElement.prototype.setPointerCapture = vi.fn();
});

beforeEach(() => {
  __resetNavbarCategoryProductsCacheForTests();
  embla.canScrollPrev = () => false;
  embla.canScrollNext = () => false;
  embla.scrollPrev.mockClear();
  embla.scrollNext.mockClear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("StorefrontNavbarCarousel rendering", () => {
  it("renders one pill per category", () => {
    render(<StorefrontNavbarCarousel items={items} />);

    const viewport = screen.getByTestId("navbar-category-viewport");
    expect(within(viewport).getAllByRole("listitem")).toHaveLength(items.length);

    expect(screen.getByRole("link", { name: "Browse Grocery" })).toHaveAttribute(
      "href",
      "/categories/grocery",
    );
    expect(screen.getByRole("link", { name: "Browse Home Care" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Products in Grocery" })).toBeInTheDocument();
  });

  it("sizes each slide per breakpoint (4 under sm, 5 from sm, auto on md+)", () => {
    render(<StorefrontNavbarCarousel items={items} />);

    const viewport = screen.getByTestId("navbar-category-viewport");
    const firstSlide = within(viewport).getAllByRole("listitem")[0];

    expect(firstSlide).toHaveClass("basis-1/4");
    expect(firstSlide).toHaveClass("sm:basis-1/5");
    expect(firstSlide).toHaveClass("md:basis-auto");
  });

  it("returns nothing when there are no items", () => {
    const { container } = render(<StorefrontNavbarCarousel items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("StorefrontNavbarCarousel arrows", () => {
  it("hides both arrows when nothing can scroll", () => {
    render(<StorefrontNavbarCarousel items={items} />);

    expect(screen.queryByRole("button", { name: /previous categories/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next categories/i })).not.toBeInTheDocument();
  });

  it("scrolls via the next arrow when more categories overflow", () => {
    embla.canScrollNext = () => true;
    render(<StorefrontNavbarCarousel items={items} />);

    const next = screen.getByRole("button", { name: /next categories/i });
    fireEvent.click(next);

    expect(embla.scrollNext).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /previous categories/i })).not.toBeInTheDocument();
  });

  it("scrolls via the previous arrow when available", () => {
    embla.canScrollPrev = () => true;
    render(<StorefrontNavbarCarousel items={items} />);

    const previous = screen.getByRole("button", { name: /previous categories/i });
    fireEvent.click(previous);

    expect(embla.scrollPrev).toHaveBeenCalledTimes(1);
  });
});

describe("StorefrontNavbarCarousel category product dropdown", () => {
  it("opens on hover and lazily loads the category products", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [
          {
            name: "Rice 5kg",
            href: "/categories/grocery/rice-5kg",
            price: 1250,
            imageUrl: "https://cdn.example.com/rice.jpg",
            imageTone: "amber",
          },
          {
            name: "Cooking Oil 1L",
            href: "/categories/grocery/cooking-oil-1l",
            price: 850,
            imageTone: "amber",
          },
        ],
        pagination: { totalItems: 12 },
      }),
    });

    render(<StorefrontNavbarCarousel items={items} />);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Products in Grocery" }));

    const menu = await screen.findByRole("menu");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/catalog/categories/grocery/products"),
    );
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("pageSize=8"));

    const productLink = await within(menu).findByRole("menuitem", { name: /rice 5kg/i });
    expect(productLink).toHaveAttribute("href", "/categories/grocery/rice-5kg");
    expect(within(menu).getByText(/rs\.\s*1,250/i)).toBeInTheDocument();

    // Footer appears because the category has more products than the fetch cap.
    expect(within(menu).getByRole("menuitem", { name: /view all 12 products/i })).toHaveAttribute(
      "href",
      "/categories/grocery",
    );
  });

  it("opens on click and shows an empty state when the category has no products", async () => {
    fetchMock.mockResolvedValue(emptyProductsResponse());

    render(<StorefrontNavbarCarousel items={items} />);

    fireEvent.click(screen.getByRole("button", { name: "Products in Home Care" }));

    const menu = await screen.findByRole("menu");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/catalog/categories/home-care/products"),
    );
    expect(await within(menu).findByText(/no products in home care yet/i)).toBeInTheDocument();
  });

  it("caches products per category so re-opening does not refetch", async () => {
    fetchMock.mockResolvedValue(emptyProductsResponse());

    const { unmount } = render(<StorefrontNavbarCarousel items={items} />);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Products in Grocery" }));
    await screen.findByRole("menu");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    unmount();
    cleanup();

    render(<StorefrontNavbarCarousel items={items} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Products in Grocery" }));
    await screen.findByRole("menu");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("StorefrontNavbarCarousel drag safety", () => {
  it("does not open a dropdown while dragging or from a drag-triggered click", async () => {
    fetchMock.mockResolvedValue(emptyProductsResponse());
    render(<StorefrontNavbarCarousel items={items} />);

    const viewport = screen.getByTestId("navbar-category-viewport");
    fireEvent.pointerDown(viewport, { clientX: 10, clientY: 4, button: 0 });
    fireEvent.pointerMove(viewport, { clientX: 70, clientY: 4, button: 0 });
    fireEvent.pointerUp(viewport, { clientX: 70, clientY: 4, button: 0 });

    const trigger = screen.getByRole("button", { name: "Products in Grocery" });

    // Still within the drag window: hover and click must be ignored.
    fireEvent.mouseEnter(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    // After the drag settles, hover opens the dropdown again.
    await new Promise((resolve) => setTimeout(resolve, 150));
    fireEvent.mouseEnter(trigger);

    await waitFor(() => expect(screen.getByRole("menu")).toBeInTheDocument());
  });
});
