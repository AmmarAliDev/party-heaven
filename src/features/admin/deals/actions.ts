"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { routes } from "@/config/routes";
import { requireRouteAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";
import { captureServerError } from "@/lib/errors/handling";
import { assertTrustedOrigin } from "@/lib/security/csrf";

import { getDealErrorCode, type DealErrorCode } from "./flash";
import { createAdminDeal, deleteAdminDeal, updateAdminDeal } from "./service";
import { validateAdminDealCreateInput, validateAdminDealUpdateInput } from "./validation";

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

function readDealPayload(formData: FormData) {
  const imageUrls = readRows(formData, "imageUrl");
  const imageAlts = readRows(formData, "imageAlt");
  const productIds = readRows(formData, "dealProductId");
  const variantIds = readRows(formData, "dealVariantId");
  const quantities = readRows(formData, "dealQuantity");
  const specKeys = readRows(formData, "specKey");
  const specValues = readRows(formData, "specValue");

  return {
    title: `${formData.get("title") ?? ""}`,
    slug: `${formData.get("slug") ?? ""}`,
    shortDescription: `${formData.get("shortDescription") ?? ""}`,
    description: `${formData.get("description") ?? ""}`,
    status: `${formData.get("status") ?? ""}`,
    categoryId: `${formData.get("categoryId") ?? ""}`,
    price: `${formData.get("price") ?? ""}`,
    comparePrice: `${formData.get("comparePrice") ?? ""}`,
    products: productIds
      .map((productId, index) => ({
        productId,
        variantId: variantIds[index] ?? "",
        quantity: quantities[index] ?? "",
      }))
      .filter((product) => product.productId.trim().length > 0),
    images: imageUrls
      .map((url, index) => ({
        url,
        alt: imageAlts[index] ?? "",
      }))
      .filter((image) => image.url.trim().length > 0),
    specifications: specKeys
      .map((key, index) => ({
        key,
        value: specValues[index] ?? "",
      }))
      .filter((specification) => specification.key.trim().length > 0),
    relatedDealIds: readRows(formData, "relatedDealIds"),
    seoTitle: `${formData.get("seoTitle") ?? ""}`,
    seoDescription: `${formData.get("seoDescription") ?? ""}`,
    seoCanonicalUrl: `${formData.get("seoCanonicalUrl") ?? ""}`,
    seoOgTitle: `${formData.get("seoOgTitle") ?? ""}`,
    seoOgDescription: `${formData.get("seoOgDescription") ?? ""}`,
    seoImageUrl: `${formData.get("seoImageUrl") ?? ""}`,
    seoSchemaNotes: `${formData.get("seoSchemaNotes") ?? ""}`,
    seoNoIndex: formData.get("seoNoIndex") !== null,
  };
}

async function requireDealWriteAccess() {
  const { role, session } = await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess, rbacPermissions.catalogWrite],
    from: routes.admin.deals,
  });

  return {
    actorId: session.user.id,
    actorRole: role,
  };
}

function revalidateStorefrontDealPaths() {
  // Bust the homepage, deals listing, and deal detail pages so admin changes
  // are reflected immediately.
  revalidatePath(routes.storefront.home);
  revalidatePath(routes.storefront.deals);
  revalidatePath(routes.storefront.deal("[slug]"), "page");
}

export async function createAdminDealAction(formData: FormData) {
  const returnTo = getReturnTo(formData, routes.admin.dealCreate);

  try {
    await assertTrustedOrigin({ action: "admin:deal:create" });
    const actor = await requireDealWriteAccess();

    const parsed = validateAdminDealCreateInput(readDealPayload(formData));
    if (!parsed.success) {
      redirect(appendFlash(returnTo, "error", "invalidInput"));
    }

    const created = await createAdminDeal({
      data: parsed.data,
      actor,
    });

    // Revalidate storefront deal surfaces so the new deal appears on the next request.
    revalidateStorefrontDealPaths();
    revalidatePath(routes.admin.deals);
    redirect(appendFlash(routes.admin.dealEdit(created.id), "notice", "created"));
  } catch (error) {
    unstable_rethrow(error);

    const appError = captureServerError(error, "admin:deal:create");
    redirect(appendFlash(returnTo, "error", getDealErrorCode(appError, "createFailed")));
  }
}

export async function updateAdminDealAction(formData: FormData) {
  const returnTo = getReturnTo(formData, routes.admin.deals);
  let errorCode: DealErrorCode | null = null;

  try {
    await assertTrustedOrigin({ action: "admin:deal:update" });
    const actor = await requireDealWriteAccess();

    const parsed = validateAdminDealUpdateInput({
      id: `${formData.get("id") ?? ""}`,
      ...readDealPayload(formData),
    });

    if (!parsed.success) {
      errorCode = "invalidInput";
    } else {
      await updateAdminDeal({
        data: parsed.data,
        actor,
      });
    }
  } catch (error) {
    unstable_rethrow(error);

    const appError = captureServerError(error, "admin:deal:update");
    errorCode = getDealErrorCode(appError, "updateFailed");
  }

  if (errorCode) {
    redirect(appendFlash(returnTo, "error", errorCode));
  }

  // Revalidate storefront deal surfaces so the updated deal refreshes.
  revalidateStorefrontDealPaths();
  revalidatePath(routes.admin.deals);
  redirect(appendFlash(returnTo, "notice", "updated"));
}

export async function deleteAdminDealAction(formData: FormData) {
  const returnTo = getReturnTo(formData, routes.admin.deals);
  const dealId = `${formData.get("dealId") ?? ""}`.trim();

  if (dealId.length === 0) {
    redirect(appendFlash(returnTo, "error", "missingId"));
  }

  try {
    await assertTrustedOrigin({ action: "admin:deal:delete" });
    const actor = await requireDealWriteAccess();

    await deleteAdminDeal({
      dealId,
      actor,
    });
  } catch (error) {
    unstable_rethrow(error);

    const appError = captureServerError(error, "admin:deal:delete");
    redirect(appendFlash(returnTo, "error", getDealErrorCode(appError, "deleteFailed")));
  }

  // Revalidate storefront deal surfaces so deleted deals disappear.
  revalidateStorefrontDealPaths();
  revalidatePath(routes.admin.deals);
  redirect(appendFlash(returnTo, "notice", "deleted"));
}
