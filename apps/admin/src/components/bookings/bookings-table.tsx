'use client';

import {
  type ColumnVisibilityState,
  createColumnHelper,
  type RowSelectionState,
  useTable,
} from '@tanstack/react-table';
import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { Checkbox } from '@tourism/ui/components/checkbox';
import {
  BanknoteIcon,
  CalendarOffIcon,
  MapPinIcon,
  TagIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import {
  BookingsClearFilters,
  BookingsDateRange,
  BookingsExportLink,
  BookingsSearch,
  BookingsStatusTabs,
} from '@/components/bookings/bookings-toolbar';
import { ColumnVisibilityMenu, DataTableBody } from '@/components/kit/data-table-body';
import { DataTableFrame } from '@/components/kit/data-table-frame';
import { selectableTableFeatures } from '@/components/kit/table-features';
import { TablePagination } from '@/components/kit/table-pagination';
import { type BookingsQuery, bookingsHref } from '@/lib/bookings-query';
import {
  type BookingRowVM,
  formatCalendarDate,
  formatDateRange,
  statusBadgeVariant,
} from '@/lib/bookings-view';
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

const columnHelper = createColumnHelper<typeof selectableTableFeatures, BookingRowVM>();

/** Nhãn cho menu ẩn/hiện — chỉ cột ẩn ĐƯỢC mới cần entry (review F3). */
const COLUMN_LABELS: Record<string, string> = {
  tourTitle: t.columns.tour,
  statusLabel: t.columns.status,
  guests: t.columns.guests,
  amount: t.columns.amount,
  customerName: t.columns.customer,
};

/**
 * Icon đầu mỗi dòng trong menu Columns (khuôn `dropdown-menu-12`, user chốt
 * 01/09). Khoá theo ĐÚNG `column.id` của `COLUMN_LABELS` — cùng bộ khoá, để
 * đổi tên một cột là thấy ngay cả hai chỗ phải sửa.
 */
const COLUMN_ICONS = {
  tourTitle: MapPinIcon,
  statusLabel: TagIcon,
  guests: UsersIcon,
  amount: BanknoteIcon,
  customerName: UserIcon,
};

/**
 * Cột nhận `query`/`total` qua tham số (không đọc từ module) vì nút Export nay
 * sống trong Ô TIÊU ĐỀ của cột `export`. Cùng nếp `buildColumns(decide)` của
 * `/cancellations` và `buildColumns(moderate)` của `/reviews`.
 *
 * CỐ Ý không nhận danh sách mã đã tích: nó đổi theo mỗi cú click, mà `columns`
 * là đầu vào của row model — truyền vào đây là bắt table dựng lại model sau
 * MỖI ô checkbox được bấm. Header đọc thẳng lựa chọn từ `table` mà TanStack
 * đưa cho nó, nên `columns` chỉ cần ổn định theo `query`/`total`.
 */
function buildColumns(query: BookingsQuery, total: number) {
  return columnHelper.columns([
    columnHelper.display({
      id: 'select',
      /**
       * Chọn CẢ TRANG, không phải cả tập — và nhãn nói đúng như thế. Phân trang
       * là điều hướng thật nên tích chết mỗi lần sang trang; hứa "select all"
       * rồi mất sạch là nói dối bằng nhãn.
       *
       * `indeterminate` khi tích lẻ là bắt buộc, không phải trang trí: báo "đã
       * chọn" lúc mới tích 1/2 hàng thì cú bấm kế tiếp sẽ BỎ hết thay vì chọn
       * nốt.
       *
       * Dùng bộ `…AllRows…` chứ KHÔNG phải `…AllPageRows…`: bộ "page" của
       * TanStack đọc row model PHÂN TRANG, mà `selectableTableFeatures` cố ý không
       * đăng ký `rowPaginationFeature` — nên chúng im lặng không làm gì (đã đo:
       * bấm chọn-cả-trang lần hai không bỏ tích được). Ở bảng này `data` VỐN ĐÃ
       * là đúng một trang do server cắt, nên "tất cả hàng" và "tất cả hàng của
       * trang" là cùng một tập.
       */
      header: ({ table }) => (
        <Checkbox
          aria-label={t.selectAllRows}
          checked={table.getIsAllRowsSelected()}
          // Base UI khai `indeterminate` thành prop RIÊNG, khác Radix (nơi nó
          // là giá trị thứ ba của `checked`). Nhét `'indeterminate'` vào
          // `checked` vừa đỏ typecheck vừa sai ngữ nghĩa.
          //
          // "Một phần" đếm trên HÀNG ĐANG HIỆN (`getSelectedRowModel`), KHÔNG
          // dùng `getIsSomeRowsSelected`: bản v9 của nó chỉ đếm key trong
          // state (`Object.keys(rowSelection).length > 0`), nên một key lạc
          // từ trang trước làm ô này kẹt `mixed` dù không hàng nào tích
          // (vòng vá review 02/09).
          indeterminate={
            !table.getIsAllRowsSelected() && table.getSelectedRowModel().rows.length > 0
          }
          onCheckedChange={(value) => table.toggleAllRowsSelected(value === true)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={t.selectRow(row.original.code)}
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(value === true)}
        />
      ),
    }),
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
    columnHelper.display({
      id: 'export',
      /**
       * Nút Export sống Ở ĐÂY thay vì trên hàng điều khiển (user chốt 01/09):
       * hàng ấy đã tràn sau khi mọi control lên 44px, và nút Clear-dates chỉ
       * hiện khi có lọc ngày nên nó là giọt nước cuối.
       *
       * Ô THÂN để trống có chủ đích: cột tồn tại để nút có chỗ đứng cố định,
       * không trôi ngang theo độ rộng cột Customer.
       *
       * `w-0` + `justify-end`: cột co về đúng bề rộng của nút và ép nó nằm SÁT
       * MÉP PHẢI bảng. Không có hai class này thì cột ăn phần chiều rộng thừa
       * mà `Customer` không dùng tới, và nút đứng lửng ở giữa khoảng trống ấy
       * (user báo 01/09 — "nằm lưng chừng").
       */
      header: ({ table }) => (
        <div className="flex w-0 justify-end">
          <BookingsExportLink
            query={query}
            total={total}
            // Khoá của row model CHÍNH LÀ `code` (`getRowId` bên dưới).
            selected={table.getSelectedRowModel().rows.map((row) => row.id)}
          />
        </div>
      ),
      cell: () => null,
    }),
  ]);
}

export interface BookingsTableProps {
  rows: BookingRowVM[];
  /** Trạng thái URL hiện tại — nguồn để dựng href phân trang/lọc. */
  query: BookingsQuery;
  total: number;
  totalPages: number;
}

export function BookingsTable({ rows, query, total, totalPages }: BookingsTableProps) {
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});
  // Tích hàng SỐNG TRONG TRANG ĐANG XEM (spec 01/09 §2) — nhưng KHÔNG tự chết
  // khi sang trang như bản đầu giả định: đổi page/filter là soft navigation
  // cùng segment, React giữ nguyên instance này và cả `useState` của nó (vòng
  // vá review 02/09). Nên bảng tự ĐẶT LẠI tích mỗi khi query đổi, theo khuôn
  // "chỉnh state trong lúc render" của React: so khoá query với lần trước,
  // lệch thì xoá — không effect, không khung hình nào lộ tích cũ. Không `key`
  // cả bảng ở page.tsx vì làm vậy xoá luôn `columnVisibility`, thứ admin
  // MUỐN giữ qua trang.
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const queryKey = bookingsHref(query, {});
  const [selectionKey, setSelectionKey] = React.useState(queryKey);
  if (selectionKey !== queryKey) {
    setSelectionKey(queryKey);
    setRowSelection({});
  }

  const columns = React.useMemo(() => buildColumns(query, total), [query, total]);

  const table = useTable({
    features: selectableTableFeatures,
    data: rows,
    columns,
    // KHÔNG có pagination state ở table: trang/limit sống trên URL và
    // `TablePagination` nhận thẳng props — nhét thêm vào table là nuôi một
    // bản sao chết (review 31/08 gỡ `manualPagination`/`rowCount`).
    state: { columnVisibility, rowSelection },
    getRowId: (row) => row.code,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
  });

  return (
    <DataTableFrame
      views={<BookingsStatusTabs query={query} />}
      actions={
        <>
          <BookingsDateRange query={query} />
          <BookingsSearch query={query} />
          {/* Export KHÔNG còn ở đây (01/09): hàng điều khiển tràn sau khi mọi
              control lên 44px. Nút nay nằm trong ô tiêu đề cột `export` — xem
              `buildColumns`. */}
          <BookingsClearFilters query={query} />
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
          hrefForPage={(page) => bookingsHref(query, { page })}
          hrefForPageSize={(limit) => bookingsHref(query, { limit })}
        />
      }
    >
      {/* Thân bảng + empty state nằm ở kit (`DataTableBody`, review F3 31/08). */}
      <DataTableBody table={table} empty={<BookingsEmpty query={query} />} />
    </DataTableFrame>
  );
}

/**
 * Ô rỗng của bảng. Khi ĐANG lọc theo ngày thì nói thẳng khoảng ngày ra và mở
 * sẵn một lối thoát — vì từ 04/09 khoảng ngày MẶC ĐỊNH là tháng hiện tại, nên
 * "không có kết quả" thường là do khoảng ngày chứ không phải do không có dữ
 * liệu.
 *
 * Đây là lưới an toàn cho ca tra cứu: khách gọi báo mã booking, người trực gõ
 * vào ô tìm kiếm, mà booking ấy tạo từ tháng trước. Ba bộ lọc CỘNG DỒN nên
 * kết quả là bảng rỗng — không có câu này thì người trực kết luận "không có
 * booking đó", trong khi thủ phạm là hai ô ngày họ chưa từng đụng vào.
 */
function BookingsEmpty({ query }: { query: BookingsQuery }) {
  if (!query.from && !query.to) return <>{t.empty}</>;

  // Ba dạng câu cho ba hình dạng khoảng — 'between X.' cho khoảng một đầu là
  // câu cụt và đọc thành 'đúng ngày X' (vòng vá review polish 2).
  const message =
    query.from && query.to
      ? t.emptyInRange(formatDateRange(query.from, query.to))
      : query.from
        ? t.emptyFrom(formatCalendarDate(query.from))
        : t.emptyTo(formatCalendarDate(query.to as string));

  return (
    <div className="flex flex-col items-center gap-2">
      <p>{message}</p>
      {/* Link chứ không nút: đổi bộ lọc là ĐIỀU HƯỚNG ở vùng này (spec P4b
          §2.2), và một link thì mở tab mới / copy được như mọi filter khác. */}
      <ButtonLink variant="outline" size="sm" href={bookingsHref(query, { from: null, to: null })}>
        <CalendarOffIcon data-icon="inline-start" aria-hidden="true" />
        {t.showAllDates}
      </ButtonLink>
    </div>
  );
}
