"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";

import { createDataTableColumnHelper, DataTable, type DataTableColumn } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { routes } from "@/config/routes";

import type { AdminProductListItem } from "../service";
import { DeleteProductButton } from "./delete-product-button";

const columnHelper = createDataTableColumnHelper<AdminProductListItem>();

const statusBadgeVariantMap: Record<"DRAFT" | "PUBLISHED" | "ARCHIVED", "secondary" | "info" | "warning"> = {
  DRAFT: "secondary",
  PUBLISHED: "info",
  ARCHIVED: "warning",
};

export const adminProductsTableColumns: DataTableColumn<AdminProductListItem>[] = [
  columnHelper.accessor("title", {
    id: "product",
    header: "Product",
    cell: (info) => {
      const product = info.row.original;
      return (
        <div>
          <p className="font-medium">{product.title}</p>
          <p className="text-muted-foreground mt-1 text-xs">/{product.slug}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {product.shortDescription ?? "No short description"}
          </p>
          <div className="mt-2">
            <Badge variant={statusBadgeVariantMap[product.status]}>{product.status}</Badge>
          </div>
        </div>
      );
    },
  }),

  columnHelper.accessor("type", {
    header: "Type",
    cell: (info) => {
      const product = info.row.original;
      return (
        <Badge variant="outline">
          {product.type === "VARIANT" ? `${product.variantCount} variants` : "Simple"}
        </Badge>
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

  columnHelper.accessor("priceLabel", {
    header: "Pricing",
    cell: (info) => {
      const priceLabel = info.getValue();
      return <p className="font-medium">{priceLabel}</p>;
    },
  }),

  columnHelper.accessor("inventoryTotal", {
    header: "Stock",
    cell: (info) => {
      const inventoryTotal = info.getValue();
      return <span className="text-muted-foreground">{inventoryTotal} units</span>;
    },
  }),

  columnHelper.accessor("seoTitle", {
    header: "SEO",
    cell: (info) => {
      const seoTitle = info.getValue();
      return (
        <span className="text-muted-foreground text-xs">{seoTitle ?? "No SEO title"}</span>
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

export interface AdminProductsTableProps {
  products: AdminProductListItem[];
  returnTo?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function AdminProductsTable({
  products,
  returnTo = routes.admin.products,
  emptyTitle = "No products found",
  emptyDescription = "Create your first product or adjust the current filters.",
}: AdminProductsTableProps) {
  const columns: DataTableColumn<AdminProductListItem>[] = [
    ...adminProductsTableColumns,
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: (info) => {
        const product = info.row.original;
        return (
          <div className="flex gap-2">
            <Link
              href={routes.admin.productEdit(product.id)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil className="size-4" />
              Edit
            </Link>
            <DeleteProductButton productId={product.id} productTitle={product.title} returnTo={returnTo} />
          </div>
        );
      },
    }),
  ];

  return (
    <DataTable<AdminProductListItem>
      data={products}
      columns={columns}
      getRowId={(row) => row.id}
      emptyState={{
        title: emptyTitle,
        description: emptyDescription,
      }}
    />
  );
}

