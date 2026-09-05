'use client';

import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { messages } from '@tourism/i18n';
import { CalendarIcon, CalendarOffIcon, TagIcon } from 'lucide-react';
import * as React from 'react';
import { ColumnVisibilityMenu, DataTableBody } from '@/components/kit/data-table-body';
import { DataTableFrame } from '@/components/kit/data-table-frame';
import { serverTableFeatures } from '@/components/kit/table-features';
import { TablePagination } from '@/components/kit/table-pagination';
import { SubscribersExportLink } from '@/components/subscribers/subscribers-export-link';
import { SubscribersSourceMenu } from '@/components/subscribers/subscribers-source-menu';
import {
  SubscribersClearFilters,
  SubscribersSearch,
  SubscribersStatusTabs,
} from '@/components/subscribers/subscribers-toolbar';
import { UnsubscribeAction } from '@/components/subscribers/unsubscribe-action';
import { type SubscribersQuery, subscribersHref } from '@/lib/subscribers-query';
import type { UnsubscribeAction as UnsubscribeActionFn } from '@/lib/subscribers-unsubscribe';
import type { SubscriberRowVM } from '@/lib/subscribers-view';
import { PAGE_SIZE_OPTIONS } from '@/lib/table-query';

/**
 * Bảng `/subscribers` (spec P4c §3-F10) — dựng trọn trên kit (`DataTableFrame`
 * + `DataTableBody` + `ColumnVisibilityMenu` + `TablePagination` +
 * `serverTableFeatures` — không checkbox, không fork rút gọn; user chốt
 * 31/08: mọi bảng vùng một kiểu). Trang/filter sống trên URL.
 *
 * Cột theo spec: Email · Source · Subscribed at · Unsubscribed at · Actions.
 * Cột Email KHÔNG ẩn được: nó là danh tính của hàng, và không có trang chi
 * tiết nào để đọc lại nó ở chỗ khác (vùng này không có `/subscribers/[id]` —
 * năm cột đã là toàn bộ sự thật về một hàng).
 *
 * Nút Export sống trong Ô TIÊU ĐỀ của cột `export`, đúng nếp `/bookings`
 * (user chốt 01/09): hàng điều khiển đã mang tab + Select nguồn + ô tìm +
 * menu cột, và nút thứ năm ở đó là giọt nước tràn ly ở màn hẹp.
 *
 * Component này KHÔNG tự tính gì: mọi con chữ đã được `toSubscriberRowVM`
 * (thuần, có test) nấu sẵn.
 */
const t = messages.admin.subscribers.list;

const columnHelper = createColumnHelper<typeof serverTableFeatures, SubscriberRowVM>();

/** Nhãn cho menu ẩn/hiện — chỉ cột ẩn ĐƯỢC mới cần entry. */
const COLUMN_LABELS: Record<string, string> = {
  source: t.columns.source,
  subscribed: t.columns.subscribed,
  unsubscribed: t.columns.unsubscribed,
};

const COLUMN_ICONS = {
  source: TagIcon,
  subscribed: CalendarIcon,
  unsubscribed: CalendarOffIcon,
};

/**
 * Cột nhận `query`/`total` qua tham số (không đọc từ module) vì nút Export
 * sống trong ô tiêu đề của cột `export` — cùng nếp `buildColumns` của
 * `/bookings`.
 */
function buildColumns(query: SubscribersQuery, total: number, unsubscribe: UnsubscribeActionFn) {
  return columnHelper.columns([
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
      header: t.columns.actions,
      // Chỉ hàng CÒN nhận tin mới có nút: bấm lên hàng đã huỷ chỉ ra 409, và
      // một nút luôn hỏng là một nút không nên vẽ.
      cell: ({ row }) =>
        row.original.isActive ? (
          <UnsubscribeAction row={row.original} unsubscribe={unsubscribe} />
        ) : null,
      enableHiding: false,
    }),
    columnHelper.display({
      id: 'export',
      /**
       * Ô THÂN để trống có chủ đích: cột tồn tại để nút có chỗ đứng cố định,
       * không trôi ngang theo độ rộng cột bên trái. `w-0` + `justify-end` ép
       * nó nằm sát mép phải bảng — cùng hai class mà `/bookings` phải thêm
       * sau khi user báo nút "nằm lưng chừng" (01/09).
       */
      header: () => (
        <div className="flex w-0 justify-end">
          <SubscribersExportLink query={query} total={total} />
        </div>
      ),
      cell: () => null,
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
  // Deps là GIÁ TRỊ NGUYÊN THUỶ (vòng vá review F10): `query` là object mới
  // mỗi lần server render nên memo theo nó không bao giờ trúng.
  const { page, limit, active, search, source } = query;
  // biome-ignore lint/correctness/useExhaustiveDependencies: memo theo từng field của `query`, không theo object
  const columns = React.useMemo(
    () => buildColumns(query, total, unsubscribe),
    [page, limit, active, search, source, total, unsubscribe],
  );

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
      views={<SubscribersStatusTabs query={query} />}
      actions={
        <>
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
      <DataTableBody table={table} empty={t.empty} />
    </DataTableFrame>
  );
}
