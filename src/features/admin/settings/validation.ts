import { z } from "zod";

import { validateWithSchema } from "@/lib/security/validation";

export const adminStoreSettingsSingletonId = "default" as const;

const phoneRegex = /^\+?[\d\s()-]{7,20}$/;

function parseNumberish(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }

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

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))
  .refine((value) => value === undefined || phoneRegex.test(value), {
    message: "Please enter a valid phone number.",
  });

const nonNegativeInt = (label: string, max: number) =>
  z.preprocess(
    parseNumberish,
    z
      .number({ error: `${label} is required.` })
      .int(`${label} must be a whole number.`)
      .min(0, `${label} cannot be negative.`)
      .max(max, `${label} is too large.`),
  );

export const adminStoreSettingsSchema = z
  .object({
    storeName: z
      .string()
      .trim()
      .min(2, "Store name must be at least 2 characters.")
      .max(120, "Store name must be 120 characters or fewer."),
    storeTagline: optionalText(160, "Store tagline must be 160 characters or fewer."),
    supportEmail: z
      .string()
      .trim()
      .min(1, "Support email is required.")
      .email("Please enter a valid support email address."),
    supportPhone: optionalPhone,
    supportWhatsapp: optionalPhone,
    supportHours: optionalText(160, "Support hours must be 160 characters or fewer."),
    shippingOriginCity: z
      .string()
      .trim()
      .min(2, "Shipping origin city must be at least 2 characters.")
      .max(80, "Shipping origin city must be 80 characters or fewer."),
    shippingFlatRate: nonNegativeInt("Flat shipping fee", 1_000_000),
    shippingFreeThreshold: z.preprocess(
      parseNumberish,
      z
        .number({ error: "Free-shipping threshold must be a number." })
        .int("Free-shipping threshold must be a whole number.")
        .min(0, "Free-shipping threshold cannot be negative.")
        .max(10_000_000, "Free-shipping threshold is too large.")
        .optional(),
    ),
    dispatchLeadTimeDays: nonNegativeInt("Dispatch lead time", 365),
    lowStockThreshold: nonNegativeInt("Low-stock threshold", 10_000),
    allowBackorders: z.preprocess(parseBooleanish, z.boolean()).default(false),
  })
  .superRefine((input, ctx) => {
    if (
      input.shippingFreeThreshold !== undefined
      && input.shippingFreeThreshold > 0
      && input.shippingFreeThreshold < input.shippingFlatRate
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["shippingFreeThreshold"],
        message: "Free-shipping threshold should be greater than or equal to the flat shipping fee.",
      });
    }
  });

export type AdminStoreSettingsInput = z.infer<typeof adminStoreSettingsSchema>;

export const defaultAdminStoreSettings: AdminStoreSettingsInput = {
  storeName: "Party Heaven",
  storeTagline: undefined,
  supportEmail: "support@partyheaven.co",
  supportPhone: undefined,
  supportWhatsapp: undefined,
  supportHours: "Mon-Sat, 9:00 AM to 6:00 PM",
  shippingOriginCity: "Karachi",
  shippingFlatRate: 250,
  shippingFreeThreshold: undefined,
  dispatchLeadTimeDays: 1,
  lowStockThreshold: 5,
  allowBackorders: false,
};

export function validateAdminStoreSettingsInput(input: unknown) {
  return validateWithSchema(adminStoreSettingsSchema, input);
}
