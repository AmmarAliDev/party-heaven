import { describe, expect, it } from "vitest";

import {
  isStorefrontImageHostAllowed,
  STOREFRONT_IMAGE_REMOTE_PATTERNS,
} from "@/config/image-hosts";
import { normalizeCatalogImageUrl } from "@/features/catalog/lib/product-image-url";

describe("storefront image host allowlist", () => {
  it("exposes remote patterns consumable by next/image", () => {
    expect(STOREFRONT_IMAGE_REMOTE_PATTERNS.length).toBeGreaterThan(0);
    for (const pattern of STOREFRONT_IMAGE_REMOTE_PATTERNS) {
      expect(pattern.hostname.length).toBeGreaterThan(0);
      expect(["http", "https"]).toContain(pattern.protocol);
    }
  });

  it("allows configured hosts and their subdomains", () => {
    expect(isStorefrontImageHostAllowed("7vmvuxle2dj9679q.public.blob.vercel-storage.com")).toBe(true);
    expect(isStorefrontImageHostAllowed("public.blob.vercel-storage.com")).toBe(true);
    expect(isStorefrontImageHostAllowed("placehold.co")).toBe(true);
    expect(isStorefrontImageHostAllowed("picsum.photos")).toBe(true);
  });

  it("rejects unconfigured hosts and empty input", () => {
    expect(isStorefrontImageHostAllowed("example.com")).toBe(false);
    expect(isStorefrontImageHostAllowed("cdn.example.com")).toBe(false);
    expect(isStorefrontImageHostAllowed("")).toBe(false);
    expect(isStorefrontImageHostAllowed(" ")).toBe(false);
  });
});

describe("normalizeCatalogImageUrl", () => {
  it("accepts root-relative paths", () => {
    expect(normalizeCatalogImageUrl("/images/product.jpg")).toBe("/images/product.jpg");
  });

  it("accepts allowlisted absolute URLs", () => {
    expect(
      normalizeCatalogImageUrl("https://7vmvuxle2dj9679q.public.blob.vercel-storage.com/admin/product/img.png"),
    ).toBe("https://7vmvuxle2dj9679q.public.blob.vercel-storage.com/admin/product/img.png");
    expect(normalizeCatalogImageUrl("https://picsum.photos/seed/x/200")).toBe("https://picsum.photos/seed/x/200");
  });

  it("rejects unconfigured hosts so next/image never crashes the page", () => {
    expect(normalizeCatalogImageUrl("https://example.com/product.jpg")).toBeUndefined();
    expect(normalizeCatalogImageUrl("https://cdn.example.com/product.jpg")).toBeUndefined();
  });

  it("rejects empty, non-string, and unsafe protocol values", () => {
    expect(normalizeCatalogImageUrl("")).toBeUndefined();
    expect(normalizeCatalogImageUrl("   ")).toBeUndefined();
    expect(normalizeCatalogImageUrl(null)).toBeUndefined();
    expect(normalizeCatalogImageUrl(undefined)).toBeUndefined();
    expect(normalizeCatalogImageUrl("javascript:alert(1)")).toBeUndefined();
    expect(normalizeCatalogImageUrl("data:text/plain;base64,SGVsbG8=")).toBeUndefined();
  });
});
