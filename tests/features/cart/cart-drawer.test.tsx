// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  __resetCartDrawerStateForTests,
  openCartDrawer,
} from "@/features/cart/cart-drawer-state";

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ open, children }: { open?: boolean; children: ReactNode }) =>
    open ? <div data-testid="cart-drawer">{children}</div> : null,
  DrawerClose: ({ children, ...props }: { children: ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  DrawerContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DrawerDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function createCart() {
  return {
    id: "cart-1",
    token: "guest-token",
    itemCount: 1,
    subtotal: 150,
    items: [
      {
        id: "item-1",
        productName: "Snow Spray Large",
        productSlug: "snow-spray-large",
        categorySlug: "decorations",
        sku: "SS-500",
        optionLabel: null,
        quantity: 1,
        unitPrice: 150,
        compareAtPrice: null,
        lineSubtotal: 150,
        availableQuantity: 50,
        href: "/categories/decorations/snow-spray-large",
      },
    ],
    dealItems: [],
  };
}

function mockCartFetch(cart: ReturnType<typeof createCart> | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, cart }),
    }),
  );
}

describe("cart drawer", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    __resetCartDrawerStateForTests();
  });

  it("renders header, line items with adjust/remove controls, and footer actions", async () => {
    mockCartFetch(createCart());

    const { CartDrawer } = await import("@/features/cart/components/cart-drawer");
    render(<CartDrawer />);

    act(() => openCartDrawer());

    expect(await screen.findByRole("heading", { name: "Shopping Cart" })).toBeInTheDocument();
    expect(await screen.findByText("Snow Spray Large")).toBeInTheDocument();

    // Line item thumbnail (placeholder shown when cart item has no image)
    expect(
      screen.getByRole("img", { name: "Snow Spray Large image placeholder" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "View full cart" })).toHaveAttribute("href", "/cart");
    expect(screen.getByRole("link", { name: "Checkout" })).toHaveAttribute("href", "/checkout");

    // Adjust + remove controls per item
    expect(
      screen.getByRole("button", { name: /decrease quantity for snow spray large/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /increase quantity for snow spray large/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /remove snow spray large from cart/i }),
    ).toBeInTheDocument();
  });

  it("shows an empty state and no footer actions when the cart is empty", async () => {
    mockCartFetch(null);

    const { CartDrawer } = await import("@/features/cart/components/cart-drawer");
    render(<CartDrawer />);

    act(() => openCartDrawer());

    expect(await screen.findByText("Cart is empty")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse products" })).toHaveAttribute(
      "href",
      "/categories",
    );
    expect(screen.queryByRole("link", { name: "View full cart" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Checkout" })).not.toBeInTheDocument();
  });

  it("disables checkout when an item exceeds available stock", async () => {
    const cart = createCart();
    cart.items[0]!.quantity = 5;
    cart.items[0]!.availableQuantity = 2;
    mockCartFetch(cart);

    const { CartDrawer } = await import("@/features/cart/components/cart-drawer");
    render(<CartDrawer />);

    act(() => openCartDrawer());

    expect(
      await screen.findByText(/requested quantity exceeds available stock/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Checkout" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Checkout" })).not.toBeInTheDocument();
  });

  it("shows a retryable error state when the cart API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Could not load your cart right now." }),
      }),
    );

    const { CartDrawer } = await import("@/features/cart/components/cart-drawer");
    render(<CartDrawer />);

    act(() => openCartDrawer());

    expect(await screen.findByText("Cart is unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry cart" })).toBeInTheDocument();
  });
});
