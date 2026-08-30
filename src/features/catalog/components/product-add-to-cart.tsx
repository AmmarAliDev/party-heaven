"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { addCartChangedListener, dispatchCartChanged } from "@/features/cart/client-events";
import { CartItemQuantityControls } from "@/features/cart/components/cart-item-quantity-controls";
import type { CartSummary } from "@/features/cart/types";
import { AppError } from "@/lib/errors/app-error";
import { toUserMessage } from "@/lib/errors/error-messages";
import { notify } from "@/lib/notify";
import { testIds } from "@/lib/test-selectors";

type ProductAddToCartProps = {
  productSlug: string;
  optionId?: string | undefined;
  sku: string;
  productName: string;
  isAvailable: boolean;
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

export function ProductAddToCart({
  productSlug,
  optionId,
  sku,
  productName,
  isAvailable,
}: ProductAddToCartProps) {
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

  const activeCartItem = useMemo(
    () => cart?.items.find((item) => item.productSlug === productSlug && item.sku === sku) ?? null,
    [cart, productSlug, sku],
  );

  const cartItemCount = cart?.itemCount ?? 0;
  const cartItemLabel = cartItemCount === 1 ? "item" : "items";
  const shouldRenderQuantityControls = activeCartItem !== null && activeCartItem.quantity > 0;

  async function handleAddToCart() {
    if (!isAvailable || pending) return;

    setPending(true);

    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productSlug,
          ...(optionId ? { optionId } : {}),
          quantity: 1,
        }),
      });

      let payload: CartMutationPayload | null = null;

      try {
        payload = (await response.json()) as CartMutationPayload | null;
      } catch {
        if (response.ok) {
          throw new AppError("Invalid cart response.", "INTERNAL_ERROR", {
            userMessage: "Could not add item to cart right now. Please try again.",
          });
        }
      }

      if (!response.ok) {
        throw new AppError("Cart add request failed.", "INTERNAL_ERROR", {
          userMessage: payload?.error ?? "Could not add item to cart right now. Please try again.",
        });
      }

      if (!payload || typeof payload !== "object" || !Object.hasOwn(payload, "cart")) {
        throw new AppError("Invalid cart response.", "INTERNAL_ERROR", {
          userMessage: payload?.error ?? "Could not add item to cart right now. Please try again.",
        });
      }

      dispatchCartChanged(payload.cart ?? null);
    } catch (error) {
      notify.error("Could not add to cart", toUserMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {shouldRenderQuantityControls && activeCartItem ? (
        <div className="space-y-3 flex items-center justify-between" data-testid="storefront-in-cart-quantity-controls">
          <CartItemQuantityControls
            cartItemId={activeCartItem.id}
            productName={productName}
            quantity={activeCartItem.quantity}
            availableQuantity={activeCartItem.availableQuantity}
          />
          <Link href={routes.storefront.cart} className="bg-background flex items-center justify-between rounded-md border-2 border-border/70 px-3 py-2 mb-auto relative" data-testid="storefront-view-cart-button">
            <span className="inline-flex items-center gap-2 text-sm font-medium ">
              <ShoppingCart className="size-4" aria-hidden="true" />
            </span>
            <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] leading-none border border-border absolute -right-2 -top-2" data-testid="storefront-cart-item-count">
              <span aria-hidden="true">{cartItemCount}</span>
              <span className="sr-only">{`${cartItemCount} ${cartItemLabel} in cart`}</span>
            </span>
          </Link>
        </div>
      ) : (
        <Button
          size="lg"
          className="w-full"
          disabled={!isAvailable || pending}
          onClick={handleAddToCart}
          aria-busy={pending}
          data-testid={testIds.storefront.addToCart}
        >
          {pending ? "Adding..." : isAvailable ? "Add to Cart" : "Out of Stock"}
        </Button>
      )}
      {cartPending ? <p className="sr-only">Loading cart details</p> : null}
      {cartErrorMessage ? <p className="sr-only">{cartErrorMessage}</p> : null}

      {isAvailable ? (
        <p className="text-muted-foreground text-center text-xs">
          Free delivery on orders over Rs. 1,500 in Karachi.
        </p>
      ) : (
        <p className="text-muted-foreground text-center text-xs">
          This item is currently unavailable. Check back soon.
        </p>
      )}
    </div>
  );
}
