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
import { CancellationsStatusTabs } from '@/components/cancellations/cancellations-toolbar';
import { DecideActions } from '@/components/cancellations/decide-actions';
import { DataTableFrame } from '@/components/kit/data-table-frame';
import { serverTableFeatures } from '@/components/kit/table-features';
import { TablePagination } from '@/components/kit/table-pagination';
import type { DecideAction } from '@/lib/cancellations-decide';
import { type CancellationsQuery, cancellationsHref } from '@/lib/cancellations-query';
import { type CancellationRowVM, cancellationStatusBadgeVariant } from '@/lib/cancellations-view';
import { PAGE_SIZE_OPTIONS } from '@/lib/table-query';

/**
 * Hàng đợi `/cancellations` (spec P4b §3-F3) — vùng thật THỨ HAI, dựng trên
 * cùng kit với bảng bookings (`DataTableFrame` + `TablePagination` +
 * `serverTableFeatures`): drag-row tắt, không checkbox, không sort/filter
 * client, TanStack chỉ lo ẩn/hiện cột. Trang/filter sống trên URL (§2.2).
 *
 * Cột cuối là chỗ DUY NHẤT khác bảng bookings: hàng còn mở thì mang cụm
 * approve/deny (hành vi ghi), hàng đã quyết thì mang dấu vết quyết định —
 * lịch sử append-only D1-B, không có nút "sửa lại".
 *
 * Component này KHÔNG tự tính gì: mọi con chữ đã được `toCancellationRow`
 * (thuần, có test) nấu sẵn.
 */
const t = messages.admin.cancellations.list;

const columnHelper = createColumnHelper<typeof serverTableFeatures, CancellationRowVM>();

/** Nhãn cột cho menu ẩn/hiện — `column.id` là tên field, không phải copy. */
const COLUMN_LABELS: Record<string, string> = {
  bookingCode: t.columns.booking,
  tourTitle: t.columns.tour,
  customerName: t.columns.customer,
  reason: t.columns.reason,
  statusLabel: t.columns.status,
  requested: t.columns.requested,
  decision: t.columns.decision,
};

/**
 * Cột nhận `decide` qua tham số (không đọc từ module) để cụm nút giữ đúng
 * luật F2: client component KHÔNG tự import server action, nó nhận vào. Gọi
 * trong `useMemo` khoá theo `decide` — `columns` là đầu vào của row model,
 * đổi tham chiếu mỗi render sẽ khiến table dựng lại model liên tục.
 */
function buildColumns(decide: DecideAction) {
  return columnHelper.columns([
    columnHelper.accessor('bookingCode', {
      header: t.columns.booking,
      // Link chéo sang chi tiết booking (§3-F3): quyết xong thường muốn soi
      // ngay sổ cái refund. Cột này không ẩn được — nó là đường ra duy nhất.
      cell: ({ row }) => (
        <Link
          href={row.original.bookingHref}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {row.original.bookingCode}
        </Link>
      ),
      enableHiding: false,
    }),
    columnHelper.accessor('tourTitle', {
      header: t.columns.tour,
      cell: ({ row }) => (
        <div className="max-w-56">
          <div className="truncate">{row.original.tourTitle}</div>
          <div className="truncate text-xs text-muted-foreground">{row.original.departure}</div>
        </div>
      ),
    }),
    columnHelper.accessor('customerName', {
      header: t.columns.customer,
      cell: ({ row }) => (
        <div className="max-w-48">
          <div className="truncate">{row.original.customerName}</div>
          <div className="truncate text-xs text-muted-foreground">{row.original.customerEmail}</div>
        </div>
      ),
    }),
    columnHelper.accessor('reason', {
      header: t.columns.reason,
      // Lý do dài tới 1000 ký tự: cắt bằng CSS nhưng giữ NGUYÊN VĂN trong
      // `title` và trong dialog xác nhận — admin quyết dựa trên nó.
      cell: ({ row }) => (
        <div className="max-w-64 truncate" title={row.original.reason}>
          {row.original.reason}
        </div>
      ),
    }),
    columnHelper.accessor('statusLabel', {
      header: t.columns.status,
      cell: ({ row }) => (
        <Badge variant={cancellationStatusBadgeVariant(row.original.status)} className="px-1.5">
          {row.original.statusLabel}
        </Badge>
      ),
    }),
    columnHelper.accessor('requested', {
      header: t.columns.requested,
      cell: ({ row }) => (
        <div className="whitespace-nowrap text-muted-foreground">{row.original.requested}</div>
      ),
    }),
    columnHelper.display({
      id: 'decision',
      header: t.columns.decision,
      cell: ({ row }) => <DecisionCell row={row.original} decide={decide} />,
      enableHiding: false,
    }),
  ]);
}

/** Còn mở → hai nút quyết định; đã quyết → dấu vết (mốc + ghi chú). */
function DecisionCell({ row, decide }: { row: CancellationRowVM; decide: DecideAction }) {
  if (row.pending) {
    return (
      <DecideActions
        request={{
          id: row.id,
          bookingCode: row.bookingCode,
          tourTitle: row.tourTitle,
          customerName: row.customerName,
          reason: row.reason,
        }}
        decide={decide}
      />
    );
  }
  return (
    <div className="grid gap-0.5 text-xs text-muted-foreground">
      {row.decided ? <span className="whitespace-nowrap">{t.decidedAt(row.decided)}</span> : null}
      {row.decisionNote ? (
        <span className="max-w-48 truncate" title={row.decisionNote}>
          {t.note(row.decisionNote)}
        </span>
      ) : null}
    </div>
  );
}

export interface CancellationsTableProps {
  rows: CancellationRowVM[];
  /** Trạng thái URL hiện tại — nguồn để dựng href phân trang/lọc. */
  query: CancellationsQuery;
  total: number;
  totalPages: number;
  /** Server action `decideCancellationAction`, truyền xuống từ trang. */
  decide: DecideAction;
}

export function CancellationsTable({
  rows,
  query,
  total,
  totalPages,
  decide,
}: CancellationsTableProps) {
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});
  const columns = React.useMemo(() => buildColumns(decide), [decide]);

  const table = useTable({
    features: serverTableFeatures,
    data: rows,
    columns,
    // KHÔNG có pagination state ở table: trang/limit sống trên URL và
    // `TablePagination` nhận thẳng props (nếp bookings, review 31/08).
    state: { columnVisibility },
    getRowId: (row) => row.id,
    onColumnVisibilityChange: setColumnVisibility,
  });

  return (
    <DataTableFrame
      views={<CancellationsStatusTabs query={query} />}
      actions={
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
      }
      footer={
        <TablePagination
          page={query.page}
          totalPages={totalPages}
          total={total}
          pageSize={query.limit}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          hrefForPage={(page) => cancellationsHref(query, { page })}
          hrefForPageSize={(limit) => cancellationsHref(query, { limit })}
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
              {/* Đếm cột ĐANG HIỆN, không phải cột định nghĩa (nếp bookings). */}
              <TableCell
                colSpan={table.getVisibleLeafColumns().length}
                className="h-24 text-center"
              >
                {t.empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </DataTableFrame>
  );
}
