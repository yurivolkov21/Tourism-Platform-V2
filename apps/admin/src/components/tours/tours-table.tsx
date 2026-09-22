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
import { serverTableFeatures } from '@/components/kit/table-features';
import { TablePagination } from '@/components/kit/table-pagination';
import { PublishToggle } from '@/components/tours/publish-toggle';
import {
  ToursCategoryMenu,
  ToursClearFilters,
  ToursMonthMenu,
  ToursStatusTabs,
} from '@/components/tours/tours-toolbar';
import type { TourCategoryOption } from '@/lib/api/tours';
import type { MonthOption } from '@/lib/month-options';
import { PAGE_SIZE_OPTIONS } from '@/lib/table-query';
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
 * Đường sang màn chuyến khởi hành (F12 dựng) đi qua HAI chỗ có chủ đích, chứ
 * không phải một cú bấm lên cả hàng: tên tour là link, và cột Actions có nút
 * "Departures". Cả hàng bấm được sẽ nuốt luôn vùng bấm của công tắc và của
 * chính link ấy — một hàng mà cú bấm làm hai việc khác nhau tuỳ toạ độ là
 * hàng không ai đoán được.
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
              href={row.original.departuresHref}
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
        </div>
      ),
    }),
    columnHelper.display({
      id: 'published',
      header: t.columns.published,
      cell: ({ row }) => <PublishToggle row={row.original} setPublished={setPublished} />,
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
 * `<img>` thuần chứ không `next/image`: URL Cloudinary đã mang sẵn
 * `f_auto,q_auto` (ADR-0005), nên cho Next tối ưu lại một lần nữa là trả tiền
 * băng thông hai lần cho cùng một tấm 40px.
 */
function TourThumb({ row }: { row: TourRowVM }) {
  if (!row.heroUrl) {
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
  return (
    // biome-ignore lint/performance/noImgElement: URL Cloudinary đã tối ưu sẵn (ADR-0005)
    <img
      src={row.heroUrl}
      alt=""
      width={40}
      height={40}
      loading="lazy"
      className="size-10 shrink-0 rounded-md object-cover"
    />
  );
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
}

export function ToursTable({
  rows,
  query,
  categories,
  monthOptions,
  total,
  totalPages,
  setPublished,
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
