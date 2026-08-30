// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/features/auth/components/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

import { StorefrontMobileNav } from "@/components/layout/storefront-mobile-nav";
import { routes } from "@/config/routes";

const navItems = [
  { title: "Home", href: "/", description: "Storefront landing page." },
  { title: "About", href: "/about", description: "Company story and mission." },
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

async function openDrawer() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /open navigation menu/i }));
  return user;
}

describe("StorefrontMobileNav", () => {
  it("renders page nav items inside the mobile drawer", async () => {
    render(
      <StorefrontMobileNav
        navItems={navItems}
        accountHref="/account"
        wishlistHref="/wishlist"
        isSignedIn={false}
        isAdmin={false}
      />,
    );

    await openDrawer();

    for (const item of navItems) {
      expect(screen.getByRole("link", { name: item.title })).toHaveAttribute("href", item.href);
    }
  });

  it("no longer lists catalog categories inside the mobile drawer", async () => {
    render(
      <StorefrontMobileNav
        navItems={navItems}
        accountHref="/account"
        wishlistHref="/wishlist"
        isSignedIn={false}
        isAdmin={false}
      />,
    );

    await openDrawer();

    // Categories now live on the desktop navbar / mobile bottom nav, not the drawer.
    expect(screen.queryByText("Party Heaven")).not.toBeInTheDocument();
    expect(screen.queryByText("All Categories")).not.toBeInTheDocument();
  });

  it("exposes wishlist and account actions for signed-out users", async () => {
    render(
      <StorefrontMobileNav
        navItems={navItems}
        accountHref="/account"
        wishlistHref="/wishlist"
        isSignedIn={false}
        isAdmin={false}
      />,
    );

    await openDrawer();

    expect(screen.getByRole("link", { name: /wishlist/i })).toHaveAttribute("href", "/wishlist");
    expect(screen.getByRole("link", { name: /account/i })).toHaveAttribute("href", "/account");
  });

  it("shows Your Orders for signed-in users (hidden for guests)", async () => {
    render(
      <StorefrontMobileNav
        navItems={navItems}
        accountHref="/account"
        wishlistHref="/wishlist"
        isSignedIn={true}
        isAdmin={false}
      />,
    );

    await openDrawer();

    expect(screen.getByRole("link", { name: /your orders/i })).toHaveAttribute(
      "href",
      routes.storefront.accountOrders,
    );
  });

  it("shows Admin Panel for admins and hides it for non-admins", async () => {
    render(
      <StorefrontMobileNav
        navItems={navItems}
        accountHref="/account"
        wishlistHref="/wishlist"
        isSignedIn={true}
        isAdmin={true}
      />,
    );

    await openDrawer();

    expect(screen.getByRole("link", { name: /admin panel/i })).toHaveAttribute(
      "href",
      routes.admin.dashboard,
    );
  });
});
