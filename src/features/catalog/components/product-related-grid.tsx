"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/ui/price-display";
import { trackEvent } from "@/features/analytics";

import type { CatalogProductCard } from "../types";
import { ProductCardAddToCart } from "./product-card-add-to-cart";

type ProductRelatedGridProps = {
  products: CatalogProductCard[];
};

export function ProductRelatedGrid({ products }: ProductRelatedGridProps) {
  return (
    <section aria-labelledby="related-heading">
      <div className="mb-6 space-y-3">
        <Badge variant="secondary">More like this</Badge>
        <h2 id="related-heading" className="text-2xl font-semibold tracking-tight">
          Related Products
        </h2>
      </div>

      {products.length === 0 ? (
        <p className="text-muted-foreground rounded-(--radius-card) border border-dashed border-border/70 px-4 py-5 text-sm">
          No related products are available right now.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <li key={product.id} className="list-none">
              <div className="group relative h-full">
                <Link
                  href={product.href}
                  onClick={() => {
                    trackEvent({
                      type: 'SELECT_ITEM',
                      payload: {
                        itemListName: 'Related products',
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
                  className="block rounded-(--radius-card) overflow-hidden shadow-(--shadow-soft) hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <article>
                    <div
                      aria-hidden
                      className="flex aspect-4/3 items-end p-4"
                      style={{
                        backgroundImage: `url(${product.imageUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    />
                    <div className="p-4 space-y-2 pb-4">
                      <p className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                        {product.name}
                      </p>
                      <PriceDisplay
                        amount={product.price}
                        {...(typeof product.compareAt === "number" ? { compareAt: product.compareAt } : {})}
                        size="sm"
                      />
                    </div>
                  </article>
                </Link>

                <ProductCardAddToCart
                  productSlug={product.slug}
                  productName={product.name}
                  isAvailable={product.inventoryQuantity > 0}
                  className="absolute right-3 bottom-3 z-10"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

