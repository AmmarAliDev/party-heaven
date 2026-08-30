import { env } from "@/config/env";
import { siteConfig } from "@/config/site";

export function generateOrganizationJsonLd() {
  const baseUrl = env.appUrl.endsWith("/") ? env.appUrl.slice(0, -1) : env.appUrl;

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: baseUrl,
    logo: `${baseUrl}${siteConfig.logoPath}`,
    description: siteConfig.description,
  };
}

export function generateBreadcrumbJsonLd(items: Array<{ name: string; item: string }>) {
  const baseUrl = env.appUrl.endsWith("/") ? env.appUrl.slice(0, -1) : env.appUrl;

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.item.startsWith("http") ? crumb.item : `${baseUrl}${crumb.item}`,
    })),
  };
}

export function generateProductJsonLd({
  name,
  description,
  image,
  price,
  currency = "Rs.",
  url,
  sku,
}: {
  name: string;
  description: string;
  image?: string;
  price: number;
  currency?: string;
  url: string;
  sku?: string;
}) {
  const baseUrl = env.appUrl.endsWith("/") ? env.appUrl.slice(0, -1) : env.appUrl;
  const fullUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;
  
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    image,
    sku,
    offers: {
      "@type": "Offer",
      url: fullUrl,
      priceCurrency: currency,
      price: price.toString(),
      availability: "https://schema.org/InStock",
    },
  };
}

export function generateArticleJsonLd({
  title,
  description,
  image,
  datePublished,
  dateModified,
  authorName,
  url,
}: {
  title: string;
  description: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
  url: string;
}) {
  const baseUrl = env.appUrl.endsWith("/") ? env.appUrl.slice(0, -1) : env.appUrl;
  const fullUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;
  
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    image,
    datePublished,
    dateModified,
    author: authorName ? {
      "@type": "Person",
      name: authorName,
    } : undefined,
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}${siteConfig.logoPath}`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": fullUrl,
    },
  };
}

export function StructuredData({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}