import { z } from "zod";

import { validateWithSchema } from "@/lib/security/validation";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const adminHomepageSectionKindValues = [
  "announcement-bar",
  "featured-categories",
  "featured-deals",
  "featured-products",
  "deal-spotlight",
] as const;

export type AdminHomepageSectionType = (typeof adminHomepageSectionKindValues)[number];

function parseNumberish(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().replaceAll(",", "");
  if (normalized.length === 0) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : value;
}

function parseBooleanish(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = `${value ?? ""}`.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "on" || normalized === "yes";
}

function parseDateish(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return undefined;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? value : parsed;
}

function parseJsonish(value: unknown) {
  if (typeof value !== "string") {
    return value ?? {};
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return {};
  }

  try {
    return JSON.parse(normalized);
  } catch {
    return value;
  }
}

function isValidHref(value: string) {
  return value.startsWith("/") || /^https?:\/\//i.test(value);
}

function isSupportedStorefrontImageHref(value: string) {
  if (value.startsWith("/")) {
    return true;
  }

  try {
    const parsed = new URL(value);
    if (!/^https?:$/i.test(parsed.protocol)) {
      return false;
    }

    return (
      parsed.hostname.endsWith(".public.blob.vercel-storage.com") ||
      parsed.hostname === "placehold.co" ||
      parsed.hostname === "picsum.photos"
    );
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const optionalShortText = z
  .string()
  .trim()
  .max(160, "This field must be 160 characters or fewer.")
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const optionalText = z
  .string()
  .trim()
  .max(2000, "This field must be 2000 characters or fewer.")
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const optionalHref = z
  .string()
  .trim()
  .max(500, "Links must be 500 characters or fewer.")
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))
  .refine((value) => value === undefined || isValidHref(value), {
    message: "Please enter a valid relative path or URL.",
  });

const optionalStorefrontImageHref = z
  .string()
  .trim()
  .max(500, "Image URL must be 500 characters or fewer.")
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))
  .refine((value) => value === undefined || isSupportedStorefrontImageHref(value), {
    message: "Use a relative image path or a configured upload host URL.",
  });

const optionalSectionImageSchema = z
  .object({
    url: z
      .string()
      .trim()
      .min(1, "Image URL is required.")
      .max(500, "Image URL must be 500 characters or fewer.")
      .refine((value) => isSupportedStorefrontImageHref(value), {
        message: "Use a relative image path or a configured upload host URL.",
      }),
    alt: z.string().trim().min(2, "Image alt text is required.").max(160, "Image alt text is too long."),
  })
  .optional();

const optionalSlug = z
  .string()
  .trim()
  .max(120, "Slugs must be 120 characters or fewer.")
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))
  .refine((value) => value === undefined || slugRegex.test(value), {
    message: "Please enter a valid lowercase slug using letters, numbers, and hyphens.",
  });

const optionalCategoryName = z
  .string()
  .trim()
  .max(120, "Category name is too long.")
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const optionalDateTime = z.preprocess(
  parseDateish,
  z.date({ error: "Please enter a valid date and time." }).optional(),
);

const requiredWholeNumber = (label: string) =>
  z.preprocess(
    parseNumberish,
    z
      .number({ error: `${label} is required.` })
      .int(`${label} must be a whole number.`)
      .min(0, `${label} cannot be negative.`),
  );

const optionalWholeNumber = (label: string) =>
  z.preprocess(
    parseNumberish,
    z
      .number({ error: `${label} must be a valid number.` })
      .int(`${label} must be a whole number.`)
      .min(0, `${label} cannot be negative.`)
      .optional(),
  );

const announcementBarContentSchema = z.object({
  message: z.string().trim().min(2, "Announcement message is required.").max(180, "Announcement message is too long."),
  href: optionalHref,
  label: optionalShortText,
});

const featuredCategorySchema = z
  .object({
    id: z.string().trim().min(1, "Category item ID is required."),
    name: optionalCategoryName,
    title: optionalCategoryName,
    description: z.string().trim().min(1, "Category description is required.").max(240, "Category description is too long."),
    href: z
      .string()
      .trim()
      .min(1, "Category link is required.")
      .refine((value) => isValidHref(value), {
        message: "Please enter a valid relative path or URL for the category link.",
      }),
    slug: optionalSlug,
    cardImageUrl: optionalHref,
    imageUrl: optionalHref,
  })
  .superRefine((value, ctx) => {
    if (!value.name && !value.title) {
      ctx.addIssue({
        code: "custom",
        path: ["name"],
        message: "Category name is required.",
      });
    }
  })
  .transform((value) => ({
    id: value.id,
    name: value.name ?? value.title ?? "",
    description: value.description,
    href: value.href,
    ...(value.slug ? { slug: value.slug } : {}),
    ...((value.cardImageUrl ?? value.imageUrl) ? { cardImageUrl: value.cardImageUrl ?? value.imageUrl } : {}),
  }));

const featuredProductSchema = z.object({
  id: z.string().trim().min(1, "Product item ID is required."),
  name: z.string().trim().min(1, "Product name is required.").max(120, "Product name is too long."),
  description: optionalText,
  href: z
    .string()
    .trim()
    .min(1, "Product link is required.")
    .refine((value) => isValidHref(value), {
      message: "Please enter a valid relative path or URL for the product link.",
    }),
  price: requiredWholeNumber("Product price"),
  compareAt: z.preprocess(
    parseNumberish,
    z
      .number({ error: "Product compare-at price must be a valid number." })
      .int("Product compare-at price must be a whole number.")
      .min(0, "Product compare-at price cannot be negative.")
      .optional(),
  ),
  badge: optionalShortText,
});

const featuredCategoriesContentSchema = z.object({
  description: optionalText,
  categories: z.array(featuredCategorySchema).default([]),
});

const featuredProductsContentSchema = z.object({
  description: optionalText,
  products: z.array(featuredProductSchema).default([]),
});

const dealSpotlightContentSchema = z
  .object({
    description: z.string().trim().min(2, "Deal description is required.").max(400, "Deal description is too long."),
    dealLabel: z.string().trim().min(1, "Deal label is required.").max(80, "Deal label is too long."),
    price: requiredWholeNumber("Deal price"),
    compareAt: requiredWholeNumber("Deal compare-at price"),
    ctaLabel: z.string().trim().min(1, "Deal CTA label is required.").max(80, "Deal CTA label is too long."),
    ctaHref: z
      .string()
      .trim()
      .min(1, "Deal CTA link is required.")
      .refine((value) => isValidHref(value), {
        message: "Please enter a valid relative path or URL for the deal CTA.",
      }),
    image: optionalSectionImageSchema,
  })
  .superRefine((input, ctx) => {
    if (input.compareAt < input.price) {
      ctx.addIssue({
        code: "custom",
        path: ["compareAt"],
        message: "Compare-at price must be greater than or equal to the active price.",
      });
    }
  });

/**
 * Featured Deals section — admin configures the shell (title, description, CTA
 * text and link, placeholder message). Deals are never stored in CMS; they are
 * hydrated at runtime from the published Deal records.
 */
const featuredDealsContentSchema = z.object({
  description: optionalText,
  ctaLabel: z.string().trim().min(1, "CTA label is required.").max(80, "CTA label is too long.").default("View all"),
  ctaHref: z
    .string()
    .trim()
    .min(1, "CTA link is required.")
    .refine((value) => isValidHref(value), {
      message: "Please enter a valid relative path or URL for the CTA.",
    })
    .default("/deals"),
  placeholderMessage: z
    .string()
    .trim()
    .min(2, "Placeholder message is required.")
    .max(240, "Placeholder message is too long.")
    .default("No Featured Deals are available right now. Check back soon."),
});

const homepageSectionContentSchemas = {
  "announcement-bar": announcementBarContentSchema,
  "featured-categories": featuredCategoriesContentSchema,
  "featured-deals": featuredDealsContentSchema,
  "featured-products": featuredProductsContentSchema,
  "deal-spotlight": dealSpotlightContentSchema,
} satisfies Record<AdminHomepageSectionType, z.ZodTypeAny>;

export const adminHomepageSectionMutationSchema = z
  .object({
    id: z.string().trim().min(1, "Section ID is required.").optional(),
    key: z
      .string()
      .trim()
      .min(2, "Section key must be at least 2 characters.")
      .max(80, "Section key must be 80 characters or fewer.")
      .regex(slugRegex, "Section key must use lowercase letters, numbers, and single hyphens."),
    title: z.string().trim().min(2, "Section title must be at least 2 characters.").max(120, "Section title is too long."),
    type: z.enum(adminHomepageSectionKindValues, {
      error: "Choose a supported homepage section type.",
    }),
    position: requiredWholeNumber("Display order"),
    active: z.preprocess(parseBooleanish, z.boolean()).default(true),
    startAt: optionalDateTime,
    endAt: optionalDateTime,
    content: z.preprocess(parseJsonish, z.unknown()),
  })
  .superRefine((input, ctx) => {
    if (input.startAt && input.endAt && input.endAt < input.startAt) {
      ctx.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "Schedule end time must be later than the start time.",
      });
    }

    if (!isRecord(input.content)) {
      ctx.addIssue({
        code: "custom",
        path: ["content"],
        message: "Section content must be a valid JSON object.",
      });
      return;
    }

    const contentSchema = homepageSectionContentSchemas[input.type];
    const parsedContent = contentSchema.safeParse(input.content);

    if (!parsedContent.success) {
      const issues = parsedContent.error.issues;
      for (const issue of issues) {
        ctx.addIssue({
          code: "custom",
          path: ["content", ...issue.path],
          message: issue.message,
        });
      }
    }
  })
  .transform((input) => ({
    ...input,
    content: homepageSectionContentSchemas[input.type].parse(input.content),
  }));

export const adminBannerMutationSchema = z
  .object({
    id: z.string().trim().min(1, "Banner ID is required.").optional(),
    title: z.string().trim().min(2, "Banner title must be at least 2 characters.").max(140, "Banner title is too long."),
    imageUrl: z.string().trim().min(1, "Banner image URL is required.").url("Please enter a valid banner image URL."),
    href: optionalHref,
    position: requiredWholeNumber("Banner order"),
    active: z.preprocess(parseBooleanish, z.boolean()).default(true),
    startAt: optionalDateTime,
    endAt: optionalDateTime,
  })
  .superRefine((input, ctx) => {
    if (input.startAt && input.endAt && input.endAt < input.startAt) {
      ctx.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "Banner end time must be later than the start time.",
      });
    }
  });

export const adminDealCampaignMutationSchema = z
  .object({
    id: z.string().trim().min(1, "Campaign ID is required.").optional(),
    name: z.string().trim().min(2, "Campaign name must be at least 2 characters.").max(140, "Campaign name is too long."),
    description: optionalText,
    price: optionalWholeNumber("Campaign price"),
    compareAt: optionalWholeNumber("Campaign compare-at price"),
    targetHref: optionalHref,
    imageUrl: optionalStorefrontImageHref,
    imageAlt: optionalShortText,
    startsAt: optionalDateTime,
    endsAt: optionalDateTime,
    active: z.preprocess(parseBooleanish, z.boolean()).default(true),
  })
  .superRefine((input, ctx) => {
    if (typeof input.compareAt === "number" && typeof input.price === "number" && input.compareAt < input.price) {
      ctx.addIssue({
        code: "custom",
        path: ["compareAt"],
        message: "Campaign compare-at price must be greater than or equal to campaign price.",
      });
    }

    if (input.startsAt && input.endsAt && input.endsAt < input.startsAt) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Campaign end time must be later than the start time.",
      });
    }

    if (input.imageUrl && !input.imageAlt) {
      ctx.addIssue({
        code: "custom",
        path: ["imageAlt"],
        message: "Image alt text is required when an image URL is provided.",
      });
    }

    if (!input.imageUrl && input.imageAlt) {
      ctx.addIssue({
        code: "custom",
        path: ["imageUrl"],
        message: "Add an image URL before setting image alt text.",
      });
    }
  });

export type AdminHomepageSectionInput = z.infer<typeof adminHomepageSectionMutationSchema>;
export type AdminBannerInput = z.infer<typeof adminBannerMutationSchema>;
export type AdminDealCampaignInput = z.infer<typeof adminDealCampaignMutationSchema>;

const homepageSectionContentTemplates: Record<AdminHomepageSectionType, Record<string, unknown>> = {
  "announcement-bar": {
    message: "Free delivery on orders over Rs. 2,000",
    href: "/categories",
    label: "Browse deals",
  },
  "featured-categories": {
    description: "Highlight key shopping categories.",
    categories: [],
  },
  "featured-deals": {
    description: "Deals are loaded from the admin Deals list. This shell configures the section heading and CTA.",
    ctaLabel: "View all",
    ctaHref: "/deals",
    placeholderMessage: "No Featured Deals are available right now. Check back soon.",
  },
  "featured-products": {
    description: "Feature products or hero SKUs.",
    products: [],
  },
  "deal-spotlight": {
    description: "Short-term campaign block with a clear CTA.",
    dealLabel: "Weekend deal",
    price: 999,
    compareAt: 1299,
    ctaLabel: "View deal",
    ctaHref: "/categories",
    image: {
      url: "/blog/placeholder-deal.jpg",
      alt: "Deal spotlight product collage",
    },
  },
};

export function getHomepageSectionContentTemplate(type: AdminHomepageSectionType) {
  return JSON.stringify(homepageSectionContentTemplates[type], null, 2);
}

export function isScheduledWindowActive(
  startAt?: Date | null | undefined,
  endAt?: Date | null | undefined,
  referenceTime = new Date(),
) {
  if (startAt && referenceTime < startAt) {
    return false;
  }

  if (endAt && referenceTime > endAt) {
    return false;
  }

  return true;
}

export function validateAdminHomepageSectionInput(input: unknown) {
  return validateWithSchema(adminHomepageSectionMutationSchema, input);
}

export function validateAdminBannerInput(input: unknown) {
  return validateWithSchema(adminBannerMutationSchema, input);
}

export function validateAdminDealCampaignInput(input: unknown) {
  return validateWithSchema(adminDealCampaignMutationSchema, input);
}
