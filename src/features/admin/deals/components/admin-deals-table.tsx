"use client";

import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";

import { createDataTableColumnHelper,DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { routes } from "@/config/routes";

import type { AdminDealListItem } from "../service";
import { DeleteDealButton } from "./delete-deal-button";

const columnHelper = createDataTableColumnHelper<AdminDealListItem>();

const statusBadgeVariantMap: Record<"DRAFT" | "PUBLISHED" | "ARCHIVED", "secondary" | "info" | "warning"> = {
  DRAFT: "secondary",
  PUBLISHED: "info",
  ARCHIVED: "warning",
};

export const adminDealsTableColumns: ColumnDef<AdminDealListItem, any>[] = [
  columnHelper.accessor("title", {
    id: "deal",
    header: "Deal",
    cell: (info) => {
      const deal = info.row.original;
      return (
        <div>
          <p className="font-medium">{deal.title}</p>
          <p className="text-muted-foreground mt-1 text-xs">/{deal.slug}</p>
          <div className="mt-2">
            <Badge variant={statusBadgeVariantMap[deal.status]}>{deal.status}</Badge>
          </div>
        </div>
      );
    },
  }),

  columnHelper.accessor("productSummary", {
    header: "Products",
    cell: (info) => {
      const deal = info.row.original;
      return (
        <div>
          <span className="text-muted-foreground line-clamp-2">{deal.productSummary}</span>
          <span className="text-muted-foreground mt-0.5 block text-xs">
            {deal.itemCount} product{deal.itemCount === 1 ? "" : "s"}
          </span>
        </div>
      );
    },
  }),

  columnHelper.accessor("categoryName", {
    header: "Category",
    cell: (info) => {
      const categoryName = info.getValue();
      return <span className="text-muted-foreground">{categoryName ?? "Unassigned"}</span>;
    },
  }),

  columnHelper.accessor("availableStock", {
    header: "Availability",
    cell: (info) => {
      const deal = info.row.original;
      if (!deal.isAvailable) {
        return <Badge variant="danger">Out of stock</Badge>;
      }

      if (deal.isLowStock) {
        return <Badge variant="warning">Low stock ({deal.availableStock})</Badge>;
      }

      return <span className="text-muted-foreground">{deal.availableStock} units</span>;
    },
  }),

  columnHelper.accessor("updatedAt", {
    header: "Updated",
    cell: (info) => {
      const raw = info.getValue();
      const date = raw ? new Date(raw) : null;
      if (!date || isNaN(date.getTime())) {
        return <span className="text-muted-foreground text-xs">{""}</span>;
      }
      const locale = typeof navigator !== "undefined" ? navigator.language : undefined;
      return (
        <span className="text-muted-foreground text-xs">
          {date.toLocaleString(locale, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
      );
    },
  }),
];

export interface AdminDealsTableProps {
  deals: AdminDealListItem[];
  returnTo?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function AdminDealsTable({
  deals,
  returnTo = routes.admin.deals,
  emptyTitle = "No deals found",
  emptyDescription = "Create your first deal or adjust the current filters.",
}: AdminDealsTableProps) {
  const columns: ColumnDef<AdminDealListItem, any>[] = [
    ...adminDealsTableColumns,
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: (info) => {
        const deal = info.row.original;
        return (
          <div className="flex gap-2">
            <Link
              href={routes.admin.dealEdit(deal.id)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil className="size-4" />
              Edit
            </Link>
            <DeleteDealButton dealId={deal.id} dealTitle={deal.title} returnTo={returnTo} />
          </div>
        );
      },
    }),
  ];

  return (
    <DataTable<AdminDealListItem>
      data={deals}
      columns={columns}
      getRowId={(row) => row.id}
      emptyState={{
        title: emptyTitle,
        description: emptyDescription,
      }}
    />
  );
}
