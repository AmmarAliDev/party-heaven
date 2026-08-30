import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { PageContainer } from "@/components/ui/page-container";
import { PriceDisplay } from "@/components/ui/price-display";
import { SectionHeader } from "@/components/ui/section-header";

import type { FeaturedDealsSection } from "../types";
import {
  HOMEPAGE_CAROUSEL_ITEM_CLASS,
  HOMEPAGE_CAROUSEL_MAX_ITEMS,
  HOMEPAGE_CAROUSEL_OPTIONS,
} from "./homepage-carousel-config";

type FeaturedDealsSectionProps = {
  section: FeaturedDealsSection;
};

/**
 * Renders the Featured Deals homepage section.
 *
 * Deals are hydrated at runtime from the published Deal records (admin-managed)
 * and therefore always reflect current availability. The section is hidden
 * entirely when no deals are available — an empty/placeholder state is
 * intentionally NOT rendered so the homepage does not advertise a deals
 * section with nothing to show.
 *
 * Up to HOMEPAGE_CAROUSEL_MAX_ITEMS deals are shown in a carousel; the
 * section's ctaHref/ctaLabel "View all" link always appears below the carousel.
 */
export function FeaturedDealsSectionBlock({ section }: FeaturedDealsSectionProps) {
  // Cap display at HOMEPAGE_CAROUSEL_MAX_ITEMS so the carousel stays manageable.
  const visibleDeals = section.deals.slice(0, HOMEPAGE_CAROUSEL_MAX_ITEMS);
  const hasDeals = visibleDeals.length > 0;

  // No active deals → hide the section completely instead of showing an empty state.
  if (!hasDeals) {
    return null;
  }

  const headerDescription = section.description ? { description: section.description } : undefined;

  return (
    <PageContainer as="section" className="space-y-6 py-8">
      <SectionHeader title={section.title} eyebrow="Deals" {...headerDescription} />

      <Carousel opts={HOMEPAGE_CAROUSEL_OPTIONS} className="w-full">
        <CarouselContent>
          {visibleDeals.map((deal) => {
            const dealKey = deal.slug ?? deal.id;
            return (
              <CarouselItem key={deal.id} className={HOMEPAGE_CAROUSEL_ITEM_CLASS}>
                <div className="group relative h-full">
                  <Link
                    href={deal.href}
                    className="focus-visible:ring-ring block h-full rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    aria-label={`View ${deal.title}`}
                  >
                    <Card className="h-full transition-transform duration-200 group-hover:-translate-y-0.5">
                      <CardHeader className="space-y-1 p-0">
                        <div className="relative overflow-hidden rounded-lg mb-4" aria-hidden="true">
                          {deal.imageUrl ? (
                            <Image
                              src={deal.imageUrl}
                              alt={deal.imageAlt ?? deal.title}
                              height={214}
                              width={365}
                              sizes="(max-width: 639px) 85vw, (max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, (max-width: 1535px) 20vw, 17vw"
                              className="h-54 w-full object-cover"
                              data-testid={`storefront-deal-card-image-${dealKey}`}
                            />
                          ) : (
                            <div
                              className="flex h-54 rounded-lg w-full items-center justify-center bg-linear-to-br from-slate-100 via-slate-200 to-slate-100 text-xs font-medium uppercase tracking-[0.16em] text-slate-600"
                              data-testid={`storefront-deal-card-fallback-${dealKey}`}
                            >
                              Deal preview
                            </div>
                          )}
                          {deal.isAvailable ? (
                            <Badge className="absolute top-2 left-2">Deal</Badge>
                          ) : (
                            <Badge variant="danger" className="absolute top-2 left-2">
                              Out of stock
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 p-3 pt-1 pb-4">
                        <div className="flex items-center justify-between gap-4">
                          <CardTitle className="text-base">{deal.title}</CardTitle>
                          <ArrowRight
                            className="text-muted-foreground size-4 transition-transform group-hover:translate-x-1"
                            aria-hidden="true"
                          />
                        </div>

                        <CardDescription className="line-clamp-2">{deal.productSummary}</CardDescription>
                        <PriceDisplay
                          amount={deal.price}
                          size="sm"
                          {...(typeof deal.compareAt === "number" ? { compareAt: deal.compareAt } : undefined)}
                        />
                      </CardContent>
                    </Card>
                  </Link>
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>

        {/* Nav buttons hide themselves on mobile and also when scroll is not possible */}
        <CarouselPrevious className="hidden size-10 sm:flex disabled:hidden" />
        <CarouselNext className="hidden size-10 sm:flex disabled:hidden" />
      </Carousel>

      {/* "View all" CTA — always shown so users can reach the full deals listing */}
      <div className="flex justify-center pt-2">
        <Link href={section.ctaHref} className={buttonVariants({ variant: "outline" })}>
          <Tag className="size-4" />
          {section.ctaLabel}
        </Link>
      </div>
    </PageContainer>
  );
}
