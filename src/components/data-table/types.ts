import type {
  ColumnDef,
  OnChangeFn,
  PaginationState,
  Row,
  RowData,
  SortingState,
} from "@tanstack/react-table";
import type { ReactNode } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack Table's value-level column type intentionally uses `any` so typed accessors (`columnHelper.accessor("title", ...)`) remain assignable under `exactOptionalPropertyTypes`. Individual cells narrow the value via `getValue()` / `row.original`.
export type DataTableColumn<TData extends RowData> = ColumnDef<TData, any>;

export type DataTableEmptyState = {
  title: string;
  description: string;
  action?: ReactNode;
  eyebrow?: string;
  align?: "start" | "center";
};

export type DataTableErrorState = {
  title?: string;
  description: string;
  action?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
};

export type DataTablePaginationOptions = {
  state: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  pageCount: number;
};

export type UseDataTableOptions<TData extends RowData> = {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  getRowId?: (originalRow: TData, index: number, parent?: Row<TData>) => string;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  defaultSorting?: SortingState;
  globalFilter?: string;
  onGlobalFilterChange?: OnChangeFn<string>;
  defaultGlobalFilter?: string;
  pagination?: DataTablePaginationOptions;
  defaultPageSize?: number;
};
