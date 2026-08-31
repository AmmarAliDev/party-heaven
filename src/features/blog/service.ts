import { AppError } from "@/lib/errors/app-error";
import {
  getBlogPostBySlug as getBlogPostRecordBySlug,
  listBlogPostsByLocale,
  type StorefrontBlogPostRecord,
} from "@/server/db/blog-queries";

import type { BlogListingItem, BlogLocale, BlogMetadataInput, BlogPost } from "./types";

const BLOG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_BLOG_LOCALE: BlogLocale = "en";
const ALLOWED_BLOG_STATUSES: BlogPost["status"][] = ["draft", "published", "archived"];

type GetBlogPostsOptions = {
  locale?: BlogLocale;
  includeDrafts?: boolean;
  limit?: number;
  excludeSlug?: string;
};

type GetBlogPostBySlugOptions = {
  locale?: BlogLocale;
  includeDrafts?: boolean;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCoverImage(record: StorefrontBlogPostRecord): BlogPost["coverImage"] {
  return {
    src: record.coverImageUrl ?? "/blog/budget-basket.svg",
    alt: record.coverImageAlt ?? `${record.title} cover image`,
    width: record.coverImageWidth ?? 1200,
    height: record.coverImageHeight ?? 630,
  };
}

function isValidBlogStatus(value: string): value is BlogPost["status"] {
  return ALLOWED_BLOG_STATUSES.includes(value as BlogPost["status"]);
}

function parseBlogContent(content: unknown): BlogPost["content"] {
  if (!Array.isArray(content)) {
    return [];
  }

  const blocks = content
    .map((item) => {
      if (!isObject(item)) {
        return null;
      }

      if (item.type === "paragraph" && typeof item.text === "string" && item.text.trim().length > 0) {
        return {
          type: "paragraph" as const,
          text: item.text,
        };
      }

      const headingLevel = item.level;
      if (
        item.type === "heading" &&
        typeof item.text === "string" &&
        item.text.trim().length > 0 &&
        typeof headingLevel === "number" &&
        Number.isInteger(headingLevel) &&
        headingLevel >= 1 &&
        headingLevel <= 6
      ) {
        return {
          type: "heading" as const,
          level: headingLevel as 1 | 2 | 3 | 4 | 5 | 6,
          text: item.text,
        };
      }

      if (
        item.type === "list" &&
        Array.isArray(item.items) &&
        item.items.every((entry) => typeof entry === "string")
      ) {
        return {
          type: "list" as const,
          items: item.items,
        };
      }

      if (item.type === "quote" && typeof item.text === "string" && item.text.trim().length > 0) {
        return {
          type: "quote" as const,
          text: item.text,
        };
      }

      return null;
    })
    .filter((item): item is BlogPost["content"][number] => item !== null);

  return blocks.length > 0 ? blocks : [];
}

function mapBlogPost(record: StorefrontBlogPostRecord): BlogPost {
  const normalizedStatus = record.status.toLowerCase();

  return {
    id: record.id,
    locale: record.locale === "ur" ? "ur" : "en",
    title: record.title,
    slug: record.slug,
    excerpt: record.excerpt,
    content: parseBlogContent(record.content),
    coverImage: parseCoverImage(record),
    status: isValidBlogStatus(normalizedStatus) ? normalizedStatus : "draft",
    ...(record.publishedAt ? { publishedAt: record.publishedAt.toISOString() } : {}),
    seo: {
      ...(record.seoTitle ? { metaTitle: record.seoTitle } : {}),
      ...(record.seoDescription ? { metaDescription: record.seoDescription } : {}),
      ...(record.seoCanonicalUrl ? { canonicalUrl: record.seoCanonicalUrl } : {}),
      ...(record.seoOgTitle ? { ogTitle: record.seoOgTitle } : {}),
      ...(record.seoOgDescription ? { ogDescription: record.seoOgDescription } : {}),
      ...(record.seoImageUrl ? { ogImage: record.seoImageUrl } : {}),
      ...(record.seoKeywords ? { keywords: record.seoKeywords } : {}),
      ...(record.seoNoIndex ? { noIndex: true } : {}),
      ...(record.seoSchemaNotes ? { structuredDataNotes: record.seoSchemaNotes } : {}),
    },
  };
}

function toPublishedTimestamp(post: BlogPost) {
  if (!post.publishedAt) return 0;
  const timestamp = Date.parse(post.publishedAt);

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isVisiblePost(post: BlogPost, includeDrafts: boolean) {
  if (includeDrafts) {
    return post.status !== "archived";
  }

  if (post.status !== "published") {
    return false;
  }

  return toPublishedTimestamp(post) <= Date.now();
}

function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase();
}

function ensureValidSlug(slug: string) {
  if (!BLOG_SLUG_PATTERN.test(slug)) {
    throw new AppError("Invalid blog slug.", "VALIDATION_ERROR", {
      statusCode: 400,
      userMessage: "The requested article address is invalid.",
    });
  }
}

export function formatBlogPublishedDate(
  input: string | undefined,
  locale: string = DEFAULT_BLOG_LOCALE,
  fallbackLabel = "Unscheduled",
) {
  if (!input) return fallbackLabel;
  const timestamp = Date.parse(input);

  if (Number.isNaN(timestamp)) {
    return fallbackLabel;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

export async function getBlogPosts(options: GetBlogPostsOptions = {}): Promise<BlogListingItem[]> {
  const locale = options.locale ?? DEFAULT_BLOG_LOCALE;
  const includeDrafts = options.includeDrafts ?? false;
  const limit = options.limit;
  const excludeSlug = options.excludeSlug?.trim().toLowerCase();
  const records: StorefrontBlogPostRecord[] = await listBlogPostsByLocale(locale);

  const filtered: BlogPost[] = records
    .map(mapBlogPost)
    .filter((post: BlogPost) => isVisiblePost(post, includeDrafts))
    .filter((post: BlogPost) => (excludeSlug ? post.slug !== excludeSlug : true))
    .sort((a: BlogPost, b: BlogPost) => toPublishedTimestamp(b) - toPublishedTimestamp(a));

  if (typeof limit === "number" && limit > 0) {
    return filtered.slice(0, limit);
  }

  return filtered;
}

export async function getBlogPostBySlug(
  slug: string,
  options: GetBlogPostBySlugOptions = {},
): Promise<BlogPost | null> {
  const locale = options.locale ?? DEFAULT_BLOG_LOCALE;
  const includeDrafts = options.includeDrafts ?? false;
  const normalizedSlug = normalizeSlug(slug);

  ensureValidSlug(normalizedSlug);

  const record = await getBlogPostRecordBySlug(normalizedSlug, locale);
  const post = record ? mapBlogPost(record) : null;

  if (!post) {
    return null;
  }

  if (!isVisiblePost(post, includeDrafts)) {
    return null;
  }

  return post;
}

export async function getBlogPostSlugs(locale: BlogLocale = DEFAULT_BLOG_LOCALE) {
  const posts = await getBlogPosts({ locale });
  return posts.map((post) => post.slug);
}

export async function getRelatedBlogPosts(post: BlogPost, limit = 3) {
  return getBlogPosts({ locale: post.locale, excludeSlug: post.slug, limit });
}

export function toBlogMetadataInput(post: BlogPost): BlogMetadataInput {
  return {
    title: post.seo.metaTitle ?? post.title,
    description: post.seo.metaDescription ?? post.excerpt,
    path: `/blog/${post.slug}`,
    ...(post.seo.canonicalUrl ? { canonicalUrl: post.seo.canonicalUrl } : {}),
    ...((post.seo.ogTitle ?? post.seo.metaTitle ?? post.title)
      ? { openGraphTitle: post.seo.ogTitle ?? post.seo.metaTitle ?? post.title }
      : {}),
    ...((post.seo.ogDescription ?? post.seo.metaDescription ?? post.excerpt)
      ? { openGraphDescription: post.seo.ogDescription ?? post.seo.metaDescription ?? post.excerpt }
      : {}),
    ...((post.seo.ogImage ?? post.coverImage.src)
      ? { openGraphImage: post.seo.ogImage ?? post.coverImage.src }
      : {}),
    ...(post.seo.keywords ? { keywords: post.seo.keywords } : {}),
    noIndex: post.seo.noIndex ?? false,
  };
}
