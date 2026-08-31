"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { routes } from "@/config/routes";
import { requireRouteAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";
import { captureServerError } from "@/lib/errors/handling";
import { assertTrustedOrigin } from "@/lib/security/csrf";
import { CATALOG_CACHE_TAGS } from "@/server/db/catalog-queries";

import { getProductErrorCode, type ProductErrorCode } from "./flash";
import { createAdminProduct, deleteAdminProduct, updateAdminProduct } from "./service";
import { validateAdminProductCreateInput, validateAdminProductUpdateInput } from "./validation";

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

function readProductPayload(formData: FormData) {
  const imageUrls = readRows(formData, "imageUrl");
  const imageAlts = readRows(formData, "imageAlt");
  const imageVariantIndexes = readRows(formData, "imageVariantIndex");
  const specKeys = readRows(formData, "specKey");
  const specValues = readRows(formData, "specValue");
  const variantTitles = readRows(formData, "variantTitle");
  const variantSkus = readRows(formData, "variantSku");
  const variantOptions = readRows(formData, "variantOptions");
  const variantPrices = readRows(formData, "variantPrice");
  const variantComparePrices = readRows(formData, "variantComparePrice");
  const variantStocks = readRows(formData, "variantStock");
  const defaultVariantIndex = `${formData.get("variantDefaultIndex") ?? ""}`.trim();

  return {
    title: `${formData.get("title") ?? ""}`,
    slug: `${formData.get("slug") ?? ""}`,
    shortDescription: `${formData.get("shortDescription") ?? ""}`,
    description: `${formData.get("description") ?? ""}`,
    categoryId: `${formData.get("categoryId") ?? ""}`,
    status: `${formData.get("status") ?? ""}`,
    sku: `${formData.get("sku") ?? ""}`,
    price: `${formData.get("price") ?? ""}`,
    comparePrice: `${formData.get("comparePrice") ?? ""}`,
    stock: `${formData.get("stock") ?? ""}`,
    variantsEnabled: formData.get("variantsEnabled") !== null,
    variants: variantTitles
      .map((title, index) => ({
        title,
        sku: variantSkus[index] ?? "",
        options: variantOptions[index] ?? "",
        price: variantPrices[index] ?? "",
        comparePrice: variantComparePrices[index] ?? "",
        stock: variantStocks[index] ?? "",
        isDefault: defaultVariantIndex === `${index}`,
      }))
      .filter((variant) =>
        [variant.title, variant.sku, variant.options, variant.price, variant.comparePrice, variant.stock].some((value) =>
          value.trim().length > 0,
        ),
      ),
    images: imageUrls
      .map((url, index) => ({
        url,
        alt: imageAlts[index] ?? "",
        // Empty string means the image is product-level (shared across variants).
        // The zod layer coerces this to `undefined` via `parseVariantIndexish`.
        variantIndex: (imageVariantIndexes[index] ?? "").trim() || undefined,
      }))
      .filter((image) => image.url.trim().length > 0),
    specifications: specKeys
      .map((key, index) => ({
        key,
        value: specValues[index] ?? "",
      }))
      .filter((specification) => specification.key.trim().length > 0 || specification.value.trim().length > 0),
    relatedProductIds: formData.getAll("relatedProductIds").map((value) => `${value ?? ""}`),
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

async function requireProductWriteAccess() {
  const { role, session } = await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess, rbacPermissions.catalogWrite],
    from: routes.admin.products,
  });

  return {
    actorId: session.user.id,
    actorRole: role,
  };
}

function revalidateStorefrontCatalogPaths() {
  // Bust unstable_cache entries so admin changes are reflected immediately
  revalidateTag(CATALOG_CACHE_TAGS.categories, "max");
  revalidateTag(CATALOG_CACHE_TAGS.products, "max");
  revalidatePath(routes.storefront.categories);
  revalidatePath(routes.storefront.category("[slug]"), "page");
  revalidatePath(routes.storefront.product("[slug]", "[productSlug]"), "page");
}

export async function createAdminProductAction(formData: FormData) {
  const returnTo = getReturnTo(formData, routes.admin.productCreate);

  try {
    await assertTrustedOrigin({ action: "admin:product:create" });
    const actor = await requireProductWriteAccess();

    const parsed = validateAdminProductCreateInput(readProductPayload(formData));
    if (!parsed.success) {
      redirect(appendFlash(returnTo, "error", "invalidInput"));
    }

    const created = await createAdminProduct({
      data: parsed.data,
      actor,
    });

    // Revalidate storefront catalog tree so listing + PDP pages refresh on next request
    revalidateStorefrontCatalogPaths();
    revalidatePath(routes.admin.products);
    redirect(appendFlash(routes.admin.productEdit(created.id), "notice", "created"));  } catch (error) {
    unstable_rethrow(error);

    const appError = captureServerError(error, "admin:product:create");
    redirect(appendFlash(returnTo, "error", getProductErrorCode(appError, "createFailed")));
  }
}

export async function updateAdminProductAction(formData: FormData) {
  const returnTo = getReturnTo(formData, routes.admin.products);
  let errorCode: ProductErrorCode | null = null;

  try {
    await assertTrustedOrigin({ action: "admin:product:update" });
    const actor = await requireProductWriteAccess();

    const parsed = validateAdminProductUpdateInput({
      id: `${formData.get("id") ?? ""}`,
      ...readProductPayload(formData),
    });

    if (!parsed.success) {
      errorCode = "invalidInput";
    } else {
      await updateAdminProduct({
        data: parsed.data,
        actor,
      });
    }
  } catch (error) {
    unstable_rethrow(error);

    const appError = captureServerError(error, "admin:product:update");
    errorCode = getProductErrorCode(appError, "updateFailed");
  }

  if (errorCode) {
    redirect(appendFlash(returnTo, "error", errorCode));
  }

  // Revalidate storefront catalog tree so listing + PDP pages refresh on next request
  revalidateStorefrontCatalogPaths();
  revalidatePath(routes.admin.products);
  redirect(appendFlash(returnTo, "notice", "updated"));
}

export async function deleteAdminProductAction(formData: FormData) {
  const returnTo = getReturnTo(formData, routes.admin.products);
  const productId = `${formData.get("productId") ?? ""}`.trim();

  if (productId.length === 0) {
    redirect(appendFlash(returnTo, "error", "missingId"));
  }

  try {
    await assertTrustedOrigin({ action: "admin:product:delete" });
    const actor = await requireProductWriteAccess();

    await deleteAdminProduct({
      productId,
      actor,
    });
  } catch (error) {
    unstable_rethrow(error);

    const appError = captureServerError(error, "admin:product:delete");
    redirect(appendFlash(returnTo, "error", getProductErrorCode(appError, "deleteFailed")));
  }

  // Revalidate storefront catalog tree so deleted products disappear on next request
  revalidateStorefrontCatalogPaths();
  revalidatePath(routes.admin.products);
  redirect(appendFlash(returnTo, "notice", "deleted"));
}
