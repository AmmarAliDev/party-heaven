import Link from "next/link";
import { Heart } from "lucide-react";

import { auth } from "@/auth";
import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PriceDisplay } from "@/components/ui/price-display";
import { SectionHeader } from "@/components/ui/section-header";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { getWishlistItemsForUser } from "@/features/wishlist";
import { WishlistRemoveButton } from "@/features/wishlist/components/wishlist-remove-button";
import { getDisplayVariantLabel } from "@/lib/variant-label";

export const metadata = buildMetadata({
  title: "Wishlist",
  path: "/wishlist",
  description: "Save products to revisit and purchase later.",
});

export default async function WishlistPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <PageShell className="items-center justify-center">
        <EmptyState
          align="center"
          className="w-full max-w-2xl"
          icon={Heart}
          eyebrow="Sign in to sync"
          title="Your wishlist is ready"
          description="Save favorite products in your account and access them across devices."
          action={
            <>
              <Link
                href={`${routes.auth.signIn}?from=${encodeURIComponent(routes.storefront.wishlist)}`}
                className={buttonVariants()}
              >
                Sign in to continue
              </Link>
              <Link href={routes.storefront.categories} className={buttonVariants({ variant: "outline" })}>
                Explore categories
              </Link>
            </>
          }
        />
      </PageShell>
    );
  }

  const items = await getWishlistItemsForUser(session.user.id);

  return (
    <PageShell>
      <SectionHeader
        eyebrow="Customer"
        title="Your wishlist"
        description="Track saved products and jump back to product details when you are ready to purchase."
        actions={
          <Link href={routes.storefront.categories} className={buttonVariants({ variant: "outline" })}>
            Continue shopping
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="No saved products yet"
          description="Use the Save to wishlist action on product pages to keep favorites here."
          icon={Heart}
          action={
            <Link href={routes.storefront.categories} className={buttonVariants()}>
              Browse catalog
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {items.map((item) => {
            const variantLabel = getDisplayVariantLabel(item.optionLabel);

            return (
              <Card key={item.id}>
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1.5">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.categoryName}</p>
                    <Link href={item.href} className="text-lg font-semibold tracking-tight hover:text-primary">
                      {item.productName}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      SKU: {item.sku}
                      {variantLabel ? ` | ${variantLabel}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                    <PriceDisplay
                      amount={item.price}
                      {...(typeof item.compareAt === "number" ? { compareAt: item.compareAt } : {})}
                      size="sm"
                    />
                    <WishlistRemoveButton sku={item.sku} productName={item.productName} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
