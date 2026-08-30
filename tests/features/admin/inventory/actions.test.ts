import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
}));
const unstableRethrowMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const requireRouteAccessMock = vi.hoisted(() => vi.fn());
const assertTrustedOriginMock = vi.hoisted(() => vi.fn());
const adjustAdminInventoryMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  unstable_rethrow: unstableRethrowMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/auth/guards", () => ({
  requireRouteAccess: requireRouteAccessMock,
}));

vi.mock("@/lib/security/csrf", () => ({
  assertTrustedOrigin: assertTrustedOriginMock,
}));

vi.mock("@/features/admin/inventory/service", () => ({
  adjustAdminInventory: adjustAdminInventoryMock,
}));

import { routes } from "@/config/routes";
import { updateAdminInventoryAction } from "@/features/admin/inventory/actions";
import { rbacPermissions } from "@/lib/auth/rbac";

describe("updateAdminInventoryAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRouteAccessMock.mockResolvedValue({
      role: "PRODUCT_MANAGER",
      session: {
        user: {
          id: "admin-1",
        },
      },
    });
    assertTrustedOriginMock.mockResolvedValue(undefined);
    adjustAdminInventoryMock.mockResolvedValue({
      inventoryId: "inventory-1",
    });
  });

  it("enforces write permissions and performs an inventory update", async () => {
    const formData = new FormData();
    formData.set("inventoryId", "inventory-1");
    formData.set("expectedUpdatedAt", "2026-04-24T10:00:00.000Z");
    formData.set("adjustmentMode", "set");
    formData.set("amount", "12");
    formData.set("reason", "Cycle count correction");
    formData.set("returnTo", routes.admin.inventory);

    await expect(updateAdminInventoryAction(formData)).rejects.toThrow(/REDIRECT:/);

    expect(requireRouteAccessMock).toHaveBeenCalledWith({
      permissions: [rbacPermissions.adminAccess, rbacPermissions.catalogWrite],
      from: routes.admin.inventory,
    });
    expect(adjustAdminInventoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: {
          actorId: "admin-1",
          actorRole: "PRODUCT_MANAGER",
        },
        data: expect.objectContaining({
          inventoryId: "inventory-1",
          adjustmentMode: "set",
          amount: 12,
        }),
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(routes.admin.inventory);
    expect(revalidatePathMock).toHaveBeenCalledWith(routes.admin.dashboard);
  });

  it("redirects with an input error when validation fails", async () => {
    const formData = new FormData();
    formData.set("inventoryId", "inventory-1");
    formData.set("expectedUpdatedAt", "2026-04-24T10:00:00.000Z");
    formData.set("adjustmentMode", "increase");
    formData.set("amount", "0");
    formData.set("reason", "no");
    formData.set("returnTo", routes.admin.inventory);

    await expect(updateAdminInventoryAction(formData)).rejects.toThrow(/error=invalidInput/);

    expect(adjustAdminInventoryMock).not.toHaveBeenCalled();
  });
});
