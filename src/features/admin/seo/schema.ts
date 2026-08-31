import { z } from "zod";

export const SEO_CHARACTER_LIMITS = {
  slug: 100,
  title: 70,
  description: 160,
  ogTitle: 95,
  ogDescription: 200,
  keywords: 200,
  schemaNotes: 2000,
} as const;

export const adminSlugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const reservedSeoSlugs = new Set([
  "account",
  "admin",
  "api",
  "auth",
  "cart",
  "checkout",
  "favicon.ico",
  "search",
  "wishlist",
]);

function normalizeOptionalText(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value.length === 0 ? undefined : value;
}

function parseBooleanish(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = `${value ?? ""}`.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "on" || normalized === "yes";
}

function isAbsoluteUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isRelativePath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !/[\r\n]/.test(value);
}

function isValidUrlOrPath(value: string) {
  return isAbsoluteUrl(value) || isRelativePath(value);
}

const optionalTextField = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => normalizeOptionalText(value));

export const adminSlugSchema = z
  .string()
  .trim()
  .min(2, "Slug must be at least 2 characters.")
  .max(SEO_CHARACTER_LIMITS.slug, `Slug must be ${SEO_CHARACTER_LIMITS.slug} characters or fewer.`)
  .regex(adminSlugRegex, "Slug must use lowercase letters, numbers, and single hyphens.")
  .refine((value) => !reservedSeoSlugs.has(value), {
    message: "This page address is reserved by the storefront. Please choose a more specific slug.",
  });

export const adminSeoFieldsSchema = z.object({
  seoTitle: optionalTextField(SEO_CHARACTER_LIMITS.title, "Meta title must be 70 characters or fewer."),
  seoDescription: optionalTextField(SEO_CHARACTER_LIMITS.description, "Meta description must be 160 characters or fewer."),
  seoCanonicalUrl: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || isValidUrlOrPath(value), {
      message: "Canonical URL must be a valid full URL or start with /.",
    })
    .transform((value) => normalizeOptionalText(value)),
  seoOgTitle: optionalTextField(SEO_CHARACTER_LIMITS.ogTitle, "OG title must be 95 characters or fewer."),
  seoOgDescription: optionalTextField(SEO_CHARACTER_LIMITS.ogDescription, "OG description must be 200 characters or fewer."),
  seoImageUrl: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || isValidUrlOrPath(value), {
      message: "OG image must be a valid full URL or start with /.",
    })
    .transform((value) => normalizeOptionalText(value)),
  seoKeywords: optionalTextField(
    SEO_CHARACTER_LIMITS.keywords,
    `Keywords must be ${SEO_CHARACTER_LIMITS.keywords} characters or fewer.`,
  ),
  seoNoIndex: z.preprocess(parseBooleanish, z.boolean()).default(false),
  seoSchemaNotes: optionalTextField(SEO_CHARACTER_LIMITS.schemaNotes, "Schema notes must be 2000 characters or fewer."),
});

export type AdminSeoFieldsInput = z.infer<typeof adminSeoFieldsSchema>;

export function createSlugCandidate(value: string | null | undefined) {
  return `${value ?? ""}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, SEO_CHARACTER_LIMITS.slug);
}

export function getSeoSlugConflictMessage(entityLabel: string) {
  return `That ${entityLabel.toLowerCase()} URL is already in use. Update the slug so the page address stays unique.`;
}

export type AdminSeoPreviewInput = {
  title?: string | null;
  slug?: string | null;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalUrl?: string | null;
  seoNoIndex?: boolean;
  basePath?: string | null | undefined;
};

export function buildAdminSeoPreview(input: AdminSeoPreviewInput) {
  const fallbackTitle = input.title?.trim() || "Preview title";
  const fallbackDescription = input.description?.trim() || "A concise search summary will appear here after saving.";
  const title = input.seoTitle?.trim() || fallbackTitle;
  const description = input.seoDescription?.trim() || fallbackDescription;
  const normalizedBasePath = `${input.basePath ?? ""}`.trim().replace(/\/+$/g, "");
  const normalizedSlug = input.slug?.trim() ? `/${input.slug.trim()}` : "/page-slug";
  const path = `${normalizedBasePath}${normalizedSlug}`.replace(/\/+/g, "/") || "/";
  const url = input.canonicalUrl?.trim() || path;
  const warnings: string[] = [];

  if (title.length > SEO_CHARACTER_LIMITS.title) {
    warnings.push("Meta title is longer than the recommended search result length.");
  }

  if (description.length > SEO_CHARACTER_LIMITS.description) {
    warnings.push("Meta description is longer than the recommended search result length.");
  }

  return {
    title,
    description,
    url,
    noIndex: Boolean(input.seoNoIndex),
    warnings,
  };
}
