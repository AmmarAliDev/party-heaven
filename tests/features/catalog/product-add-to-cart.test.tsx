// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as ClientCartEvents from "@/features/cart/client-events";

const notifySuccessMock = vi.fn();
const notifyErrorMock = vi.fn();
const dispatchCartChangedMock = vi.fn();

type TestCartItem = {
  id: string;
  productSlug: string;
  sku: string;
  productName?: string;
  quantity?: number;
  availableQuantity?: number;
  optionLabel?: string | null;
};

function createCartPayload(items: TestCartItem[], itemCount = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0)) {
  return {
    id: "cart-1",
    token: "guest-token",
    itemCount,
    subtotal: 100,
    items: items.map((item) => ({
      id: item.id,
      productName: item.productName ?? "Surface Cleaner",
      productSlug: item.productSlug,
      categorySlug: "cleaners",
      sku: item.sku,
      optionLabel: item.optionLabel ?? null,
      quantity: item.quantity ?? 1,
      unitPrice: 100,
      compareAtPrice: null,
      lineSubtotal: 100,
      availableQuantity: item.availableQuantity ?? 10,
      href: `/categories/cleaners/${item.productSlug}`,
    })),
  };
}

function mockCartFetchFlow({
  initialCart,
  postCart,
}: {
  initialCart: ReturnType<typeof createCartPayload> | null;
  postCart?: ReturnType<typeof createCartPayload> | null;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/cart" && (init?.method === "GET" || typeof init?.method === "undefined")) {
        return {
          ok: true,
          json: async () => ({ cart: initialCart }),
        };
      }

      if (url === "/api/cart" && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({ cart: postCart ?? initialCart }),
        };
      }

      return {
        ok: false,
        json: async () => ({ error: "Unexpected request" }),
      };
    }),
  );
}

vi.mock("@/lib/notify", () => ({
  notify: {
    success: notifySuccessMock,
    error: notifyErrorMock,
  },
}));

vi.mock("@/features/cart/client-events", async (importOriginal) => {
  const actual = await importOriginal<typeof ClientCartEvents>();

  return {
    ...actual,
    dispatchCartChanged: (...args: Parameters<typeof actual.dispatchCartChanged>) => {
      dispatchCartChangedMock(...args);
      actual.dispatchCartChanged(...args);
    },
  };
});

describe("product add-to-cart", () => {
  beforeEach(() => {
    notifySuccessMock.mockReset();
    notifyErrorMock.mockReset();
    dispatchCartChangedMock.mockReset();

    mockCartFetchFlow({ initialCart: null, postCart: null });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not show a toast when adding to cart", async () => {
    const user = userEvent.setup();
    const { ProductAddToCart } = await import("@/features/catalog/components/product-add-to-cart");

    render(
      <ProductAddToCart
        productSlug="surface-cleaner"
        optionId={undefined}
        sku="surface-cleaner-default"
        productName="Surface Cleaner"
        isAvailable={true}
      />,
    );

    await user.click(screen.getByRole("button", { name: /add to cart/i }));

    await waitFor(() => {
      expect(dispatchCartChangedMock).toHaveBeenCalledTimes(1);
    });

    expect(notifySuccessMock).not.toHaveBeenCalled();
    expect(notifyErrorMock).not.toHaveBeenCalled();
  });

  it("switches from add-to-cart button to quantity controls after add", async () => {
    const user = userEvent.setup();
    const { ProductAddToCart } = await import("@/features/catalog/components/product-add-to-cart");

    mockCartFetchFlow({
      initialCart: createCartPayload([], 0),
      postCart: createCartPayload([
        {
          id: "line-1",
          productSlug: "surface-cleaner",
          sku: "surface-cleaner-default",
          quantity: 1,
        },
      ], 1),
    });

    render(
      <ProductAddToCart
        productSlug="surface-cleaner"
        optionId={undefined}
        sku="surface-cleaner-default"
        productName="Surface Cleaner"
        isAvailable={true}
      />,
    );

    await user.click(screen.getByRole("button", { name: /add to cart/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /add to cart/i })).not.toBeInTheDocument();
      expect(screen.getByTestId("storefront-in-cart-quantity-controls")).toBeInTheDocument();
    });
  });

  it("renders variant-aware quantity controls when matching sku is already in cart", async () => {
    const { ProductAddToCart } = await import("@/features/catalog/components/product-add-to-cart");

    mockCartFetchFlow({
      initialCart: createCartPayload(
        [
          {
            id: "line-2",
            productSlug: "surface-cleaner",
            sku: "surface-cleaner-default",
            quantity: 2,
            availableQuantity: 8,
          },
          {
            id: "line-3",
            productSlug: "surface-cleaner",
            sku: "surface-cleaner-alt-variant",
            quantity: 1,
          },
        ],
        3,
      ),
    });

    render(
      <ProductAddToCart
        productSlug="surface-cleaner"
        optionId={undefined}
        sku="surface-cleaner-default"
        productName="Surface Cleaner"
        isAvailable={true}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("storefront-in-cart-quantity-controls")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /add to cart/i })).not.toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /increase quantity for surface cleaner/i })).toBeInTheDocument();
    });
  });

  it("reverts back to add-to-cart button when product is removed from cart", async () => {
    const { ProductAddToCart } = await import("@/features/catalog/components/product-add-to-cart");
    const { CART_CHANGED_EVENT } = await import("@/features/cart/client-events");

    mockCartFetchFlow({
      initialCart: createCartPayload([
        {
          id: "line-4",
          productSlug: "surface-cleaner",
          sku: "surface-cleaner-default",
          quantity: 1,
        },
      ]),
    });

    render(
      <ProductAddToCart
        productSlug="surface-cleaner"
        optionId={undefined}
        sku="surface-cleaner-default"
        productName="Surface Cleaner"
        isAvailable={true}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("storefront-in-cart-quantity-controls")).toBeInTheDocument();
    });

    window.dispatchEvent(
      new CustomEvent(CART_CHANGED_EVENT, {
        detail: {
          cart: createCartPayload([], 0),
        },
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add to cart/i })).toBeInTheDocument();
      expect(screen.queryByTestId("storefront-in-cart-quantity-controls")).not.toBeInTheDocument();
    });
  });

  it("updates cart count badge from cart:changed payloads", async () => {
    const { ProductAddToCart } = await import("@/features/catalog/components/product-add-to-cart");
    const { CART_CHANGED_EVENT } = await import("@/features/cart/client-events");

    mockCartFetchFlow({
      initialCart: createCartPayload([
        {
          id: "line-5",
          productSlug: "surface-cleaner",
          sku: "surface-cleaner-default",
          quantity: 1,
        },
      ], 1),
    });

    render(
      <ProductAddToCart
        productSlug="surface-cleaner"
        optionId={undefined}
        sku="surface-cleaner-default"
        productName="Surface Cleaner"
        isAvailable={true}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("1 item in cart")).toBeInTheDocument();
      expect(screen.getByTestId("storefront-view-cart-button")).toBeInTheDocument();
    });

    window.dispatchEvent(
      new CustomEvent(CART_CHANGED_EVENT, {
        detail: {
          cart: createCartPayload([
            {
              id: "line-5",
              productSlug: "surface-cleaner",
              sku: "surface-cleaner-default",
              quantity: 2,
            },
            {
              id: "line-6",
              productSlug: "other-product",
              sku: "other-product-default",
              quantity: 3,
            },
          ], 5),
        },
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("5 items in cart")).toBeInTheDocument();
    });
  });
});
