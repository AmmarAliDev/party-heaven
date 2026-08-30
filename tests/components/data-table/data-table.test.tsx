// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDataTableColumnHelper,
  DataTable,
  type DataTableColumn,
} from "@/components/data-table";

type RowItem = {
  id: string;
  name: string;
  sku: string;
};

const columnHelper = createDataTableColumnHelper<RowItem>();

const columns: DataTableColumn<RowItem>[] = [
  columnHelper.accessor("name", {
    header: "Product",
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("sku", {
    header: "SKU",
    cell: (info) => info.getValue(),
  }),
];

const data: RowItem[] = [
  { id: "p-1", name: "Daily Face Wash", sku: "DFW-001" },
  { id: "p-2", name: "Classic Tee", sku: "CT-002" },
];

afterEach(() => {
  cleanup();
});

describe("DataTable", () => {
  it("renders headers and cell values", () => {
    render(<DataTable data={data} columns={columns} />);

    expect(screen.getByRole("columnheader", { name: "Product" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "SKU" })).toBeInTheDocument();
    expect(screen.getByText("Daily Face Wash")).toBeInTheDocument();
    expect(screen.getByText("CT-002")).toBeInTheDocument();
  });

  it("renders custom empty state when there are no rows", () => {
    render(
      <DataTable
        data={[]}
        columns={columns}
        emptyState={{
          title: "No products found",
          description: "Try clearing filters.",
          align: "center",
        }}
      />,
    );

    expect(screen.getByText("No products found")).toBeInTheDocument();
    expect(screen.getByText("Try clearing filters.")).toBeInTheDocument();
  });

  it("renders loading skeleton state", () => {
    render(<DataTable data={data} columns={columns} loading />);

    expect(screen.getByTestId("data-table-loading")).toBeInTheDocument();
    expect(screen.queryByText("Daily Face Wash")).not.toBeInTheDocument();
  });

  it("supports row action slot and prevents row click when action is clicked", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const onActionClick = vi.fn();

    render(
      <DataTable
        data={data}
        columns={columns}
        onRowClick={(row) => onRowClick(row.original.id)}
        rowActions={(row) => (
          <button type="button" onClick={() => onActionClick(row.original.id)}>
            Edit {row.original.id}
          </button>
        )}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit p-1" }));

    expect(onActionClick).toHaveBeenCalledWith("p-1");
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
