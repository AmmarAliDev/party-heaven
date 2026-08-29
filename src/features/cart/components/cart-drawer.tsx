"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ShoppingBag, X } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { PriceDisplay } from "@/components/ui/price-display";
import { SectionErrorState } from "@/components/ui/section-error-state";
import { routes } from "@/config/routes";
import { closeCartDrawer, useCartDrawerState } from "@/features/cart/cart-drawer-state";
import { addCartChangedListener } from "@/features/cart/client-events";
import type { CartSummary } from "@/features/cart/types";
import { AppError } from "@/lib/errors/app-error";
import { toUserMessage } from "@/lib/errors/error-messages";
import { getDisplayVariantLabel } from "@/lib/variant-label";

import { CartItemQuantityControls } from "./cart-item-quantity-controls";
import { CartItemThumbnail } from "./cart-item-thumbnail";

type CartApiPayload = {
  ok: boolean;
  cart: CartSummary | null;
};

async function fetchCart() {
  const response = await fetch("/api/cart", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new AppError("Cart drawer request failed.", "INTERNAL_ERROR", {
      userMessage: payload?.error ?? "Could not load your cart right now. Please try again.",
    });
  }

  const payload = (await response.json()) as CartApiPayload;
  return payload.cart;
}

export function CartDrawer() {
  const { open } = useCartDrawerState();
  const [pending, setPending] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cart, setCart] = useState<CartSummary | null>(null);

  async function load() {
    setPending(true);
    setErrorMessage(null);

    try {
      const nextCart = await fetchCart();
      setCart(nextCart);
    } catch (error) {
      setErrorMessage(toUserMessage(error));
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    void load();

    return addCartChangedListener((nextCart) => {
      if (typeof nextCart !== "undefined") {
        setCart(nextCart ?? null);
        setErrorMessage(null);
        setPending(false);
        return;
      }

      void load();
    });
  }, []);

  // Refresh from the server the first time the drawer opens so the panel is
  // never stale (e.g. when opened from the header without a recent mutation).
  useEffect(() => {
    if (open && cart === null) {
      void load();
    }
  }, [open, cart]);

  const hasItems = Boolean(cart && cart.items.length > 0);
  const canCheckout = hasItems && cart!.items.every((item) => item.quantity <= item.availableQuantity);

  return (
    <Drawer
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeCartDrawer();
        }
      }}
      direction="right"
      shouldScaleBackground={false}
    >
      <DrawerContent className="w-full min-w-85 sm:max-w-md">
        <DrawerHeader className="border-border/70 pr-12 border-b">
          <DrawerTitle>Shopping Cart</DrawerTitle>
          <DrawerDescription>
            {hasItems
              ? `${cart!.itemCount} ${cart!.itemCount === 1 ? "item" : "items"} in your cart`
              : "Review your items before checkout."}
          </DrawerDescription>
          <DrawerClose
            className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring absolute top-4 right-4 rounded-md p-1 opacity-70 transition-opacity focus-visible:ring-2 focus-visible:outline-none hover:opacity-100"
            aria-label="Close cart"
          >
            <X className="size-5" aria-hidden="true" />
          </DrawerClose>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {pending ? (
            <div className="py-8">
              <InlineSpinner label="Loading your cart" />
            </div>
          ) : null}

          {!pending && errorMessage ? (
            <SectionErrorState
              title="Cart is unavailable"
              description={errorMessage}
              onRetry={() => void load()}
              retryLabel="Retry cart"
            />
          ) : null}

          {!pending && !errorMessage && !hasItems ? (
            <EmptyState
              title="Cart is empty"
              description="Add products from the catalog to start checkout."
              align="center"
              icon={ShoppingBag}
              action={
                <Link
                  href={routes.storefront.categories}
                  className={buttonVariants({ size: "sm" })}
                  onClick={closeCartDrawer}
                >
                  Browse products
                </Link>
              }
            />
          ) : null}

          {!pending && !errorMessage && hasItems ? (
            <ul className="space-y-3">
              {cart!.items.map((item) => {
                const hasStockIssue = item.quantity > item.availableQuantity;
                const variantLabel = getDisplayVariantLabel(item.optionLabel);

                return (
                  <li key={item.id} className="border-border/70 rounded-lg border p-3">
                    <div className="flex items-start gap-3">
                      <CartItemThumbnail
                        productName={item.productName}
                        imageUrl={item.imageUrl}
                        imageAlt={item.imageAlt}
                        href={item.href}
                        onClick={closeCartDrawer}
                      />

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="space-y-0.5">
                          <Link
                            href={item.href}
                            onClick={closeCartDrawer}
                            className="hover:text-primary line-clamp-2 text-sm font-medium"
                          >
                            {item.productName}
                          </Link>
                          {variantLabel ? (
                            <p className="text-muted-foreground text-xs">{variantLabel}</p>
                          ) : null}
                          <PriceDisplay amount={item.unitPrice} size="sm" className="shrink-0" />
                        </div>

                        {hasStockIssue ? (
                          <p className="text-destructive inline-flex items-center gap-1 text-xs">
                            <AlertTriangle className="size-3.5" aria-hidden="true" />
                            Requested quantity exceeds available stock ({item.availableQuantity}).
                          </p>
                        ) : null}

                        <div className="flex items-center justify-between gap-3">
                          <CartItemQuantityControls
                            cartItemId={item.id}
                            productName={item.productName}
                            quantity={item.quantity}
                            availableQuantity={item.availableQuantity}
                          />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {hasItems ? (
          <DrawerFooter className="border-border/70 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <PriceDisplay amount={cart!.subtotal} size="sm" />
            </div>
            <Link
              href={routes.storefront.cart}
              onClick={closeCartDrawer}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              View full cart
            </Link>
            {canCheckout ? (
              <Link
                href={routes.storefront.checkout}
                onClick={closeCartDrawer}
                className={buttonVariants({ size: "lg" })}
              >
                Checkout
              </Link>
            ) : (
              <button type="button" disabled className={buttonVariants({ size: "lg" })}>
                Checkout
              </button>
            )}
            {!canCheckout ? (
              <p className="text-muted-foreground text-center text-xs">
                Adjust quantities above to continue to checkout.
              </p>
            ) : null}
          </DrawerFooter>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
