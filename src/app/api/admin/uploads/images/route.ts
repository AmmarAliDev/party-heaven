import { NextResponse } from "next/server";

import {
  adminImageUploadRequestSchema,
  assertValidAdminImageFile,
  createAdminImageStorageProvider,
} from "@/features/admin/uploads";
import { guardRouteHandlerAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";
import { createRouteHandlerErrorResponse, createValidationAppError } from "@/lib/errors/handling";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const access = await guardRouteHandlerAccess({
      permissions: [rbacPermissions.adminAccess],
    });

    if (!access.ok) {
      return access.response;
    }

    const formData = await request.formData();
    const parsed = adminImageUploadRequestSchema.safeParse({
      purpose: formData.get("purpose") ?? "",
    });

    if (!parsed.success) {
      throw createValidationAppError(parsed.error, "Invalid image upload request.");
    }

    const file = formData.get("file");
    assertValidAdminImageFile(file);

    const provider = createAdminImageStorageProvider();
    const result = await provider.upload({
      file,
      purpose: parsed.data.purpose,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return createRouteHandlerErrorResponse(error, "admin image upload", {
      userMessage: "We could not upload that image right now. Try again or paste an existing image URL.",
    });
  }
}