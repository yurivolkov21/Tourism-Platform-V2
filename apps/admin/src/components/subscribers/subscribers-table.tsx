'use client';

import {
  type ColumnVisibilityState,
  createColumnHelper,
  type RowSelectionState,
  useTable,
} from '@tanstack/react-table';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { Checkbox } from '@tourism/ui/components/checkbox';
import { CalendarCheckIcon, CalendarIcon, CalendarOffIcon, TagIcon } from 'lucide-react';
import * as React from 'react';
import { ColumnVisibilityMenu, DataTableBody } from '@/components/kit/data-table-body';
import { DataTableFrame } from '@/components/kit/data-table-frame';
import { selectableTableFeatures } from '@/components/kit/table-features';
import { TablePagination } from '@/components/kit/table-pagination';
import { SubscribersExportLink } from '@/components/subscribers/subscribers-export-link';
import { SubscribersSourceMenu } from '@/components/subscribers/subscribers-source-menu';
import {
  SubscribersClearFilters,
  SubscribersDateRange,
  SubscribersSearch,
  SubscribersStatusTabs,
} from '@/components/subscribers/subscribers-toolbar';
import { UnsubscribeAction } from '@/components/subscribers/unsubscribe-action';
import { formatCalendarDate, formatDateRange } from '@/lib/bookings-view';
import { type SubscribersQuery, subscribersHref } from '@/lib/subscribers-query';
import type { UnsubscribeAction as UnsubscribeActionFn } from '@/lib/subscribers-unsubscribe';
import type { SubscriberRowVM } from '@/lib/subscribers-view';
import { PAGE_SIZE_OPTIONS } from '@/lib/table-query';

/**
 * Bảng `/subscribers` (spec P4c §3-F10) — dựng trọn trên kit (`DataTableFrame`
 * + `DataTableBody` + `ColumnVisibilityMenu` + `TablePagination` +
 * `selectableTableFeatures` — không fork rút gọn; user chốt 31/08: mọi bảng
 * vùng một kiểu). Trang/filter sống trên URL.
 *
 * Cột ô tích ở đầu (G43, 13/10, khuôn `/bookings` 01/09): tích vài địa chỉ rồi
 * bấm "Export N rows" để tải đúng các hàng ấy. Luật vòng đời của tích ở
 * `BookingsTable`; bảng này chép y nguyên.
 *
 * Cột theo spec: Email · Source · Subscribed at · Unsubscribed at · Actions.
 * Cột Email KHÔNG ẩn được: nó là danh tính của hàng, và không có trang chi
 * tiết nào để đọc lại nó ở chỗ khác (vùng này không có `/subscribers/[id]` —
 * năm cột đã là toàn bộ sự thật về một hàng).
 *
 * Nút Export sống trong Ô TIÊU ĐỀ của cột Actions, không ở hàng điều khiển
 * (user chốt 01/09, theo nếp `/bookings`): hàng ấy đã mang tab + Select
 * nguồn + ô tìm + menu cột, và nút thứ năm ở đó là giọt nước tràn ly ở màn
 * hẹp. Từ spec 2026-10-05 §4 #4 nó thôi có cột `export` riêng — lý do ở
 * JSDoc cột `actions`.
 *
 * Component này KHÔNG tự tính gì: mọi con chữ đã được `toSubscriberRowVM`
 * (thuần, có test) nấu sẵn.
 */
const t = messages.admin.subscribers.list;

const columnHelper = createColumnHelper<typeof selectableTableFeatures, SubscriberRowVM>();

/** Nhãn cho menu ẩn/hiện — chỉ cột ẩn ĐƯỢC mới cần entry. */
const COLUMN_LABELS: Record<string, string> = {
  source: t.columns.source,
  subscribed: t.columns.subscribed,
  confirmed: t.columns.confirmed,
  unsubscribed: t.columns.unsubscribed,
};

const COLUMN_ICONS = {
  source: TagIcon,
  subscribed: CalendarIcon,
  confirmed: CalendarCheckIcon,
  unsubscribed: CalendarOffIcon,
};

/**
 * Cột nhận `query`/`total` qua tham số (không đọc từ module) vì nút Export
 * sống trong ô tiêu đề của cột `actions` — cùng nếp `buildColumns` của
 * `/bookings`.
 *
 * CỐ Ý không nhận danh sách id đã tích (cùng lý do `/bookings`): nó đổi theo
 * mỗi cú click, mà `columns` là đầu vào của row model. Header đọc thẳng lựa
 * chọn từ `table` mà TanStack đưa cho nó.
 */
function buildColumns(query: SubscribersQuery, total: number, unsubscribe: UnsubscribeActionFn) {
  return columnHelper.columns([
    columnHelper.display({
      id: 'select',
      /**
       * Chọn CẢ TRANG, không phải cả tập, và nhãn nói đúng như thế. Bộ
       * `…AllRows…` chứ không phải `…AllPageRows…`, và "một phần" đếm trên hàng
       * ĐANG HIỆN — lý do của cả hai ở cột `select` của `BookingsTable`.
       */
      header: ({ table }) => (
        <Checkbox
          aria-label={t.selectAllRows}
          checked={table.getIsAllRowsSelected()}
          indeterminate={
            !table.getIsAllRowsSelected() && table.getSelectedRowModel().rows.length > 0
          }
          onCheckedChange={(value) => table.toggleAllRowsSelected(value === true)}
        />
      ),
      // Nhãn gọi tên địa chỉ: trình đọc màn hình đọc "Select ada@…", không
      // phải mười lần "Select row" giống hệt nhau.
      cell: ({ row }) => (
        <Checkbox
          aria-label={t.selectRow(row.original.email)}
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(value === true)}
        />
      ),
    }),
    columnHelper.accessor('email', {
      header: t.columns.email,
      cell: ({ row }) => (
        <div className="max-w-72 truncate font-medium text-foreground" title={row.original.email}>
          {row.original.email}
        </div>
      ),
      enableHiding: false,
    }),
    columnHelper.accessor('source', {
      header: t.columns.source,
      // VM đã rơi về "Direct sign-up" cho hàng không khai nguồn — không rẽ nhánh.
      cell: ({ row }) => (
        <div className="max-w-48 truncate text-muted-foreground" title={row.original.source}>
          {row.original.source}
        </div>
      ),
    }),
    columnHelper.accessor('subscribed', {
      header: t.columns.subscribed,
      cell: ({ row }) => (
        <div className="whitespace-nowrap text-muted-foreground">{row.original.subscribed}</div>
      ),
    }),
    columnHelper.accessor('confirmed', {
      header: t.columns.confirmed,
      // Cột double opt-in (W4 E3): hàng chưa bấm link in "Awaiting
      // confirmation" (VM lo) — cùng luật "cột luôn có chữ" với unsubscribed.
      cell: ({ row }) => (
        <div className="whitespace-nowrap text-muted-foreground">{row.original.confirmed}</div>
      ),
    }),
    columnHelper.accessor('unsubscribed', {
      header: t.columns.unsubscribed,
      // Hàng còn nhận tin in "Still subscribed" (VM lo) — không phải một dấu
      // gạch: ô trống ở cột này đọc thành "thiếu dữ liệu", còn đây là câu trả
      // lời quan trọng nhất của cả hàng.
      cell: ({ row }) => (
        <div
          className={`whitespace-nowrap ${
            row.original.isActive ? 'text-muted-foreground' : 'text-foreground'
          }`}
        >
          {row.original.unsubscribed}
        </div>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      /**
       * Nút Export sống trong CHÍNH ô tiêu đề cột Actions (spec 2026-10-05 §4 #4). Bản trước
       * dựng một cột `export` rộng 0 sát mép phải, nút tràn sang trái và đè chữ "Actions"
       * (còn đọc được "Acti"). Ở đây cột có bề rộng thật, ít nhất bằng nút. Chữ "Actions"
       * còn cho trình đọc màn hình.
       */
      header: ({ table }) => (
        <div className="flex items-center justify-end">
          <span className="sr-only">{t.columns.actions}</span>
          <SubscribersExportLink
            query={query}
            total={total}
            // Khoá của row model CHÍNH LÀ `id` (`getRowId` bên dưới) — URL mang
            // id chứ không mang email (spec G43, quyết định 3).
            selected={table.getSelectedRowModel().rows.map((row) => row.id)}
          />
        </div>
      ),
      // Chỉ hàng CÒN nhận tin mới có nút: bấm lên hàng đã huỷ chỉ ra 409, và một nút luôn
      // hỏng là một nút không nên vẽ.
      cell: ({ row }) =>
        row.original.isActive ? (
          <div className="flex justify-end">
            <UnsubscribeAction row={row.original} unsubscribe={unsubscribe} />
          </div>
        ) : null,
      enableHiding: false,
    }),
  ]);
}

export interface SubscribersTableProps {
  rows: SubscriberRowVM[];
  /** Trạng thái URL hiện tại — nguồn để dựng href phân trang/lọc. */
  query: SubscribersQuery;
  /** Các giá trị `source` có thật trong bảng — nguồn duy nhất của Select lọc. */
  sources: string[];
  total: number;
  totalPages: number;
  unsubscribe: UnsubscribeActionFn;
}

export function SubscribersTable({
  rows,
  query,
  sources,
  total,
  totalPages,
  unsubscribe,
}: SubscribersTableProps) {
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});
  // Tích sống trong trang đang xem và bị ĐẶT LẠI mỗi khi query đổi, theo khuôn
  // "chỉnh state trong lúc render" của `BookingsTable` (vòng vá review 02/09):
  // đổi trang/lọc là soft navigation cùng segment nên React GIỮ `useState` này.
  // So khoá query với lần trước, lệch thì xoá — không effect, không khung hình
  // nào lộ tích cũ, và `columnVisibility` vẫn sống qua trang.
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const queryKey = subscribersHref(query, {});
  const [selectionKey, setSelectionKey] = React.useState(queryKey);
  if (selectionKey !== queryKey) {
    setSelectionKey(queryKey);
    setRowSelection({});
  }

  // Deps là GIÁ TRỊ NGUYÊN THUỶ (vòng vá review F10): `query` là object mới
  // mỗi lần server render nên memo theo nó không bao giờ trúng.
  const { page, limit, active, search, source, from, to } = query;
  // biome-ignore lint/correctness/useExhaustiveDependencies: memo theo từng field của `query`, không theo object
  const columns = React.useMemo(
    () => buildColumns(query, total, unsubscribe),
    [page, limit, active, search, source, from, to, total, unsubscribe],
  );

  const table = useTable({
    features: selectableTableFeatures,
    data: rows,
    columns,
    // KHÔNG có pagination state ở table: trang/limit sống trên URL.
    state: { columnVisibility, rowSelection },
    getRowId: (row) => row.id,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
  });

  return (
    <DataTableFrame
      views={<SubscribersStatusTabs query={query} />}
      actions={
        <>
          <SubscribersDateRange query={query} />
          <SubscribersSourceMenu query={query} sources={sources} />
          <SubscribersSearch query={query} />
          <SubscribersClearFilters query={query} />
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
          hrefForPage={(page) => subscribersHref(query, { page })}
          hrefForPageSize={(limit) => subscribersHref(query, { limit })}
        />
      }
    >
      <DataTableBody table={table} empty={<SubscribersEmpty query={query} />} />
    </DataTableFrame>
  );
}

/**
 * Ô rỗng của bảng. Khi ĐANG lọc theo ngày (G43) thì nói thẳng khoảng ngày ra và
 * mở sẵn lối về mọi ngày, cùng nếp `/bookings` và `/reviews`: bộ lọc CỘNG DỒN,
 * nên "không có kết quả" sau khi tìm một email thường là do hai ô ngày đặt từ
 * lúc trước chứ không phải do địa chỉ ấy không có trong danh sách.
 */
function SubscribersEmpty({ query }: { query: SubscribersQuery }) {
  if (!query.from && !query.to) return <>{t.empty}</>;

  // Ba dạng câu cho ba hình dạng khoảng — 'between X.' cho khoảng một đầu là
  // câu cụt và đọc thành 'đúng ngày X'.
  const message =
    query.from && query.to
      ? t.emptyInRange(formatDateRange(query.from, query.to))
      : query.from
        ? t.emptyFrom(formatCalendarDate(query.from))
        : t.emptyTo(formatCalendarDate(query.to as string));

  return (
    <div className="flex flex-col items-center gap-2">
      <p>{message}</p>
      {/* Link chứ không nút: đổi bộ lọc là ĐIỀU HƯỚNG ở vùng này, và một link
          thì mở tab mới / copy được như mọi filter khác. */}
      <ButtonLink
        variant="outline"
        size="sm"
        href={subscribersHref(query, { from: null, to: null })}
      >
        <CalendarOffIcon data-icon="inline-start" aria-hidden="true" />
        {t.showAllDates}
      </ButtonLink>
    </div>
  );
}
