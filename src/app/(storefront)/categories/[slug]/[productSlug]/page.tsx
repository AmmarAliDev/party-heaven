import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import {
  getCatalogCategory,
  getProductBySlug,
  getProductMetadataBySlug,
  getProductSlugsWithCategory,
  getRelatedProducts,
} from "@/features/catalog";
import { ProductOverview } from "@/features/catalog/components/product-overview";
import { ProductRelatedGrid } from "@/features/catalog/components/product-related-grid";
import { ProductReviews } from "@/features/catalog/components/product-reviews";
import { ProductSpecifications } from "@/features/catalog/components/product-specifications";
import {
  toProductStaticParams,
} from "@/features/rendering/seo-content-rendering";
import { ReviewComposer } from "@/features/reviews/components/review-composer";

export const revalidate = 900;
export const dynamicParams = true;

function isDeploymentLikeBuild() {
  const ci = (process.env.CI ?? "").trim().toLowerCase();
  const vercel = (process.env.VERCEL ?? "").trim().toLowerCase();

  return ci === "1" || ci === "true" || vercel === "1" || vercel === "true";
}

type ProductPageProps = {
  params: Promise<{ slug: string; productSlug: string }>;
};

export async function generateStaticParams() {
  // In CI/Vercel builds, skip exhaustive product prerender fan-out to avoid
  // exhausting the Prisma pool during static generation.
  if (isDeploymentLikeBuild()) {
    return [];
  }

  const slugs = await getProductSlugsWithCategory();
  return toProductStaticParams(slugs);
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const product = await getProductMetadataBySlug(productSlug);

  if (!product || product.categorySlug !== slug) {
    return buildMetadata({ title: "Product", path: `/categories/${slug}/${productSlug}` });
  }

  return buildMetadata({
    title: product.name,
    path: routes.storefront.product(slug, productSlug),
    description: product.shortDescription,
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug, productSlug } = await params;

  const [product, category, relatedProducts] = await Promise.all([
    getProductBySlug(productSlug),
    getCatalogCategory(slug),
    getRelatedProducts(slug, productSlug),
  ]);

  // Guard: product must exist and belong to this category
  if (!product || product.categorySlug !== slug) {
    notFound();
  }

  if (!category) {
    notFound();
  }

  const returnTo = routes.storefront.product(slug, productSlug);

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
            <Link
              href={routes.storefront.category(category.slug)}
              className="hover:text-foreground transition-colors"
            >
              {category.name}
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li
            aria-current="page"
            className="text-foreground max-w-50 truncate font-medium sm:max-w-xs"
          >
            {product.name}
          </li>
        </ol>
      </nav>

      {/* Hero: gallery + product panel (kept in sync for variant products) */}
      <ProductOverview product={product} />

      {/* Specifications */}
      {product.specifications.length > 0 ? (
        <ProductSpecifications specifications={product.specifications} />
      ) : null}

      {/* Related products (rendered above reviews) */}
      <ProductRelatedGrid products={relatedProducts} />

      {/* Reviews */}
      <ProductReviews
        reviews={product.reviews}
        summary={product.reviewSummary}
        composer={<ReviewComposer productId={product.id} returnTo={returnTo} />}
      />
    </PageShell>
  );
}
