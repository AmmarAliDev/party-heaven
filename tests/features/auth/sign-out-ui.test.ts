import React from "react";
import type * as ReactModule from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useStateMock = vi.hoisted(() => vi.fn());
const signOutActionMock = vi.hoisted(() => vi.fn());
const prepareSignOutActionMock = vi.hoisted(() => vi.fn());

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof ReactModule>("react");

  return {
    ...actual,
    useState: useStateMock,
  };
});

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href, ...props }, children),
}));

vi.mock("@/features/auth/actions/sign-out", () => ({
  prepareSignOutAction: prepareSignOutActionMock,
  signOutAction: signOutActionMock,
}));

describe("sign-out surfaces", () => {
  beforeEach(() => {
    useStateMock.mockImplementation((initialValue: unknown) => [initialValue === false ? true : initialValue, vi.fn()]);
    signOutActionMock.mockReset();
    prepareSignOutActionMock.mockReset();
  });

  it("shows a direct sign-out action in the mobile drawer for authenticated users", async () => {
    const { StorefrontMobileNav } = await import("@/components/layout/storefront-mobile-nav");

    const html = renderToStaticMarkup(
      React.createElement(StorefrontMobileNav, {
        navItems: [{ title: "Shop", href: "/shop" }],
        accountHref: "/account",
        wishlistHref: "/wishlist",
        isSignedIn: true,
        isAdmin: false,
      }),
    );

    expect(html).toContain("lucide-log-out");
    expect(html).not.toContain("Profile");
  });

  it("shows the account entry point when the user is signed out", async () => {
    const { StorefrontMobileNav } = await import("@/components/layout/storefront-mobile-nav");

    const html = renderToStaticMarkup(
      React.createElement(StorefrontMobileNav, {
        navItems: [{ title: "Shop", href: "/shop" }],
        accountHref: "/account",
        wishlistHref: "/wishlist",
        isSignedIn: false,
        isAdmin: false,
      }),
    );

    expect(html).toContain("Account");
  });
});
