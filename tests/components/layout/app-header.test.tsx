// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const mockGetCatalogCategories = vi.hoisted(() => vi.fn());

vi.mock("@/features/catalog", () => ({
  getCatalogCategories: (...args: unknown[]) => mockGetCatalogCategories(...args),
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

vi.mock("@/features/cart/components/cart-drawer-trigger", () => ({
  CartDrawerTrigger: () => <div data-testid="cart-drawer-trigger" />,
}));

vi.mock("@/features/cart/components/mobile-cart-button", () => ({
  MobileCartButton: () => <div data-testid="mobile-cart-button" />,
}));

vi.mock("@/components/layout/storefront-header-auth-controls", () => ({
  StorefrontHeaderAuthControls: () => <div data-testid="auth-controls" />,
}));

import { AppHeader } from "@/components/layout/app-header";

const categories = [
  {
    id: "party-heaven",
    name: "Party Heaven",
    slug: "party-heaven",
    description: "Virtual party heaven category",
    productCount: 4,
    href: "/categories/party-heaven",
  },
  {
    id: "home-care",
    name: "Home Care",
    slug: "home-care",
    description: "Cleaning and household essentials",
    productCount: 18,
    href: "/categories/home-care",
  },
  {
    id: "grocery",
    name: "Grocery",
    slug: "grocery",
    description: "Pantry staples",
    productCount: 22,
    href: "/categories/grocery",
  },
  {
    id: "personal-care",
    name: "Personal Care",
    slug: "personal-care",
    description: "Daily hygiene",
    productCount: 12,
    href: "/categories/personal-care",
  },
  {
    id: "cleaning-supplies",
    name: "Cleaning Supplies",
    slug: "cleaning-supplies",
    description: "Household cleaning",
    productCount: 9,
    href: "/categories/cleaning-supplies",
  },
  {
    id: "kitchen-dining",
    name: "Kitchen & Dining",
    slug: "kitchen-dining",
    description: "Cookware and dining",
    productCount: 14,
    href: "/categories/kitchen-dining",
  },
  {
    id: "baby-care",
    name: "Baby Care",
    slug: "baby-care",
    description: "Baby essentials",
    productCount: 8,
    href: "/categories/baby-care",
  },
  {
    id: "pet-supplies",
    name: "Pet Supplies",
    slug: "pet-supplies",
    description: "Pet essentials",
    productCount: 6,
    href: "/categories/pet-supplies",
  },
];

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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function storefrontNav() {
  return screen.getByRole("navigation", { name: "Storefront" });
}

async function renderHeader() {
  mockGetCatalogCategories.mockResolvedValue(categories);
  render(await AppHeader());
}

async function openMoreMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /more storefront navigation/i }));
  return user;
}

describe("AppHeader storefront navigation", () => {
  it("renders categories directly in the navbar", async () => {
    await renderHeader();

    const nav = storefrontNav();

    // Direct category links: Party Heaven first, then alphabetically up to the cap (NAVBAR_DIRECT_CATEGORY_LIMIT = 6).
    for (const [title, href] of [
      ["Party Heaven", "/categories/party-heaven"],
      ["Baby Care", "/categories/baby-care"],
      ["Cleaning Supplies", "/categories/cleaning-supplies"],
      ["Grocery", "/categories/grocery"],
      ["Home Care", "/categories/home-care"],
      ["Kitchen & Dining", "/categories/kitchen-dining"],
    ]) {
      const link = within(nav).getByRole("link", { name: title });
      expect(link).toHaveAttribute("href", href);
    }
  });

  it("renders More as the last navbar option", async () => {
    await renderHeader();

    const nav = storefrontNav();
    const listItems = within(nav).getAllByRole("listitem");

    expect(listItems.at(-1)).toHaveTextContent("More");
    expect(listItems.at(-1)).not.toHaveTextContent("Categories");
  });

  it("puts remaining categories inside the More dropdown", async () => {
    await renderHeader();

    await openMoreMenu();

    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Personal Care" })).toHaveAttribute(
      "href",
      "/categories/personal-care",
    );
    expect(within(menu).getByRole("menuitem", { name: "Pet Supplies" })).toHaveAttribute(
      "href",
      "/categories/pet-supplies",
    );
  });

  it("renders All Categories as the final dropdown item linking to the categories page", async () => {
    await renderHeader();

    await openMoreMenu();

    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem");

    const lastItem = items.at(-1);
    expect(lastItem).toHaveTextContent("All Categories");
    expect(lastItem).toHaveAttribute("href", "/categories");
  });

  it("avoids duplicate navigation links between the navbar and More dropdown", async () => {
    await renderHeader();

    const nav = storefrontNav();
    const navbarHrefs = within(nav)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    await openMoreMenu();

    const menu = await screen.findByRole("menu");
    const moreHrefs = within(menu)
      .getAllByRole("menuitem")
      .map((item) => item.getAttribute("href"));

    navbarHrefs.forEach((href) => {
      expect(moreHrefs).not.toContain(href);
    });
  });
});
