import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "@/components/ui/price-display";
import { formatPrice } from "@/lib/currency";

import type { StorefrontDeal } from "../types";

type DealInfoBlockProps = {
  deal: StorefrontDeal;
};

function inventoryBadge(quantity: number) {
  if (quantity <= 0) return { label: "Out of stock", variant: "danger" as const };
  if (quantity <= 5) return { label: `Only ${quantity} left`, variant: "warning" as const };
  return { label: "In stock", variant: "success" as const };
}

/**
 * Mirrors the PDP info block: title, short description, price/compare-at, and
 * an availability badge driven by the least-available included product.
 */
export function DealInfoBlock({ deal }: DealInfoBlockProps) {
  const stock = inventoryBadge(deal.availableStock);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Featured Deal</Badge>
          {deal.isAvailable ? (
            <Badge variant={stock.variant}>{stock.label}</Badge>
          ) : (
            <Badge variant="danger">Out of stock</Badge>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{deal.title}</h1>
        {deal.shortDescription ? (
          <p className="text-muted-foreground">{deal.shortDescription}</p>
        ) : null}
      </div>

      <PriceDisplay
        amount={deal.price}
        {...(typeof deal.compareAt === "number" ? { compareAt: deal.compareAt } : {})}
        size="lg"
      />

      {deal.description ? (
        <p className="text-muted-foreground text-sm leading-relaxed">{deal.description}</p>
      ) : null}

      {typeof deal.compareAt === "number" && deal.compareAt > deal.price ? (
        <p className="text-success text-sm font-medium">
          You save {formatPrice(deal.compareAt - deal.price)} on this deal.
        </p>
      ) : null}
    </div>
  );
}
