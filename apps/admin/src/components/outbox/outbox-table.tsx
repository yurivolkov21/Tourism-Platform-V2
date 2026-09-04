'use client';

import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { Button } from '@tourism/ui/components/button';
import {
  AtSignIcon,
  CalendarCheckIcon,
  CalendarIcon,
  FileWarningIcon,
  HashIcon,
  MailIcon,
  TagIcon,
} from 'lucide-react';
import * as React from 'react';
import { ColumnVisibilityMenu, DataTableBody } from '@/components/kit/data-table-body';
import { DataTableFrame } from '@/components/kit/data-table-frame';
import { serverTableFeatures } from '@/components/kit/table-features';
import { TablePagination } from '@/components/kit/table-pagination';
import { OutboxDetailSheet } from '@/components/outbox/outbox-detail-sheet';
import { OutboxSearch, OutboxStatusTabs } from '@/components/outbox/outbox-toolbar';
import { OutboxTypeMenu } from '@/components/outbox/outbox-type-menu';
import { RetryAction } from '@/components/outbox/retry-action';
import { type OutboxQuery, outboxHref } from '@/lib/outbox-query';
import type { RetryAction as RetryActionFn } from '@/lib/outbox-retry';
import { type OutboxRowVM, outboxStatusBadgeVariant } from '@/lib/outbox-view';
import { PAGE_SIZE_OPTIONS } from '@/lib/table-query';

/**
 * Bảng `/outbox` (spec P4c §3-F7) — vùng thật đầu tiên của P4c, dựng trọn
 * trên kit (`DataTableFrame` + `DataTableBody` + `ColumnVisibilityMenu` +
 * `TablePagination` + `serverTableFeatures` — không checkbox, không fork rút
 * gọn; user chốt 31/08: mọi bảng vùng một kiểu). Trang/filter sống trên URL.
 *
 * Cột: Type (kèm dedupeKey mono bên dưới) · Recipient · Status · Attempts ·
 * Last error (cắt CSS + `title`) · Created · Processed · Actions (Details mở
 * drawer; Retry chỉ ở hàng FAILED). Quyết định tự chọn: KHÔNG có cột payload
 * preview — payload là dữ liệu để soi trong drawer (spec §2.3), Recipient +
 * dedupeKey đã tóm tắt đủ để nhận ra hàng; một cột JSON cắt ngắn chỉ chiếm
 * bề ngang mà không đọc được gì.
 *
 * Component này KHÔNG tự tính gì: mọi con chữ đã được `toOutboxRowVM` (thuần,
 * có test) nấu sẵn.
 */
const t = messages.admin.outbox.list;

const columnHelper = createColumnHelper<typeof serverTableFeatures, OutboxRowVM>();

/** Nhãn cho menu ẩn/hiện — chỉ cột ẩn ĐƯỢC mới cần entry. */
const COLUMN_LABELS: Record<string, string> = {
  recipient: t.columns.recipient,
  statusLabel: t.columns.status,
  attemptsLabel: t.columns.attempts,
  lastError: t.columns.lastError,
  created: t.columns.created,
  processed: t.columns.processed,
};

const COLUMN_ICONS = {
  recipient: AtSignIcon,
  statusLabel: TagIcon,
  attemptsLabel: HashIcon,
  lastError: FileWarningIcon,
  created: CalendarIcon,
  processed: CalendarCheckIcon,
};

/**
 * Cột nhận `retry` và `onView` qua tham số (không đọc từ module) — client
 * component KHÔNG tự import server action (nếp F2). Gọi trong `useMemo` khoá
 * theo hai hàm: `columns` là đầu vào của row model.
 */
function buildColumns(retry: RetryActionFn, onView: (row: OutboxRowVM) => void) {
  return columnHelper.columns([
    columnHelper.accessor('typeLabel', {
      header: t.columns.type,
      // Cột này không ẩn được — nó là danh tính của hàng (type + dedupeKey).
      cell: ({ row }) => (
        <div className="max-w-64">
          <div className="flex items-center gap-1.5">
            <MailIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate font-medium text-foreground">{row.original.typeLabel}</span>
          </div>
          <div
            className="truncate font-mono text-xs text-muted-foreground"
            title={row.original.dedupeKey}
          >
            {row.original.dedupeKey}
          </div>
        </div>
      ),
      enableHiding: false,
    }),
    columnHelper.accessor('recipient', {
      header: t.columns.recipient,
      cell: ({ row }) =>
        row.original.recipient ? (
          <div className="max-w-56 truncate" title={row.original.recipient}>
            {row.original.recipient}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{t.noRecipient}</span>
        ),
    }),
    columnHelper.accessor('statusLabel', {
      header: t.columns.status,
      cell: ({ row }) => (
        <Badge variant={outboxStatusBadgeVariant(row.original.status)} className="px-1.5">
          {row.original.statusLabel}
        </Badge>
      ),
    }),
    columnHelper.accessor('attemptsLabel', {
      header: t.columns.attempts,
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums">{row.original.attemptsLabel}</span>
      ),
    }),
    columnHelper.accessor('lastError', {
      header: t.columns.lastError,
      // Lỗi dài tới 1000 ký tự: cắt bằng CSS nhưng giữ NGUYÊN VĂN trong
      // `title`; drawer là chỗ đọc đủ.
      cell: ({ row }) =>
        row.original.lastError ? (
          <div className="max-w-64 truncate font-mono text-xs" title={row.original.lastError}>
            {row.original.lastError}
          </div>
        ) : (
          <span className="text-muted-foreground">{messages.admin.bookings.detail.empty}</span>
        ),
    }),
    columnHelper.accessor('created', {
      header: t.columns.created,
      cell: ({ row }) => (
        <div className="whitespace-nowrap text-muted-foreground">{row.original.created}</div>
      ),
    }),
    columnHelper.accessor('processed', {
      header: t.columns.processed,
      cell: ({ row }) => (
        <div className="whitespace-nowrap text-muted-foreground">
          {row.original.processed ?? messages.admin.bookings.detail.empty}
        </div>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: t.columns.actions,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t.viewLabel(row.original.dedupeKey)}
            onClick={() => onView(row.original)}
          >
            {t.view}
          </Button>
          {row.original.canRetry ? <RetryAction row={row.original} retry={retry} /> : null}
        </div>
      ),
      enableHiding: false,
    }),
  ]);
}

export interface OutboxTableProps {
  rows: OutboxRowVM[];
  /** Trạng thái URL hiện tại — nguồn để dựng href phân trang/lọc. */
  query: OutboxQuery;
  total: number;
  totalPages: number;
  /** Server action `retryOutboxAction`, truyền xuống từ trang. */
  retry: RetryActionFn;
}

export function OutboxTable({ rows, query, total, totalPages, retry }: OutboxTableProps) {
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});
  /** Hàng đang mở trong drawer — MỘT instance cho cả bảng. */
  const [detail, setDetail] = React.useState<OutboxRowVM | null>(null);
  const columns = React.useMemo(() => buildColumns(retry, setDetail), [retry]);

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
      views={<OutboxStatusTabs query={query} />}
      actions={
        <>
          <OutboxTypeMenu query={query} />
          <OutboxSearch query={query} />
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
          hrefForPage={(page) => outboxHref(query, { page })}
          hrefForPageSize={(limit) => outboxHref(query, { limit })}
        />
      }
    >
      <DataTableBody table={table} empty={t.empty} />
      <OutboxDetailSheet row={detail} onClose={() => setDetail(null)} />
    </DataTableFrame>
  );
}
