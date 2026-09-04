"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";

import { createDataTableColumnHelper, DataTable, type DataTableColumn } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { routes } from "@/config/routes";

import type { AdminOccasionListItem } from "../service";
import { DeleteOccasionButton } from "./delete-occasion-button";

const columnHelper = createDataTableColumnHelper<AdminOccasionListItem>();

const statusBadgeVariantMap: Record<"DRAFT" | "PUBLISHED" | "ARCHIVED", "secondary" | "info" | "warning"> = {
  DRAFT: "secondary",
  PUBLISHED: "info",
  ARCHIVED: "warning",
};

export const adminOccasionsTableColumns: DataTableColumn<AdminOccasionListItem>[] = [
  columnHelper.accessor("name", {
    id: "occasion",
    header: "Occasion",
    cell: (info) => {
      const occasion = info.row.original;
      return (
        <div>
          <p className="font-medium">{occasion.name}</p>
          <p className="text-muted-foreground mt-1 text-xs">/{occasion.slug}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant={statusBadgeVariantMap[occasion.status]}>{occasion.status}</Badge>
            {occasion.isSpecial ? <Badge variant="danger">Special</Badge> : <Badge variant="outline">Normal</Badge>}
          </div>
        </div>
      );
    },
  }),

  columnHelper.accessor("itemCount", {
    id: "content",
    header: "Content",
    cell: (info) => {
      const occasion = info.row.original;
      return (
        <div className="text-muted-foreground text-sm">
          {occasion.productCount} product{occasion.productCount === 1 ? "" : "s"} · {occasion.dealCount} deal
          {occasion.dealCount === 1 ? "" : "s"}
        </div>
      );
    },
  }),

  columnHelper.accessor("coverImageUrl", {
    id: "cover",
    header: "Cover",
    cell: (info) => {
      const url = info.getValue();
      if (!url) {
        return <span className="text-muted-foreground text-xs">None</span>;
      }

      return (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary blob URLs; next/image remote config may reject them.
        <img
          src={url}
          alt=""
          className="h-10 w-16 rounded-md border object-cover"
          aria-hidden="true"
        />
      );
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

export interface AdminOccasionsTableProps {
  occasions: AdminOccasionListItem[];
  returnTo?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function AdminOccasionsTable({
  occasions,
  returnTo = routes.admin.occasions,
  emptyTitle = "No occasions found",
  emptyDescription = "Create your first occasion or adjust the current filters.",
}: AdminOccasionsTableProps) {
  const columns: DataTableColumn<AdminOccasionListItem>[] = [
    ...adminOccasionsTableColumns,
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: (info) => {
        const occasion = info.row.original;
        return (
          <div className="flex gap-2">
            <Link
              href={routes.admin.occasionEdit(occasion.id)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil className="size-4" />
              Edit
            </Link>
            <DeleteOccasionButton
              occasionId={occasion.id}
              occasionName={occasion.name}
              returnTo={returnTo}
            />
          </div>
        );
      },
    }),
  ];

  return (
    <DataTable<AdminOccasionListItem>
      data={occasions}
      columns={columns}
      getRowId={(row) => row.id}
      emptyState={{
        title: emptyTitle,
        description: emptyDescription,
      }}
    />
  );
}
