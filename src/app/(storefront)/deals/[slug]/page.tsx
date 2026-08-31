import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import { getDealBySlug, getPublishedDealSlugs, listPublishedDealsByIds } from "@/features/deals";
import { DealAddToCart } from "@/features/deals/components/deal-add-to-cart";
import { DealGallery } from "@/features/deals/components/deal-gallery";
import { DealInfoBlock } from "@/features/deals/components/deal-info-block";
import { DealProductsList } from "@/features/deals/components/deal-products-list";
import { DealRelatedGrid } from "@/features/deals/components/deal-related-grid";
import { DealReviews } from "@/features/deals/components/deal-reviews";
import { DealSpecifications } from "@/features/deals/components/deal-specifications";
import { DealWishlistToggleButton } from "@/features/deals/components/deal-wishlist-toggle-button";
import { ReviewComposer } from "@/features/reviews/components/review-composer";
import { listPublishedDealReviews } from "@/features/reviews/service";

export const revalidate = 900;
export const dynamicParams = true;

function isDeploymentLikeBuild() {
  const ci = (process.env.CI ?? "").trim().toLowerCase();
  const vercel = (process.env.VERCEL ?? "").trim().toLowerCase();

  return ci === "1" || ci === "true" || vercel === "1" || vercel === "true";
}

type DealPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  // In CI/Vercel builds, skip exhaustive deal prerender fan-out to avoid
  // exhausting the Prisma pool during static generation.
  if (isDeploymentLikeBuild()) {
    return [];
  }

  const slugs = await getPublishedDealSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: DealPageProps): Promise<Metadata> {
  const { slug } = await params;
  const deal = await getDealBySlug(slug);

  if (!deal) {
    return buildMetadata({ title: "Deal", path: routes.storefront.deal(slug) });
  }

  return buildMetadata({
    title: deal.seo?.title ?? deal.title,
    path: routes.storefront.deal(slug),
    description:
      deal.seo?.description ??
      deal.shortDescription ??
      deal.description ??
      `Featured deal from the Party Heaven catalog.`,
    ...(deal.seo?.canonicalUrl ? { canonicalUrl: deal.seo.canonicalUrl } : {}),
    ...(deal.seo?.ogTitle ? { openGraphTitle: deal.seo.ogTitle } : {}),
    ...(deal.seo?.ogDescription ? { openGraphDescription: deal.seo.ogDescription } : {}),
    ...(deal.seo?.imageUrl ? { openGraphImage: deal.seo.imageUrl } : {}),
    ...(deal.seo?.keywords ? { keywords: deal.seo.keywords } : {}),
    ...(deal.seo?.noIndex ? { noIndex: true } : {}),
  });
}

export default async function DealPage({ params }: DealPageProps) {
  const { slug } = await params;
  const deal = await getDealBySlug(slug);

  if (!deal) {
    notFound();
  }

  // Related deals (admin-curated cross-sell), mirroring the PDP's related
  // products section.
  const relatedDeals = deal.relatedDealIds.length > 0 ? await listPublishedDealsByIds(deal.relatedDealIds) : [];
  const visibleRelatedDeals = relatedDeals.filter((related) => related.id !== deal.id).slice(0, 4);

  // Deal reviews (approved only) for the storefront reviews section.
  const dealReviews = await listPublishedDealReviews(deal.id);

  const returnTo = routes.storefront.deal(slug);

  return (
    <PageShell className="gap-14">
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
            <Link href={routes.storefront.deals} className="hover:text-foreground transition-colors">
              Deals
            </Link>
          </li>
          {deal.categorySlug ? (
            <>
              <li aria-hidden>
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li>
                <Link
                  href={routes.storefront.category(deal.categorySlug)}
                  className="hover:text-foreground transition-colors"
                >
                  {deal.categorySlug.split("-").join(" ")}
                </Link>
              </li>
            </>
          ) : null}
          <li aria-hidden>
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li aria-current="page" className="text-foreground max-w-50 truncate font-medium sm:max-w-xs">
            {deal.title}
          </li>
        </ol>
      </nav>

      {/* Hero: gallery + deal info (mirrors the PDP overview layout) */}
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <DealGallery deal={deal} />

        <div className="space-y-6">
          <DealInfoBlock deal={deal} />

          {/* What's included — replaces the variant picker found on the PDP */}
          <DealProductsList deal={deal} />

          {!deal.isAvailable ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              This deal is currently out of stock because one of the included products is unavailable.
              Check back soon or visit the product pages.
            </div>
          ) : null}

          <div className="space-y-3">
            <DealAddToCart deal={deal} />
            <DealWishlistToggleButton deal={deal} />
          </div>
        </div>
      </div>

      {/* Specifications */}
      {deal.specifications.length > 0 ? <DealSpecifications specifications={deal.specifications} /> : null}

      {/* Related deals (rendered above reviews) */}
      <DealRelatedGrid deals={visibleRelatedDeals} />

      {/* Reviews */}
      <DealReviews
        reviews={dealReviews.reviews}
        summary={dealReviews.summary}
        composer={<ReviewComposer dealId={deal.id} returnTo={returnTo} />}
      />
    </PageShell>
  );
}
