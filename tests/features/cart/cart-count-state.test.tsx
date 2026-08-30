// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetGlobalCartCountStateForTests,
  useCartCountState,
} from "@/features/cart/cart-count-state";
import { dispatchCartChanged } from "@/features/cart/client-events";

function CartCountProbe() {
  const { itemCount, pending } = useCartCountState();

  return (
    <div>
      <span data-testid="count">{itemCount}</span>
      <span data-testid="status">{pending ? "pending" : "ready"}</span>
    </div>
  );
}

function buildCart(itemCount: number) {
  return {
    itemCount,
  };
}

describe("cart count state", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ cart: buildCart(2) }),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    __resetGlobalCartCountStateForTests();
    vi.unstubAllGlobals();
  });

  it("loads cart count from the cart API", async () => {
    render(<CartCountProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("ready");
    });

    expect(screen.getByTestId("count").textContent).toBe("2");
  });

  it("synchronizes count immediately when cart update events include cart detail", async () => {
    render(<CartCountProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("2");
    });

    dispatchCartChanged(buildCart(7) as never);

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("7");
    });
  });

  it("re-fetches count when cart update event omits cart detail", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cart: buildCart(1) }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cart: buildCart(5) }),
      });

    vi.stubGlobal("fetch", fetchMock);

    render(<CartCountProbe />);

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("1");
    });

    dispatchCartChanged(undefined);

    await waitFor(() => {
      expect(screen.getByTestId("count").textContent).toBe("5");
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
