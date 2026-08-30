"use client";

import { type ColumnDef, createColumnHelper, flexRender, type Row, type RowData } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionErrorState } from "@/components/ui/section-error-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type {
  DataTableEmptyState,
  DataTableErrorState,
  DataTablePaginationOptions,
  UseDataTableOptions,
} from "./types";
import { useDataTable } from "./use-data-table";

export const createDataTableColumnHelper = createColumnHelper;

type DataTableProps<TData extends RowData> = UseDataTableOptions<TData> & {
  className?: string;
  caption?: string;
  toolbar?: ReactNode;
  loading?: boolean;
  loadingRows?: number;
  loadingColumns?: number;
  emptyState?: DataTableEmptyState;
  errorState?: DataTableErrorState;
  renderErrorState?: (errorState: DataTableErrorState) => ReactNode;
  rowActions?: (row: Row<TData>) => ReactNode;
  rowClassName?: (row: Row<TData>) => string | undefined;
  onRowClick?: (row: Row<TData>) => void;
  renderPagination?: (args: {
    pagination?: DataTablePaginationOptions;
    pageIndex: number;
    pageCount: number;
    canPreviousPage: boolean;
    canNextPage: boolean;
    previousPage: () => void;
    nextPage: () => void;
  }) => ReactNode;
  paginationClassName?: string;
};

const DEFAULT_EMPTY_STATE: DataTableEmptyState = {
  title: "No records found",
  description: "Try a different search or adjust your filters.",
};

function getSortableColumnLabel(headerValue: unknown, columnId: string) {
  return typeof headerValue === "string" && headerValue.trim().length > 0 ? headerValue : columnId;
}

export function DataTable<TData extends RowData>({
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
  defaultPageSize,
  className,
  caption,
  toolbar,
  loading = false,
  loadingRows = 4,
  loadingColumns,
  emptyState = DEFAULT_EMPTY_STATE,
  errorState,
  renderErrorState,
  rowActions,
  rowClassName,
  onRowClick,
  renderPagination,
  paginationClassName,
}: DataTableProps<TData>) {
  const actionColumnWidthClass = "w-[1%] whitespace-nowrap";

  const tableOptions: UseDataTableOptions<TData> = {
    data,
    columns,
    ...(getRowId ? { getRowId } : {}),
    ...(sorting ? { sorting } : {}),
    ...(onSortingChange ? { onSortingChange } : {}),
    ...(defaultSorting ? { defaultSorting } : {}),
    ...(globalFilter !== undefined ? { globalFilter } : {}),
    ...(onGlobalFilterChange ? { onGlobalFilterChange } : {}),
    ...(defaultGlobalFilter !== undefined ? { defaultGlobalFilter } : {}),
    ...(pagination ? { pagination } : {}),
    ...(defaultPageSize !== undefined ? { defaultPageSize } : {}),
  };

  const { table } = useDataTable<TData>(tableOptions);

  const visibleColumnsCount = table.getVisibleFlatColumns().length;
  const tableColumnsCount = Math.max(visibleColumnsCount + (rowActions ? 1 : 0), 1);

  if (errorState) {
    if (renderErrorState) {
      return <>{renderErrorState(errorState)}</>;
    }

    const sectionErrorStateProps = {
      description: errorState.description,
      ...(className ? { className } : {}),
      ...(errorState.title ? { title: errorState.title } : {}),
      ...(errorState.action ? { action: errorState.action } : {}),
      ...(errorState.onRetry ? { onRetry: errorState.onRetry } : {}),
      ...(errorState.retryLabel ? { retryLabel: errorState.retryLabel } : {}),
    };

    return (
      <SectionErrorState {...sectionErrorStateProps} />
    );
  }

  if (loading) {
    return (
      <div className={className} aria-busy="true" aria-live="polite">
        {toolbar ? <div className="mb-4">{toolbar}</div> : null}
        <div data-testid="data-table-loading">
          <TableSkeleton rows={loadingRows} columns={loadingColumns ?? tableColumnsCount} />
        </div>
      </div>
    );
  }

  const rows = table.getRowModel().rows;
  const resolvedEmptyStateProps = {
    title: emptyState.title,
    description: emptyState.description,
    ...(emptyState.action ? { action: emptyState.action } : {}),
    ...(emptyState.eyebrow ? { eyebrow: emptyState.eyebrow } : {}),
    ...(emptyState.align ? { align: emptyState.align } : {}),
  };

  return (
    <div className={cn("space-y-4", className)}>
      {toolbar ? <div>{toolbar}</div> : null}

      <div className="border-border/70 bg-card overflow-hidden rounded-[var(--radius-card)] border shadow-[var(--shadow-soft)]">
        <Table>
          {caption ? <TableCaption>{caption}</TableCaption> : null}

          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortingDirection = header.column.getIsSorted();
                  const sortableColumnLabel = getSortableColumnLabel(
                    header.column.columnDef.header,
                    header.column.id,
                  );

                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : canSort ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-8 px-2"
                          onClick={header.column.getToggleSortingHandler()}
                          aria-label={`Sort by ${sortableColumnLabel}`}
                        >
                          <span>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {sortingDirection === "asc" ? (
                            <ArrowUp className="text-muted-foreground size-3.5" aria-hidden="true" />
                          ) : null}
                          {sortingDirection === "desc" ? (
                            <ArrowDown className="text-muted-foreground size-3.5" aria-hidden="true" />
                          ) : null}
                          {sortingDirection === false ? (
                            <ArrowUpDown className="text-muted-foreground size-3.5" aria-hidden="true" />
                          ) : null}
                        </Button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
                {rowActions ? <TableHead className={actionColumnWidthClass}>Actions</TableHead> : null}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    onRowClick ? "cursor-pointer" : undefined,
                    rowClassName ? rowClassName(row) : undefined,
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                  {rowActions ? (
                    <TableCell className={actionColumnWidthClass}>
                      <div onClick={(event) => event.stopPropagation()}>{rowActions(row)}</div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={tableColumnsCount} className="p-6">
                  <EmptyState {...resolvedEmptyStateProps} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {renderPagination
        ? renderPagination({
            pageIndex: table.getState().pagination.pageIndex,
            pageCount: table.getPageCount(),
            canPreviousPage: table.getCanPreviousPage(),
            canNextPage: table.getCanNextPage(),
            previousPage: table.previousPage,
            nextPage: table.nextPage,
            ...(pagination ? { pagination } : {}),
          })
        : table.getPageCount() > 1
          ? (
              <div
                className={cn("flex items-center justify-end gap-2", paginationClassName)}
                aria-label="Pagination controls"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <p className="text-muted-foreground text-sm">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                </Button>
              </div>
            )
          : null}
    </div>
  );
}

export type { ColumnDef };
