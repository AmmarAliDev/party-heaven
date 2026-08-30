import { z } from "zod";

import { adminSeoFieldsSchema, adminSlugSchema } from "@/features/admin/seo/schema";
import { validateWithSchema } from "@/lib/security/validation";

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

/**
 * Parses an optional variant id coming from the admin form. An empty string
 * means "no specific variant" (the deal unit maps to the product's default
 * variant) and is coerced to `undefined` so the inner `nullable` schema
 * round-trips cleanly.
 */
function parseVariantIdish(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return undefined;
  }

  return normalized;
}

const optionalText = z
  .string()
  .trim()
  .max(4000, "Description must be 4000 characters or fewer.")
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const optionalShortText = z
  .string()
  .trim()
  .max(240, "Short description must be 240 characters or fewer.")
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const requiredMoney = (label: string) =>
  z.preprocess(
    parseNumberish,
    z
      .number({ error: `${label} is required.` })
      .finite(`${label} must be a valid number.`)
      .min(0, `${label} cannot be negative.`),
  );

const optionalMoney = (label: string) =>
  z.preprocess(
    parseNumberish,
    z
      .number({ error: `${label} must be a valid number.` })
      .finite(`${label} must be a valid number.`)
      .min(0, `${label} cannot be negative.`)
      .optional(),
  );

const adminDealImageSchema = z.object({
  url: z.string().trim().min(1, "Image URL is required.").url("Please enter a valid image URL."),
  alt: z
    .string()
    .trim()
    .max(160, "Image alt text must be 160 characters or fewer.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

const adminDealProductSchema = z.object({
  productId: z.string({ error: "Product is required." }).trim().min(1, "Product is required."),
  // Optional variant. Empty string → product's default variant.
  variantId: z.preprocess(parseVariantIdish, z.string().trim().nullable().optional()),
  quantity: z.preprocess(
    parseNumberish,
    z
      .number({ error: "Quantity is required." })
      .int("Quantity must be a whole number.")
      .min(1, "Quantity must be at least 1."),
  ),
});

const adminDealSpecificationSchema = z.object({
  key: z.string().trim().min(1, "Specification label is required.").max(80, "Specification label is too long."),
  value: z.string().trim().min(1, "Specification value is required.").max(240, "Specification value is too long."),
});

export const adminDealStatusValues = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export const adminDealMutationSchema = z
  .object({
    title: z.string().trim().min(2, "Title must be at least 2 characters.").max(120, "Title must be 120 characters or fewer."),
    slug: adminSlugSchema,
    shortDescription: optionalShortText,
    description: optionalText,
    status: z.enum(adminDealStatusValues, {
      error: "Status must be one of DRAFT, PUBLISHED, or ARCHIVED.",
    }),
    categoryId: z.string({ error: "Category is required." }).trim().min(1, "Category is required."),
    price: requiredMoney("Price"),
    comparePrice: optionalMoney("Compare price"),
    products: z.array(adminDealProductSchema).default([]),
    images: z.array(adminDealImageSchema).default([]),
    specifications: z.array(adminDealSpecificationSchema).default([]),
    relatedDealIds: z.array(z.string().trim().min(1)).default([]).transform((ids) => [...new Set(ids)]),
  })
  .extend(adminSeoFieldsSchema.shape)
  .superRefine((input, ctx) => {
    if (input.comparePrice !== undefined && input.comparePrice < input.price) {
      ctx.addIssue({
        code: "custom",
        message: "Compare price must be greater than or equal to the price.",
        path: ["comparePrice"],
      });
    }

    if (input.products.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Add at least one product to the deal.",
        path: ["products"],
      });
    }

    const seenProducts = new Set<string>();
    for (const [index, product] of input.products.entries()) {
      const key = `${product.productId}::${product.variantId ?? ""}`;
      if (seenProducts.has(key)) {
        ctx.addIssue({
          code: "custom",
          message: "Each product (and variant) can only be added to a deal once.",
          path: ["products", index, "productId"],
        });
      }
      seenProducts.add(key);
    }
  });

export const adminDealCreateSchema = adminDealMutationSchema;

export const adminDealUpdateSchema = adminDealMutationSchema.extend({
  id: z.string({ error: "Deal ID is required." }).trim().min(1, "Deal ID is required."),
});

export type AdminDealCreateInput = z.infer<typeof adminDealCreateSchema>;
export type AdminDealUpdateInput = z.infer<typeof adminDealUpdateSchema>;
export type AdminDealProductInput = z.infer<typeof adminDealProductSchema>;
export type AdminDealImageInput = z.infer<typeof adminDealImageSchema>;
export type AdminDealSpecificationInput = z.infer<typeof adminDealSpecificationSchema>;

export function validateAdminDealCreateInput(input: unknown) {
  return validateWithSchema(adminDealCreateSchema, input);
}

export function validateAdminDealUpdateInput(input: unknown) {
  return validateWithSchema(adminDealUpdateSchema, input);
}
