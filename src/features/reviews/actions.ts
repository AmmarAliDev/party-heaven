"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { auth } from "@/auth";
import { routes } from "@/config/routes";
import { captureServerError } from "@/lib/errors/handling";
import { assertTrustedOrigin } from "@/lib/security/csrf";

import type { ReviewErrorCode, ReviewNoticeCode } from "./flash";
import { submitCustomerReview } from "./service";
import { validateCustomerReviewInput } from "./validation";

function isSafeRelativePath(value: string) {
  const candidate = value.trim();

  if (!candidate.startsWith("/")) {
    return false;
  }

  if (candidate.startsWith("//") || candidate.includes("://") || candidate.includes("\\")) {
    return false;
  }

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(candidate.slice(1)) || /[\r\n]/.test(candidate)) {
    return false;
  }

  return true;
}

function getReturnTo(formData: FormData) {
  const raw = `${formData.get("returnTo") ?? ""}`.trim();
  if (!isSafeRelativePath(raw)) {
    return routes.storefront.home;
  }

  return raw;
}

function appendFlash(path: string, key: "reviewNotice" | "reviewError", code: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(code)}`;
}

function stripQuery(path: string) {
  const queryIndex = path.indexOf("?");
  return queryIndex === -1 ? path : path.slice(0, queryIndex);
}

function mapReviewErrorCode(code: string): ReviewErrorCode {
  switch (code) {
    case "REVIEW_AUTH_REQUIRED":
      return "signInRequired";
    case "REVIEW_PURCHASE_REQUIRED":
      return "purchaseRequired";
    case "REVIEW_PRODUCT_NOT_FOUND":
    case "REVIEW_DEAL_NOT_FOUND":
      return "notFound";
    case "RATE_LIMITED":
      return "rateLimited";
    default:
      return "submitFailed";
  }
}

export async function submitCustomerReviewAction(formData: FormData) {
  const returnTo = getReturnTo(formData);
  const targetPath = stripQuery(returnTo);

  try {
    await assertTrustedOrigin({ action: "review:submit" });

    const session = await auth();
    const userId = session?.user?.id?.trim();

    if (!userId) {
      redirect(`${routes.auth.signIn}?from=${encodeURIComponent(returnTo)}`);
    }

    const parsed = validateCustomerReviewInput({
      productId: `${formData.get("productId") ?? ""}`,
      dealId: `${formData.get("dealId") ?? ""}`,
      rating: `${formData.get("rating") ?? ""}`,
      title: `${formData.get("title") ?? ""}`,
      body: `${formData.get("body") ?? ""}`,
    });

    if (!parsed.success) {
      redirect(appendFlash(returnTo, "reviewError", "invalidInput"));
    }

    const result = await submitCustomerReview({
      userId,
      ...(parsed.data.productId ? { productId: parsed.data.productId } : {}),
      ...(parsed.data.dealId ? { dealId: parsed.data.dealId } : {}),
      rating: parsed.data.rating,
      ...(parsed.data.title ? { title: parsed.data.title } : {}),
      body: parsed.data.body,
    });

    revalidatePath(targetPath);
    revalidatePath(routes.storefront.accountReviews);
    revalidatePath(routes.admin.reviews);

    if ("dealSlug" in result && result.dealSlug) {
      revalidatePath(routes.storefront.deal(result.dealSlug));
    } else if ("productSlug" in result && "categorySlug" in result && result.productSlug && result.categorySlug) {
      revalidatePath(routes.storefront.product(result.categorySlug, result.productSlug));
    }

    const noticeCode: ReviewNoticeCode = result.action;
    redirect(appendFlash(returnTo, "reviewNotice", noticeCode));
  } catch (error) {
    unstable_rethrow(error);

    const appError = captureServerError(error, "review:submit");
    const errorCode = mapReviewErrorCode(appError.code);
    redirect(appendFlash(returnTo, "reviewError", errorCode));
  }
}