"use client";

import { ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCartCountState } from "@/features/cart/cart-count-state";
import { openCartDrawer, useCartDrawerState } from "@/features/cart/cart-drawer-state";

/**
 * Desktop/tablet header trigger for the cart drawer.
 *
 * Replaces the old mini-cart dropdown: clicking now opens the right-side cart
 * drawer. The item-count badge stays powered by the shared cart count store.
 */
export function CartDrawerTrigger() {
  const { itemCount, pending, errorMessage } = useCartCountState();
  const { open } = useCartDrawerState();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={openCartDrawer}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={`Open shopping cart with ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
    >
      <ShoppingCart className="size-4" aria-hidden="true" />
      Cart
      <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-xxs leading-none">
        <span aria-hidden="true">{itemCount}</span>
        <span className="sr-only">{`${itemCount} ${itemCount === 1 ? "item" : "items"} in cart`}</span>
      </span>
      {pending ? <span className="sr-only">Loading cart count</span> : null}
      {errorMessage ? <span className="sr-only">{errorMessage}</span> : null}
    </Button>
  );
}
