import { cookies } from "next/headers";
import Link from "next/link";

import { auth } from "@/auth";
import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionErrorState } from "@/components/ui/section-error-state";
import { SectionHeader } from "@/components/ui/section-header";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import {
  CART_COOKIE_NAME,
  getCartSummaryForContext,
  getOrCreateGuestCartToken,
  readCartTokenFromCookieValue,
  validateCartStock,
} from "@/features/cart";
import { CHECKOUT_SHIPPING_FEE, listCheckoutPaymentMethods } from "@/features/checkout";
import { CheckoutPageClient } from "@/features/checkout/components/checkout-page-client";

export const metadata = buildMetadata({
  title: "Checkout",
  path: "/checkout",
  description: "Complete your checkout with Karachi delivery and Cash on Delivery.",
});

export default async function CheckoutPage() {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const guestToken = readCartTokenFromCookieValue(cookieStore.get(CART_COOKIE_NAME)?.value);
  const ensuredGuestToken = await getOrCreateGuestCartToken(guestToken);

  const cart = await getCartSummaryForContext({
    userId: session?.user?.id,
    guestToken: ensuredGuestToken,
    mergeGuestIntoUser: Boolean(session?.user?.id && guestToken),
  });

  if (!cart || (cart.items.length === 0 && cart.dealItems.length === 0)) {
    return (
      <PageShell className="items-center justify-center">
        <EmptyState
          align="center"
          className="w-full max-w-2xl"
          eyebrow="Cart required"
          title="Your cart is empty"
          description="Add products before proceeding to checkout."
          action={
            <Link href={routes.storefront.cart} className={buttonVariants()}>
              Go to cart
            </Link>
          }
        />
      </PageShell>
    );
  }

  const stockValidation = validateCartStock(cart);
  const paymentMethods = listCheckoutPaymentMethods();

  return (
    <PageShell>
      <SectionHeader
        eyebrow="Checkout"
        title="Checkout"
        description=""
        actions={
          <Link href={routes.storefront.cart} className={buttonVariants({ variant: "outline" })}>
            Back to cart
          </Link>
        }
      />

      {!stockValidation.ok ? (
        <SectionErrorState
          title="Cart stock needs an update"
          description="Please fix stock quantities in your cart before submitting checkout."
          action={
            <div className="space-y-1 text-xs text-muted-foreground">
              {stockValidation.issues.slice(0, 3).map((issue) => (
                <p key={issue.cartItemId}>
                  {issue.productName}: requested {issue.requestedQuantity}, available {issue.availableQuantity}
                </p>
              ))}
            </div>
          }
        />
      ) : null}

      <CheckoutPageClient
        cart={cart}
        shipping={CHECKOUT_SHIPPING_FEE}
        allowSubmit={stockValidation.ok}
        paymentMethods={paymentMethods}
        initialCustomer={{
          fullName: session?.user?.name ?? "",
          email: session?.user?.email ?? "",
          phone: "",
        }}
      />
    </PageShell>
  );
}
