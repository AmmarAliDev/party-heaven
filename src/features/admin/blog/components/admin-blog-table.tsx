"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";

import { createDataTableColumnHelper, DataTable, type DataTableColumn } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { routes } from "@/config/routes";

import type { AdminBlogListItem } from "../service";
import { DeleteBlogPostButton } from "./delete-blog-post-button";

const columnHelper = createDataTableColumnHelper<AdminBlogListItem>();

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

export const adminBlogTableColumns: DataTableColumn<AdminBlogListItem>[] = [
  columnHelper.accessor("title", {
    id: "title",
    header: "Title",
    cell: (info) => {
      const post = info.row.original;
      return (
        <div>
          <p className="font-medium">{post.title}</p>
          <p className="text-muted-foreground mt-1 text-xs">/{post.slug}</p>
        </div>
      );
    },
  }),

  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => {
      const status = info.getValue() as "DRAFT" | "PUBLISHED" | "ARCHIVED";
      return <Badge variant={statusBadgeVariantMap[status]}>{statusLabelMap[status]}</Badge>;
    },
  }),

  columnHelper.accessor("publishedAt", {
    header: "Publish date",
    cell: (info) => {
      const raw = info.getValue();
      if (!raw) {
        return <span className="text-muted-foreground text-xs">Unscheduled</span>;
      }

      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) {
        return <span className="text-muted-foreground text-xs">Invalid date</span>;
      }

      const locale = typeof navigator !== "undefined" ? navigator.language : "en-US";
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

  columnHelper.accessor("updatedAt", {
    header: "Updated",
    cell: (info) => {
      const raw = info.getValue();
      if (!raw) {
        return <span className="text-muted-foreground text-xs">-</span>;
      }

      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) {
        return <span className="text-muted-foreground text-xs">-</span>;
      }

      const locale = typeof navigator !== "undefined" ? navigator.language : "en-US";

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

export type AdminBlogTableProps = {
  posts: AdminBlogListItem[];
  returnTo?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function AdminBlogTable({
  posts,
  returnTo = routes.admin.blog,
  emptyTitle = "No blog posts found",
  emptyDescription = "Create your first article or adjust the current filters.",
}: AdminBlogTableProps) {
  const columns: DataTableColumn<AdminBlogListItem>[] = [
    ...adminBlogTableColumns,
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: (info) => {
        const post = info.row.original;
        return (
          <div className="flex gap-2">
            <Link href={routes.admin.blogEdit(post.id)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Pencil className="size-4" />
              Edit
            </Link>
            <DeleteBlogPostButton blogPostId={post.id} blogPostTitle={post.title} returnTo={returnTo} />
          </div>
        );
      },
    }),
  ];

  return (
    <DataTable<AdminBlogListItem>
      data={posts}
      columns={columns}
      getRowId={(row) => row.id}
      emptyState={{
        title: emptyTitle,
        description: emptyDescription,
      }}
    />
  );
}
