import { env } from "@/config/env";

import type { BlogListingItem, BlogPost } from "./types";

function toAbsoluteUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return `${env.appUrl}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

export function buildBlogListingJsonLd(posts: BlogListingItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Party Heaven Blog",
    url: toAbsoluteUrl("/blog"),
    inLanguage: "en",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: posts.map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: toAbsoluteUrl(`/blog/${post.slug}`),
        name: post.title,
      })),
    },
  };
}

export function buildBlogPostJsonLd(post: BlogPost) {
  const url = toAbsoluteUrl(`/blog/${post.slug}`);
  const imageSource = post.seo.ogImage ?? post.coverImage?.src;

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    inLanguage: post.locale,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    ...(imageSource ? { image: [toAbsoluteUrl(imageSource)] } : {}),
    author: {
      "@type": "Organization",
      name: "Party Heaven",
    },
    publisher: {
      "@type": "Organization",
      name: "Party Heaven",
    },
  };
}

export function buildBlogPostBreadcrumbJsonLd(post: BlogPost) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Blog",
        item: toAbsoluteUrl("/blog"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: post.title,
        item: toAbsoluteUrl(`/blog/${post.slug}`),
      },
    ],
  };
}
