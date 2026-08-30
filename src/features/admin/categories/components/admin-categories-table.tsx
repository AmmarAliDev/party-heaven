"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";

import { createDataTableColumnHelper, DataTable, type DataTableColumn } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { routes } from "@/config/routes";

import type { AdminCategoryListItem } from "../service";
import { DeleteCategoryButton } from "./delete-category-button";

const columnHelper = createDataTableColumnHelper<AdminCategoryListItem>();

const statusBadgeVariantMap: Record<"DRAFT" | "PUBLISHED" | "ARCHIVED", "secondary" | "info" | "warning"> = {
  DRAFT: "secondary",
  PUBLISHED: "info",
  ARCHIVED: "warning",
};

const statusLabelMap: Record<"DRAFT" | "PUBLISHED" | "ARCHIVED", string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export const adminCategoriesTableColumns: DataTableColumn<AdminCategoryListItem>[] = [
  columnHelper.accessor("name", {
    id: "name",
    header: "Name",
    cell: (info) => {
      const category = info.row.original;
      return (
        <div>
          <p className="font-medium">{category.name}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {category.description ?? "No description"}
          </p>
        </div>
      );
    },
  }),

  columnHelper.accessor("slug", {
    header: "Slug",
    cell: (info) => {
      const slug = info.getValue();
      return <p className="font-mono text-xs">{slug}</p>;
    },
  }),

  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => {
      const status = info.getValue() as "DRAFT" | "PUBLISHED" | "ARCHIVED";
      return (
        <Badge variant={statusBadgeVariantMap[status]}>
          {statusLabelMap[status]}
        </Badge>
      );
    },
  }),

  columnHelper.accessor("seoTitle", {
    header: "SEO",
    cell: (info) => {
      const category = info.row.original;
      return (
        <div className="text-xs text-muted-foreground">
          <p>{category.seoTitle ?? "No SEO title"}</p>
          <p className="mt-1">{category.seoDescription ?? "No SEO description"}</p>
        </div>
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

export interface AdminCategoriesTableProps {
  categories: AdminCategoryListItem[];
  returnTo?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function AdminCategoriesTable({
  categories,
  returnTo = "/admin/categories",
  emptyTitle = "No categories found",
  emptyDescription = "Create your first category or adjust search and filters.",
}: AdminCategoriesTableProps) {
  const columns: DataTableColumn<AdminCategoryListItem>[] = [
    ...adminCategoriesTableColumns,
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: (info) => {
        const category = info.row.original;
        return (
          <div className="flex gap-2">
            <Link
              href={routes.admin.categoryEdit(category.id)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil className="size-4" />
              Edit
            </Link>
            <DeleteCategoryButton
              categoryId={category.id}
              categoryName={category.name}
              returnTo={returnTo}
            />
          </div>
        );
      },
    }),
  ];

  return (
    <DataTable<AdminCategoryListItem>
      data={categories}
      columns={columns}
      getRowId={(row) => row.id}
      emptyState={{
        title: emptyTitle,
        description: emptyDescription,
      }}
    />
  );
}

