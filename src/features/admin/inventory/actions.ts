"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { routes } from "@/config/routes";
import { requireRouteAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";
import { captureServerError } from "@/lib/errors/handling";
import { assertTrustedOrigin } from "@/lib/security/csrf";

import {
  type AdminInventoryErrorCode,
  getAdminInventoryErrorCode,
} from "./flash";
import { adjustAdminInventory } from "./service";
import { validateAdminInventoryAdjustmentInput } from "./validation";

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

async function requireInventoryWriteAccess() {
  const { role, session } = await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess, rbacPermissions.catalogWrite],
    from: routes.admin.inventory,
  });

  return {
    actorId: session.user.id,
    actorRole: role,
  };
}

export async function updateAdminInventoryAction(formData: FormData) {
  const returnTo = getReturnTo(formData, routes.admin.inventory);
  let errorCode: AdminInventoryErrorCode | null = null;

  try {
    await assertTrustedOrigin({ action: "admin:inventory:update" });
    const actor = await requireInventoryWriteAccess();

    const parsed = validateAdminInventoryAdjustmentInput({
      inventoryId: `${formData.get("inventoryId") ?? ""}`,
      expectedUpdatedAt: `${formData.get("expectedUpdatedAt") ?? ""}`,
      adjustmentMode: `${formData.get("adjustmentMode") ?? ""}`,
      amount: `${formData.get("amount") ?? ""}`,
      reason: `${formData.get("reason") ?? ""}`,
    });

    if (!parsed.success) {
      errorCode = "invalidInput";
    } else {
      await adjustAdminInventory({
        data: parsed.data,
        actor,
      });
    }
  } catch (error) {
    unstable_rethrow(error);

    const appError = captureServerError(error, "admin:inventory:update");
    errorCode = getAdminInventoryErrorCode(appError, "updateFailed");
  }

  if (errorCode) {
    redirect(appendFlash(returnTo, "error", errorCode));
  }

  revalidatePath(routes.admin.inventory);
  revalidatePath(routes.admin.dashboard);
  redirect(appendFlash(returnTo, "notice", "updated"));
}
