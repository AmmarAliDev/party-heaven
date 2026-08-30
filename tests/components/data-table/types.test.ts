import { expectTypeOf, test } from "vitest";

import {
  createDataTableColumnHelper,
  type DataTableColumn,
  type DataTablePaginationOptions,
} from "@/components/data-table";

type ProductRow = {
  id: string;
  title: string;
  price: number;
};

test("createDataTableColumnHelper keeps row typing for accessors", () => {
  const helper = createDataTableColumnHelper<ProductRow>();

  const columns = [
    helper.accessor("title", {
      header: "Title",
      cell: (info) => info.getValue(),
    }),
    helper.accessor("price", {
      header: "Price",
      cell: (info) => info.getValue().toFixed(2),
    }),
  ] satisfies DataTableColumn<ProductRow>[];

  expectTypeOf(columns).toMatchTypeOf<DataTableColumn<ProductRow>[]>();
});

test("pagination options expose typed tanstack pagination contract", () => {
  expectTypeOf<DataTablePaginationOptions>().toMatchTypeOf<{
    pageCount: number;
  }>();
});
