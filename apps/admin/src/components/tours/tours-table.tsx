'use client';

import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { buttonVariants } from '@tourism/ui/components/button';
import { CalendarRangeIcon, DollarSignIcon, ShoppingBagIcon, TagIcon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { ColumnVisibilityMenu, DataTableBody } from '@/components/kit/data-table-body';
import { DataTableFrame } from '@/components/kit/data-table-frame';
import { SafeImg } from '@/components/kit/safe-img';
import { serverTableFeatures } from '@/components/kit/table-features';
import { TablePagination } from '@/components/kit/table-pagination';
import { NewTourDialog } from '@/components/tours/editor/new-tour-dialog';
import { PublishToggle } from '@/components/tours/publish-toggle';
import {
  ToursCategoryMenu,
  ToursClearFilters,
  ToursMonthMenu,
  ToursStatusTabs,
} from '@/components/tours/tours-toolbar';
import type { TourCategoryOption, TourEditorOptions } from '@/lib/api/tours';
import type { MonthOption } from '@/lib/month-options';
import { PAGE_SIZE_OPTIONS } from '@/lib/table-query';
import type { CreateTourAction } from '@/lib/tour-editor-write';
import type { SetPublishedAction } from '@/lib/tours-publish';
import { type ToursQuery, toursHref } from '@/lib/tours-query';
import type { TourRowVM } from '@/lib/tours-view';

/**
 * Bảng `/tours` (spec P4e-1 §3-F11) — dựng trọn trên kit (`DataTableFrame` +
 * `DataTableBody` + `ColumnVisibilityMenu` + `TablePagination` +
 * `serverTableFeatures`): không checkbox, không fork rút gọn; user chốt
 * 31/08: mọi bảng vùng một kiểu. Trang/filter sống trên URL.
 *
 * Cột theo spec: Tour · Category · Base price · Open departures · On sale ·
 * Actions. Cột Tour KHÔNG ẩn được — nó là danh tính của hàng.
 *
 * Hai đường ra khỏi hàng, có chủ đích, chứ không phải một cú bấm lên cả hàng:
 * tên tour là link sang khu làm việc của tour (F17), và cột Actions giữ nút
 * "Departures" làm lối tắt sang màn chuyến (F12). Cả hàng bấm được sẽ nuốt luôn
 * vùng bấm của công tắc và của chính link ấy — một hàng mà cú bấm làm hai việc
 * khác nhau tuỳ toạ độ là hàng không ai đoán được.
 *
 * Thanh công cụ có nút New tour (F17): hộp tạo tour sinh ra đang TẮT bán.
 *
 * Component này KHÔNG tự tính gì: mọi con chữ đã được `toTourRowVM` (thuần, có
 * test) nấu sẵn.
 */
const t = messages.admin.tours.list;

const columnHelper = createColumnHelper<typeof serverTableFeatures, TourRowVM>();

/** Nhãn cho menu ẩn/hiện — chỉ cột ẩn ĐƯỢC mới cần entry. */
const COLUMN_LABELS: Record<string, string> = {
  category: t.columns.category,
  price: t.columns.price,
  departures: t.columns.departures,
  published: t.columns.published,
};

const COLUMN_ICONS = {
  category: TagIcon,
  price: DollarSignIcon,
  departures: CalendarRangeIcon,
  published: ShoppingBagIcon,
};

function buildColumns(setPublished: SetPublishedAction) {
  return columnHelper.columns([
    columnHelper.accessor('title', {
      header: t.columns.tour,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <TourThumb row={row.original} />
          <div className="grid min-w-0 gap-0.5">
            <Link
              href={row.original.editorHref}
              className="max-w-72 truncate font-medium text-foreground underline-offset-4 hover:underline"
              title={row.original.title}
            >
              {row.original.title}
            </Link>
            {row.original.isFeatured ? (
              <span>
                <Badge variant="secondary">{t.featured}</Badge>
              </span>
            ) : null}
          </div>
        </div>
      ),
      enableHiding: false,
    }),
    columnHelper.accessor('category', {
      header: t.columns.category,
      cell: ({ row }) => (
        <div className="max-w-48 truncate text-muted-foreground" title={row.original.category}>
          {row.original.category}
        </div>
      ),
    }),
    columnHelper.accessor('price', {
      header: t.columns.price,
      cell: ({ row }) => (
        <div className="whitespace-nowrap tabular-nums text-muted-foreground">
          {row.original.price}
        </div>
      ),
    }),
    columnHelper.accessor('openDepartureCount', {
      id: 'departures',
      header: t.columns.departures,
      /**
       * Số 0 in ĐẬM HƠN chứ không mờ đi: "tour này không còn chuyến nào trong
       * khoảng đang xem" là câu trả lời quan trọng nhất của cột, không phải một
       * ô thiếu dữ liệu. Câu đầy đủ dành cho trình đọc màn hình — một con số
       * trần không nói nó là số gì.
       */
      cell: ({ row }) => (
        <div
          className={`tabular-nums ${
            row.original.openDepartureCount === 0 ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          <span aria-hidden="true">{row.original.openDepartureCount}</span>
          <span className="sr-only">{row.original.countLabel}</span>
          {/* Tour tắt bán mà còn chuyến bookable: nói ngay dưới con số rằng
              khách không thấy chúng — màn chuyến báo đúng điều này (F16).
              `aria-hidden` vì câu đọc-màn-hình ở trên đã mang đủ ý. */}
          {row.original.countNote ? (
            <div aria-hidden="true" className="text-xs whitespace-nowrap text-muted-foreground">
              {row.original.countNote}
            </div>
          ) : null}
        </div>
      ),
    }),
    columnHelper.display({
      id: 'published',
      header: t.columns.published,
      cell: ({ row }) => (
        <PublishToggle
          tour={row.original}
          setPublished={setPublished}
          notReadyHref={row.original.reviewHref}
        />
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: t.columns.actions,
      cell: ({ row }) => (
        <Link
          href={row.original.departuresHref}
          aria-label={row.original.departuresLabel}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <CalendarRangeIcon data-icon="inline-start" aria-hidden="true" />
          {t.departuresAction}
        </Link>
      ),
      enableHiding: false,
    }),
  ]);
}

/**
 * Ô ảnh bìa 40px. Tour chưa gắn hero thì in một ô giữ chỗ CÓ CHỮ (sr-only) —
 * ô trống câm đọc thành "ảnh hỏng", còn đây là một sự thật bình thường của
 * tour vừa tạo. Thư viện ảnh là P4f, nên ô này chỉ đọc chứ chưa bấm được.
 *
 * Có hero thì vẽ bằng kit `SafeImg` với URL VM đã thu về `w_160` (spec 2026-10-05
 * §4 #3) — ô 40px không kéo nguyên ảnh gốc ~2400px. Ảnh hỏng thành ô icon mang tên
 * "Photo unavailable" chứ không thành ô trống câm (§4 #13). Lý do dùng `<img>`
 * thường thay cho `next/image` ghi ở `SafeImg`.
 */
function TourThumb({ row }: { row: TourRowVM }) {
  if (!row.thumbUrl) {
    return (
      // `aria-hidden` + `title` là hai thứ TRIỆT TIÊU nhau: cái đầu gỡ hẳn nút
      // khỏi cây trợ năng, còn `title` trên một div không tương tác thì vốn
      // không được đọc — cộng lại thành một ô câm, đúng thứ JSDoc trên nói phải
      // tránh. Một span `sr-only` mới thật sự nói được.
      <div className="size-10 shrink-0 rounded-md border border-dashed bg-muted">
        <span className="sr-only">{t.noImage}</span>
      </div>
    );
  }
  return <SafeImg src={row.thumbUrl} alt="" width={40} height={40} className="size-10" />;
}

export interface ToursTableProps {
  rows: TourRowVM[];
  /** Trạng thái URL hiện tại — nguồn để dựng href phân trang/lọc. */
  query: ToursQuery;
  /** Nguồn của menu lọc danh mục (`catalog.categories.list`). */
  categories: TourCategoryOption[];
  /** Các tháng bày trong menu khoảng đếm — server tính để nhãn không theo đồng hồ máy. */
  monthOptions: MonthOption[];
  total: number;
  totalPages: number;
  setPublished: SetPublishedAction;
  /** Hai danh sách chọn của hộp New tour — hỏng thì rỗng, hộp tự nói vì sao (F17). */
  createOptions: TourEditorOptions;
  create: CreateTourAction;
  /** Quick Create (`?create=1`) — chuyển thẳng xuống hộp New tour (spec 2026-10-05 §2.5). */
  openCreate?: boolean;
}

export function ToursTable({
  rows,
  query,
  categories,
  monthOptions,
  total,
  totalPages,
  setPublished,
  createOptions,
  create,
  openCreate,
}: ToursTableProps) {
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});
  const columns = React.useMemo(() => buildColumns(setPublished), [setPublished]);

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
      views={<ToursStatusTabs query={query} />}
      actions={
        <>
          <ToursCategoryMenu query={query} categories={categories} />
          <ToursMonthMenu query={query} options={monthOptions} />
          <ToursClearFilters query={query} />
          <ColumnVisibilityMenu table={table} labels={COLUMN_LABELS} icons={COLUMN_ICONS} />
          <NewTourDialog options={createOptions} create={create} openCreate={openCreate} />
        </>
      }
      footer={
        <TablePagination
          page={query.page}
          totalPages={totalPages}
          total={total}
          pageSize={query.limit}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          hrefForPage={(page) => toursHref(query, { page })}
          hrefForPageSize={(limit) => toursHref(query, { limit })}
        />
      }
    >
      <DataTableBody table={table} empty={t.empty} />
    </DataTableFrame>
  );
}
