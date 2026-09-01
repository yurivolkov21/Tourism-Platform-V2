'use client';

import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import Link from 'next/link';
import * as React from 'react';
import {
  BookingsDateRange,
  BookingsExportLink,
  BookingsSearch,
  BookingsStatusTabs,
} from '@/components/bookings/bookings-toolbar';
import { ColumnVisibilityMenu, DataTableBody } from '@/components/kit/data-table-body';
import { DataTableFrame } from '@/components/kit/data-table-frame';
import { serverTableFeatures } from '@/components/kit/table-features';
import { TablePagination } from '@/components/kit/table-pagination';
import { type BookingsQuery, bookingsHref } from '@/lib/bookings-query';
import { type BookingRowVM, statusBadgeVariant } from '@/lib/bookings-view';
import { PAGE_SIZE_OPTIONS } from '@/lib/table-query';

/**
 * Bảng `/bookings` — bản THẬT ĐẦU TIÊN mọc từ xương data-table của
 * dashboard-01 (spec P4b §2.1). Khác bản demo ở trang `/` (giữ nguyên, không
 * đụng):
 *
 * - Drag-row TẮT: thứ tự hàng do server quyết (mới nhất trước), kéo thả không
 *   mang nghĩa gì ở vùng thật (§2.2).
 * - Không checkbox chọn hàng: chưa có hành vi hàng loạt nào để chọn cho.
 * - Không pagination state ở table: `data` CHÍNH LÀ một trang server đã cắt,
 *   `TablePagination` đọc thẳng props từ URL — table chỉ lo ẩn/hiện cột.
 * - Không sort/filter client: cả hai là việc của API, row model client chỉ
 *   nhìn thấy một trang nên mọi phép nó làm đều sai phạm vi.
 *
 * Component này KHÔNG tự tính gì: mọi con chữ đã được `toBookingRow` (thuần,
 * có test) nấu sẵn.
 */
const t = messages.admin.bookings.list;

const columnHelper = createColumnHelper<typeof serverTableFeatures, BookingRowVM>();

/** Nhãn cho menu ẩn/hiện — chỉ cột ẩn ĐƯỢC mới cần entry (review F3). */
const COLUMN_LABELS: Record<string, string> = {
  tourTitle: t.columns.tour,
  statusLabel: t.columns.status,
  guests: t.columns.guests,
  amount: t.columns.amount,
  customerName: t.columns.customer,
};

// Định nghĩa ở CẤP MODULE: `columns` và `data` là đầu vào của row model, đổi
// tham chiếu mỗi lần render sẽ khiến table dựng lại model liên tục.
const columns = columnHelper.columns([
  columnHelper.accessor('code', {
    header: t.columns.code,
    // Mã booking là đường vào trang chi tiết — cột duy nhất không ẩn được.
    cell: ({ row }) => (
      <Link
        href={row.original.href}
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        {row.original.code}
      </Link>
    ),
    enableHiding: false,
  }),
  columnHelper.accessor('tourTitle', {
    header: t.columns.tour,
    cell: ({ row }) => (
      <div className="max-w-64">
        <div className="truncate">{row.original.tourTitle}</div>
        <div className="truncate text-xs text-muted-foreground">{row.original.departure}</div>
      </div>
    ),
  }),
  columnHelper.accessor('statusLabel', {
    header: t.columns.status,
    cell: ({ row }) => (
      <Badge variant={statusBadgeVariant(row.original.status)} className="px-1.5">
        {row.original.statusLabel}
      </Badge>
    ),
  }),
  columnHelper.accessor('guests', {
    header: () => <div className="w-full text-right">{t.columns.guests}</div>,
    cell: ({ row }) => (
      <div className="text-right tabular-nums" title={row.original.guestsLabel}>
        {row.original.guests}
      </div>
    ),
  }),
  columnHelper.accessor('amount', {
    header: () => <div className="w-full text-right">{t.columns.amount}</div>,
    cell: ({ row }) => <div className="text-right tabular-nums">{row.original.amount}</div>,
  }),
  columnHelper.accessor('customerName', {
    header: t.columns.customer,
    cell: ({ row }) => (
      <div className="max-w-56">
        <div className="truncate">{row.original.customerName}</div>
        <div className="truncate text-xs text-muted-foreground">{row.original.customerEmail}</div>
      </div>
    ),
  }),
]);

export interface BookingsTableProps {
  rows: BookingRowVM[];
  /** Trạng thái URL hiện tại — nguồn để dựng href phân trang/lọc. */
  query: BookingsQuery;
  total: number;
  totalPages: number;
}

export function BookingsTable({ rows, query, total, totalPages }: BookingsTableProps) {
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});

  const table = useTable({
    features: serverTableFeatures,
    data: rows,
    columns,
    // KHÔNG có pagination state ở table: trang/limit sống trên URL và
    // `TablePagination` nhận thẳng props — nhét thêm vào table là nuôi một
    // bản sao chết (review 31/08 gỡ `manualPagination`/`rowCount`).
    state: { columnVisibility },
    getRowId: (row) => row.code,
    onColumnVisibilityChange: setColumnVisibility,
  });

  return (
    <DataTableFrame
      views={<BookingsStatusTabs query={query} />}
      actions={
        <>
          <BookingsDateRange query={query} />
          <BookingsSearch query={query} />
          <ColumnVisibilityMenu table={table} labels={COLUMN_LABELS} />
          {/* Export đứng CUỐI hàng: nó là hành động trên kết quả của mọi bộ
              lọc bên trái, nên đọc từ trái sang phải là "lọc… rồi tải về".
              `total` để nút tự tắt khi tập vượt trần export (vòng vá F6). */}
          <BookingsExportLink query={query} total={total} />
        </>
      }
      footer={
        <TablePagination
          page={query.page}
          totalPages={totalPages}
          total={total}
          pageSize={query.limit}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          hrefForPage={(page) => bookingsHref(query, { page })}
          hrefForPageSize={(limit) => bookingsHref(query, { limit })}
        />
      }
    >
      {/* Thân bảng + empty state nằm ở kit (`DataTableBody`, review F3 31/08). */}
      <DataTableBody table={table} empty={t.empty} />
    </DataTableFrame>
  );
}
