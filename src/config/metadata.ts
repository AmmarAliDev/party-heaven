import type { Metadata } from "next";

import { resolveCanonicalUrl } from "@/lib/seo/slug";

import { env } from "./env";
import { siteConfig } from "./site";

export type BuildMetadataOptions = {
  title?: string | undefined;
  description?: string | undefined;
  path?: string | undefined;
  canonicalUrl?: string | undefined;
  keywords?: string | string[] | undefined;
  openGraphTitle?: string | undefined;
  openGraphDescription?: string | undefined;
  openGraphImage?: string | undefined;
  openGraphType?: "website" | "article" | "profile" | "book" | "music.song" | "music.album" | "music.playlist" | "music.radio_station" | "video.movie" | "video.episode" | "video.tv_show" | "video.other" | undefined;
  openGraphPublishedTime?: string | undefined;
  openGraphModifiedTime?: string | undefined;
  openGraphAuthors?: string[] | undefined;
  noIndex?: boolean | undefined;
};

export function buildMetadata(options: BuildMetadataOptions = {}): Metadata {
  const title = options.title ? `${options.title} | ${siteConfig.name}` : siteConfig.name;
  const description = options.description ?? siteConfig.description;
  const metadataBase = new URL(env.appUrl);
  
  const canonical = options.canonicalUrl 
    ? resolveCanonicalUrl(options.canonicalUrl)
    : resolveCanonicalUrl(options.path ?? "/");
    
  const openGraphTitle = options.openGraphTitle ?? title;
  const openGraphDescription = options.openGraphDescription ?? description;
  const openGraphImage = options.openGraphImage?.trim() || undefined;

  const metadata: Metadata = {
    title,
    description,
    metadataBase,
    applicationName: siteConfig.name,
    alternates: {
      canonical,
    },
    ...(options.keywords ? { keywords: options.keywords } : {}),
    openGraph: {
      title: openGraphTitle,
      description: openGraphDescription,
      url: canonical,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: options.openGraphType || "website",
      ...(options.openGraphType === "article"
        ? {
            publishedTime: options.openGraphPublishedTime,
            modifiedTime: options.openGraphModifiedTime,
            authors: options.openGraphAuthors,
          }
        : {}),
      ...(openGraphImage
        ? {
            images: [
              {
                url: openGraphImage,
                alt: openGraphTitle,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: openGraphImage ? "summary_large_image" : "summary",
      title: openGraphTitle,
      description: openGraphDescription,
      ...(openGraphImage ? { images: [openGraphImage] } : {}),
    },
    robots: options.noIndex
      ? {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
          },
        }
      : {
          index: true,
          follow: true,
        },
  };

  return metadata;
}

export function buildProductMetadata({
  name,
  description,
  path,
  imageUrl,
  canonicalUrl,
  keywords,
  noIndex,
}: {
  name: string;
  description: string;
  path: string;
  imageUrl?: string;
  canonicalUrl?: string;
  keywords?: string;
  noIndex?: boolean;
}): Metadata {
  return buildMetadata({
    title: name,
    description,
    path,
    noIndex,
    ...(canonicalUrl ? { canonicalUrl } : {}),
    ...(keywords ? { keywords } : {}),
    openGraphTitle: name,
    openGraphDescription: description,
    openGraphImage: imageUrl,
    openGraphType: "website",
  });
}

export function buildCategoryMetadata({
  name,
  description,
  path,
  imageUrl,
  canonicalUrl,
  keywords,
  noIndex,
}: {
  name: string;
  description: string;
  path: string;
  imageUrl?: string;
  canonicalUrl?: string;
  keywords?: string;
  noIndex?: boolean;
}): Metadata {
  return buildMetadata({
    title: name,
    description,
    path,
    noIndex,
    ...(canonicalUrl ? { canonicalUrl } : {}),
    ...(keywords ? { keywords } : {}),
    openGraphImage: imageUrl,
  });
}

export function buildArticleMetadata({
  title,
  description,
  path,
  publishedAt,
  modifiedAt,
  authors,
  imageUrl,
  canonicalUrl,
  keywords,
  noIndex,
}: {
  title: string;
  description: string;
  path: string;
  publishedAt?: string;
  modifiedAt?: string;
  authors?: string[];
  imageUrl?: string;
  canonicalUrl?: string;
  keywords?: string;
  noIndex?: boolean;
}): Metadata {
  return buildMetadata({
    title,
    description,
    path,
    noIndex,
    ...(canonicalUrl ? { canonicalUrl } : {}),
    ...(keywords ? { keywords } : {}),
    openGraphType: "article",
    openGraphPublishedTime: publishedAt,
    openGraphModifiedTime: modifiedAt,
    openGraphAuthors: authors,
    openGraphImage: imageUrl,
  });
}
