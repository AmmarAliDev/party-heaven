// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminShell } from "@/components/layout/admin-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
}));

vi.mock("next-auth/react", () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/auth/actions/sign-out", () => ({
  prepareSignOutAction: vi.fn().mockResolvedValue(undefined),
  signOutAction: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("max-width") ? false : true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
});

describe("AdminShell component layout and background styling", () => {
  const dummyUser = {
    id: "user-1",
    name: "Admin User",
    email: "admin@example.com",
    role: "ADMIN" as const,
  };

  it("renders admin shell container and sidebar with bg-background class", () => {
    const { container } = render(
      <AdminShell role="ADMIN" user={dummyUser}>
        <div>Admin Content</div>
      </AdminShell>
    );

    expect(screen.getByText("Admin Content")).toBeInTheDocument();
    expect(screen.getByText("Admin workspace")).toBeInTheDocument();
    expect(screen.getByText("Party Heaven Ops")).toBeInTheDocument();

    const sidebar = container.querySelector("div[aria-label='Admin navigation sidebar']");
    expect(sidebar).not.toBeNull();
    expect(sidebar).toHaveClass("bg-background");

    const mainWrapper = container.querySelector(".min-h-screen");
    expect(mainWrapper).toHaveClass("bg-background");
  });
});
