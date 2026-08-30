import { AppError } from "@/lib/errors/app-error";

import { extractCheckoutSubmitErrorMessage,parseCheckoutSubmitSuccessResponse } from "./api-contract";
import type { CheckoutPayload } from "./types";

export async function submitCheckoutRequest(
  payload: CheckoutPayload,
  fetchImplementation: typeof fetch = fetch,
) {
  let response: Response;

  try {
    response = await fetchImplementation("/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new AppError("Checkout request failed before reaching the server.", "CHECKOUT_NETWORK_ERROR", {
      cause: error,
      userMessage: "Unable to reach checkout right now. Please check your connection and try again.",
    });
  }

  const responsePayload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new AppError("Checkout request was rejected.", "CHECKOUT_SUBMIT_FAILED", {
      statusCode: response.status,
      userMessage:
        extractCheckoutSubmitErrorMessage(responsePayload) ??
        "Checkout could not be submitted. Please try again.",
    });
  }

  const parsedSuccess = parseCheckoutSubmitSuccessResponse(responsePayload);
  if (!parsedSuccess.success) {
    throw new AppError("Checkout API returned an invalid success payload.", "CHECKOUT_RESPONSE_INVALID", {
      userMessage:
        "Your order was submitted, but we could not load the confirmation details. Please open your account orders and verify the latest order.",
    });
  }

  return parsedSuccess.data.order;
}
