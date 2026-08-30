import type { ReactNode } from "react";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { SectionErrorState } from "@/components/ui/section-error-state";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import {
  AdminPageHeader,
} from "@/features/admin/components/admin-page-patterns";
import { updateAdminInventoryAction } from "@/features/admin/inventory/actions";
import {
  type AdminInventoryItem,
  AdminInventoryTable,
} from "@/features/admin/inventory/components/admin-inventory-table";
import {
  getAdminInventoryErrorMessage,
  getAdminInventoryNoticeMessage,
} from "@/features/admin/inventory/flash";
import { listAdminLowStockInventoryItems } from "@/features/admin/inventory/service";
import { requireRouteAccess } from "@/lib/auth/guards";
import { hasPermission, rbacPermissions } from "@/lib/auth/rbac";

export const metadata = buildMetadata({
  title: "Admin Inventory",
  path: "/admin/inventory",
  description: "Inventory and low-stock placeholder using the shared admin table pattern.",
});

type AdminInventoryPageProps = {
  searchParams?: Promise<{ notice?: string; error?: string }>;
};

function FlashBanner({
  message,
  tone = "notice",
  role,
}: {
  message: ReactNode;
  tone?: "notice" | "error";
  role?: string;
}) {
  const isNotice = tone === "notice";
  const cls = isNotice
    ? "rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900"
    : "rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive";

  const ariaRole = role ?? (isNotice ? "status" : "alert");

  return (
    <div role={ariaRole} className={cls}>
      {message}
    </div>
  );
}

export default async function AdminInventoryPage({ searchParams }: AdminInventoryPageProps) {
  const { role } = await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess],
    from: routes.admin.inventory,
  });

  const canAdjustInventory = hasPermission(role, rbacPermissions.catalogWrite);
  const params = (await searchParams) ?? {};
  const noticeMessage = getAdminInventoryNoticeMessage(params.notice);
  const errorMessage = getAdminInventoryErrorMessage(params.error);

  let lowStockItems: Awaited<ReturnType<typeof listAdminLowStockInventoryItems>> = [];
  try {
    lowStockItems = await listAdminLowStockInventoryItems({
      take: 200,
    });
  } catch {
    return (
      <PageShell className="gap-8">
        <AdminPageHeader
          eyebrow="Inventory"
          title="Low stock overview"
          description="See products that may need restocking before customers are impacted."
        />

        <SectionErrorState
          title="Could not load inventory"
          description="We could not load inventory records right now. Please try again."
        />
      </PageShell>
    );
  }

  if (lowStockItems.length === 0) {
    return (
      <PageShell className="gap-8">
        <AdminPageHeader
          eyebrow="Inventory"
          title="Low stock overview"
          description="See products that may need restocking before customers are impacted."
        />

        {noticeMessage ? (
          <FlashBanner message={noticeMessage} tone="notice" />
        ) : null}

        {errorMessage ? (
          <FlashBanner message={errorMessage} tone="error" />
        ) : null}

        <Card>
          <CardContent className="pt-6">
            <AdminInventoryTable
              items={[]}
              canAdjust={canAdjustInventory}
              updateAction={updateAdminInventoryAction}
              returnTo={routes.admin.inventory}
            />
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const inventoryItems: AdminInventoryItem[] = lowStockItems.map((item) => ({
    id: item.inventoryId,
    productName: item.productName,
    sku: item.sku,
    onHand: item.onHand,
    safetyStock: item.safetyStock,
    alertThreshold: item.alertThreshold,
    location: item.location,
    updatedAt: item.updatedAt.toISOString(),
  }));

  return (
    <PageShell className="gap-8">
      <AdminPageHeader
        eyebrow="Inventory"
        title="Low stock overview"
        description="See products that may need restocking before customers are impacted."
      />

      {noticeMessage ? <FlashBanner message={noticeMessage} tone="notice" /> : null}

      {errorMessage ? <FlashBanner message={errorMessage} tone="error" /> : null}

      <Card>
        <CardContent className="pt-6">
          <AdminInventoryTable
            items={inventoryItems}
            canAdjust={canAdjustInventory}
            updateAction={updateAdminInventoryAction}
            returnTo={routes.admin.inventory}
          />
        </CardContent>
      </Card>

      {!canAdjustInventory ? (
        <Card className="border-dashed">
          <CardContent className="p-4 text-sm text-muted-foreground">
            You can review low-stock rows here, but inventory adjustments require catalog write access.
          </CardContent>
        </Card>
      ) : null}
    </PageShell>
  );
}
