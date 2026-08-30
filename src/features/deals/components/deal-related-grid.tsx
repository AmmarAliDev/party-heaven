import { Badge } from "@/components/ui/badge";

import type { StorefrontDeal } from "../types";
import { DealCard } from "./deal-card";

type DealRelatedGridProps = {
  deals: StorefrontDeal[];
};

/**
 * "Related deals" cross-sell grid shown on the deal detail page — mirrors the
 * PDP's related-products section.
 */
export function DealRelatedGrid({ deals }: DealRelatedGridProps) {
  return (
    <section aria-labelledby="related-deals-heading">
      <div className="mb-6 space-y-3">
        <Badge variant="secondary">More deals</Badge>
        <h2 id="related-deals-heading" className="text-2xl font-semibold tracking-tight">
          Related Deals
        </h2>
      </div>

      {deals.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed border-border/70 px-4 py-5 text-sm">
          No related deals are available right now.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {deals.map((deal) => (
            <li key={deal.id} className="list-none">
              <DealCard deal={deal} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
