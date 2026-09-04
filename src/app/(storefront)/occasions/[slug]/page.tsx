import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarHeart, ChevronRight, Home, Package } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { ProductGridCard } from "@/features/catalog";
import { DealCard } from "@/features/deals/components/deal-card";
import { getOccasionBySlug, getPublishedOccasionSlugs } from "@/features/occasions";

export const revalidate = 900;
export const dynamicParams = true;

function isDeploymentLikeBuild() {
  const ci = (process.env.CI ?? "").trim().toLowerCase();
  const vercel = (process.env.VERCEL ?? "").trim().toLowerCase();

  return ci === "1" || ci === "true" || vercel === "1" || vercel === "true";
}

type OccasionPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  // In CI/Vercel builds, skip exhaustive occasion prerender fan-out to avoid
  // exhausting the Prisma pool during static generation.
  if (isDeploymentLikeBuild()) {
    return [];
  }

  const slugs = await getPublishedOccasionSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: OccasionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const occasion = await getOccasionBySlug(slug);

  if (!occasion) {
    return buildMetadata({ title: "Occasion", path: routes.storefront.occasion(slug) });
  }

  return buildMetadata({
    title: occasion.seo?.title ?? occasion.name,
    path: routes.storefront.occasion(slug),
    description:
      occasion.seo?.description ??
      occasion.shortDescription ??
      occasion.description ??
      `Curated collection for ${occasion.name} from the Party Heaven catalog.`,
    ...(occasion.seo?.canonicalUrl ? { canonicalUrl: occasion.seo.canonicalUrl } : {}),
    ...(occasion.seo?.ogTitle ? { openGraphTitle: occasion.seo.ogTitle } : {}),
    ...(occasion.seo?.ogDescription ? { openGraphDescription: occasion.seo.ogDescription } : {}),
    ...(occasion.seo?.imageUrl ? { openGraphImage: occasion.seo.imageUrl } : {}),
    ...(occasion.seo?.keywords ? { keywords: occasion.seo.keywords } : {}),
    ...(occasion.seo?.noIndex ? { noIndex: true } : {}),
  });
}

export default async function OccasionPage({ params }: OccasionPageProps) {
  const { slug } = await params;
  const occasion = await getOccasionBySlug(slug);

  if (!occasion) {
    notFound();
  }

  const hasProducts = occasion.products.length > 0;
  const hasDeals = occasion.deals.length > 0;

  return (
    <PageShell className="gap-12">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <ol className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm">
          <li>
            <Link
              href={routes.storefront.home}
              className="hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <Home className="h-3.5 w-3.5" />
              <span className="sr-only">Home</span>
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li>
            <Link href={routes.storefront.occasions} className="hover:text-foreground transition-colors">
              Occasions
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li aria-current="page" className="text-foreground max-w-50 truncate font-medium sm:max-w-xs">
            {occasion.name}
          </li>
        </ol>
      </nav>

      {/* Cover + intro */}
      <section aria-labelledby="occasion-page-heading" className="space-y-6">
        <div className="relative overflow-hidden rounded-(--radius-card)">
          {occasion.coverImageUrl ? (
            <Image
              src={occasion.coverImageUrl}
              alt={occasion.coverImageAlt ?? occasion.name}
              width={1600}
              height={640}
              sizes="100vw"
              priority
              className="h-64 w-full object-cover sm:h-80 lg:h-96"
              data-testid={`storefront-occasion-cover-${occasion.slug}`}
            />
          ) : (
            <div
              className="from-primary/20 via-primary/10 to-primary/5 flex h-64 w-full items-center justify-center bg-linear-to-br sm:h-80"
              aria-hidden="true"
            >
              <CalendarHeart className="text-primary/50 size-14" />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Occasion</Badge>
            {occasion.isSpecial ? <Badge variant="danger">Special occasion</Badge> : null}
          </div>
          <h1 id="occasion-page-heading" className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {occasion.name}
          </h1>
          {occasion.shortDescription ? (
            <p className="text-primary-strong text-sm sm:text-base">{occasion.shortDescription}</p>
          ) : null}
          {occasion.description ? (
            <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed sm:text-base">
              {occasion.description}
            </p>
          ) : null}
        </div>
      </section>

      {/* Products — rendered with the same card grid as the category pages */}
      {hasProducts ? (
        <section aria-labelledby="occasion-products-heading" className="space-y-6">
          <SectionHeader
            title="Products"
            eyebrow=""
            titleAs="h2"
            titleId="occasion-products-heading"
            description={
              occasion.products.length === 1
                ? "1 product curated for this occasion"
                : `${occasion.products.length} products curated for this occasion`
            }
          />
          <ul
            className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
            data-testid="storefront-occasion-products-grid"
          >
            {occasion.products.map((product, index) => (
              <li key={product.id} className="list-none">
                <ProductGridCard
                  product={product}
                  eagerImage={index === 0}
                  itemListName="Occasion products"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Deals */}
      {hasDeals ? (
        <section aria-labelledby="occasion-deals-heading" className="space-y-6">
          <SectionHeader
            title="Deals"
            eyebrow=""
            titleAs="h2"
            titleId="occasion-deals-heading"
            description={
              occasion.deals.length === 1
                ? "1 deal curated for this occasion"
                : `${occasion.deals.length} deals curated for this occasion`
            }
          />
          <ul
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="storefront-occasion-deals-grid"
          >
            {occasion.deals.map((deal) => (
              <li key={deal.id} className="list-none">
                <DealCard deal={deal} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!hasProducts && !hasDeals ? (
        <Card>
          <CardContent className="space-y-2 p-8 text-center">
            <Package className="text-muted-foreground mx-auto size-8" />
            <p className="font-medium">This occasion is being put together</p>
            <p className="text-muted-foreground text-sm">
              We&rsquo;re still curating the products and deals for this occasion. Check back soon.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </PageShell>
  );
}
