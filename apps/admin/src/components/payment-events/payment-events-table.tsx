'use client';

import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import {
  BanknoteIcon,
  CalendarCheckIcon,
  CalendarIcon,
  CreditCardIcon,
  TagIcon,
  TicketIcon,
} from 'lucide-react';
import * as React from 'react';
import { BookingLink } from '@/components/kit/booking-link';
import { ColumnVisibilityMenu, DataTableBody } from '@/components/kit/data-table-body';
import { DataTableFrame } from '@/components/kit/data-table-frame';
import { serverTableFeatures } from '@/components/kit/table-features';
import { TablePagination } from '@/components/kit/table-pagination';
import { PaymentEventDetailSheet } from '@/components/payment-events/payment-event-detail-sheet';
import {
  PaymentEventsClearFilters,
  PaymentEventsProviderTabs,
  PaymentEventsSearch,
  PaymentEventsUnprocessedToggle,
} from '@/components/payment-events/payment-events-toolbar';
import { PaymentEventsTypeMenu } from '@/components/payment-events/payment-events-type-menu';
import { UnprocessedBadge } from '@/components/payment-events/unprocessed-badge';
import type { PaymentEventLoader } from '@/lib/payment-events-detail';
import { type PaymentEventsQuery, paymentEventsHref } from '@/lib/payment-events-query';
import type { PaymentEventRowVM } from '@/lib/payment-events-view';
import { PAGE_SIZE_OPTIONS } from '@/lib/table-query';

/**
 * Bảng `/payment-events` (spec P4c §3-F8) — dựng trọn trên kit
 * (`DataTableFrame` + `DataTableBody` + `ColumnVisibilityMenu` +
 * `TablePagination` + `serverTableFeatures` — không checkbox, không fork rút
 * gọn; user chốt 31/08: mọi bảng vùng một kiểu). Trang/filter sống trên URL.
 *
 * Cột: Provider (kèm eventId mono bên dưới — danh tính của hàng, không ẩn
 * được) · Type · Amount · Booking (link `/bookings/[code]`) · Received ·
 * Processed (mốc, hoặc badge "Unprocessed" có tooltip) · Actions (Details mở
 * drawer — drawer tự tải payload vì list không mang JSON).
 *
 * Component này KHÔNG tự tính gì: mọi con chữ đã được `toPaymentEventRowVM`
 * (thuần, có test) nấu sẵn.
 */
const t = messages.admin.paymentEvents.list;

const columnHelper = createColumnHelper<typeof serverTableFeatures, PaymentEventRowVM>();

/** Nhãn cho menu ẩn/hiện — chỉ cột ẩn ĐƯỢC mới cần entry. */
const COLUMN_LABELS: Record<string, string> = {
  typeLabel: t.columns.type,
  amount: t.columns.amount,
  bookingCode: t.columns.booking,
  received: t.columns.received,
  processed: t.columns.processed,
};

const COLUMN_ICONS = {
  typeLabel: TagIcon,
  amount: BanknoteIcon,
  bookingCode: TicketIcon,
  received: CalendarIcon,
  processed: CalendarCheckIcon,
};

/** Cột nhận `onView` qua tham số; gọi trong `useMemo` vì `columns` là đầu vào của row model. */
function buildColumns(onView: (row: PaymentEventRowVM) => void) {
  return columnHelper.columns([
    columnHelper.accessor('providerLabel', {
      header: t.columns.provider,
      cell: ({ row }) => (
        <div className="max-w-64">
          <div className="flex items-center gap-1.5">
            <CreditCardIcon
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="truncate font-medium text-foreground">
              {row.original.providerLabel}
            </span>
          </div>
          <div
            className="truncate font-mono text-xs text-muted-foreground"
            title={row.original.eventId}
          >
            {row.original.eventId}
          </div>
        </div>
      ),
      enableHiding: false,
    }),
    columnHelper.accessor('typeLabel', {
      header: t.columns.type,
      cell: ({ row }) => <span className="whitespace-nowrap">{row.original.typeLabel}</span>,
    }),
    columnHelper.accessor('amount', {
      header: t.columns.amount,
      cell: ({ row }) =>
        row.original.amount ? (
          <span className="whitespace-nowrap tabular-nums">{row.original.amount}</span>
        ) : (
          <span className="text-muted-foreground">{messages.admin.bookings.detail.empty}</span>
        ),
    }),
    columnHelper.accessor('bookingCode', {
      header: t.columns.booking,
      // Link chéo sang chi tiết booking: từ một webhook lạ soi ngay đơn nó
      // chạm tới (kit `BookingLink` — cùng cột Booking của `/cancellations`).
      cell: ({ row }) => <BookingLink code={row.original.bookingCode} fallback={t.noBooking} />,
    }),
    columnHelper.accessor('received', {
      header: t.columns.received,
      cell: ({ row }) => (
        <div className="whitespace-nowrap text-muted-foreground">{row.original.received}</div>
      ),
    }),
    columnHelper.accessor('processed', {
      header: t.columns.processed,
      cell: ({ row }) =>
        row.original.processed ? (
          <div className="whitespace-nowrap text-muted-foreground">{row.original.processed}</div>
        ) : (
          <UnprocessedBadge />
        ),
    }),
    columnHelper.display({
      id: 'actions',
      header: t.columns.actions,
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t.viewLabel(row.original.eventId)}
          onClick={() => onView(row.original)}
        >
          {t.view}
        </Button>
      ),
      enableHiding: false,
    }),
  ]);
}

export interface PaymentEventsTableProps {
  rows: PaymentEventRowVM[];
  /** Trạng thái URL hiện tại — nguồn để dựng href phân trang/lọc. */
  query: PaymentEventsQuery;
  total: number;
  totalPages: number;
  /** Server action `getPaymentEventAction`, truyền xuống từ trang. */
  load: PaymentEventLoader;
}

export function PaymentEventsTable({
  rows,
  query,
  total,
  totalPages,
  load,
}: PaymentEventsTableProps) {
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});
  /** Hàng đang mở trong drawer — MỘT instance cho cả bảng. */
  const [detail, setDetail] = React.useState<PaymentEventRowVM | null>(null);
  const columns = React.useMemo(() => buildColumns(setDetail), []);

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
      views={<PaymentEventsProviderTabs query={query} />}
      actions={
        <>
          <PaymentEventsTypeMenu query={query} />
          <PaymentEventsUnprocessedToggle query={query} />
          <PaymentEventsSearch query={query} />
          <PaymentEventsClearFilters query={query} />
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
          hrefForPage={(page) => paymentEventsHref(query, { page })}
          hrefForPageSize={(limit) => paymentEventsHref(query, { limit })}
        />
      }
    >
      <DataTableBody table={table} empty={t.empty} />
      <PaymentEventDetailSheet row={detail} onClose={() => setDetail(null)} load={load} />
    </DataTableFrame>
  );
}
