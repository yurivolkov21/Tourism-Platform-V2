'use client';

import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import {
  AtSignIcon,
  CalendarIcon,
  CompassIcon,
  MessageSquareIcon,
  PlaneTakeoffIcon,
  TagIcon,
  UsersIcon,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import {
  EnquiriesClearFilters,
  EnquiriesSearch,
  EnquiriesStatusTabs,
  EnquiriesTourFilter,
} from '@/components/enquiries/enquiries-toolbar';
import { ColumnVisibilityMenu, DataTableBody } from '@/components/kit/data-table-body';
import { DataTableFrame } from '@/components/kit/data-table-frame';
import { serverTableFeatures } from '@/components/kit/table-features';
import { TablePagination } from '@/components/kit/table-pagination';
import { type EnquiriesQuery, enquiriesHref } from '@/lib/enquiries-query';
import { type EnquiryRowVM, enquiryStatusBadgeVariant } from '@/lib/enquiries-view';
import { PAGE_SIZE_OPTIONS } from '@/lib/table-query';

/**
 * Bảng `/enquiries` (spec P4c §3-F9) — dựng trọn trên kit (`DataTableFrame` +
 * `DataTableBody` + `ColumnVisibilityMenu` + `TablePagination` +
 * `serverTableFeatures` — không checkbox, không fork rút gọn; user chốt
 * 31/08: mọi bảng vùng một kiểu). Trang/filter sống trên URL.
 *
 * Cột theo spec: Name (link chi tiết) · Email · Tour · Travel date · Group ·
 * Status · Notes · Created. `budgetTier` của contract KHÔNG chiếm một cột
 * riêng (spec liệt kê tám cột, và một chuỗi tự do như "luxury" không đáng một
 * cột) — nó đi dưới số khách như dòng phụ, đúng nếp cột Type của `/outbox`
 * chở `dedupeKey`: cùng một câu hỏi ("đoàn này cỡ nào, tiền cỡ nào"), đọc
 * cùng một chỗ.
 *
 * Component này KHÔNG tự tính gì: mọi con chữ đã được `toEnquiryRowVM`
 * (thuần, có test) nấu sẵn.
 */
const t = messages.admin.enquiries.list;

const columnHelper = createColumnHelper<typeof serverTableFeatures, EnquiryRowVM>();

/** Nhãn cho menu ẩn/hiện — chỉ cột ẩn ĐƯỢC mới cần entry. */
const COLUMN_LABELS: Record<string, string> = {
  email: t.columns.email,
  tourTitle: t.columns.tour,
  travelDate: t.columns.travelDate,
  groupSize: t.columns.group,
  statusLabel: t.columns.status,
  notesCount: t.columns.notes,
  created: t.columns.created,
};

const COLUMN_ICONS = {
  email: AtSignIcon,
  tourTitle: CompassIcon,
  travelDate: PlaneTakeoffIcon,
  groupSize: UsersIcon,
  statusLabel: TagIcon,
  notesCount: MessageSquareIcon,
  created: CalendarIcon,
};

/** Ô trống dùng chung của back-office — một dấu gạch, không phải chuỗi rỗng. */
const EMPTY = messages.admin.bookings.detail.empty;

const columns = columnHelper.columns([
  columnHelper.accessor('name', {
    header: t.columns.name,
    // Cột này không ẩn được — nó là danh tính của hàng VÀ là đường vào trang
    // chi tiết (nơi duy nhất đọc được message và ghi được note).
    cell: ({ row }) => (
      <Link
        href={row.original.href}
        aria-label={t.viewLabel(row.original.name)}
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        {row.original.name}
      </Link>
    ),
    enableHiding: false,
  }),
  columnHelper.accessor('email', {
    header: t.columns.email,
    cell: ({ row }) => (
      <div className="max-w-56 truncate" title={row.original.email}>
        {row.original.email}
      </div>
    ),
  }),
  columnHelper.accessor('tourTitle', {
    header: t.columns.tour,
    // VM đã rơi về "General enquiry" cho lead không gắn tour — không rẽ nhánh.
    cell: ({ row }) => (
      <div className="max-w-56 truncate" title={row.original.tourTitle}>
        {row.original.tourTitle}
      </div>
    ),
  }),
  columnHelper.accessor('travelDate', {
    header: t.columns.travelDate,
    cell: ({ row }) => (
      <div className="whitespace-nowrap text-muted-foreground">
        {row.original.travelDate ?? EMPTY}
      </div>
    ),
  }),
  columnHelper.accessor('groupSize', {
    header: t.columns.group,
    // Dòng phụ `budgetTier` — xem JSDoc đầu file.
    cell: ({ row }) => (
      <div className="whitespace-nowrap">
        <div>{row.original.groupSize ?? EMPTY}</div>
        {row.original.budgetTier ? (
          <div className="truncate text-xs text-muted-foreground">{row.original.budgetTier}</div>
        ) : null}
      </div>
    ),
  }),
  columnHelper.accessor('statusLabel', {
    header: t.columns.status,
    cell: ({ row }) => (
      <Badge variant={enquiryStatusBadgeVariant(row.original.status)} className="px-1.5">
        {row.original.statusLabel}
      </Badge>
    ),
  }),
  columnHelper.accessor('notesCount', {
    header: t.columns.notes,
    // Con số tabular + nhãn đầy đủ trong `title`: cột hẹp nhưng vẫn đọc được
    // "2 notes" khi rê chuột, và trình đọc màn hình không đọc một số trần.
    cell: ({ row }) => (
      <span className="tabular-nums" title={row.original.notesLabel}>
        {row.original.notesCount}
      </span>
    ),
  }),
  columnHelper.accessor('created', {
    header: t.columns.created,
    cell: ({ row }) => (
      <div className="whitespace-nowrap text-muted-foreground">{row.original.created}</div>
    ),
  }),
]);

export interface EnquiriesTableProps {
  rows: EnquiryRowVM[];
  /** Trạng thái URL hiện tại — nguồn để dựng href phân trang/lọc. */
  query: EnquiriesQuery;
  total: number;
  totalPages: number;
}

export function EnquiriesTable({ rows, query, total, totalPages }: EnquiriesTableProps) {
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});

  const table = useTable({
    features: serverTableFeatures,
    data: rows,
    columns,
    // KHÔNG có pagination state ở table: trang/limit sống trên URL.
    state: { columnVisibility },
    getRowId: (row) => row.id,
    onColumnVisibilityChange: setColumnVisibility,
  });

  return (
    <DataTableFrame
      views={<EnquiriesStatusTabs query={query} />}
      actions={
        <>
          <EnquiriesTourFilter query={query} />
          <EnquiriesSearch query={query} />
          <EnquiriesClearFilters query={query} />
          <ColumnVisibilityMenu table={table} labels={COLUMN_LABELS} icons={COLUMN_ICONS} />
        </>
      }
      footer={
        <TablePagination
          page={query.page}
          totalPages={totalPages}
          total={total}
          pageSize={query.limit}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          hrefForPage={(page) => enquiriesHref(query, { page })}
          hrefForPageSize={(limit) => enquiriesHref(query, { limit })}
        />
      }
    >
      <DataTableBody table={table} empty={t.empty} />
    </DataTableFrame>
  );
}
