import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { PriceDisplay } from "@/components/ui/price-display";
import { SectionHeader } from "@/components/ui/section-header";
import { ProductCardAddToCart } from "@/features/catalog/components/product-card-add-to-cart";

import type { FeaturedProductsSection } from "../types";
import {
  HOMEPAGE_CAROUSEL_ITEM_CLASS,
  HOMEPAGE_CAROUSEL_MAX_ITEMS,
  HOMEPAGE_CAROUSEL_OPTIONS,
} from "./homepage-carousel-config";

type FeaturedProductsSectionProps = {
  section: FeaturedProductsSection;
};

export function FeaturedProductsSectionBlock({ section }: FeaturedProductsSectionProps) {
  const headerDescription = section.description
    ? { description: section.description }
    : undefined;

  // Cap display at HOMEPAGE_CAROUSEL_MAX_ITEMS; overflow triggers the View All link.
  const visibleProducts = section.products.slice(0, HOMEPAGE_CAROUSEL_MAX_ITEMS);
  const isCapped = section.products.length > HOMEPAGE_CAROUSEL_MAX_ITEMS;
  const hasProducts = visibleProducts.length > 0;

  // View All is shown when items were capped or an explicit href was provided.
  const showViewAll = isCapped || Boolean(section.viewAllHref);
  const viewAllLabel = section.viewAllLabel ?? "View all products";

  return (
    <PageContainer as="section" className="space-y-6 py-8">
      <SectionHeader title={section.title} eyebrow="" {...headerDescription} />

      {hasProducts ? (
        <>
          <Carousel opts={HOMEPAGE_CAROUSEL_OPTIONS} className="w-full">
            <CarouselContent>
              {visibleProducts.map((product) => {
                const primary = product?.images?.find((img) => img.isPrimary) ?? product?.images?.[0];
                const productKey = product.slug ?? product.id;
                return (
                  <CarouselItem key={product.id} className={HOMEPAGE_CAROUSEL_ITEM_CLASS}>
                    <div className="group relative h-full">
                      <Link
                        href={product.href}
                        className="focus-visible:ring-ring block h-full rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      >
                        <Card className="h-full transition-transform duration-500 group-hover:-translate-y-0.5">
                          <CardHeader className="space-y-1 p-0">
                            <div className="relative overflow-hidden rounded-lg mb-4" aria-hidden="true">
                              {primary ? (
                                <Image
                                  src={primary.url}
                                  alt={primary.alt ?? product.name}
                                  height={214}
                                  width={365}
                                  sizes="(max-width: 639px) 85vw, (max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, (max-width: 1535px) 20vw, 17vw"
                                  className="h-54 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                  data-testid={`storefront-product-card-image-${productKey}`}
                                />
                              ) : (
                                <div
                                  className="flex h-54 rounded-lg w-full items-center justify-center bg-linear-to-br from-slate-100 via-slate-200 to-slate-100 text-xs font-medium uppercase tracking-[0.16em] text-slate-600"
                                  data-testid={`storefront-product-card-fallback-${productKey}`}
                                >
                                  Product preview
                                </div>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2 p-3 pt-1 pb-4">
                            <div className="flex items-center justify-between gap-4">
                              <CardTitle className="text-base">{product.name}</CardTitle>
                              <ArrowRight
                                className="text-muted-foreground size-4 transition-transform group-hover:translate-x-1"
                                aria-hidden="true"
                              />
                            </div>
                            {product.description ? (
                              <CardDescription>{product.description}</CardDescription>
                            ) : null}
                            <PriceDisplay
                              amount={product.price}
                              size="sm"
                              {...(typeof product.compareAt === "number" ? { compareAt: product.compareAt } : undefined)}
                            />
                          </CardContent>
                        </Card>
                      </Link>

                      {product.slug ? (
                        <ProductCardAddToCart
                          productSlug={product.slug}
                          productName={product.name}
                          isAvailable={(product.inventoryQuantity ?? 1) > 0}
                          className="absolute right-3 bottom-3 z-10"
                        />
                      ) : null}
                    </div>
                  </CarouselItem>
                )
              })}
            </CarouselContent>

            {/* Nav buttons hide themselves on mobile and also when scroll is not possible */}
            <CarouselPrevious className="hidden size-10 sm:flex disabled:hidden" />
            <CarouselNext className="hidden size-10 sm:flex disabled:hidden" />
          </Carousel>

          {showViewAll && section.viewAllHref && (
            <div className="flex justify-center pt-2">
              <Link href={section.viewAllHref} className={buttonVariants({ variant: "outline" })}>
                {viewAllLabel}
              </Link>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={ShoppingBag}
          title="No featured products yet"
          description="Featured products will appear here when this section is configured."
        />
      )}
    </PageContainer>
  );
}
