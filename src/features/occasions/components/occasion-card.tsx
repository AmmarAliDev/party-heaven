import Image from "next/image";
import Link from "next/link";
import { CalendarHeart, Package } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import type { StorefrontOccasionSummary } from "../types";

type OccasionCardProps = {
  occasion: StorefrontOccasionSummary;
  eagerImage?: boolean;
};

/**
 * Storefront occasion card used on the /occasions index. Mirrors the product
 * listing card chrome so occasions read as part of the same catalog surface.
 */
export function OccasionCard({ occasion, eagerImage = false }: OccasionCardProps) {
  const itemCount = occasion.productCount + occasion.dealCount;

  return (
    <Link
      href={occasion.href}
      className="focus-visible:ring-ring block h-full rounded-(--radius-card) focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <div className="group relative flex h-full flex-col border-2 !bg-card border-border/70 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-md rounded-(--radius-card)">
        <div className="relative overflow-hidden rounded-t-(--radius-card)" aria-hidden="true">
          {occasion.coverImageUrl ? (
            <Image
              src={occasion.coverImageUrl}
              alt={occasion.coverImageAlt ?? occasion.name}
              width={640}
              height={360}
              sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
              className="h-54 w-full object-cover transition-transform duration-500 group-hover:scale-105"
              priority={eagerImage}
              loading={eagerImage ? "eager" : "lazy"}
              data-testid={`storefront-occasion-card-image-${occasion.slug}`}
            />
          ) : (
            <div className="from-primary/20 via-primary/10 to-primary/5 flex h-54 w-full items-center justify-center bg-linear-to-br">
              <CalendarHeart className="text-primary/50 size-10" />
            </div>
          )}
          {occasion.isSpecial ? (
            <Badge variant="danger" className="absolute top-3 left-3 shadow-sm">
              Special occasion
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-4">
          <h2 className="line-clamp-1 text-lg font-semibold tracking-tight">{occasion.name}</h2>
          {occasion.shortDescription ? (
            <p className="text-muted-foreground line-clamp-2 text-sm">{occasion.shortDescription}</p>
          ) : null}
          <p className="text-muted-foreground flex items-center gap-1.5 pt-1 text-xs">
            <Package className="size-3.5" />
            {occasion.productCount > 0
              ? `${occasion.productCount} product${occasion.productCount === 1 ? "" : "s"}`
              : "No products"}
            {occasion.dealCount > 0 ? ` · ${occasion.dealCount} deal${occasion.dealCount === 1 ? "" : "s"}` : ""}
            {itemCount === 0 ? " · Empty" : ""}
          </p>
        </div>
      </div>
    </Link>
  );
}
