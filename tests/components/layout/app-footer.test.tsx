// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockGetCatalogCategories = vi.hoisted(() => vi.fn());

vi.mock("@/features/catalog", () => ({
  getCatalogCategories: (...args: unknown[]) => mockGetCatalogCategories(...args),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { AppFooter } from "@/components/layout/app-footer";

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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function renderFooter() {
  mockGetCatalogCategories.mockResolvedValue(categories);
  render(await AppFooter());
}

describe("AppFooter", () => {
  it("renders the four footer columns with their headings", async () => {
    await renderFooter();

    for (const headingName of ["Quick Links", "Help", "Policies", "Contact"]) {
      const heading = screen.getByRole("heading", { name: headingName });
      expect(heading).toBeInTheDocument();
      // Responsive heading: small on mobile, larger from the md breakpoint up.
      expect(within(heading).getByText(headingName)).toHaveClass("text-sm", "md:text-xl");
    }
  });

  it("renders up to six quick link categories plus a View All action", async () => {
    await renderFooter();

    const quickLinksNav = screen.getByRole("navigation", { name: "Quick Links links" });
    const quickLinkItems = quickLinksNav.querySelectorAll("a[href^='/categories/']");

    // Party Heaven first, then categories alphabetically, capped at NAVBAR_DIRECT_CATEGORY_LIMIT = 6.
    expect(quickLinkItems).toHaveLength(6);
    expect(quickLinkItems[0]).toHaveTextContent("Party Heaven");
    expect(quickLinkItems[1]).toHaveTextContent("Baby Care");
    expect(quickLinkItems[2]).toHaveTextContent("Cleaning Supplies");
    expect(quickLinkItems[3]).toHaveTextContent("Grocery");
    expect(quickLinkItems[4]).toHaveTextContent("Home Care");
    expect(quickLinkItems[5]).toHaveTextContent("Kitchen & Dining");

    // Column links use the muted footer link styling.
    expect(quickLinkItems[0]).toHaveClass("text-muted", "hover:text-muted-foreground");

    // View All is a ghost text-link (buttonVariants base + transparent hover, no border).
    const viewAll = screen.getByRole("link", { name: "View All" });
    expect(viewAll).toHaveAttribute("href", "/categories");
    expect(viewAll).toHaveClass("inline-flex", "hover:bg-transparent");
  });

  it("renders Help links", async () => {
    await renderFooter();

    expect(screen.getByRole("link", { name: "About us" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: "Contact us" })).toHaveAttribute("href", "/contact");
    expect(screen.getByRole("link", { name: "Your Orders" })).toHaveAttribute("href", "/account/orders");
  });

  it("renders Policies links", async () => {
    await renderFooter();

    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Refund Policy" })).toHaveAttribute("href", "/return-policy");
    expect(screen.getByRole("link", { name: "Shipping Policy" })).toHaveAttribute("href", "/shipping-policy");
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
  });

  it("renders Contact details with blank email and phone placeholders", async () => {
    await renderFooter();

    expect(screen.getByText("Email:")).toBeInTheDocument();
    expect(screen.getByText("Phone:")).toBeInTheDocument();
    expect(screen.getByText("Email:").parentElement).toHaveTextContent("—");
    expect(screen.getByText("Phone:").parentElement).toHaveTextContent("—");
  });

  it("collapses and expands columns on mobile via the heading toggle", async () => {
    const user = userEvent.setup();
    await renderFooter();

    const helpContent = document.getElementById("footer-help-content");
    const toggle = screen.getByRole("button", { name: "Toggle Help" });

    // Collapsed by default on mobile (hidden), expanded on desktop via md:block.
    expect(helpContent).toHaveClass("hidden");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(helpContent).not.toHaveClass("hidden");
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await user.click(toggle);

    expect(helpContent).toHaveClass("hidden");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps footer content visible on desktop regardless of mobile collapse state", async () => {
    await renderFooter();

    const helpContent = document.getElementById("footer-help-content");

    // md:block is always applied so the column stays visible at the md breakpoint.
    expect(helpContent).toHaveClass("md:block");
    expect(helpContent).toHaveClass("hidden");
  });
});
