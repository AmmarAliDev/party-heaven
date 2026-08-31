"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { trackEvent } from "@/features/analytics/lib";
import { openCartDrawer } from "@/features/cart/cart-drawer-state";
import { dispatchCartChanged } from "@/features/cart/client-events";
import type { CartSummary } from "@/features/cart/types";
import { AppError } from "@/lib/errors/app-error";
import { toUserMessage } from "@/lib/errors/error-messages";
import { notify } from "@/lib/notify";
import { testIds } from "@/lib/test-selectors";
import { cn } from "@/lib/utils";

type ProductCardAddToCartProps = {
  productSlug: string;
  productName: string;
  isAvailable: boolean;
  className?: string;
};

type CartMutationPayload = {
  cart?: CartSummary | null;
  error?: string;
};

/**
 * Compact "Add to Cart" action rendered on storefront product cards
 * (category grids, search results, related products).
 *
 * The card itself remains a full clickable link; this button is layered above
 * it (sibling with a higher z-index) so its clicks never trigger navigation.
 * On success the shared cart is updated and the right-side cart drawer opens.
 */
export function ProductCardAddToCart({
  productSlug,
  productName,
  isAvailable,
  className,
}: ProductCardAddToCartProps) {
  const [pending, setPending] = useState(false);

  async function handleAddToCart() {
    if (!isAvailable || pending) {
      return;
    }

    setPending(true);

    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productSlug,
          quantity: 1,
        }),
      });

      const payload = (await response.json().catch(() => null)) as CartMutationPayload | null;

      if (!response.ok) {
        throw new AppError("Cart add request failed.", "INTERNAL_ERROR", {
          userMessage: payload?.error ?? "Could not add item to cart right now. Please try again.",
        });
      }

      if (!payload || typeof payload !== "object" || !Object.hasOwn(payload, "cart")) {
        throw new AppError("Invalid cart response.", "INTERNAL_ERROR", {
          userMessage: "Could not add item to cart right now. Please try again.",
        });
      }

      dispatchCartChanged(payload.cart ?? null);
      openCartDrawer();

      const addedItem = payload.cart?.items.find((item) => item.productSlug === productSlug);

      trackEvent({
        type: 'ADD_TO_CART',
        payload: {
          product: {
            id: addedItem?.id ?? productSlug,
            name: addedItem?.productName ?? productName,
            price: addedItem?.unitPrice ?? 0,
            quantity: addedItem?.quantity ?? 1,
            ...(addedItem?.categorySlug ? { category: addedItem.categorySlug } : {}),
          },
          value: addedItem?.lineSubtotal ?? 0,
          currency: 'PKR',
        },
      });
    } catch (error) {
      notify.error("Could not add to cart", toUserMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      size="icon"
      className={cn(className)}
      disabled={!isAvailable || pending}
      onClick={handleAddToCart}
      aria-busy={pending}
      aria-label={isAvailable ? `Add to cart: ${productName}` : `Out of stock: ${productName}`}
      data-testid={testIds.storefront.cardAddToCart(productSlug)}
    >
      <ShoppingCart className="size-4" aria-hidden="true" />
    </Button>
  );
}
