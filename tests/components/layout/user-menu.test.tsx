// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
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

import UserMenu from "@/components/layout/user-menu";
import { routes } from "@/config/routes";
import type { NavItem } from "@/types/app";

const pageNavItems: NavItem[] = [
  { title: "Home", href: routes.storefront.home, description: "Storefront landing page." },
  { title: "About", href: routes.storefront.about, description: "Company story and mission." },
  { title: "Blog", href: routes.storefront.blog, description: "Storefront blog and buying guides." },
  { title: "Contact", href: routes.storefront.contact, description: "Customer contact page." },
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

async function openMenu() {
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", { name: /open user and navigation menu/i });
  await user.click(trigger);
  return user;
}

describe("UserMenu", () => {
  it("keeps Home, About, Blog, and Contact inside the user menu", async () => {
    render(<UserMenu isSignedIn={false} isAdmin={false} navItems={pageNavItems} />);

    await openMenu();

    const menu = screen.getByRole("menu");

    for (const item of pageNavItems) {
      const link = within(menu).getByRole("menuitem", { name: item.title });
      expect(link).toHaveAttribute("href", item.href);
    }
  });

  it("preserves the account entry point for signed-out users", async () => {
    render(<UserMenu isSignedIn={false} isAdmin={false} navItems={pageNavItems} />);

    await openMenu();

    const menu = screen.getByRole("menu");
    const signInLink = within(menu).getByRole("menuitem", { name: /sign in/i });
    expect(signInLink).toHaveAttribute("href", routes.storefront.account);
  });

  it("preserves account and admin panel links for authenticated admins", async () => {
    render(<UserMenu isSignedIn={true} isAdmin={true} navItems={pageNavItems} />);

    await openMenu();

    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: /admin panel/i })).toHaveAttribute(
      "href",
      routes.admin.dashboard,
    );
    expect(within(menu).getByRole("menuitem", { name: /account/i })).toHaveAttribute(
      "href",
      routes.storefront.account,
    );
    expect(within(menu).getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("does not show admin-only controls for non-admin users", async () => {
    render(<UserMenu isSignedIn={true} isAdmin={false} navItems={pageNavItems} />);

    await openMenu();

    expect(screen.queryByRole("menuitem", { name: /admin panel/i })).not.toBeInTheDocument();
  });

  it("shows Your Orders before sign-out for authenticated users", async () => {
    render(<UserMenu isSignedIn={true} isAdmin={false} navItems={pageNavItems} />);

    await openMenu();

    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: /your orders/i })).toHaveAttribute(
      "href",
      routes.storefront.accountOrders,
    );
    expect(within(menu).getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("hides Your Orders for signed-out users", async () => {
    render(<UserMenu isSignedIn={false} isAdmin={false} navItems={pageNavItems} />);

    await openMenu();

    expect(screen.queryByRole("menuitem", { name: /your orders/i })).not.toBeInTheDocument();
  });
});
