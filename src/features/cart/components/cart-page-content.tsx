"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ShoppingCart } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PriceDisplay } from "@/components/ui/price-display";
import { SectionErrorState } from "@/components/ui/section-error-state";
import { routes } from "@/config/routes";
import type { CartSummary } from "@/features/cart/types";
import { validateCartStock } from "@/features/cart/validation";
import { testIds } from "@/lib/test-selectors";
import { getDisplayVariantLabel } from "@/lib/variant-label";

import { addCartChangedListener } from "../client-events";
import { CartItemQuantityControls } from "./cart-item-quantity-controls";
import { CartItemThumbnail } from "./cart-item-thumbnail";

type CartPageContentProps = {
  initialCart: CartSummary;
};

export function CartPageContent({ initialCart }: CartPageContentProps) {
  const [cart, setCart] = useState<CartSummary | null>(initialCart);

  useEffect(() => {
    return addCartChangedListener((nextCart) => {
      if (typeof nextCart !== "undefined") {
        setCart(nextCart ?? null);
      }
    });
  }, []);

  const stockValidation = useMemo(
    () => (cart ? validateCartStock(cart) : { ok: true, issues: [] }),
    [cart],
  );

  if (!cart || (cart.items.length === 0 && cart.dealItems.length === 0)) {
    return (
      <EmptyState
        align="center"
        className="w-full max-w-2xl"
        icon={ShoppingCart}
        eyebrow="Your bag is empty"
        title="Start adding products"
        description="Browse categories and add products to see them here. Your cart persists for guests and signed-in customers."
        action={
          <Link href={routes.storefront.categories} className={buttonVariants()}>
            Browse categories
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6" data-testid={testIds.storefront.cartContent}>
      {!stockValidation.ok ? (
        <SectionErrorState
          title="Some items need attention"
          description="One or more items exceed available stock. Reduce quantity to continue to checkout."
          action={
            <div className="text-muted-foreground space-y-1 text-xs">
              {stockValidation.issues.slice(0, 3).map((issue) => (
                <p key={issue.cartItemId}>
                  {issue.productName}: requested {issue.requestedQuantity}, available{" "}
                  {issue.availableQuantity}
                </p>
              ))}
            </div>
          }
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-3">
          {cart.dealItems.map((item) => {
            const hasStockIssue = item.quantity > item.availableQuantity;

            return (
              <Card key={item.id}>
                <CardContent className="flex gap-2 sm:gap-4 p-5">
                  <CartItemThumbnail
                    productName={item.title}
                    imageUrl={item.imageUrl}
                    imageAlt={item.imageAlt}
                    href={item.href}
                    className="size-24 sm:size-32"
                  />

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <Link
                          href={item.href}
                          className="hover:text-primary text-base font-semibold tracking-tight"
                        >
                          {item.title}
                        </Link>
                        <p className="text-muted-foreground text-sm">
                          {item.productSummary} · {item.itemCount}{" "}
                          {item.itemCount === 1 ? "product" : "products"}
                        </p>
                        <p className="text-muted-foreground text-sm">SKU: {item.sku}</p>
                        <p className="text-muted-foreground text-xs">
                          In stock: {item.availableQuantity} bundle
                          {item.availableQuantity === 1 ? "" : "s"}
                        </p>
                      </div>

                      <PriceDisplay
                        amount={item.unitPrice}
                        {...(typeof item.compareAtPrice === "number"
                          ? { compareAt: item.compareAtPrice }
                          : {})}
                        size="sm"
                      />
                    </div>

                    {hasStockIssue ? (
                      <p className="text-destructive inline-flex items-center gap-1 text-xs">
                        <AlertTriangle className="size-3.5" aria-hidden="true" />
                        Requested quantity exceeds available bundles.
                      </p>
                    ) : null}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <CartItemQuantityControls
                        cartItemId={item.id}
                        dealCartItemId={item.id}
                        productName={item.title}
                        quantity={item.quantity}
                        availableQuantity={item.availableQuantity}
                      />

                      <span className="flex gap-1">Total:{" "} <PriceDisplay amount={item.lineSubtotal} size="sm" /></span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {cart.items.map((item) => {
            const hasStockIssue = item.quantity > item.availableQuantity;
            const variantLabel = getDisplayVariantLabel(item.optionLabel);

            return (
              <Card key={item.id}>
                <CardContent className="flex gap-2 sm:gap-4 p-5">
                  <CartItemThumbnail
                    productName={item.productName}
                    imageUrl={item.imageUrl}
                    imageAlt={item.imageAlt}
                    href={item.href}
                    className="size-24 sm:size-32"
                  />

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <Link
                          href={item.href}
                          className="hover:text-primary text-base font-semibold tracking-tight"
                        >
                          {item.productName}
                        </Link>
                        {variantLabel ? (
                          <p className="text-muted-foreground text-sm">{variantLabel}</p>
                        ) : null}
                        <p className="text-muted-foreground text-sm">SKU: {item.sku}</p>
                        <p className="text-muted-foreground text-xs">
                          In stock: {item.availableQuantity}
                        </p>
                      </div>

                      <PriceDisplay
                        amount={item.unitPrice}
                        {...(typeof item.compareAtPrice === "number"
                          ? { compareAt: item.compareAtPrice }
                          : {})}
                        size="sm"
                      />
                    </div>

                    {hasStockIssue ? (
                      <p className="text-destructive inline-flex items-center gap-1 text-xs">
                        <AlertTriangle className="size-3.5" aria-hidden="true" />
                        Requested quantity exceeds available stock.
                      </p>
                    ) : null}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <CartItemQuantityControls
                        cartItemId={item.id}
                        productName={item.productName}
                        quantity={item.quantity}
                        availableQuantity={item.availableQuantity}
                      />

                      <span className="flex gap-1">Total:{" "} <PriceDisplay amount={item.lineSubtotal} size="sm" /></span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="h-fit" data-testid={testIds.storefront.cartSummary}>
          <CardContent className="space-y-4 p-5">
            <h2 className="text-base font-semibold tracking-tight">Order summary</h2>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Items</span>
              <span>{cart.itemCount}</span>
            </div>

            <div className="border-border/70 flex items-center justify-between border-t pt-3">
              <span className="font-medium">Subtotal</span>
              <PriceDisplay amount={cart.subtotal} size="sm" />
            </div>

            {stockValidation.ok ? (
              <Link href={routes.storefront.checkout} className={buttonVariants({ size: "lg" })}>
                Proceed to checkout
              </Link>
            ) : (
              <button type="button" className={buttonVariants({ size: "lg" })} disabled>
                Proceed to checkout
              </button>
            )}

            {!stockValidation.ok ? (
              <p className="text-muted-foreground text-xs">
                Checkout is temporarily disabled until stock quantities are adjusted.
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Shipping and taxes are calculated at checkout.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
