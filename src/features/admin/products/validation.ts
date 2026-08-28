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

function parseBooleanish(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = `${value ?? ""}`.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "on" || normalized === "yes";
}

/**
 * Parses an optional image → variant index coming from the admin form.
 *
 * The admin form submits `imageVariantIndex` rows as strings. An empty value
 * means the image is product-level (shared across all variants) and is
 * coerced to `null` (the inner schema is `nullable`). The client-side variant
 * select also writes `null` directly into the form state when the admin picks
 * "All variants (shared)", so `null` must round-trip as `null` — returning
 * `undefined` here would make the inner `z.number().nullable()` schema reject
 * it and fail the whole product save. Any non-negative integer is the index
 * into the product's `variants` array.
 */
function parseVariantIndexish(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 ? value : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseVariantOptions(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  const raw = `${value ?? ""}`.trim();
  if (raw.length === 0) {
    return {};
  }

  const entries = raw
    .split(/[\n,;]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const [rawKey, ...rawValueParts] = segment.split(/[:=]/);
      const key = rawKey?.trim() ?? "";
      const parsedValue = rawValueParts.join(":").trim();

      return [key, parsedValue] as const;
    })
    .filter(([key, parsedValue]) => key.length > 0 && parsedValue.length > 0);

  return Object.fromEntries(entries);
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

const requiredWholeNumber = (label: string) =>
  z.preprocess(
    parseNumberish,
    z
      .number({ error: `${label} is required.` })
      .int(`${label} must be a whole number.`)
      .min(0, `${label} cannot be negative.`),
  );

const adminProductImageSchema = z.object({
  url: z.string().trim().min(1, "Image URL is required.").url("Please enter a valid image URL."),
  alt: z
    .string()
    .trim()
    .max(160, "Image alt text must be 160 characters or fewer.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  // Index into the product's `variants` array. When set, the image is attached
  // to that specific variant. When absent/null, the image is product-level
  // (shared across all variants). Only meaningful when `variantsEnabled` is true.
  variantIndex: z.preprocess(parseVariantIndexish, z.number().int().min(0).nullable()).optional(),
});

const adminProductSpecificationSchema = z.object({
  key: z.string().trim().min(1, "Specification label is required.").max(80, "Specification label is too long."),
  value: z.string().trim().min(1, "Specification value is required.").max(240, "Specification value is too long."),
});

const adminProductVariantSchema = z.object({
  title: z.string().trim().min(1, "Variant title is required.").max(80, "Variant title is too long."),
  sku: z.string().trim().min(1, "Variant SKU is required.").max(80, "Variant SKU is too long."),
  price: requiredMoney("Variant price"),
  comparePrice: optionalMoney("Variant compare price"),
  stock: requiredWholeNumber("Variant stock"),
  options: z.preprocess(parseVariantOptions, z.record(z.string(), z.string())),
  isDefault: z.preprocess(parseBooleanish, z.boolean()).optional().default(false),
});

export const adminProductStatusValues = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export const adminProductMutationSchema = z
  .object({
    title: z.string().trim().min(2, "Title must be at least 2 characters.").max(120, "Title must be 120 characters or fewer."),
    slug: adminSlugSchema,
    shortDescription: optionalShortText,
    description: optionalText,
    categoryId: z.string({ error: "Category is required." }).trim().min(1, "Category is required."),
    status: z.enum(adminProductStatusValues, {
      error: "Status must be one of DRAFT, PUBLISHED, or ARCHIVED.",
    }),
    sku: z.string().trim().min(1, "SKU is required.").max(80, "SKU must be 80 characters or fewer."),
    price: requiredMoney("Price"),
    comparePrice: optionalMoney("Compare price"),
    stock: requiredWholeNumber("Stock"),
    variantsEnabled: z.preprocess(parseBooleanish, z.boolean()).default(false),
    variants: z.array(adminProductVariantSchema).default([]),
    images: z.array(adminProductImageSchema).default([]),
    specifications: z.array(adminProductSpecificationSchema).default([]),
    relatedProductIds: z.array(z.string().trim().min(1)).default([]).transform((ids) => [...new Set(ids)]),
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

    if (input.variantsEnabled) {
      if (input.variants.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Add at least one variant when variant mode is enabled.",
          path: ["variants"],
        });
      }

      const seenSkus = new Set<string>();
      for (const [index, variant] of input.variants.entries()) {
        if (variant.comparePrice !== undefined && variant.comparePrice < variant.price) {
          ctx.addIssue({
            code: "custom",
            message: "Variant compare price must be greater than or equal to the price.",
            path: ["variants", index, "comparePrice"],
          });
        }

        const normalizedSku = variant.sku.trim().toLowerCase();
        if (seenSkus.has(normalizedSku)) {
          ctx.addIssue({
            code: "custom",
            message: "Each variant SKU must be unique.",
            path: ["variants", index, "sku"],
          });
        }
        seenSkus.add(normalizedSku);
      }

      // Every image assigned to a variant must point to an existing variant row.
      for (const [imageIndex, image] of input.images.entries()) {
        if (typeof image.variantIndex === "number" && image.variantIndex >= input.variants.length) {
          ctx.addIssue({
            code: "custom",
            message: `Image ${imageIndex + 1} references a variant that does not exist.`,
            path: ["images", imageIndex, "variantIndex"],
          });
        }
      }
    }
  });

export const adminProductCreateSchema = adminProductMutationSchema;

export const adminProductUpdateSchema = adminProductMutationSchema.extend({
  id: z.string({ error: "Product ID is required." }).trim().min(1, "Product ID is required."),
});

export type AdminProductCreateInput = z.infer<typeof adminProductCreateSchema>;
export type AdminProductUpdateInput = z.infer<typeof adminProductUpdateSchema>;
export type AdminProductVariantInput = z.infer<typeof adminProductVariantSchema>;
export type AdminProductImageInput = z.infer<typeof adminProductImageSchema>;
export type AdminProductSpecificationInput = z.infer<typeof adminProductSpecificationSchema>;

export function validateAdminProductCreateInput(input: unknown) {
  return validateWithSchema(adminProductCreateSchema, input);
}

export function validateAdminProductUpdateInput(input: unknown) {
  return validateWithSchema(adminProductUpdateSchema, input);
}
