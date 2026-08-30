import Link from "next/link";
import { AlertTriangle, PackageCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { StorefrontDeal } from "../types";

type DealProductsListProps = {
  deal: StorefrontDeal;
};

/**
 * The deal's "What's included" list — replaces the variant picker found on the
 * product detail page. Each row shows one included product with its quantity
 * ("product name | x Pcs"), its effective variant (when meaningful), and its
 * per-product availability.
 */
export function DealProductsList({ deal }: DealProductsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">What&rsquo;s included</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {deal.products.map((product) => (
          <div
            key={product.id}
            className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-sm"
          >
            <div className="min-w-0">
              <Link
                href={product.href}
                className="text-foreground font-medium underline-offset-4 hover:underline"
              >
                {product.name}
              </Link>
              {product.variantTitle ? (
                <p className="text-muted-foreground mt-0.5 text-xs">{product.variantTitle}</p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <span className="text-muted-foreground whitespace-nowrap font-medium">
                {product.quantity} Pcs
              </span>
              {product.isAvailable ? (
                <Badge variant="success" className="gap-1">
                  <PackageCheck className="size-3" />
                  In stock
                </Badge>
              ) : (
                <Badge variant="danger" className="gap-1">
                  <AlertTriangle className="size-3" />
                  Out of stock
                </Badge>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
