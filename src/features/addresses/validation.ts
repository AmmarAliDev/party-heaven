import { z } from "zod";

export const SAVED_ADDRESS_CITY = "Karachi";
export const SAVED_ADDRESS_PROVINCE = "Sindh";
export const SAVED_ADDRESS_COUNTRY = "Pakistan";

const phonePattern = /^\+?[0-9\s-]{10,16}$/;

const citySchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.toLowerCase())
  .refine((value) => value === SAVED_ADDRESS_CITY.toLowerCase(), {
    message: `We currently ship only to ${SAVED_ADDRESS_CITY}.`,
  })
  .transform(() => SAVED_ADDRESS_CITY);

const provinceSchema = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .refine((value) => value === SAVED_ADDRESS_PROVINCE.toLowerCase(), {
    message: `Province must be ${SAVED_ADDRESS_PROVINCE}.`,
  })
  .transform(() => SAVED_ADDRESS_PROVINCE);

const countrySchema = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .refine((value) => value === SAVED_ADDRESS_COUNTRY.toLowerCase(), {
    message: `Country must be ${SAVED_ADDRESS_COUNTRY}.`,
  })
  .transform(() => SAVED_ADDRESS_COUNTRY);

/**
 * Shared validation for creating and updating a saved address.
 *
 * Matches the checkout address rules (Karachi/Sindh/Pakistan only, numeric
 * postal code, optional phone matching the checkout phone pattern) so the
 * same address can be saved from either flow without surprises.
 */
export const savedAddressInputSchema = z.object({
  label: z
    .string()
    .trim()
    .max(40, "Address label must be 40 characters or less.")
    .optional(),
  addressLine1: z.string().trim().min(5, "Please provide your delivery address.").max(220),
  addressLine2: z
    .string()
    .trim()
    .max(220, "Address line 2 must be 220 characters or less.")
    .optional(),
  city: citySchema,
  province: provinceSchema,
  country: countrySchema,
  postcode: z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .regex(/^\d+$/, "Postal code must contain numbers only.")
        .min(4, "Please provide a valid postal code.")
        .max(10),
    ])
    .optional()
    .transform((value) => (value ? value : undefined)),
  phone: z
    .union([
      z.literal(""),
      z.string().trim().regex(phonePattern, "Please provide a valid phone number."),
    ])
    .optional()
    .transform((value) => (value ? value : undefined)),
  isDefault: z.boolean().optional(),
});

export type SavedAddressInputSchema = z.infer<typeof savedAddressInputSchema>;
