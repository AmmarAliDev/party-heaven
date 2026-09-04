"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { routes } from "@/config/routes";
import { requireRouteAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";
import { captureServerError } from "@/lib/errors/handling";
import { assertTrustedOrigin } from "@/lib/security/csrf";

import { getOccasionErrorCode,type OccasionErrorCode } from "./flash";
import { createAdminOccasion, deleteAdminOccasion, updateAdminOccasion } from "./service";
import { validateAdminOccasionCreateInput, validateAdminOccasionUpdateInput } from "./validation";

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

function readRows(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => `${value ?? ""}`);
}

function readOccasionPayload(formData: FormData) {
  const productIds = readRows(formData, "occasionProductId");
  const categoryIds = readRows(formData, "occasionCategoryId");

  return {
    name: `${formData.get("name") ?? ""}`,
    slug: `${formData.get("slug") ?? ""}`,
    shortDescription: `${formData.get("shortDescription") ?? ""}`,
    description: `${formData.get("description") ?? ""}`,
    coverImageUrl: `${formData.get("coverImageUrl") ?? ""}`,
    coverImageAlt: `${formData.get("coverImageAlt") ?? ""}`,
    status: `${formData.get("status") ?? ""}`,
    isSpecial: formData.get("isSpecial") !== null,
    products: productIds
      .map((productId, index) => ({
        productId,
        categoryId: categoryIds[index] ?? "",
      }))
      .filter((product) => product.productId.trim().length > 0),
    dealIds: readRows(formData, "occasionDealId"),
    seoTitle: `${formData.get("seoTitle") ?? ""}`,
    seoDescription: `${formData.get("seoDescription") ?? ""}`,
    seoCanonicalUrl: `${formData.get("seoCanonicalUrl") ?? ""}`,
    seoOgTitle: `${formData.get("seoOgTitle") ?? ""}`,
    seoOgDescription: `${formData.get("seoOgDescription") ?? ""}`,
    seoImageUrl: `${formData.get("seoImageUrl") ?? ""}`,
    seoKeywords: `${formData.get("seoKeywords") ?? ""}`,
    seoSchemaNotes: `${formData.get("seoSchemaNotes") ?? ""}`,
    seoNoIndex: formData.get("seoNoIndex") !== null,
  };
}

async function requireOccasionWriteAccess() {
  const { role, session } = await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess, rbacPermissions.catalogWrite],
    from: routes.admin.occasions,
  });

  return {
    actorId: session.user.id,
    actorRole: role,
  };
}

function revalidateStorefrontOccasionPaths() {
  // Bust the storefront occasion index + detail pages so admin changes are
  // reflected on the next request.
  revalidatePath(routes.storefront.occasions);
  revalidatePath(routes.storefront.occasion("[slug]"), "page");
}

export async function createAdminOccasionAction(formData: FormData) {
  const returnTo = getReturnTo(formData, routes.admin.occasionCreate);

  try {
    await assertTrustedOrigin({ action: "admin:occasion:create" });
    const actor = await requireOccasionWriteAccess();

    const parsed = validateAdminOccasionCreateInput(readOccasionPayload(formData));
    if (!parsed.success) {
      redirect(appendFlash(returnTo, "error", "invalidInput"));
    }

    const created = await createAdminOccasion({
      data: parsed.data,
      actor,
    });

    revalidateStorefrontOccasionPaths();
    revalidatePath(routes.admin.occasions);
    redirect(appendFlash(routes.admin.occasionEdit(created.id), "notice", "created"));
  } catch (error) {
    unstable_rethrow(error);

    const appError = captureServerError(error, "admin:occasion:create");
    redirect(appendFlash(returnTo, "error", getOccasionErrorCode(appError, "createFailed")));
  }
}

export async function updateAdminOccasionAction(formData: FormData) {
  const returnTo = getReturnTo(formData, routes.admin.occasions);
  let errorCode: OccasionErrorCode | null = null;

  try {
    await assertTrustedOrigin({ action: "admin:occasion:update" });
    const actor = await requireOccasionWriteAccess();

    const parsed = validateAdminOccasionUpdateInput({
      id: `${formData.get("id") ?? ""}`,
      ...readOccasionPayload(formData),
    });

    if (!parsed.success) {
      errorCode = "invalidInput";
    } else {
      await updateAdminOccasion({
        data: parsed.data,
        actor,
      });
    }
  } catch (error) {
    unstable_rethrow(error);

    const appError = captureServerError(error, "admin:occasion:update");
    errorCode = getOccasionErrorCode(appError, "updateFailed");
  }

  if (errorCode) {
    redirect(appendFlash(returnTo, "error", errorCode));
  }

  revalidateStorefrontOccasionPaths();
  revalidatePath(routes.admin.occasions);
  redirect(appendFlash(returnTo, "notice", "updated"));
}

export async function deleteAdminOccasionAction(formData: FormData) {
  const returnTo = getReturnTo(formData, routes.admin.occasions);
  const occasionId = `${formData.get("occasionId") ?? ""}`.trim();

  if (occasionId.length === 0) {
    redirect(appendFlash(returnTo, "error", "missingId"));
  }

  try {
    await assertTrustedOrigin({ action: "admin:occasion:delete" });
    const actor = await requireOccasionWriteAccess();

    await deleteAdminOccasion({
      occasionId,
      actor,
    });
  } catch (error) {
    unstable_rethrow(error);

    const appError = captureServerError(error, "admin:occasion:delete");
    redirect(appendFlash(returnTo, "error", getOccasionErrorCode(appError, "deleteFailed")));
  }

  revalidateStorefrontOccasionPaths();
  revalidatePath(routes.admin.occasions);
  redirect(appendFlash(returnTo, "notice", "deleted"));
}
