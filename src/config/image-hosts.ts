/**
 * Single source of truth for hostnames the storefront is allowed to render
 * images from via `next/image`.
 *
 * `next.config.ts` maps these directly into `images.remotePatterns`, and the
 * storefront URL normalizer (`src/features/catalog/lib/product-image-url.ts`)
 * uses the same list so product/category/homepage image URLs that point at
 * unconfigured hosts fall back to the placeholder UI instead of crashing the
 * page with a next/image "unconfigured host" error.
 */

export type StorefrontImageRemotePattern = {
  protocol: "http" | "https";
  hostname: string;
  pathname: string;
};

export const STOREFRONT_IMAGE_REMOTE_PATTERNS: StorefrontImageRemotePattern[] = [
  // Admin/content uploads are stored in Vercel Blob in all environments.
  { protocol: "https", hostname: "**.public.blob.vercel-storage.com", pathname: "/**" },
  // Local/dev demo catalog seeding uses placeholder remote images for realistic test data.
  { protocol: "https", hostname: "placehold.co", pathname: "/**" },
  { protocol: "https", hostname: "picsum.photos", pathname: "/**" },
];

/**
 * Matches a hostname against the allowlist. Supports a leading `**.` wildcard
 * (mirroring next/image remotePatterns semantics) so subdomains of a shared
 * host are allowed.
 */
export function isStorefrontImageHostAllowed(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();

  if (!host) {
    return false;
  }

  return STOREFRONT_IMAGE_REMOTE_PATTERNS.some((pattern) => {
    const patternHost = pattern.hostname.toLowerCase();

    if (patternHost.startsWith("**.")) {
      const suffix = patternHost.slice(3);
      return host === suffix || host.endsWith(`.${suffix}`);
    }

    return host === patternHost;
  });
}
