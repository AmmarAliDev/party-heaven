"use client";

import { createDataTableColumnHelper, DataTable, type DataTableColumn } from "@/components/data-table";

import { InventoryAdjustmentForm } from "./inventory-adjustment-form";

const columnHelper = createDataTableColumnHelper<AdminInventoryItem>();

export type AdminInventoryItem = {
  id: string;
  productName: string | null;
  sku: string | null;
  onHand: number;
  safetyStock: number | null;
  alertThreshold: number;
  location: string | null;
  updatedAt: string;
};

export const adminInventoryTableColumns: DataTableColumn<AdminInventoryItem>[] = [
  columnHelper.accessor("productName", {
    header: "Product",
    cell: (info) => {
      const productName = info.getValue();
      return <span>{productName ?? "—"}</span>;
    },
  }),

  columnHelper.accessor("sku", {
    header: "SKU",
    cell: (info) => {
      const sku = info.getValue();
      return <span>{sku ?? "—"}</span>;
    },
  }),

  columnHelper.accessor("onHand", {
    header: "On hand",
    cell: (info) => {
      const onHand = info.getValue();
      return <span>{onHand}</span>;
    },
  }),

  columnHelper.accessor("safetyStock", {
    header: "Safety",
    cell: (info) => {
      const safetyStock = info.getValue();
      return <span>{safetyStock ?? 0}</span>;
    },
  }),

  columnHelper.accessor("alertThreshold", {
    header: "Alert at",
    cell: (info) => {
      const alertThreshold = info.getValue();
      return <span>{alertThreshold}</span>;
    },
  }),

  columnHelper.accessor("location", {
    header: "Location",
    cell: (info) => {
      const location = info.getValue();
      return <span>{location ?? "—"}</span>;
    },
  }),
];

export interface AdminInventoryTableProps {
  items: AdminInventoryItem[];
  canAdjust?: boolean;
  updateAction?: (formData: FormData) => void | Promise<void>;
  returnTo?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function AdminInventoryTable({
  items,
  canAdjust = false,
  updateAction,
  returnTo = "/admin/inventory",
  emptyTitle = "No low-stock alerts",
  emptyDescription = "Inventory alerts will appear here as product stock drops.",
}: AdminInventoryTableProps) {
  const columns: DataTableColumn<AdminInventoryItem>[] = [
    ...adminInventoryTableColumns,
    ...(canAdjust && updateAction
      ? [
          columnHelper.display({
            id: "adjust",
            header: "Adjust",
            cell: (info) => {
              const item = info.row.original;

              return <InventoryAdjustmentForm item={item} action={updateAction} returnTo={returnTo} />;
            },
          }),
        ]
      : []),
  ];

  return (
    <DataTable<AdminInventoryItem>
      data={items}
      columns={columns}
      getRowId={(row) => row.id}
      emptyState={{
        title: emptyTitle,
        description: emptyDescription,
      }}
    />
  );
}


