import type { Metadata } from "next";
import { CalendarHeart } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { listPublishedOccasions,OccasionCard } from "@/features/occasions";

export const revalidate = 900;

export const metadata: Metadata = buildMetadata({
  title: "Shop by Occasion",
  path: routes.storefront.occasions,
  description: "Browse curated Party Heaven collections for every special occasion.",
});

export default async function OccasionsPage() {
  const occasions = await listPublishedOccasions();

  return (
    <PageShell className="gap-10">
      <SectionHeader
        title="Shop by Occasion"
        eyebrow=""
        titleAs="h1"
        titleId="occasions-page-heading"
        description="Hand-picked collections for birthdays, weddings, baby showers and more — everything you need for the moment."
      />

      {occasions.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 p-8 text-center">
            <CalendarHeart className="text-muted-foreground mx-auto size-8" />
            <p className="font-medium">No occasions yet</p>
            <p className="text-muted-foreground text-sm">
              Check back soon for curated collections for every occasion.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4" data-testid="storefront-occasions-grid">
          {occasions.map((occasion, index) => (
            <li key={occasion.id} className="list-none">
              <OccasionCard occasion={occasion} eagerImage={index === 0} />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
