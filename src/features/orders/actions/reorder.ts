"use server";

import { auth } from "@/auth";
import { reorderFromOrder } from "@/features/orders/service";
import { AppError } from "@/lib/errors/app-error";
import { assertTrustedOrigin } from "@/lib/security/csrf";

import type { ReorderActionState } from "./reorder-types";

export async function reorderOrderAction(
  _prev: ReorderActionState,
  formData: FormData,
): Promise<ReorderActionState> {
  try {
    await assertTrustedOrigin({ action: "order:reorder" });

    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw new AppError("Unauthorized reorder attempt.", "UNAUTHORIZED", {
        statusCode: 401,
        userMessage: "Please sign in again to reorder this order.",
      });
    }

    const rawOrderNumber = formData.get("orderNumber");
    const orderNumber = typeof rawOrderNumber === "string" ? rawOrderNumber.trim() : "";

    if (!orderNumber) {
      throw new AppError("Reorder order number missing.", "ORDER_NUMBER_INVALID", {
        statusCode: 400,
        userMessage: "We could not determine which order to re-order.",
      });
    }

    const result = await reorderFromOrder({
      userId,
      orderNumber,
    });

    if (result.addedQuantity < 1 && result.issues.length > 0) {
      return {
        ok: false,
        message: "No items were added because products are unavailable or out of stock.",
        addedQuantity: result.addedQuantity,
        issueCount: result.issues.length,
        issues: result.issues.map((issue) => ({
          productName: issue.productName,
          requestedQuantity: issue.requestedQuantity,
          addedQuantity: issue.addedQuantity,
          reason: issue.reason,
          message: issue.message,
        })),
      };
    }

    if (result.issues.length > 0) {
      return {
        ok: true,
        message: `Added ${result.addedQuantity} item(s) to cart with ${result.issues.length} adjustment(s).`,
        addedQuantity: result.addedQuantity,
        issueCount: result.issues.length,
        issues: result.issues.map((issue) => ({
          productName: issue.productName,
          requestedQuantity: issue.requestedQuantity,
          addedQuantity: issue.addedQuantity,
          reason: issue.reason,
          message: issue.message,
        })),
      };
    }

    return {
      ok: true,
      message: `Added ${result.addedQuantity} item(s) to your cart.`,
      addedQuantity: result.addedQuantity,
      issueCount: 0,
      issues: [],
    };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        ok: false,
        message: error.userMessage ?? "We could not re-order this order right now.",
        addedQuantity: 0,
        issueCount: 0,
        issues: [],
      };
    }

    return {
      ok: false,
      message: "We could not re-order this order right now.",
      addedQuantity: 0,
      issueCount: 0,
      issues: [],
    };
  }
}
