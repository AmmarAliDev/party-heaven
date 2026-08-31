import { cookies } from "next/headers";
import Link from "next/link";

import { auth } from "@/auth";
import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { CART_COOKIE_NAME, getCartSummaryForContext, getOrCreateGuestCartToken, readCartTokenFromCookieValue } from "@/features/cart";
import { CartPageContent } from "@/features/cart/components/cart-page-content";

export const metadata = buildMetadata({
  title: "Cart",
  path: "/cart",
  description: "Review your selected items and get ready for checkout.",
  noIndex: true,
});

export default async function CartPage() {
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
          eyebrow="Your bag is empty"
          title="Start adding products"
          description="Browse categories and add products to see them here. Your cart persists for guests and signed-in customers."
          action={
            <Link href={routes.storefront.categories} className={buttonVariants()}>
              Browse categories
            </Link>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <SectionHeader
        eyebrow="Checkout"
        title="Your cart"
        description="Update quantities, remove items, and confirm stock availability before checkout."
        actions={
          <Link href={routes.storefront.categories} className={buttonVariants({ variant: "outline" })}>
            Continue shopping
          </Link>
        }
      />

      <CartPageContent initialCart={cart} />
    </PageShell>
  );
}
