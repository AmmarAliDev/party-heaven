import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";

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
import { SectionHeader } from "@/components/ui/section-header";
import { routes } from "@/config/routes";

import type { FeaturedCategoriesSection } from "../types";
import {
  FEATURED_CATEGORIES_CAROUSEL_ITEM_CLASS,
  FEATURED_CATEGORIES_CAROUSEL_OPTIONS,
} from "./featured-categories-carousel-config";
import {
  HOMEPAGE_CAROUSEL_MAX_ITEMS,
} from "./homepage-carousel-config";

type FeaturedCategoriesSectionProps = {
  section: FeaturedCategoriesSection;
};

export function FeaturedCategoriesSectionBlock({ section }: FeaturedCategoriesSectionProps) {
  const headerDescription = section.description
    ? { description: section.description }
    : undefined;

  // Cap display at HOMEPAGE_CAROUSEL_MAX_ITEMS; overflow triggers the View All link.
  const visibleCategories = section.categories.slice(0, HOMEPAGE_CAROUSEL_MAX_ITEMS);
  const isCapped = section.categories.length > HOMEPAGE_CAROUSEL_MAX_ITEMS;
  const hasCategories = visibleCategories.length > 0;

  // Resolve View All link: prefer admin-supplied href, fall back to category route.
  const viewAllHref = section.viewAllHref ?? routes.storefront.categories;
  const viewAllLabel = section.viewAllLabel ?? "View all";
  const showViewAll = isCapped || Boolean(section.viewAllHref);

  return (
    <PageContainer as="section" className="space-y-6 py-8">
      <SectionHeader title={section.title} eyebrow="" {...headerDescription} />

      {hasCategories ? (
        <>
          <Carousel opts={FEATURED_CATEGORIES_CAROUSEL_OPTIONS} className="w-full">
            <CarouselContent>
              {visibleCategories.map((category, index) => (
                <CarouselItem key={category.id} className={FEATURED_CATEGORIES_CAROUSEL_ITEM_CLASS}>
                  <Link
                    href={category.href}
                    className="group focus-visible:ring-ring block h-full rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    <Card className="h-full transition-transform duration-200 group-hover:-translate-y-0.5">
                      <CardHeader className="p-0">
                        <div className="relative overflow-hidden rounded-lg mb-4" aria-hidden="true">
                          {category.cardImageUrl ? (
                            <Image
                              src={category.cardImageUrl}
                              alt={category.name}
                              height={214}
                              width={365}
                              sizes="(max-width: 639px) 85vw, (max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw"
                              className="h-54 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                              data-testid={`storefront-category-card-image-${category.slug ?? category.id}`}
                              priority={index === 0}
                            />
                          ) : (
                            <div
                              className="flex h-54 rounded-lg w-full items-center justify-center bg-linear-to-br from-slate-100 via-slate-200 to-slate-100 text-xs font-medium uppercase tracking-[0.16em] text-slate-600"
                              data-testid={`storefront-category-card-fallback-${category.slug ?? category.id}`}
                            >
                              Category preview
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <div className="flex items-center justify-between gap-4">
                          <CardTitle>{category.name}</CardTitle>
                          <ArrowRight
                            className="text-muted-foreground size-4 transition-transform group-hover:translate-x-1"
                            aria-hidden="true"
                          />
                        </div>

                        <CardDescription>{category.description}</CardDescription>
                      </CardContent>
                    </Card>
                  </Link>
                </CarouselItem>
              ))}
            </CarouselContent>

            {/* Nav buttons hide themselves on mobile and also when scroll is not possible */}
            <CarouselPrevious className="hidden size-10 sm:flex disabled:hidden" />
            <CarouselNext className="hidden size-10 sm:flex disabled:hidden" />
          </Carousel>

          {showViewAll && (
            <div className="flex justify-center pt-2">
              <Link href={viewAllHref} className={buttonVariants({ variant: "outline" })}>
                {viewAllLabel}
              </Link>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={Layers}
          title="No featured categories yet"
          description="Featured categories will appear here when this section is configured."
          action={
            <Link href={routes.storefront.categories} className="text-primary text-sm font-medium hover:underline">
              Browse all categories
            </Link>
          }
        />
      )}
    </PageContainer>
  );
}
