'use client';

import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { CalendarIcon, ClockIcon, FileTextIcon, TagIcon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { ColumnVisibilityMenu, DataTableBody } from '@/components/kit/data-table-body';
import { DataTableFrame } from '@/components/kit/data-table-frame';
import { serverTableFeatures } from '@/components/kit/table-features';
import { TablePagination } from '@/components/kit/table-pagination';
import { NewPostDialog } from '@/components/posts/new-post-dialog';
import { PostsClearFilters, PostsSearch, PostsStatusTabs } from '@/components/posts/posts-toolbar';
import { type PostsQuery, postsHref } from '@/lib/posts-query';
import { POST_STATUS_VARIANT, type PostRowVM } from '@/lib/posts-view';
import type { CreatePostAction } from '@/lib/posts-write';
import { PAGE_SIZE_OPTIONS } from '@/lib/table-query';

/**
 * Bảng `/posts` (spec P4e-4 §4.2) — dựng trọn trên kit như mọi bảng admin (user chốt
 * 31/08). Trang và bộ lọc sống trên URL. Cột Post không ẩn được — nó là danh tính của hàng.
 *
 * Tiêu đề là link sang trang sửa, không phải cả hàng bấm được (Quyết định 12 của plan) —
 * cùng nếp bảng Tours. Component KHÔNG tự tính gì: mọi con chữ đã được `toPostRowVM` nấu.
 */
const t = messages.admin.posts.list;

const columnHelper = createColumnHelper<typeof serverTableFeatures, PostRowVM>();

const COLUMN_LABELS: Record<string, string> = {
  status: t.columns.status,
  published: t.columns.published,
  tags: t.columns.tags,
  updated: t.columns.updated,
};

const COLUMN_ICONS = {
  status: FileTextIcon,
  published: CalendarIcon,
  tags: TagIcon,
  updated: ClockIcon,
};

const COLUMNS = columnHelper.columns([
  columnHelper.accessor('title', {
    header: t.columns.post,
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <PostThumb row={row.original} />
        <div className="grid min-w-0 gap-0.5">
          <Link
            href={row.original.editorHref}
            className="max-w-80 truncate font-medium text-foreground underline-offset-4 hover:underline"
            title={row.original.title}
          >
            {row.original.title}
          </Link>
          <span className="max-w-80 truncate text-xs text-muted-foreground">
            {row.original.slug}
          </span>
        </div>
      </div>
    ),
    enableHiding: false,
  }),
  columnHelper.accessor('statusLabel', {
    id: 'status',
    header: t.columns.status,
    cell: ({ row }) => (
      <Badge variant={POST_STATUS_VARIANT[row.original.displayStatus]}>
        {row.original.statusLabel}
      </Badge>
    ),
  }),
  columnHelper.accessor('published', {
    header: t.columns.published,
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums text-muted-foreground">
        {row.original.published}
      </span>
    ),
  }),
  columnHelper.accessor('tags', {
    header: t.columns.tags,
    cell: ({ row }) => (
      <div className="max-w-56 truncate text-muted-foreground" title={row.original.tags}>
        {row.original.tags}
      </div>
    ),
  }),
  columnHelper.accessor('updated', {
    header: t.columns.updated,
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums text-muted-foreground">
        {row.original.updated}
      </span>
    ),
  }),
]);

/**
 * Ô ảnh bìa 40px — cùng khuôn `TourThumb`: chưa có ảnh thì ô giữ chỗ mang chữ `sr-only`
 * (ô câm đọc thành "ảnh hỏng"); `<img>` thuần vì URL Cloudinary đã mang sẵn `f_auto,q_auto`.
 */
function PostThumb({ row }: { row: PostRowVM }) {
  if (!row.thumbUrl) {
    return (
      <div className="size-10 shrink-0 rounded-md border border-dashed bg-muted">
        <span className="sr-only">{t.noImage}</span>
      </div>
    );
  }
  return (
    // biome-ignore lint/performance/noImgElement: URL Cloudinary đã tối ưu sẵn (ADR-0005)
    <img
      src={row.thumbUrl}
      alt=""
      width={40}
      height={40}
      loading="lazy"
      className="size-10 shrink-0 rounded-md object-cover"
    />
  );
}

export interface PostsTableProps {
  rows: PostRowVM[];
  /** Trạng thái URL hiện tại — nguồn để dựng href phân trang/lọc. */
  query: PostsQuery;
  total: number;
  totalPages: number;
  create: CreatePostAction;
}

export function PostsTable({ rows, query, total, totalPages, create }: PostsTableProps) {
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});

  const table = useTable({
    features: serverTableFeatures,
    data: rows,
    columns: COLUMNS,
    // KHÔNG có pagination state ở table: trang/limit sống trên URL.
    state: { columnVisibility },
    getRowId: (row) => row.id,
    onColumnVisibilityChange: setColumnVisibility,
  });

  return (
    <DataTableFrame
      views={<PostsStatusTabs query={query} />}
      actions={
        <>
          <PostsSearch query={query} />
          <PostsClearFilters query={query} />
          <ColumnVisibilityMenu table={table} labels={COLUMN_LABELS} icons={COLUMN_ICONS} />
          <NewPostDialog create={create} />
        </>
      }
      footer={
        <TablePagination
          page={query.page}
          totalPages={totalPages}
          total={total}
          pageSize={query.limit}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          hrefForPage={(page) => postsHref(query, { page })}
          hrefForPageSize={(limit) => postsHref(query, { limit })}
        />
      }
    >
      <DataTableBody table={table} empty={t.empty} />
    </DataTableFrame>
  );
}
