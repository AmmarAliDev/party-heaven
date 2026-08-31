import type { MetadataRoute } from "next";

import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { pushUniqueSitemapEntry, resolveSitemapUrl } from "@/lib/seo/sitemap";
import { getBlogPostSitemapEntries } from "@/server/db/blog-queries";
import { getPublishedCategorySitemapEntries, getPublishedProductSitemapEntries } from "@/server/db/catalog-queries";

const BLOG_SITEMAP_LOCALE = "en";

/**
 * Generates the storefront sitemap.
 *
 * Static routes come from `siteConfig.storefrontNav`; dynamic routes are
 * assembled from the live catalog (published categories + products) and the
 * published blog. Every entry advertises the URL the page actually
 * canonicalizes to (honoring admin `seoCanonicalUrl` overrides) and duplicates
 * are collapsed, so the sitemap never lists the same `<loc>` twice or signals
 * a canonical it doesn't render.
 *
 * This is a Route Handler that Next.js caches by default; the DB reads below
 * run once per cache window.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const seen = new Set<string>();

  // Static storefront routes.
  for (const route of siteConfig.storefrontNav) {
    pushUniqueSitemapEntry(
      entries,
      seen,
      resolveSitemapUrl(route.href),
      new Date().toISOString(),
      {
        changeFrequency: route.href === "/" ? "daily" : "weekly",
        priority: route.href === "/" ? 1.0 : 0.8,
      },
    );
  }

  // Dynamic routes from the catalog + blog. Loaded in parallel; each row
  // respects its canonical override and noindex flag.
  const [categories, products, blogPosts] = await Promise.all([
    getPublishedCategorySitemapEntries(),
    getPublishedProductSitemapEntries(),
    getBlogPostSitemapEntries(BLOG_SITEMAP_LOCALE),
  ]);

  for (const category of categories) {
    if (category.seoNoIndex) {
      continue;
    }

    pushUniqueSitemapEntry(
      entries,
      seen,
      resolveSitemapUrl(routes.storefront.category(category.slug), category.seoCanonicalUrl),
      category.updatedAt.toISOString(),
      { changeFrequency: "weekly", priority: 0.7 },
    );
  }

  for (const product of products) {
    if (product.seoNoIndex || !product.category?.slug) {
      continue;
    }

    pushUniqueSitemapEntry(
      entries,
      seen,
      resolveSitemapUrl(routes.storefront.product(product.category.slug, product.slug), product.seoCanonicalUrl),
      product.updatedAt.toISOString(),
      { changeFrequency: "weekly", priority: 0.6 },
    );
  }

  for (const post of blogPosts) {
    if (post.seoNoIndex) {
      continue;
    }

    pushUniqueSitemapEntry(
      entries,
      seen,
      resolveSitemapUrl(routes.storefront.blogPost(post.slug), post.seoCanonicalUrl),
      (post.publishedAt ?? post.updatedAt).toISOString(),
      { changeFrequency: "monthly", priority: 0.5 },
    );
  }

  return entries;
}
