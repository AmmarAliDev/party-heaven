import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { PriceDisplay } from "@/components/ui/price-display";
import { normalizeCatalogImageUrl } from "@/features/catalog/lib/product-image-url";

import type { DealSpotlightSection } from "../types";

type DealSpotlightSectionProps = {
  section: DealSpotlightSection;
};

function isValidSpotlightHref(value: string) {
  return value.startsWith("/") || /^https?:\/\//i.test(value);
}

function isExternalSpotlightHref(value: string) {
  return /^https?:\/\//i.test(value);
}

export function DealSpotlightSectionBlock({ section }: DealSpotlightSectionProps) {
  const spotlightImageUrl = normalizeCatalogImageUrl(section.image?.url);
  const normalizedHref = section.ctaHref.trim();
  const hasValidHref = normalizedHref.length > 0 && isValidSpotlightHref(normalizedHref);
  const isExternalHref = hasValidHref && isExternalSpotlightHref(normalizedHref);

  return (
    <PageContainer as="section" className="py-8">
      <Card className="overflow-hidden bg-card text-card-foreground shadow-(--shadow-soft)">
        {spotlightImageUrl ? (
          <div className="relative aspect-16/7 w-full border-b bg-muted">
            <Image
              src={spotlightImageUrl}
              alt={section.image?.alt ?? section.title}
              fill
              sizes="100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        ) : null}
        <CardHeader className="gap-3">
          <Badge className="w-fit">{section.dealLabel}</Badge>
          <CardTitle className="text-2xl">{section.title}</CardTitle>
          <CardDescription>{section.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <PriceDisplay amount={section.price} compareAt={section.compareAt} size="lg" />
          {hasValidHref ? (
            isExternalHref ? (
              <a href={normalizedHref} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: "lg" })}>
                {section.ctaLabel}
              </a>
            ) : (
              <Link href={normalizedHref} className={buttonVariants({ size: "lg" })}>
                {section.ctaLabel}
              </Link>
            )
          ) : (
            <span className={buttonVariants({ size: "lg", variant: "secondary" })} aria-disabled="true">
              {section.ctaLabel}
            </span>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
