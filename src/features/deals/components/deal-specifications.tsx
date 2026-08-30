import { Badge } from "@/components/ui/badge";

import type { StorefrontDealSpec } from "../types";

type DealSpecificationsProps = {
  specifications: StorefrontDealSpec[];
};

/**
 * Mirrors the PDP specifications block for deals.
 */
export function DealSpecifications({ specifications }: DealSpecificationsProps) {
  if (specifications.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="deal-specifications-heading">
      <div className="mb-6 space-y-3">
        <Badge variant="secondary">Details</Badge>
        <h2 id="deal-specifications-heading" className="text-2xl font-semibold tracking-tight">
          Specifications
        </h2>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70">
        <dl className="divide-y divide-border/70">
          {specifications.map((spec, index) => (
            <div
              key={`spec-${index}`}
              className="grid grid-cols-2 gap-4 px-5 py-3 sm:grid-cols-[200px_1fr] odd:bg-muted/30"
            >
              <dt className="text-muted-foreground text-sm font-medium">{spec.label}</dt>
              <dd className="text-sm">{spec.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
