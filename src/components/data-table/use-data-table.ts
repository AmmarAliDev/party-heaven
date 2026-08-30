"use client";

import { useMemo, useState } from "react";
import type { PaginationState, RowData, SortingState } from "@tanstack/react-table";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import type { UseDataTableOptions } from "./types";

const DEFAULT_PAGE_SIZE = 10;

export function useDataTable<TData extends RowData>({
  data,
  columns,
  getRowId,
  sorting,
  onSortingChange,
  defaultSorting,
  globalFilter,
  onGlobalFilterChange,
  defaultGlobalFilter,
  pagination,
  defaultPageSize = DEFAULT_PAGE_SIZE,
}: UseDataTableOptions<TData>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>(defaultSorting ?? []);
  const [internalGlobalFilter, setInternalGlobalFilter] = useState<string>(defaultGlobalFilter ?? "");
  const [internalPagination, setInternalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });

  const resolvedSorting = sorting ?? internalSorting;
  const resolvedOnSortingChange = onSortingChange ?? setInternalSorting;
  const resolvedGlobalFilter = globalFilter ?? internalGlobalFilter;
  const resolvedOnGlobalFilterChange = onGlobalFilterChange ?? setInternalGlobalFilter;
  const resolvedPagination = pagination?.state ?? internalPagination;
  const resolvedOnPaginationChange = pagination?.onPaginationChange ?? setInternalPagination;

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table's useReactTable is a well-known external hook the React Compiler cannot analyze; the hook is intentionally wrapped for a typed data-table abstraction.
  const table = useReactTable({
    data,
    columns,
    ...(getRowId ? { getRowId } : {}),
    state: {
      sorting: resolvedSorting,
      globalFilter: resolvedGlobalFilter,
      pagination: resolvedPagination,
    },
    onSortingChange: resolvedOnSortingChange,
    onGlobalFilterChange: resolvedOnGlobalFilterChange,
    onPaginationChange: resolvedOnPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: "includesString",
    manualPagination: Boolean(pagination),
    ...(pagination ? { pageCount: pagination.pageCount } : {}),
  });

  return useMemo(
    () => ({
      table,
      state: {
        sorting: resolvedSorting,
        globalFilter: resolvedGlobalFilter,
        pagination: resolvedPagination,
      },
    }),
    [resolvedGlobalFilter, resolvedPagination, resolvedSorting, table],
  );
}
