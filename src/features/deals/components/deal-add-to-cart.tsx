"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { trackEvent } from "@/features/analytics/lib";
import { addCartChangedListener, dispatchCartChanged } from "@/features/cart/client-events";
import { CartItemQuantityControls } from "@/features/cart/components/cart-item-quantity-controls";
import type { CartSummary } from "@/features/cart/types";
import type { StorefrontDeal } from "@/features/deals/types";
import { AppError } from "@/lib/errors/app-error";
import { toUserMessage } from "@/lib/errors/error-messages";
import { notify } from "@/lib/notify";
import { testIds } from "@/lib/test-selectors";

type DealAddToCartProps = {
  deal: StorefrontDeal;
};

type CartMutationPayload = {
  cart?: CartSummary | null;
  error?: string;
};

type CartApiPayload = {
  cart?: CartSummary | null;
  error?: string;
};

async function fetchCartSummary() {
  const response = await fetch("/api/cart", {
    method: "GET",
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as CartApiPayload | null;

  if (!response.ok) {
    throw new AppError("Cart read request failed.", "INTERNAL_ERROR", {
      userMessage: payload?.error ?? "Could not sync your cart right now. Please try again.",
    });
  }

  return payload?.cart ?? null;
}

/**
 * Deal add-to-cart — the whole deal is treated as ONE cart line item. Clicking
 * "Add to Cart" adds a single deal line (with the deal's snapshot price); once
 * the deal is in the cart, the button is replaced by ONE quantity control for
 * the whole deal plus a "View cart" link.
 */
export function DealAddToCart({ deal }: DealAddToCartProps) {
  const [pending, setPending] = useState(false);
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [cartPending, setCartPending] = useState(true);
  const [cartErrorMessage, setCartErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCart() {
      if (!cancelled) {
        setCartPending(true);
        setCartErrorMessage(null);
      }

      try {
        const nextCart = await fetchCartSummary();

        if (cancelled) {
          return;
        }

        setCart(nextCart);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setCartErrorMessage(toUserMessage(error));
      } finally {
        if (!cancelled) {
          setCartPending(false);
        }
      }
    }

    void loadCart();

    const detach = addCartChangedListener((nextCart) => {
      if (cancelled) {
        return;
      }

      if (typeof nextCart !== "undefined") {
        setCart(nextCart ?? null);
        setCartErrorMessage(null);
        setCartPending(false);
        return;
      }

      void loadCart();
    });

    return () => {
      cancelled = true;
      detach();
    };
  }, []);

  const activeDealItem = useMemo(
    () => cart?.dealItems.find((item) => item.dealId === deal.id || item.dealSlug === deal.slug) ?? null,
    [cart, deal.id, deal.slug],
  );

  const includedInCart = Boolean(activeDealItem && activeDealItem.quantity > 0);
  const cartItemCount = cart?.itemCount ?? 0;
  const cartItemLabel = cartItemCount === 1 ? "item" : "items";

  async function handleAddToCart() {
    if (!deal.isAvailable || pending) {
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
          dealSlug: deal.slug,
          quantity: 1,
        }),
      });

      const payload = (await response.json().catch(() => null)) as CartMutationPayload | null;

      if (!response.ok) {
        throw new AppError("Cart add request failed.", "INTERNAL_ERROR", {
          userMessage: payload?.error ?? "Could not add this deal to your cart right now. Please try again.",
        });
      }

      if (!payload || typeof payload !== "object" || !Object.hasOwn(payload, "cart")) {
        throw new AppError("Invalid cart response.", "INTERNAL_ERROR", {
          userMessage: payload?.error ?? "Could not add this deal to your cart right now. Please try again.",
        });
      }

      dispatchCartChanged(payload.cart ?? null);

      const addedDealItem = payload.cart?.dealItems.find((item) => item.dealSlug === deal.slug);

      trackEvent({
        type: 'ADD_TO_CART',
        payload: {
          product: {
            id: addedDealItem?.dealId ?? deal.id,
            name: addedDealItem?.title ?? deal.title,
            price: addedDealItem?.unitPrice ?? deal.price,
            quantity: addedDealItem?.quantity ?? 1,
            ...(deal.categorySlug ? { category: deal.categorySlug } : {}),
          },
          value: addedDealItem?.lineSubtotal ?? deal.price,
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
    <div className="space-y-3">
      {includedInCart && activeDealItem ? (
        <div className="space-y-3" data-testid="storefront-deal-in-cart-quantity-controls">
          <p className="text-sm font-medium">In your cart</p>

          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground min-w-0 truncate text-sm">
              {activeDealItem.title} · {activeDealItem.productSummary}
            </p>
            <CartItemQuantityControls
              cartItemId={activeDealItem.id}
              dealCartItemId={activeDealItem.id}
              productName={activeDealItem.title}
              quantity={activeDealItem.quantity}
              availableQuantity={activeDealItem.availableQuantity}
            />
          </div>

          <Link
            href={routes.storefront.cart}
            className="bg-background relative flex items-center justify-center gap-2 rounded-md border-2 border-border/70 px-4 py-3 text-sm font-medium"
            data-testid="storefront-view-cart-button"
          >
            <ShoppingCart className="size-4" aria-hidden="true" />
            View cart
            <span
              className="bg-primary text-primary-foreground absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full border border-border px-1.5 text-[10px] leading-none"
              data-testid="storefront-cart-item-count"
            >
              <span aria-hidden="true">{cartItemCount}</span>
              <span className="sr-only">{`${cartItemCount} ${cartItemLabel} in cart`}</span>
            </span>
          </Link>
        </div>
      ) : (
        <Button
          size="lg"
          className="w-full"
          disabled={!deal.isAvailable || pending}
          onClick={handleAddToCart}
          aria-busy={pending}
          data-testid={testIds.storefront.addToCart}
        >
          {pending ? "Adding..." : deal.isAvailable ? "Add to Cart" : "Out of Stock"}
        </Button>
      )}

      {cartPending ? <p className="sr-only">Loading cart details</p> : null}
      {cartErrorMessage ? <p className="sr-only">{cartErrorMessage}</p> : null}
    </div>
  );
}
