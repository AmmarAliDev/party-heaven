import type { AppError } from "@/lib/errors/app-error";

export type OccasionErrorCode =
  | "createFailed"
  | "updateFailed"
  | "deleteFailed"
  | "invalidInput"
  | "missingId"
  | "notFound"
  | "slugTaken"
  | "invalidProduct"
  | "invalidDeal";

export type OccasionNoticeCode = "created" | "updated" | "deleted";

const noticeMessages: Record<OccasionNoticeCode, string> = {
  created: "Occasion saved successfully.",
  updated: "Occasion changes saved successfully.",
  deleted: "Occasion deleted successfully.",
};

const errorMessages: Record<OccasionErrorCode, string> = {
  createFailed: "The occasion could not be created. Please try again.",
  updateFailed: "The occasion could not be updated. Please try again.",
  deleteFailed: "The occasion could not be deleted. Please try again.",
  invalidInput: "Please review the form and fix the highlighted information.",
  missingId: "The selected occasion is missing or no longer available.",
  notFound: "The selected occasion could not be found.",
  slugTaken: "That occasion URL is already in use. Update the slug so the page address stays unique.",
  invalidProduct: "One or more selected products are no longer available.",
  invalidDeal: "One or more selected deals are no longer available.",
};

export function getOccasionNoticeMessage(code: string | undefined) {
  if (!code) {
    return null;
  }

  return noticeMessages[code as OccasionNoticeCode] ?? null;
}

export function getOccasionErrorMessage(code: string | undefined, fallback: string | null = null) {
  if (!code) {
    return null;
  }

  return errorMessages[code as OccasionErrorCode] ?? fallback;
}

export function getOccasionErrorCode(error: AppError, fallback: OccasionErrorCode): OccasionErrorCode {
  switch (error.code) {
    case "OCCASION_NOT_FOUND":
      return "notFound";
    case "OCCASION_SLUG_TAKEN":
      return "slugTaken";
    case "OCCASION_PRODUCT_INVALID":
    case "OCCASION_REFERENCE_INVALID":
      return "invalidProduct";
    case "OCCASION_DEAL_INVALID":
      return "invalidDeal";
    default:
      return fallback;
  }
}
