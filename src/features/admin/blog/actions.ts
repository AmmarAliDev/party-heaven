"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { routes } from "@/config/routes";
import { requireRouteAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";
import { captureServerError } from "@/lib/errors/handling";
import { assertTrustedOrigin } from "@/lib/security/csrf";

import { type BlogErrorCode, getBlogErrorCode } from "./flash";
import { createAdminBlogPost, deleteAdminBlogPost, updateAdminBlogPost } from "./service";
import { validateAdminBlogCreateInput, validateAdminBlogUpdateInput } from "./validation";

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

function readBlogPayload(formData: FormData) {
  return {
    locale: `${formData.get("locale") ?? "en"}`,
    title: `${formData.get("title") ?? ""}`,
    slug: `${formData.get("slug") ?? ""}`,
    excerpt: `${formData.get("excerpt") ?? ""}`,
    contentJson: `${formData.get("contentJson") ?? ""}`,
    coverImageUrl: `${formData.get("coverImageUrl") ?? ""}`,
    coverImageAlt: `${formData.get("coverImageAlt") ?? ""}`,
    coverImageWidth: `${formData.get("coverImageWidth") ?? ""}`,
    coverImageHeight: `${formData.get("coverImageHeight") ?? ""}`,
    status: `${formData.get("status") ?? ""}`,
    publishedAt: `${formData.get("publishedAt") ?? ""}`,
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

async function requireBlogWriteAccess() {
  const { role, session } = await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess, rbacPermissions.catalogWrite],
    from: routes.admin.blog,
  });

  return {
    actorId: session.user.id,
    actorRole: role,
  };
}

function revalidateBlogPaths() {
  revalidatePath(routes.storefront.blog);
  revalidatePath(routes.storefront.blogPost("[slug]"), "page");
  revalidatePath(routes.admin.blog);
}

export async function createAdminBlogPostAction(formData: FormData) {
  const returnTo = getReturnTo(formData, routes.admin.blog);

  try {
    await assertTrustedOrigin({ action: "admin:blog:create" });
    const actor = await requireBlogWriteAccess();

    const parsed = validateAdminBlogCreateInput(readBlogPayload(formData));
    if (!parsed.success) {
      redirect(appendFlash(returnTo, "error", "invalidInput"));
    }

    const created = await createAdminBlogPost({
      data: parsed.data,
      actor,
    });

    revalidateBlogPaths();
    redirect(appendFlash(routes.admin.blogEdit(created.id), "notice", "created"));
  } catch (error) {
    unstable_rethrow(error);

    const appError = captureServerError(error, "admin:blog:create");
    redirect(appendFlash(returnTo, "error", getBlogErrorCode(appError, "createFailed")));
  }
}

export async function updateAdminBlogPostAction(formData: FormData) {
  const returnTo = getReturnTo(formData, routes.admin.blog);
  let errorCode: BlogErrorCode | null = null;

  try {
    await assertTrustedOrigin({ action: "admin:blog:update" });
    const actor = await requireBlogWriteAccess();

    const parsed = validateAdminBlogUpdateInput({
      id: `${formData.get("id") ?? ""}`,
      ...readBlogPayload(formData),
    });

    if (!parsed.success) {
      errorCode = "invalidInput";
    } else {
      await updateAdminBlogPost({
        data: parsed.data,
        actor,
      });
    }
  } catch (error) {
    unstable_rethrow(error);

    const appError = captureServerError(error, "admin:blog:update");
    errorCode = getBlogErrorCode(appError, "updateFailed");
  }

  if (errorCode) {
    redirect(appendFlash(returnTo, "error", errorCode));
  }

  revalidateBlogPaths();
  redirect(appendFlash(returnTo, "notice", "updated"));
}

export async function deleteAdminBlogPostAction(formData: FormData) {
  const returnTo = getReturnTo(formData, routes.admin.blog);
  const blogPostId = `${formData.get("blogPostId") ?? ""}`.trim();

  if (blogPostId.length === 0) {
    redirect(appendFlash(returnTo, "error", "missingId"));
  }

  try {
    await assertTrustedOrigin({ action: "admin:blog:delete" });
    const actor = await requireBlogWriteAccess();

    await deleteAdminBlogPost({
      blogPostId,
      actor,
    });
  } catch (error) {
    unstable_rethrow(error);

    const appError = captureServerError(error, "admin:blog:delete");
    redirect(appendFlash(returnTo, "error", getBlogErrorCode(appError, "deleteFailed")));
  }

  revalidateBlogPaths();
  redirect(appendFlash(returnTo, "notice", "deleted"));
}
