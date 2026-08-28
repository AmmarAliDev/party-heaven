import { isStorefrontImageHostAllowed } from "@/config/image-hosts";

/**
 * Returns a safe, renderable storefront image URL or undefined.
 *
 * Accepted values:
 * - Root-relative paths (`/images/product.jpg`)
 * - Absolute HTTP(S) URLs whose host is allowlisted for `next/image`
 *   (see `src/config/image-hosts.ts`)
 *
 * Rejected values include empty strings, unsupported protocols (`javascript:`,
 * `data:`), and unconfigured hosts. Rejecting unconfigured hosts prevents the
 * storefront from crashing with a next/image "unconfigured host" error and
 * lets callers fall back to the placeholder UI instead.
 */
export function normalizeCatalogImageUrl(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const candidate = value.trim();

  if (!candidate) {
    return undefined;
  }

  if (candidate.startsWith("/")) {
    return candidate;
  }

  try {
    const parsedUrl = new URL(candidate);

    if (
      (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") &&
      isStorefrontImageHostAllowed(parsedUrl.hostname)
    ) {
      return candidate;
    }

    return undefined;
  } catch {
    return undefined;
  }
}
