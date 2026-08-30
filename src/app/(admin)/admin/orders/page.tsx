import Link from "next/link";
import { ReceiptText } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMetadata } from "@/config/metadata";
import { routes } from "@/config/routes";
import {
  AdminPageHeader,
} from "@/features/admin/components/admin-page-patterns";
import {
  type AdminOrderStatusFilter,
  getAdminOrderErrorMessage,
  getAdminOrderNoticeMessage,
  listAdminOrders,
} from "@/features/admin/orders";
import { AdminOrderFiltersForm } from "@/features/admin/orders/components/admin-order-filters-form";
import { AdminOrdersTable } from "@/features/admin/orders/components/admin-orders-table";
import { requireRouteAccess } from "@/lib/auth/guards";
import { rbacPermissions } from "@/lib/auth/rbac";

type AdminOrdersPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    page?: string;
    notice?: string;
    error?: string;
  }>;
};

function normalizeStatusFilter(value?: string): AdminOrderStatusFilter {
  if (
    value === "PENDING" ||
    value === "CONFIRMED" ||
    value === "PACKED" ||
    value === "SHIPPED" ||
    value === "DELIVERED" ||
    value === "CANCELLED"
  ) {
    return value;
  }

  return "ALL";
}

function normalizePageParam(value?: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return Math.floor(parsed);
}

function buildOrdersPageHref(page: number, query: string, status: AdminOrderStatusFilter) {
  const params = new URLSearchParams();

  if (query.trim().length > 0) {
    params.set("q", query.trim());
  }

  if (status !== "ALL") {
    params.set("status", status);
  }

  if (page > 1) {
    params.set("page", `${page}`);
  }

  const queryString = params.toString();
  return queryString ? `${routes.admin.orders}?${queryString}` : routes.admin.orders;
}

export const metadata = buildMetadata({
  title: "Admin Orders",
  path: routes.admin.orders,
  description: "Manage fulfillment status, invoice access, customer details, and order history.",
});

export default async function AdminOrdersPage({ searchParams }: AdminOrdersPageProps) {
  await requireRouteAccess({
    permissions: [rbacPermissions.adminAccess, rbacPermissions.ordersRead],
    from: routes.admin.orders,
  });

  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const status = normalizeStatusFilter(params.status);
  const page = normalizePageParam(params.page);

  const orders = await listAdminOrders({
    query,
    status,
    page,
    pageSize: 20,
  });

  const noticeMessage = getAdminOrderNoticeMessage(params.notice);
  const errorMessage = getAdminOrderErrorMessage(params.error);

  return (
    <PageShell className="gap-8">
      <AdminPageHeader
        eyebrow="Orders"
        title="Order queue"
        description="Give non-technical staff a clear view of new, active, and completed orders with simple filters and status badges."
      />

      {noticeMessage ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900">
          {noticeMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-4 py-3 text-sm">
          {errorMessage}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Search and filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AdminOrderFiltersForm query={query} status={status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Order list</CardTitle>
          <div className="text-muted-foreground text-sm">Page {orders.page}</div>
        </CardHeader>
        <CardContent className="space-y-4">
          <AdminOrdersTable orders={orders.items} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-muted-foreground text-sm">
              Showing up to {orders.pageSize} orders per page.
            </div>
            <div className="flex gap-2">
              {orders.page <= 1 ? (
                <button
                  type="button"
                  disabled
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                  aria-disabled="true"
                >
                  Previous
                </button>
              ) : (
                <Link
                  href={buildOrdersPageHref(Math.max(1, orders.page - 1), query, status)}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Previous
                </Link>
              )}

              {!orders.hasNextPage ? (
                <button
                  type="button"
                  disabled
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                  aria-disabled="true"
                >
                  Next
                </button>
              ) : (
                <Link
                  href={buildOrdersPageHref(orders.page + 1, query, status)}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="text-muted-foreground flex items-start gap-3 p-4 text-sm">
          <ReceiptText className="mt-0.5 size-4" />
          <p>
            Staff tip: open an order to review the address, invoice, items, customer note, internal
            note, and full status history in one place.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
