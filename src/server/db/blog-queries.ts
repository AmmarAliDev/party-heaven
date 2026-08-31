import type { Prisma } from "@prisma/client";

import { getPrismaClient } from "@/server/db";

const blogPostSelect = {
  id: true,
  locale: true,
  title: true,
  slug: true,
  excerpt: true,
  content: true,
  coverImageUrl: true,
  coverImageAlt: true,
  coverImageWidth: true,
  coverImageHeight: true,
  status: true,
  publishedAt: true,
  seoTitle: true,
  seoDescription: true,
  seoCanonicalUrl: true,
  seoOgTitle: true,
  seoOgDescription: true,
  seoImageUrl: true,
  seoKeywords: true,
  seoNoIndex: true,
  seoSchemaNotes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BlogPostSelect;

export type StorefrontBlogPostRecord = Prisma.BlogPostGetPayload<{ select: typeof blogPostSelect }>;

export async function listBlogPostsByLocale(locale: string) {
  const db = getPrismaClient();

  return db.blogPost.findMany({
    where: {
      locale,
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: blogPostSelect,
  });
}

export async function getBlogPostBySlug(slug: string, locale: string) {
  const db = getPrismaClient();

  return db.blogPost.findFirst({
    where: {
      slug,
      locale,
    },
    select: blogPostSelect,
  });
}

export async function getAllBlogPostSlugsByLocale(locale: string) {
  const db = getPrismaClient();

  return db.blogPost.findMany({
    where: {
      locale,
    },
    select: {
      slug: true,
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
}

/**
 * Lightweight published blog post rows for sitemap generation. Filters to
 * posts that have actually gone live (publishedAt in the past) and includes
 * the canonical override + noindex flag so the sitemap lists canonical URLs
 * and skips noindexed articles.
 */
export async function getBlogPostSitemapEntries(locale: string) {
  const db = getPrismaClient();

  return db.blogPost.findMany({
    where: {
      locale,
      status: "PUBLISHED",
      publishedAt: { lte: new Date() },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      slug: true,
      seoCanonicalUrl: true,
      seoNoIndex: true,
      publishedAt: true,
      updatedAt: true,
    },
  });
}
