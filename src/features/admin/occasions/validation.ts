import { z } from "zod";

import { adminSeoFieldsSchema, adminSlugSchema } from "@/features/admin/seo/schema";
import { validateWithSchema } from "@/lib/security/validation";

function normalizeOptionalText(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value.length === 0 ? undefined : value;
}

const optionalShortText = z
  .string()
  .trim()
  .max(240, "Short description must be 240 characters or fewer.")
  .optional()
  .transform((value) => normalizeOptionalText(value));

const optionalText = z
  .string()
  .trim()
  .max(4000, "Description must be 4000 characters or fewer.")
  .optional()
  .transform((value) => normalizeOptionalText(value));

function isRelativePath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !/[\r\n]/.test(value);
}

function isAbsoluteHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const optionalImageUrlSchema = z
  .string()
  .trim()
  .optional()
  .refine((value) => {
    if (!value) {
      return true;
    }

    return isRelativePath(value) || isAbsoluteHttpUrl(value);
  }, "Cover image must be a valid full URL or start with /.")
  .transform((value) => normalizeOptionalText(value));

const optionalAltTextSchema = z
  .string()
  .trim()
  .max(160, "Cover image alt text must be 160 characters or fewer.")
  .optional()
  .transform((value) => normalizeOptionalText(value));

function parseBooleanish(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = `${value ?? ""}`.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "on" || normalized === "yes";
}

/**
 * Coerces an empty string (blank form select) to `undefined` so the inner
 * optional schema round-trips cleanly.
 */
function parseEmptyToUndefined(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}

export const adminOccasionStatusValues = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

/**
 * One curated product row. `categoryId` is informational (the product's real
 * category lives on the `Product` record) — it travels with the row only so
 * the edit form can restore the right category context in the picker.
 */
const adminOccasionProductSchema = z.object({
  productId: z.string({ error: "Product is required." }).trim().min(1, "Product is required."),
  categoryId: z.preprocess(parseEmptyToUndefined, z.string().trim().max(80).optional()),
});

export const adminOccasionMutationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Occasion name must be at least 2 characters.")
      .max(120, "Occasion name must be 120 characters or fewer."),
    slug: adminSlugSchema,
    shortDescription: optionalShortText,
    description: optionalText,
    coverImageUrl: optionalImageUrlSchema,
    coverImageAlt: optionalAltTextSchema,
    status: z.enum(adminOccasionStatusValues, {
      error: "Status must be one of DRAFT, PUBLISHED, or ARCHIVED.",
    }),
    // Special occasions are surfaced as seasonal/hero content; normal
    // occasions are everyday collections.
    isSpecial: z.preprocess(parseBooleanish, z.boolean()).default(false),
    products: z.array(adminOccasionProductSchema).default([]),
    dealIds: z
      .array(z.string().trim().min(1))
      .default([])
      .transform((ids) => [...new Set(ids)]),
  })
  .extend(adminSeoFieldsSchema.shape)
  .superRefine((input, ctx) => {
    if (input.products.length === 0 && input.dealIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Add at least one product or deal to the occasion.",
        path: [],
      });
    }

    const seenProducts = new Set<string>();
    for (const [index, product] of input.products.entries()) {
      if (seenProducts.has(product.productId)) {
        ctx.addIssue({
          code: "custom",
          message: "Each product can only be added to an occasion once.",
          path: ["products", index, "productId"],
        });
      }
      seenProducts.add(product.productId);
    }
  });

export const adminOccasionCreateSchema = adminOccasionMutationSchema;

export const adminOccasionUpdateSchema = adminOccasionMutationSchema.extend({
  id: z
    .string({ error: "Occasion ID is required." })
    .trim()
    .min(1, "Occasion ID is required."),
});

export type AdminOccasionCreateInput = z.infer<typeof adminOccasionCreateSchema>;
export type AdminOccasionUpdateInput = z.infer<typeof adminOccasionUpdateSchema>;
export type AdminOccasionProductInput = z.infer<typeof adminOccasionProductSchema>;

export function validateAdminOccasionCreateInput(input: unknown) {
  return validateWithSchema(adminOccasionCreateSchema, input);
}

export function validateAdminOccasionUpdateInput(input: unknown) {
  return validateWithSchema(adminOccasionUpdateSchema, input);
}
