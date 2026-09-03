import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceDisplay } from "@/components/ui/price-display";

import type { StorefrontDeal } from "../types";

/** Builds a compact subtitle for a deal card from its included product names. */
export function buildDealProductSummary(deal: StorefrontDeal) {
  const names = deal.products.map((product) => product.name);

  if (names.length === 0) {
    return "Bundle deal";
  }

  if (names.length === 1) {
    return names[0];
  }

  if (names.length === 2) {
    return `${names[0]} + ${names[1]}`;
  }

  return `${names.slice(0, 2).join(" + ")} +${names.length - 2} more`;
}

type DealCardProps = {
  deal: StorefrontDeal;
};

/**
 * Reusable storefront deal card used on the deals listing page and in the
 * "Related deals" cross-sell grid.
 */
export function DealCard({ deal }: DealCardProps) {
  const image = deal.images[0];
  const summary = buildDealProductSummary(deal);

  return (
    <Link
      href={`/deals/${deal.slug}`}
      className="focus-visible:ring-ring group block h-full rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <Card className="h-full transition-transform duration-500 group-hover:-translate-y-0.5">
        <CardHeader className="space-y-1 p-0">
          <div className="relative overflow-hidden rounded-lg mb-4" aria-hidden="true">
            {image ? (
              <Image
                src={image.url}
                alt={image.alt}
                height={214}
                width={365}
                sizes="(max-width: 639px) 90vw, (max-width: 1023px) 50vw, 33vw"
                className="h-54 w-full object-cover"
              />
            ) : (
              <div className="flex h-54 w-full items-center justify-center rounded-lg bg-linear-to-br from-slate-100 via-slate-200 to-slate-100 text-xs font-medium uppercase tracking-[0.16em] text-slate-600">
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
          <CardTitle className="text-base">{deal.title}</CardTitle>
          <CardDescription className="line-clamp-2">{summary}</CardDescription>
          <PriceDisplay
            amount={deal.price}
            size="sm"
            {...(typeof deal.compareAt === "number" ? { compareAt: deal.compareAt } : undefined)}
          />
        </CardContent>
      </Card>
    </Link>
  );
}
