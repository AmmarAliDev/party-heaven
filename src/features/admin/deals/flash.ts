import type { AppError } from "@/lib/errors/app-error";

export type DealErrorCode =
  | "createFailed"
  | "updateFailed"
  | "deleteFailed"
  | "invalidInput"
  | "missingId"
  | "notFound"
  | "slugTaken"
  | "invalidCategory"
  | "invalidProduct"
  | "invalidVariant"
  | "productCategoryMismatch"
  | "stockExceeded"
  | "referenceInvalid"
  | "relatedInvalid";

export type DealNoticeCode = "created" | "updated" | "deleted";

const noticeMessages: Record<DealNoticeCode, string> = {
  created: "Deal saved successfully.",
  updated: "Deal changes saved successfully.",
  deleted: "Deal deleted successfully.",
};

const errorMessages: Record<DealErrorCode, string> = {
  createFailed: "The deal could not be created. Please try again.",
  updateFailed: "The deal could not be updated. Please try again.",
  deleteFailed: "The deal could not be deleted. Please try again.",
  invalidInput: "Please review the form and fix the highlighted information.",
  missingId: "The selected deal is missing or no longer available.",
  notFound: "The selected deal could not be found.",
  slugTaken: "That deal URL is already in use. Update the slug so the page address stays unique.",
  invalidCategory: "Choose a valid category before saving the deal.",
  invalidProduct: "Choose a valid product before saving the deal.",
  invalidVariant: "The selected variant does not belong to the selected product.",
  productCategoryMismatch: "The selected product does not belong to the selected category.",
  stockExceeded: "Deal quantity cannot exceed the linked product's available stock. Reduce the quantity or restock first.",
  referenceInvalid: "The selected product or variant is no longer available.",
  relatedInvalid: "One or more related deals are no longer available.",
};

export function getDealNoticeMessage(code: string | undefined) {
  if (!code) {
    return null;
  }

  return noticeMessages[code as DealNoticeCode] ?? null;
}

export function getDealErrorMessage(code: string | undefined, fallback: string | null = null) {
  if (!code) {
    return null;
  }

  return errorMessages[code as DealErrorCode] ?? fallback;
}

export function getDealErrorCode(error: AppError, fallback: DealErrorCode): DealErrorCode {
  switch (error.code) {
    case "DEAL_NOT_FOUND":
      return "notFound";
    case "DEAL_SLUG_TAKEN":
      return "slugTaken";
    case "DEAL_CATEGORY_INVALID":
      return "invalidCategory";
    case "DEAL_PRODUCT_INVALID":
      return "invalidProduct";
    case "DEAL_VARIANT_INVALID":
      return "invalidVariant";
    case "DEAL_PRODUCT_CATEGORY_MISMATCH":
      return "productCategoryMismatch";
    case "DEAL_STOCK_EXCEEDED":
      return "stockExceeded";
    case "DEAL_REFERENCE_INVALID":
      return "referenceInvalid";
    case "DEAL_RELATED_INVALID":
      return "relatedInvalid";
    default:
      return fallback;
  }
}
