'use client';

import { BookingStatusSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  ChartPieIcon,
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  ListIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ExportButton } from '@/components/kit/export-button';
import { ALL_FILTER_VALUE as ALL, StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { TableSearchForm } from '@/components/kit/table-search-form';
import { ToolbarDateRange } from '@/components/kit/toolbar-date-range';
import { type BookingsQuery, bookingsExportHref, bookingsHref } from '@/lib/bookings-query';
import { EXPORT_MAX_ROWS } from '@/lib/export-pages';

/**
 * Bốn mẩu điều khiển của `/bookings`, lắp vào hai khe của `DataTableFrame`:
 * tab lọc trạng thái (khe trái — cặp Select/Tabs responsive nằm ở kit
 * `StatusFilterTabs`, nâng lên ở review F3 31/08); ô tìm kiếm, khoảng ngày và
 * nút Export CSV (khe phải, hai cái sau thêm ở F6).
 *
 * Ba mẩu lọc chỉ làm một việc: đổi URL; server component đọc lại
 * `searchParams` rồi fetch (spec P4b §2.2), không có state danh sách nào ở
 * client. Mẩu thứ tư là một liên kết tải file, cũng đọc từ chính URL ấy.
 */
const t = messages.admin.bookings.list;

/** Nguồn danh sách trạng thái = enum contract, không chép tay lần hai. */
const STATUSES = BookingStatusSchema.options;

/**
 * Icon cho từng trạng thái (user chốt 01/09). Bản đồ đặt ở VÙNG chứ không ở
 * kit: kit không biết REFUNDED khác PARTIALLY_REFUNDED ở chỗ nào.
 *
 * Ghi theo `Record` trên enum chứ không phải object rời: thêm một member vào
 * `BookingStatus` mà quên icon là ĐỎ ở typecheck, thay vì lặng lẽ thiếu một
 * icon giữa hàng.
 */
const STATUS_ICONS: Record<(typeof STATUSES)[number], typeof ClockIcon> = {
  PENDING: ClockIcon,
  PAID: CircleCheckIcon,
  CANCELLED: CircleXIcon,
  REFUNDED: RotateCcwIcon,
  // "Một phần" của một tổng — thứ gần nhất mà một glyph 16px nói được.
  PARTIALLY_REFUNDED: ChartPieIcon,
};

const TAB_ITEMS = [
  { label: t.all, value: ALL, icon: ListIcon },
  ...STATUSES.map((status) => ({
    label: messages.admin.bookings.status[status],
    value: status,
    icon: STATUS_ICONS[status],
  })),
];

export function BookingsStatusTabs({ query }: { query: BookingsQuery }) {
  const router = useRouter();
  const value = query.status ?? ALL;

  function go(next: string) {
    // `safeParse` chứ không `parse`: cùng nếp khoan dung với đường URL
    // (`parseBookingsSearchParams`) — value lạ từ Select/Tabs (kể cả `null`
    // khi bị reset) rơi êm về "All" thay vì ném ZodError giữa event handler.
    const parsed = BookingStatusSchema.safeParse(next);
    router.push(bookingsHref(query, { status: parsed.success ? parsed.data : null }));
  }

  return (
    <StatusFilterTabs
      items={TAB_ITEMS}
      value={value}
      label={t.filterLabel}
      selectId="bookings-status-selector"
      onSelect={go}
    />
  );
}

export function BookingsSearch({ query }: { query: BookingsQuery }) {
  const router = useRouter();

  return (
    <TableSearchForm
      inputId="bookings-search"
      label={t.searchLabel}
      placeholder={t.searchPlaceholder}
      clearLabel={t.clear}
      value={query.search}
      onSearch={(term) => router.push(bookingsHref(query, { search: term }))}
      onClear={() => router.push(bookingsHref(query, { search: null }))}
    />
  );
}

/**
 * Khoảng ngày ĐẶT BOOKING (spec P4b §3-F6) — vỏ mỏng quanh kit
 * `ToolbarDateRange`. Vùng chỉ giữ phần của mình: nhãn, tiền tố id, và cách
 * dựng href. Guard "patch bị vứt" cùng hai ô đã lên kit ở 04/09 khi
 * `/cancellations` thành consumer thứ hai (ADR-0028 §AMEND).
 */
export function BookingsDateRange({ query }: { query: BookingsQuery }) {
  const router = useRouter();

  return (
    <ToolbarDateRange
      idPrefix="bookings"
      label={t.dateFilterLabel}
      labels={{
        from: t.dateFrom,
        to: t.dateTo,
        openFrom: t.pickDateFrom,
        openTo: t.pickDateTo,
        placeholder: t.datePlaceholder,
        clear: t.clearDates,
      }}
      from={query.from}
      to={query.to}
      hrefFor={(patch) => bookingsHref(query, patch)}
      onNavigate={router.push}
    />
  );
}

/**
 * Nút tải CSV — hình dạng ở `ExportButton` (khuôn `button-27`, user chốt
 * 01/09); phần ở đây chỉ quyết ĐỊNH ĐI ĐÂU và NÓI GÌ.
 *
 * Sống trong ô tiêu đề cột `export` của bảng, không còn ở hàng điều khiển —
 * hàng ấy tràn sau khi mọi control lên 44px.
 *
 * Hai chế độ, và nhãn phải nói rõ đang ở chế độ nào TRƯỚC cú bấm:
 *
 * - **Không tích gì** → xuất CẢ TẬP đang lọc. `total` (server đã đếm cho footer
 *   phân trang) quyết định nút sống hay tắt: tập vượt trần `EXPORT_MAX_ROWS` là
 *   chuyện biết được TRƯỚC cú click, mà một `<a>` nhận 413 là một cú điều hướng
 *   thật — admin bị đá khỏi bảng đang lọc sang một trang text chỉ để đọc lời từ
 *   chối. Tắt nút kèm chính câu 413 làm tooltip thì lời từ chối đến trước, bảng
 *   còn nguyên.
 * - **Có tích** → xuất đúng các hàng ấy. Trần KHÔNG áp: việc chọn khoá trong
 *   trang đang xem nên số hàng ≤ `limit` (tối đa 100), tắt nút ở đây là chặn
 *   một việc hoàn toàn làm được.
 *
 * (Các nhánh lỗi không đoán trước được — API sập giữa chừng, trang đã đổi dưới
 * chân — vẫn là điều hướng; đó là giá của một cú tải file bằng `<a>` thật.)
 */
export function BookingsExportLink({
  query,
  total,
  selected,
}: {
  query: BookingsQuery;
  total: number;
  /** Mã các hàng đã tích trên TRANG ĐANG XEM; rỗng nghĩa là xuất cả tập lọc. */
  selected: readonly string[];
}) {
  const label = selected.length ? t.exportSelected(selected.length) : t.exportCsv;
  const tooLarge = selected.length === 0 && total > EXPORT_MAX_ROWS;

  return (
    <ExportButton
      label={label}
      href={tooLarge ? undefined : bookingsExportHref(query, selected)}
      disabledReason={tooLarge ? t.exportTooLarge(total, EXPORT_MAX_ROWS) : undefined}
    />
  );
}
