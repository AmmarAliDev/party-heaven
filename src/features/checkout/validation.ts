import { z } from "zod";

import { CHECKOUT_FIXED_PROVINCE, CHECKOUT_PAYMENT_METHODS, CHECKOUT_SUPPORTED_CITY } from "./constants";

const phonePattern = /^\+?[0-9\s-]{10,16}$/;

const citySchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.toLowerCase())
  .refine((value) => value === CHECKOUT_SUPPORTED_CITY.toLowerCase(), {
    message: `We currently ship only to ${CHECKOUT_SUPPORTED_CITY}.`,
  })
  .transform(() => CHECKOUT_SUPPORTED_CITY);

const provinceSchema = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .refine((value) => value === CHECKOUT_FIXED_PROVINCE.toLowerCase(), {
    message: `Province must be ${CHECKOUT_FIXED_PROVINCE}.`,
  })
  .transform(() => CHECKOUT_FIXED_PROVINCE);

export const checkoutPayloadSchema = z.object({
  cartId: z.string().trim().min(1, "Cart is missing. Refresh and try again."),
  customer: z.object({
    fullName: z.string().trim().min(2, "Please provide your full name.").max(120),
    email: z.email("Please provide a valid email address.").max(254),
    phone: z.string().trim().regex(phonePattern, "Please provide a valid phone number."),
  }),
  shippingAddress: z.object({
    addressLine1: z.string().trim().min(5, "Please provide your delivery address.").max(220),
    city: citySchema,
    province: provinceSchema,
    country: z.string().trim().min(2, "Please provide a country for shipping.").max(120),
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
  }),
  paymentMethod: z.enum([CHECKOUT_PAYMENT_METHODS.COD]),
  notes: z.string().trim().max(600, "Order notes must be 600 characters or less.").optional(),
});

export type CheckoutPayloadSchema = z.infer<typeof checkoutPayloadSchema>;
