"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { routes } from "@/config/routes";
import { requireRouteAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";
import { captureServerError } from "@/lib/errors/handling";
import { assertTrustedOrigin } from "@/lib/security/csrf";

import { type AdminReviewErrorCode, getAdminReviewErrorCode } from "./flash";
import { moderateAdminReview } from "./service";
import { validateAdminReviewModerationInput } from "./validation";

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

function getReturnTo(formData: FormData, fallbackPath: string) {
  const value = `${formData.get("returnTo") ?? ""}`;
  return isSafeRelativePath(value) ? value.trim() : fallbackPath;
}

function appendFlash(path: string, key: "notice" | "error", code: string) {
  const encoded = encodeURIComponent(code);
  const separator = path.includes("?") ? "&" : "?";

  return `${path}${separator}${key}=${encoded}`;
}

async function requireReviewWriteAccess() {
  const { role, session } = await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess, rbacPermissions.catalogWrite],
    from: routes.admin.reviews,
  });

  return {
    actorId: session.user.id,
    actorRole: role,
  };
}

export async function moderateAdminReviewAction(formData: FormData) {
  const returnTo = getReturnTo(formData, routes.admin.reviews);
  let errorCode: AdminReviewErrorCode | null = null;

  try {
    await assertTrustedOrigin({ action: "admin:review:moderate" });
    const actor = await requireReviewWriteAccess();

    const parsed = validateAdminReviewModerationInput({
      reviewId: `${formData.get("reviewId") ?? ""}`,
      nextStatus: `${formData.get("nextStatus") ?? ""}`,
      reason: `${formData.get("reason") ?? ""}`,
    });

    if (!parsed.success) {
      errorCode = "invalidInput";
    } else {
      const result = await moderateAdminReview({
        reviewId: parsed.data.reviewId,
        nextStatus: parsed.data.nextStatus,
        ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
        actor,
      });

      revalidatePath(routes.admin.reviews);

      if (result.target.kind === "deal") {
        revalidatePath(routes.storefront.deal(result.target.slug));
      } else if (result.target.categorySlug) {
        revalidatePath(routes.storefront.category(result.target.categorySlug));
        revalidatePath(routes.storefront.product(result.target.categorySlug, result.target.slug));
      }
    }
  } catch (error) {
    unstable_rethrow(error);

    const appError = captureServerError(error, "admin:review:moderate");
    errorCode = getAdminReviewErrorCode(appError, "updateFailed");
  }

  if (errorCode) {
    redirect(appendFlash(returnTo, "error", errorCode));
  }

  redirect(appendFlash(returnTo, "notice", "updated"));
}
