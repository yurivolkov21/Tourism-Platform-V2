'use client';

import {
  type ColumnVisibilityState,
  createColumnHelper,
  FlexRender,
  useTable,
} from '@tanstack/react-table';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { Button } from '@tourism/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@tourism/ui/components/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tourism/ui/components/table';
import { ChevronDownIcon, Columns3Icon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { BookingsSearch, BookingsStatusTabs } from '@/components/bookings/bookings-toolbar';
import { DataTableFrame } from '@/components/kit/data-table-frame';
import { serverTableFeatures } from '@/components/kit/table-features';
import { TablePagination } from '@/components/kit/table-pagination';
import { type BookingsQuery, bookingsHref, PAGE_SIZE_OPTIONS } from '@/lib/bookings-query';
import { type BookingRowVM, statusBadgeVariant } from '@/lib/bookings-view';

/**
 * Bảng `/bookings` — bản THẬT ĐẦU TIÊN mọc từ xương data-table của
 * dashboard-01 (spec P4b §2.1). Khác bản demo ở trang `/` (giữ nguyên, không
 * đụng):
 *
 * - Drag-row TẮT: thứ tự hàng do server quyết (mới nhất trước), kéo thả không
 *   mang nghĩa gì ở vùng thật (§2.2).
 * - Không checkbox chọn hàng: chưa có hành vi hàng loạt nào để chọn cho.
 * - `manualPagination`: `data` CHÍNH LÀ một trang server đã cắt; table chỉ
 *   nhận thêm `rowCount` để biết còn trang nào không.
 * - Không sort/filter client: cả hai là việc của API, row model client chỉ
 *   nhìn thấy một trang nên mọi phép nó làm đều sai phạm vi.
 *
 * Component này KHÔNG tự tính gì: mọi con chữ đã được `toBookingRow` (thuần,
 * có test) nấu sẵn.
 */
const t = messages.admin.bookings.list;

const columnHelper = createColumnHelper<typeof serverTableFeatures, BookingRowVM>();

/** Nhãn cột cho menu ẩn/hiện — `column.id` là tên field, không phải copy. */
const COLUMN_LABELS: Record<string, string> = {
  code: t.columns.code,
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
    // Server đã cắt trang; `rowCount` là tổng TOÀN BỘ kết quả, không phải
    // độ dài `rows` (thiếu nó thì table tưởng chỉ có một trang).
    manualPagination: true,
    rowCount: total,
    state: {
      pagination: { pageIndex: query.page - 1, pageSize: query.limit },
      columnVisibility,
    },
    getRowId: (row) => row.code,
    onColumnVisibilityChange: setColumnVisibility,
  });

  return (
    <DataTableFrame
      views={<BookingsStatusTabs query={query} />}
      actions={
        <>
          <BookingsSearch query={query} />
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <Columns3Icon data-icon="inline-start" />
              {messages.admin.table.columns}
              <ChevronDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {table
                .getAllColumns()
                .filter((column) => typeof column.accessorFn !== 'undefined' && column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {COLUMN_LABELS[column.id] ?? column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-muted">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} colSpan={header.colSpan}>
                  {header.isPlaceholder ? null : <FlexRender header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                {t.empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </DataTableFrame>
  );
}
