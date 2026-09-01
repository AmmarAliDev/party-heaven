"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PriceDisplay } from "@/components/ui/price-display";
import { trackEvent } from "@/features/analytics";
import { testIds } from "@/lib/test-selectors";

import type { CatalogProductCard } from "../types";
import { ProductCardAddToCart } from "./product-card-add-to-cart";
import { ProductCardMedia } from "./product-card-media";

function getInventoryBadge(quantity: number) {
  if (quantity <= 0) {
    return { label: "Out of stock", variant: "danger" as const };
  }

  if (quantity <= 5) {
    return { label: `Low stock: ${quantity} left`, variant: "warning" as const };
  }

  return { label: "In stock", variant: "success" as const };
}

type ProductGridCardProps = {
  product: CatalogProductCard;
  eagerImage?: boolean;
  /** Analytics `item_list_name` used for the `select_item` event. */
  itemListName?: string;
};

export function ProductGridCard({
  product,
  eagerImage = false,
  itemListName = "product_list",
}: ProductGridCardProps) {
  const stockBadge = getInventoryBadge(product.inventoryQuantity);
  const isAvailable = product.inventoryQuantity > 0;

  return (
    <div className="group relative h-full border-2 !bg-card border-border/70 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-md rounded-(--radius-card)">
      <Link
        href={product.href}
        onClick={() => {
          trackEvent({
            type: 'SELECT_ITEM',
            payload: {
              itemListName,
              product: {
                id: product.id,
                name: product.name,
                price: product.price,
                category: product.categorySlug,
                quantity: 1,
              },
            },
          });
        }}
        className="focus-visible:ring-primary block rounded-[var(--radius-card)] focus-visible:ring-2 focus-visible:outline-none"
        data-testid={testIds.storefront.productCard(product.slug)}
      >
        <article>
          <Card className="border-none bg-transparent overflow-hidden shadow-none ">
            <ProductCardMedia
              productName={product.name}
              {...(product.imageUrl ? { imageUrl: product.imageUrl } : {})}
              imageLabel={product.imageLabel}
              imageTone={product.imageTone}
              attributeSummary={product.attributeSummary}
              eagerImage={eagerImage}
            />

            <CardContent className="space-y-2 p-3 pb-6">
              <div className="space-y-2">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <Badge variant={stockBadge.variant}>{stockBadge.label}</Badge>
                  {product.compareAt && product.compareAt > product.price ? (
                    <Badge variant="info">Discount available</Badge>
                  ) : null}
                </div>
                <h3 className="group-hover:text-primary text-lg font-semibold tracking-tight transition-colors">
                  {product.name}
                </h3>
                <p className="text-muted-foreground text-sm line-clamp-2">{product.description}</p>
              </div>

              <PriceDisplay
                amount={product.price}
                {...(typeof product.compareAt === "number" ? { compareAt: product.compareAt } : {})}
                size="sm"
              />

              {/* <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs sm:text-sm">
                <span>{getReviewSummary(product)}</span>
              </div> */}
            </CardContent>
          </Card>
        </article>
      </Link>

      <ProductCardAddToCart
        productSlug={product.slug}
        productName={product.name}
        isAvailable={isAvailable}
        className="absolute right-3 bottom-3 z-10"
      />
    </div>
  );
}
