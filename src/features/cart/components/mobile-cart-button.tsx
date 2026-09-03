"use client";

import { ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useCartCountState } from "../cart-count-state";
import { openCartDrawer } from "../cart-drawer-state";

export function MobileCartButton() {
  const { itemCount, pending, errorMessage } = useCartCountState();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={openCartDrawer}
      aria-haspopup="dialog"
      aria-label={`Open shopping cart with ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
      className="relative"
    >
      <ShoppingCart className="size-4" aria-hidden="true" />
      <span className="bg-primary border border-border text-primary-foreground absolute -right-2 -top-2 rounded-full px-1.5 py-0.5 text-xxs leading-none">
        <span aria-hidden="true">{itemCount}</span>
        <span className="sr-only">{`${itemCount} ${itemCount === 1 ? "item" : "items"} in cart`}</span>
      </span>
      {pending ? <span className="sr-only">Loading cart count</span> : null}
      {errorMessage ? <span className="sr-only">{errorMessage}</span> : null}
    </Button>
  );
}
