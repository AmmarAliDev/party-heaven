// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

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

vi.mock("@/features/catalog/components/search-dialog-trigger", () => ({
  SearchDialogTrigger: () => <div data-testid="search-dialog-trigger" />,
}));

vi.mock("@/components/layout/storefront-header-auth-controls", () => ({
  StorefrontHeaderAuthControls: () => <div data-testid="auth-controls" />,
}));

// The category navbar is covered by its own tests (app-navbar + carousel).
vi.mock("@/components/layout/app-navbar", () => ({
  default: () => <div data-testid="app-navbar" />,
}));

import { AppHeader } from "@/components/layout/app-header";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

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

async function renderHeader() {
  return render(await AppHeader());
}

describe("AppHeader upper section", () => {
  it("renders the skip link, logo, wishlist, cart, search, and auth controls", async () => {
    await renderHeader();

    expect(screen.getByRole("link", { name: "Skip to content" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: new RegExp(`${siteConfig.name} homepage`, "i") }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wishlist" })).toHaveAttribute(
      "href",
      routes.storefront.wishlist,
    );
    expect(screen.getByTestId("search-dialog-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("cart-drawer-trigger")).toBeInTheDocument();
    expect(screen.getAllByTestId("auth-controls").length).toBeGreaterThan(0);
  });

  it("keeps the dark header background on the upper section only, with the navbar below on the page background", async () => {
    const { container } = await renderHeader();

    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    expect(header!.className).toContain("bg-background");

    const darkStrip = header!.querySelector(".bg-background-header-footer");
    expect(darkStrip).not.toBeNull();

    // Logo + actions live inside the dark strip (rendered twice: mobile + desktop)…
    expect(within(darkStrip as HTMLElement).getAllByTestId("auth-controls").length).toBeGreaterThan(0);
    expect(
      within(darkStrip as HTMLElement).getByRole("link", { name: "Wishlist" }),
    ).toBeInTheDocument();

    // …while the navbar is a sibling that must NOT inherit the dark strip.
    expect(within(darkStrip as HTMLElement).queryByTestId("app-navbar")).not.toBeInTheDocument();
    expect(within(header as HTMLElement).getByTestId("app-navbar")).toBeInTheDocument();
  });
});
