"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { routes } from "@/config/routes";
import { requireRouteAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";
import { captureServerError } from "@/lib/errors/handling";
import { assertTrustedOrigin } from "@/lib/security/csrf";
import { CATALOG_CACHE_TAGS } from "@/server/db/catalog-queries";

import { type CategoryErrorCode, getCategoryErrorCode } from "./flash";
import { createAdminCategory, deleteAdminCategory, updateAdminCategory } from "./service";
import { validateCategoryCreateInput, validateCategoryUpdateInput } from "./validation";

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

function readCategoryPayload(formData: FormData) {
  return {
    name: `${formData.get("name") ?? ""}`,
    slug: `${formData.get("slug") ?? ""}`,
    description: `${formData.get("description") ?? ""}`,
    categoryCardImageUrl: `${formData.get("categoryCardImageUrl") ?? ""}`,
    status: `${formData.get("status") ?? ""}`,
    seoTitle: `${formData.get("seoTitle") ?? ""}`,
    seoDescription: `${formData.get("seoDescription") ?? ""}`,
    seoCanonicalUrl: `${formData.get("seoCanonicalUrl") ?? ""}`,
    seoOgTitle: `${formData.get("seoOgTitle") ?? ""}`,
    seoOgDescription: `${formData.get("seoOgDescription") ?? ""}`,
    seoImageUrl: `${formData.get("seoImageUrl") ?? ""}`,
    seoKeywords: `${formData.get("seoKeywords") ?? ""}`,
    seoNoIndex: formData.get("seoNoIndex") !== null,
    seoSchemaNotes: `${formData.get("seoSchemaNotes") ?? ""}`,
  };
}

async function requireCategoryWriteAccess() {
  const { role, session } = await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess, rbacPermissions.catalogWrite],
    from: routes.admin.categories,
  });

  return {
    actorId: session.user.id,
    actorRole: role,
  };
}

function revalidateStorefrontCategoryPaths() {
  // Bust unstable_cache entries so admin changes are reflected immediately
  revalidateTag(CATALOG_CACHE_TAGS.categories, "max");
  revalidateTag(CATALOG_CACHE_TAGS.products, "max");
  revalidatePath(routes.storefront.categories);
  revalidatePath(routes.storefront.category("[slug]"), "page");
  revalidatePath(routes.storefront.product("[slug]", "[productSlug]"), "page");
}

export async function createAdminCategoryAction(formData: FormData) {
  const returnTo = getReturnTo(formData, routes.admin.categories);

  try {
    await assertTrustedOrigin({ action: "admin:category:create" });
    const actor = await requireCategoryWriteAccess();

    const parsed = validateCategoryCreateInput(readCategoryPayload(formData));
    if (!parsed.success) {
      redirect(appendFlash(returnTo, "error", "invalidInput"));
    }

    await createAdminCategory({
      data: parsed.data,
      actor,
    });
  } catch (error) {
    unstable_rethrow(error);

    const appError = captureServerError(error, "admin:category:create");
    redirect(appendFlash(returnTo, "error", getCategoryErrorCode(appError, "createFailed")));
  }

  // Revalidate storefront category tree so index, listing, and PDP pages refresh on next request
  revalidateStorefrontCategoryPaths();
  revalidatePath(routes.admin.categories);
  redirect(appendFlash(returnTo, "notice", "created"));
}

export async function updateAdminCategoryAction(formData: FormData) {
  const returnTo = getReturnTo(formData, routes.admin.categories);
  let errorCode: CategoryErrorCode | null = null;

  try {
    await assertTrustedOrigin({ action: "admin:category:update" });
    const actor = await requireCategoryWriteAccess();

    const parsed = validateCategoryUpdateInput({
      id: `${formData.get("id") ?? ""}`,
      ...readCategoryPayload(formData),
    });

    if (!parsed.success) {
      errorCode = "invalidInput";
    } else {
      await updateAdminCategory({
        data: parsed.data,
        actor,
      });
    }
  } catch (error) {
    unstable_rethrow(error);

    const appError = captureServerError(error, "admin:category:update");
    errorCode = getCategoryErrorCode(appError, "updateFailed");
  }

  if (errorCode) {
    redirect(appendFlash(returnTo, "error", errorCode));
  }

  // Revalidate storefront category tree so index, listing, and PDP pages refresh on next request
  revalidateStorefrontCategoryPaths();
  revalidatePath(routes.admin.categories);
  redirect(appendFlash(returnTo, "notice", "updated"));
}

export async function deleteAdminCategoryAction(formData: FormData) {
  const returnTo = getReturnTo(formData, routes.admin.categories);
  const categoryId = `${formData.get("categoryId") ?? ""}`.trim();

  if (categoryId.length === 0) {
    redirect(appendFlash(returnTo, "error", "missingId"));
  }

  try {
    await assertTrustedOrigin({ action: "admin:category:delete" });
    const actor = await requireCategoryWriteAccess();

    await deleteAdminCategory({
      categoryId,
      actor,
    });
  } catch (error) {
    unstable_rethrow(error);

    const appError = captureServerError(error, "admin:category:delete");
    redirect(appendFlash(returnTo, "error", getCategoryErrorCode(appError, "deleteFailed")));
  }

  // Revalidate storefront category tree so deleted/unpublished pages stop serving stale HTML
  revalidateStorefrontCategoryPaths();
  revalidatePath(routes.admin.categories);
  redirect(appendFlash(returnTo, "notice", "deleted"));
}
