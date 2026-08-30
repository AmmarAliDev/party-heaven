"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { createDataTableColumnHelper, DataTable, type DataTableColumn } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PriceDisplay } from "@/components/ui/price-display";
import { routes } from "@/config/routes";
import { getOrderStatusVariant } from "@/features/orders/status";

import type { AdminOrderListItem } from "../service";

const columnHelper = createDataTableColumnHelper<AdminOrderListItem>();

export const adminOrdersTableColumns: DataTableColumn<AdminOrderListItem>[] = [
  columnHelper.accessor("orderNumber", {
    id: "order",
    header: "Order",
    cell: (info) => {
      const order = info.row.original;
      return (
        <div>
          <p className="font-medium">{order.orderNumber}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {order.itemCount} item line{order.itemCount === 1 ? "" : "s"}
          </p>
        </div>
      );
    },
  }),

  columnHelper.accessor("customerName", {
    header: "Customer",
    cell: (info) => {
      const order = info.row.original;
      return (
        <div>
          <p className="font-medium">{order.customerName}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {order.customerEmail ?? order.customerPhone ?? "No contact provided"}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {order.city ?? "City not provided"}
          </p>
        </div>
      );
    },
  }),

  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => {
      const order = info.row.original;
      return (
        <Badge variant={getOrderStatusVariant(order.status)}>
          {order.statusLabel}
        </Badge>
      );
    },
  }),

  columnHelper.accessor("paymentMethodLabel", {
    header: "Payment",
    cell: (info) => {
      const order = info.row.original;
      return (
        <div>
          <p className="font-medium">{order.paymentMethodLabel}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {order.paymentStatus ?? "Pending"}
          </p>
        </div>
      );
    },
  }),

  columnHelper.accessor("total", {
    header: "Total",
    cell: (info) => {
      const total = info.getValue();
      return <PriceDisplay amount={total} />;
    },
  }),

  columnHelper.accessor("placedAt", {
    header: "Placed",
    cell: (info) => {
      const date = info.getValue();
      return (
        <span className="text-muted-foreground text-xs">
          {date.toLocaleString("en-PK", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
      );
    },
  }),

  columnHelper.display({
    id: "actions",
    header: "Actions",
    cell: (info) => {
      const order = info.row.original;
      return (
        <Link
          href={routes.admin.orderDetail(order.orderNumber)}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ArrowRight className="size-4" />
          View
        </Link>
      );
    },
  }),
];

export interface AdminOrdersTableProps {
  orders: AdminOrderListItem[];
  emptyTitle?: string;
  emptyDescription?: string;
}

export function AdminOrdersTable({
  orders,
  emptyTitle = "No orders match the current filters",
  emptyDescription = "Try a broader search or switch back to all statuses.",
}: AdminOrdersTableProps) {
  return (
    <DataTable<AdminOrderListItem>
      data={orders}
      columns={adminOrdersTableColumns}
      getRowId={(row) => row.id}
      emptyState={{
        title: emptyTitle,
        description: emptyDescription,
      }}
    />
  );
}

