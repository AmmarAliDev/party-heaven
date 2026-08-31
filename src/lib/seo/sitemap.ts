import type { MetadataRoute } from "next";

import { resolveCanonicalUrl } from "@/lib/seo/slug";

/**
 * Resolves the absolute URL a sitemap entry should advertise for a route,
 * honoring an optional SEO canonical override.
 *
 * Each storefront page already emits a canonical link (either its default
 * storefront path or an admin-provided `seoCanonicalUrl` override). To avoid
 * duplicate-content signals, the sitemap must advertise the SAME URL the page
 * canonicalizes to. If the override resolves to the same absolute URL as the
 * default path, the single default URL is returned (no redundant override).
 */
export function resolveSitemapUrl(path: string, canonicalUrl?: string | null): string {
  const defaultUrl = resolveCanonicalUrl(path);
  const override = canonicalUrl?.trim();

  if (!override) {
    return defaultUrl;
  }

  const overrideUrl = resolveCanonicalUrl(override);
  return overrideUrl === defaultUrl ? defaultUrl : overrideUrl;
}

/**
 * Appends a URL to the sitemap list only when it has not already been added,
 * guaranteeing zero duplicate `<loc>` entries across static and dynamic routes.
 *
 * Uses the same trailing-slash normalization as `resolveCanonicalUrl` so a URL
 * produced by either path dedupes correctly.
 */
export function pushUniqueSitemapEntry(
  entries: MetadataRoute.Sitemap,
  seen: Set<string>,
  url: string,
  lastModified: Date | string,
  options: { changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"]; priority?: number } = {},
): void {
  // Strip trailing slashes before resolving so absolute URLs normalize the
  // same way relative paths do (e.g. the root "/" → base URL without a slash).
  const trimmedUrl = url.endsWith("/") && url.length > 1 ? url.slice(0, -1) : url;
  const normalized = resolveCanonicalUrl(trimmedUrl);
  if (seen.has(normalized)) {
    return;
  }

  seen.add(normalized);
  entries.push({
    url: normalized,
    lastModified,
    ...(options.changeFrequency ? { changeFrequency: options.changeFrequency } : {}),
    ...(options.priority !== undefined ? { priority: options.priority } : {}),
  });
}
