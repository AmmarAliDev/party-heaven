import { describe, expect, it, vi } from "vitest";

import {
  ADD_TO_CART_TOAST_DURATION_MS,
  buildAddToCartToastPayload,
} from "@/features/catalog/lib/add-to-cart-toast";

describe("add-to-cart toast payload", () => {
  it("adds mobile checkout CTA and extended duration on mobile", () => {
    const onProceedToCheckout = vi.fn();

    const payload = buildAddToCartToastPayload({
      productName: "Surface Cleaner",
      isMobileViewport: true,
      onProceedToCheckout,
    });

    expect(payload.title).toBe("Surface Cleaner added to cart");
    expect(payload.description).toBe("Cart updated.");
    expect(payload.options.duration).toBe(ADD_TO_CART_TOAST_DURATION_MS);

    // sonner's `action` is a loose ReactNode union; the builder stores a
    // { label, onClick } object, so narrow it for the assertions.
    const action = payload.options.action as
      | { label?: string; onClick?: (event: unknown) => void }
      | undefined;

    expect(action?.label).toBe("Proceed to Checkout");

    action?.onClick?.({} as never);
    expect(onProceedToCheckout).toHaveBeenCalledTimes(1);
  });

  it("keeps desktop toast without checkout CTA and applies shared duration", () => {
    const payload = buildAddToCartToastPayload({
      productName: "Surface Cleaner",
      isMobileViewport: false,
      onProceedToCheckout: vi.fn(),
    });

    expect(payload.title).toBe("Surface Cleaner added to cart");
    expect(payload.description).toBe("Cart updated.");
    expect(payload.options.duration).toBe(ADD_TO_CART_TOAST_DURATION_MS);
    expect(payload.options.action).toBeUndefined();
  });
});
