// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SidebarProvider } from "@/components/ui/sidebar"
import { AdminSidebarNav } from "@/features/admin/components/admin-sidebar-nav"
import { getVisibleAdminNavigation } from "@/features/admin/navigation"
import { RoleKey } from "@/lib/auth/roles"

let mockedPathname = "/admin"

vi.mock("next/navigation", () => ({
  usePathname: () => mockedPathname,
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
afterEach(() => {
  cleanup()
  mockedPathname = "/admin"
})

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
  })
})

describe("AdminSidebarNav", () => {
  it("renders role-visible items and marks the active route", () => {
    mockedPathname = "/admin/orders"
    const items = getVisibleAdminNavigation(RoleKey.ORDER_MANAGER)

    render(
      <SidebarProvider defaultOpen>
        <AdminSidebarNav items={items} />
      </SidebarProvider>
    )

    const activeLink = screen.getByRole("link", { name: /orders/i })

    expect(activeLink).toHaveAttribute("aria-current", "page")
    expect(screen.queryByRole("link", { name: /settings/i })).not.toBeInTheDocument()
  })

  it("shows a user-friendly empty state when no nav items are provided", () => {
    render(
      <SidebarProvider defaultOpen>
        <AdminSidebarNav items={[]} />
      </SidebarProvider>
    )

    expect(screen.getByRole("status")).toHaveTextContent("No navigation items are available for this role yet.")
  })
})
