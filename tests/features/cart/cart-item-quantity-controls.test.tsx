// @vitest-environment jsdom

import { cleanup,fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach,beforeEach, describe, expect, it, vi } from "vitest";

import { CartItemQuantityControls } from "@/features/cart/components/cart-item-quantity-controls";

// Mock the cart client events
vi.mock("@/features/cart/client-events", () => ({
  dispatchCartChanged: vi.fn(),
}));

// Mock the notify module
vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Import mocked functions after defining the mocks
import { notify } from "@/lib/notify";

describe("CartItemQuantityControls", () => {
  const mockFetchResponse = (data: unknown, ok = true) => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok,
        json: () => Promise.resolve(data),
      }),
    ) as unknown as typeof fetch;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("rendering", () => {
    it("renders with current quantity in editable input field", () => {
      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={3}
          availableQuantity={10}
        />,
      );

      const input = screen.getByRole("spinbutton", {
        name: /Quantity for Test Product/i,
      }) as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toBe("3");
      expect(input).toHaveAttribute("type", "number");
      expect(input).toHaveAttribute("min", "1");
      expect(input).toHaveAttribute("max", "10");
    });

    it("renders plus and minus buttons alongside input", () => {
      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={2}
          availableQuantity={10}
        />,
      );

      expect(screen.getByLabelText(/Decrease quantity/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Increase quantity/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Remove/i)).toBeInTheDocument();
    });

    it("disables decrease button when quantity is 1", () => {
      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={1}
          availableQuantity={10}
        />,
      );

      expect(screen.getByLabelText(/Decrease quantity/i)).toBeDisabled();
    });

    it("disables increase button when quantity equals available quantity", () => {
      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={5}
          availableQuantity={5}
        />,
      );

      expect(screen.getByLabelText(/Increase quantity/i)).toBeDisabled();
    });

    it("updates input when quantity prop changes", () => {
      const { rerender } = render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={2}
          availableQuantity={10}
        />,
      );

      let input = screen.getByRole("spinbutton", {
        name: /Quantity for Test Product/i,
      }) as HTMLInputElement;
      expect(input.value).toBe("2");

      rerender(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={5}
          availableQuantity={10}
        />,
      );

      input = screen.getByRole("spinbutton", {
        name: /Quantity for Test Product/i,
      }) as HTMLInputElement;
      expect(input.value).toBe("5");
    });
  });

  describe("plus button interaction", () => {
    it("increments quantity when plus button is clicked", async () => {
      mockFetchResponse({
        cart: {
          itemCount: 5,
          items: [
            {
              id: "item-1",
              productName: "Test Product",
              quantity: 4,
              availableQuantity: 10,
            },
          ],
        },
      });

      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={3}
          availableQuantity={10}
        />,
      );

      const plusButton = screen.getByLabelText(/Increase quantity/i);
      fireEvent.click(plusButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/cart", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartItemId: "item-1", quantity: 4 }),
        });
      });

      // Success mutations are silent — no success toast.
      expect(notify.success).not.toHaveBeenCalled();
    });

    it("does not increment beyond available quantity", () => {
      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={10}
          availableQuantity={10}
        />,
      );

      const plusButton = screen.getByLabelText(/Increase quantity/i);
      expect(plusButton).toBeDisabled();
    });
  });

  describe("minus button interaction", () => {
    it("decrements quantity when minus button is clicked", async () => {
      mockFetchResponse({
        cart: {
          itemCount: 3,
          items: [
            {
              id: "item-1",
              productName: "Test Product",
              quantity: 2,
              availableQuantity: 10,
            },
          ],
        },
      });

      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={3}
          availableQuantity={10}
        />,
      );

      const minusButton = screen.getByLabelText(/Decrease quantity/i);
      fireEvent.click(minusButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/cart", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartItemId: "item-1", quantity: 2 }),
        });
      });

      // Success mutations are silent — no success toast.
      expect(notify.success).not.toHaveBeenCalled();
    });

    it("does not decrement below 1", () => {
      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={1}
          availableQuantity={10}
        />,
      );

      const minusButton = screen.getByLabelText(/Decrease quantity/i);
      expect(minusButton).toBeDisabled();
    });
  });

  describe("direct input interaction", () => {
    it("commits valid input on blur", async () => {
      mockFetchResponse({
        cart: {
          itemCount: 7,
          items: [
            {
              id: "item-1",
              productName: "Test Product",
              quantity: 7,
              availableQuantity: 10,
            },
          ],
        },
      });

      const user = userEvent.setup();
      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={3}
          availableQuantity={10}
        />,
      );

      const input = screen.getByRole("spinbutton", {
        name: /Quantity for Test Product/i,
      }) as HTMLInputElement;

      await user.clear(input);
      await user.type(input, "7");

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      fireEvent.blur(input);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/cart", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartItemId: "item-1", quantity: 7 }),
        });
      });

      // Success mutations are silent — no success toast.
      expect(notify.success).not.toHaveBeenCalled();
    });

    it("does not flag input that exceeds allowed max while typing", async () => {
      global.fetch = vi.fn() as unknown as typeof fetch;

      const user = userEvent.setup();
      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={3}
          availableQuantity={10}
        />,
      );

      const input = screen.getByRole("spinbutton", {
        name: /Quantity for Test Product/i,
      }) as HTMLInputElement;

      await user.clear(input);
      await user.type(input, "50");

      expect(
        screen.queryByText("Please enter a quantity between 1 and 10."),
      ).not.toBeInTheDocument();
      expect(input).not.toHaveAttribute("aria-invalid");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("keeps previous value and does not update for float input on blur", async () => {
      global.fetch = vi.fn() as unknown as typeof fetch;

      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={3}
          availableQuantity={10}
        />,
      );

      const input = screen.getByRole("spinbutton", {
        name: /Quantity for Test Product/i,
      }) as HTMLInputElement;

      fireEvent.change(input, { target: { value: "3.5" } });
      fireEvent.blur(input);

      expect(input.value).toBe("3");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("keeps previous value and does not update for non-integer input on blur", async () => {
      global.fetch = vi.fn() as unknown as typeof fetch;

      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={3}
          availableQuantity={10}
        />,
      );

      const input = screen.getByRole("spinbutton", {
        name: /Quantity for Test Product/i,
      }) as HTMLInputElement;

      fireEvent.change(input, { target: { value: "abc" } });
      fireEvent.blur(input);

      expect(input.value).toBe("3");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("commits valid input on Enter key", async () => {
      mockFetchResponse({
        cart: {
          itemCount: 5,
          items: [
            {
              id: "item-1",
              productName: "Test Product",
              quantity: 5,
              availableQuantity: 10,
            },
          ],
        },
      });

      const user = userEvent.setup();
      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={3}
          availableQuantity={10}
        />,
      );

      const input = screen.getByRole("spinbutton", {
        name: /Quantity for Test Product/i,
      }) as HTMLInputElement;

      await user.clear(input);
      await user.type(input, "5");
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/cart", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartItemId: "item-1", quantity: 5 }),
        });
      });

      // Success mutations are silent — no success toast.
      expect(notify.success).not.toHaveBeenCalled();
    });

    it("clamps zero to minimum quantity and commits on blur", async () => {
      mockFetchResponse({
        cart: {
          itemCount: 1,
          items: [
            {
              id: "item-1",
              productName: "Test Product",
              quantity: 1,
              availableQuantity: 10,
            },
          ],
        },
      });

      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={3}
          availableQuantity={10}
        />,
      );

      const input = screen.getByRole("spinbutton", {
        name: /Quantity for Test Product/i,
      }) as HTMLInputElement;

      fireEvent.change(input, { target: { value: "0" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/cart", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartItemId: "item-1", quantity: 1 }),
        });
      });

      // Success mutations are silent — no success toast.
      expect(notify.success).not.toHaveBeenCalled();
    });

    it("clamps too-high input to available max and commits on blur", async () => {
      mockFetchResponse({
        cart: {
          itemCount: 10,
          items: [
            {
              id: "item-1",
              productName: "Test Product",
              quantity: 10,
              availableQuantity: 10,
            },
          ],
        },
      });

      const user = userEvent.setup();
      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={3}
          availableQuantity={10}
        />,
      );

      const input = screen.getByRole("spinbutton", {
        name: /Quantity for Test Product/i,
      }) as HTMLInputElement;

      await user.clear(input);
      await user.type(input, "50");
      fireEvent.blur(input);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/cart", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartItemId: "item-1", quantity: 10 }),
        });
      });

      // Success mutations are silent — no success toast.
      expect(notify.success).not.toHaveBeenCalled();

      expect(
        screen.queryByText("Please enter a quantity between 1 and 10."),
      ).not.toBeInTheDocument();
    });

    it("clamps negative integer to minimum quantity and commits on blur", async () => {
      mockFetchResponse({
        cart: {
          itemCount: 1,
          items: [
            {
              id: "item-1",
              productName: "Test Product",
              quantity: 1,
              availableQuantity: 10,
            },
          ],
        },
      });

      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={3}
          availableQuantity={10}
        />,
      );

      const input = screen.getByRole("spinbutton", {
        name: /Quantity for Test Product/i,
      }) as HTMLInputElement;

      fireEvent.change(input, { target: { value: "-5" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/cart", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartItemId: "item-1", quantity: 1 }),
        });
      });

      // Success mutations are silent — no success toast.
      expect(notify.success).not.toHaveBeenCalled();
    });

    it("clamps too-high input to cart hard cap of 99 on commit", async () => {
      mockFetchResponse({
        cart: {
          itemCount: 99,
          items: [
            {
              id: "item-1",
              productName: "Test Product",
              quantity: 99,
              availableQuantity: 150,
            },
          ],
        },
      });

      const user = userEvent.setup();
      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={3}
          availableQuantity={150}
        />,
      );

      const input = screen.getByRole("spinbutton", {
        name: /Quantity for Test Product/i,
      }) as HTMLInputElement;

      expect(input).toHaveAttribute("max", "99");

      await user.clear(input);
      await user.type(input, "120");
      fireEvent.blur(input);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/cart", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartItemId: "item-1", quantity: 99 }),
        });
      });

      // Success mutations are silent — no success toast.
      expect(notify.success).not.toHaveBeenCalled();

      expect(
        screen.queryByText("Please enter a quantity between 1 and 99."),
      ).not.toBeInTheDocument();
    });

    it("does not commit when input equals current quantity", async () => {
      global.fetch = vi.fn() as unknown as typeof fetch;

      const user = userEvent.setup();
      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={3}
          availableQuantity={10}
        />,
      );

      const input = screen.getByRole("spinbutton", {
        name: /Quantity for Test Product/i,
      }) as HTMLInputElement;

      // Just focus and blur without changing
      await user.click(input);
      fireEvent.blur(input);

      expect(global.fetch).not.toHaveBeenCalled();
    });
    it("updates input display after successful mutation", async () => {
      mockFetchResponse({
        cart: {
          itemCount: 8,
          items: [
            {
              id: "item-1",
              productName: "Test Product",
              quantity: 8,
              availableQuantity: 10,
            },
          ],
        },
      });

      const user = userEvent.setup();
      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={3}
          availableQuantity={10}
        />,
      );

      const input = screen.getByRole("spinbutton", {
        name: /Quantity for Test Product/i,
      }) as HTMLInputElement;

      await user.clear(input);
      await user.type(input, "8");
      fireEvent.blur(input);

      await waitFor(() => {
        expect(input.value).toBe("8");
      });
    });
  });

  describe("error handling", () => {
    it("reverts to previous quantity on mutation error", async () => {
      mockFetchResponse({ error: "Failed to update" }, false);

      const user = userEvent.setup();
      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={3}
          availableQuantity={10}
        />,
      );

      const input = screen.getByRole("spinbutton", {
        name: /Quantity for Test Product/i,
      }) as HTMLInputElement;

      await user.clear(input);
      await user.type(input, "5");
      fireEvent.blur(input);

      await waitFor(() => {
        expect(notify.error).toHaveBeenCalled();
      });

      expect(input.value).toBe("3");
    });

    it("shows error notification on update failure", async () => {
      mockFetchResponse({ error: "Update failed" }, false);

      const user = userEvent.setup();
      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={3}
          availableQuantity={10}
        />,
      );

      const input = screen.getByRole("spinbutton", {
        name: /Quantity for Test Product/i,
      }) as HTMLInputElement;

      await user.clear(input);
      await user.type(input, "5");
      fireEvent.blur(input);

      await waitFor(() => {
        expect(notify.error).toHaveBeenCalledWith(
          "Could not update your cart",
          expect.any(String),
        );
      });
    });
  });

  describe("remove button", () => {
    it("removes item when remove button is clicked", async () => {
      mockFetchResponse({
        cart: {
          itemCount: 2,
          items: [],
        },
      });

      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={3}
          availableQuantity={10}
        />,
      );

      const removeButton = screen.getByLabelText(/Remove.*from cart/i);
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/cart", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartItemId: "item-1" }),
        });
      });

      // Success mutations are silent — no success toast on remove.
      expect(notify.success).not.toHaveBeenCalled();
    });
  });

  describe("pending state", () => {
    it("disables all controls while mutation is pending", async () => {
      let resolveResponse: ((value: unknown) => void) | undefined;
      const promise = new Promise((resolve) => {
        resolveResponse = resolve;
      });

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => promise,
        }),
      ) as unknown as typeof fetch;

      const user = userEvent.setup();
      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={3}
          availableQuantity={10}
        />,
      );

      const input = screen.getByRole("spinbutton", {
        name: /Quantity for Test Product/i,
      }) as HTMLInputElement;
      const plusButton = screen.getByLabelText(/Increase quantity/i);

      await user.clear(input);
      await user.type(input, "5");
      fireEvent.blur(input);

      // Input should be disabled while pending
      expect(input).toBeDisabled();
      expect(plusButton).toBeDisabled();

      // Resolve the response
      resolveResponse!({
        cart: {
          itemCount: 5,
          items: [
            {
              id: "item-1",
              productName: "Test Product",
              quantity: 5,
              availableQuantity: 10,
            },
          ],
        },
      });

      // Wait for pending to clear
      await waitFor(() => {
        expect(input).not.toBeDisabled();
      });
    });
  });

  describe("accessibility", () => {
    it("has proper aria labels for all controls", () => {
      render(
        <CartItemQuantityControls
          cartItemId="item-1"
          productName="Test Product"
          quantity={3}
          availableQuantity={10}
        />,
      );

      expect(
        screen.getByLabelText(/Decrease quantity for Test Product/i),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Increase quantity for Test Product/i),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Remove Test Product from cart/i),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Quantity for Test Product.*Minimum 1.*maximum 10/i),
      ).toBeInTheDocument();
    });
  });
});
