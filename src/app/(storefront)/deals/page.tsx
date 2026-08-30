import type { Metadata } from "next";
import { Tag } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { SectionHeader } from "@/components/ui/section-header";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { listPublishedDeals } from "@/features/deals";
import { DealCard } from "@/features/deals/components/deal-card";

export const revalidate = 900;

export const metadata: Metadata = buildMetadata({
  title: "Featured Deals",
  path: routes.storefront.deals,
  description: "Browse hand-picked Featured Deals from the Party Heaven catalog.",
});

export default async function DealsPage() {
  const deals = await listPublishedDeals();

  return (
    <PageShell className="gap-10">
      <PageContainer as="section" className="space-y-6 py-8">
        <SectionHeader
          title="Featured Deals"
          eyebrow="Deals"
          description="Hand-picked deals curated from the catalog by the team."
        />

        {deals.length === 0 ? (
          <Card>
            <CardContent className="space-y-2 p-8 text-center">
              <Tag className="mx-auto size-8 text-muted-foreground" />
              <p className="font-medium">No Featured Deals right now</p>
              <p className="text-muted-foreground text-sm">
                Check back soon for fresh deals on products you love.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        )}
      </PageContainer>
    </PageShell>
  );
}
