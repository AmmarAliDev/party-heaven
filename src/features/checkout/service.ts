import type { CartSummary } from "@/features/cart";
import { AppError } from "@/lib/errors/app-error";

import { CHECKOUT_SHIPPING_FEE, CHECKOUT_SUPPORTED_CITY } from "./constants";
import { getCheckoutPaymentProvider } from "./payment";
import type { CheckoutAttemptResult, CheckoutPayload, CheckoutTotals } from "./types";

export function calculateCheckoutTotals(subtotal: number): CheckoutTotals {
  const normalizedSubtotal = Number.isFinite(subtotal) ? Math.max(0, Math.trunc(subtotal)) : 0;
  const shipping = CHECKOUT_SHIPPING_FEE;

  return {
    subtotal: normalizedSubtotal,
    shipping,
    total: normalizedSubtotal + shipping,
  };
}

export function assertCheckoutCartReady(cart: CartSummary | null) {
  if (!cart || (cart.items.length === 0 && cart.dealItems.length === 0)) {
    throw new AppError("Checkout requested with empty cart.", "CHECKOUT_CART_EMPTY", {
      statusCode: 400,
      userMessage: "Your cart is empty. Add products before checkout.",
    });
  }

  return cart;
}

export function assertKarachiCity(city: unknown) {
  if (typeof city !== "string" || city.trim().length === 0) {
    throw new AppError("Shipping city missing or invalid.", "CHECKOUT_CITY_UNSUPPORTED", {
      statusCode: 400,
      userMessage: `Please provide a valid city for shipping. We currently deliver only in ${CHECKOUT_SUPPORTED_CITY}.`,
    });
  }

  const trimmed = city.trim();
  if (trimmed.toLowerCase() !== CHECKOUT_SUPPORTED_CITY.toLowerCase()) {
    throw new AppError(`Unsupported shipping city submitted: ${trimmed}`, "CHECKOUT_CITY_UNSUPPORTED", {
      statusCode: 400,
      userMessage: `We currently deliver only in ${CHECKOUT_SUPPORTED_CITY}.`,
    });
  }
}

export function buildCheckoutAttemptResult(payload: CheckoutPayload, cart: CartSummary): CheckoutAttemptResult {
  assertKarachiCity(payload.shippingAddress.city);

  const totals = calculateCheckoutTotals(cart.subtotal);
  const paymentProvider = getCheckoutPaymentProvider(payload.paymentMethod);
  const payment = paymentProvider.authorize({
    payload,
    totals,
  });

  return {
    cart: {
      id: cart.id,
      itemCount: cart.itemCount,
      subtotal: totals.subtotal,
    },
    totals,
    payment,
  };
}
