export const adminImageUploadPurposes = ["product", "category", "seo", "blog", "banner", "content", "occasion"] as const;

export type AdminImageUploadPurpose = (typeof adminImageUploadPurposes)[number];

export const adminImageUploadMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;

export const ADMIN_IMAGE_UPLOAD_MAX_BYTES = 4_000_000;

export const ADMIN_IMAGE_UPLOAD_ACCEPT = adminImageUploadMimeTypes.join(",");

export function formatImageUploadSize(bytes: number) {
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
  }

  if (bytes >= 1_000) {
    return `${Math.round(bytes / 1_000)} KB`;
  }

  return `${bytes} B`;
}