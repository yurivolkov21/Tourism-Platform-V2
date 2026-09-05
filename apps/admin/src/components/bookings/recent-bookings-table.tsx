'use client';

import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { ArrowRightIcon, CalendarClockIcon, ListIcon } from 'lucide-react';
import * as React from 'react';
import {
  AmountCell,
  BOOKING_COLUMN_ICONS,
  BOOKING_COLUMN_LABELS,
  CustomerCell,
  GuestsCell,
  RightHeader,
  StatusCell,
  TourCell,
} from '@/components/bookings/booking-cells';
import { BookingLink } from '@/components/kit/booking-link';
import { ColumnVisibilityMenu, DataTableBody } from '@/components/kit/data-table-body';
import { DataTableFrame } from '@/components/kit/data-table-frame';
import { serverTableFeatures } from '@/components/kit/table-features';
import type { BookingRowVM } from '@/lib/bookings-view';

/**
 * Bảng "Recent bookings" của dashboard `/` (ADR-0036 §3): mười booking mới
 * nhất, MỌI trạng thái, không lọc ngày — lắp vào đúng kit khung của
 * `dashboard-01` như mọi bảng vùng (user chốt 31/08), thay cho bản demo
 * `data-table.tsx` + `data.json`.
 *
 * Khác `/bookings` ở phần RIÊNG, không ở ô thân (dùng chung `booking-cells`):
 * - khe views: MỘT tiêu đề tĩnh "Recent bookings" (vòng vá review 05/09 —
 *   bản đầu dựng `StatusFilterTabs` một mục, một control bấm-được-không-làm-gì);
 * - không checkbox/export: dashboard không có hành vi hàng loạt nào;
 * - footer: link "View all bookings" thay `TablePagination` — mười hàng là
 *   một cửa sổ nhìn, không phải một tập để lật;
 * - cột Code qua `BookingLink` (href trần, không mang bộ lọc vì không có bộ
 *   lọc để mang) và thêm cột Created — "gần nhất" cần con dấu thời gian.
 */
const t = messages.admin.dashboard.table;
const tb = messages.admin.bookings.list;

const columnHelper = createColumnHelper<typeof serverTableFeatures, BookingRowVM>();

const COLUMN_LABELS: Record<string, string> = {
  ...BOOKING_COLUMN_LABELS,
  createdAt: t.columns.created,
};
const COLUMN_ICONS = { ...BOOKING_COLUMN_ICONS, createdAt: CalendarClockIcon };

const columns = columnHelper.columns([
  columnHelper.accessor('code', {
    header: tb.columns.code,
    cell: ({ row }) => <BookingLink code={row.original.code} fallback={t.empty} />,
    enableHiding: false,
  }),
  columnHelper.accessor('tourTitle', {
    header: tb.columns.tour,
    cell: ({ row }) => <TourCell row={row.original} />,
  }),
  columnHelper.accessor('statusLabel', {
    header: tb.columns.status,
    cell: ({ row }) => <StatusCell row={row.original} />,
  }),
  columnHelper.accessor('guests', {
    header: () => <RightHeader>{tb.columns.guests}</RightHeader>,
    cell: ({ row }) => <GuestsCell row={row.original} />,
  }),
  columnHelper.accessor('amount', {
    header: () => <RightHeader>{tb.columns.amount}</RightHeader>,
    cell: ({ row }) => <AmountCell row={row.original} />,
  }),
  columnHelper.accessor('customerName', {
    header: tb.columns.customer,
    cell: ({ row }) => <CustomerCell row={row.original} />,
  }),
  columnHelper.accessor('createdAt', {
    header: t.columns.created,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">{row.original.createdAt}</span>
    ),
  }),
]);

export function RecentBookingsTable({ rows }: { rows: BookingRowVM[] }) {
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});

  const table = useTable({
    features: serverTableFeatures,
    data: rows,
    columns,
    state: { columnVisibility },
    getRowId: (row) => row.code,
    onColumnVisibilityChange: setColumnVisibility,
  });

  return (
    <DataTableFrame
      views={
        // Cùng glyph với mục "tất cả" của bốn vùng (ListIcon) để cụm nhìn là
        // một hệ, nhưng là chữ tĩnh: không có gì để chọn thì không có bộ chọn.
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <ListIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          {t.tab}
        </h2>
      }
      actions={<ColumnVisibilityMenu table={table} labels={COLUMN_LABELS} icons={COLUMN_ICONS} />}
      footer={
        <div className="flex justify-end">
          <ButtonLink variant="outline" size="sm" href="/bookings">
            {t.viewAll}
            <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
          </ButtonLink>
        </div>
      }
    >
      <DataTableBody table={table} empty={t.empty} />
    </DataTableFrame>
  );
}
