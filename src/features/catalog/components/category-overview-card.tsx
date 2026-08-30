import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { testIds } from "@/lib/test-selectors";

import type { CatalogCategory } from "../types";

type CategoryOverviewCardProps = {
  category: CatalogCategory;
  eagerImage?: boolean;
};

export function CategoryOverviewCard({ category, eagerImage = false }: CategoryOverviewCardProps) {
  return (
    <Link
      href={category.href}
      className="group focus-visible:ring-ring block focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      data-testid={testIds.storefront.categoryCard(category.slug)}
    >
      <article>
        <Card className="border-border/70 h-full shadow-(--shadow-soft) transition-transform duration-200 group-hover:-translate-y-0.5">
          <CardContent className="flex h-full flex-col gap-2 p-3">
            <div className="relative overflow-hidden rounded-lg border border-border/60 mb-2" aria-hidden="true">
              {category.cardImageUrl ? (
                <Image
                  src={category.cardImageUrl}
                  alt={category.name}
                  height={214}
                  width={365}
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  className="h-54 w-full object-cover"
                  loading={eagerImage ? "eager" : "lazy"}
                  fetchPriority={eagerImage ? "high" : "auto"}
                  data-testid={`storefront-category-card-image-${category.slug}`}
                />
              ) : (
                <div
                  className="flex h-54 w-full items-center justify-center bg-linear-to-br from-slate-100 via-slate-200 to-slate-100 text-xs font-medium uppercase tracking-[0.16em] text-slate-600"
                  data-testid={`storefront-category-card-fallback-${category.slug}`}
                >
                  Category preview
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/15 via-black/0 to-black/0" />
            </div>

            <div className="flex items-center justify-between gap-4">
              <Badge variant="secondary">Simple category</Badge>
              <ArrowRight
                className="text-muted-foreground size-4 transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">{category.name}</h2>
              <p className="text-muted-foreground text-sm line-clamp-2">{category.description}</p>
            </div>

            <div className="mt-auto flex items-center justify-end gap-3 text-sm">
              <span className="font-medium">
                {category.productCount} {category.productCount === 1 ? "product" : "products"}
              </span>
            </div>
          </CardContent>
        </Card>
      </article>
    </Link>
  );
}
