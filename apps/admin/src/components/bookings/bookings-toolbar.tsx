'use client';

import { BookingStatusSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import {
  ChartPieIcon,
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  ListIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { DatePickerField } from '@/components/bookings/date-picker-field';
import { ExportButton } from '@/components/bookings/export-button';
import { ALL_FILTER_VALUE as ALL, StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { TableSearchForm } from '@/components/kit/table-search-form';
import { TOOLBAR_BUTTON } from '@/components/kit/toolbar-metrics';
import {
  type BookingsHrefPatch,
  type BookingsQuery,
  bookingsExportHref,
  bookingsHref,
  EXPORT_MAX_ROWS,
} from '@/lib/bookings-query';

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
 * Khoảng ngày ĐẶT BOOKING (spec P4b §3-F6) — hai ô `DatePickerField`, tức kiểu
 * `date-picker-04` của Shadcn Studio (user chốt 01/09, thay cho cặp
 * `<input type="date">` native trước đó). Riêng ô này không cần gói mới:
 * `Calendar` và `Popover` đã nằm sẵn trong `@tourism/ui`. (Gói `motion` mà
 * nút Export/pill/nút quyết định cùng vòng kéo vào admin thì có ghi sổ —
 * ADR-0027 §AMEND 02/09.)
 *
 * Đổi ngày là ĐIỀU HƯỚNG ngay, cùng nếp với tab trạng thái — nhưng "ngay" bây
 * giờ tính theo lúc CHỐT (chọn trên lịch / rời ô / Enter) chứ không theo từng
 * phím, vì ô chữ tự do không có sẵn ranh giới `change` mà ô date native cho
 * không. Chi tiết nằm ở `DatePickerField`.
 *
 * CỐ Ý chưa nâng lên `components/kit/`: bookings vẫn là vùng DUY NHẤT có bộ
 * lọc ngày (`/cancellations` và `/reviews` không khai `from`/`to` trong
 * contract), và luật §2.1 là kit mọc từ vùng thật chứ không dựng abstraction
 * trước. Vùng thứ hai xuất hiện thì nâng lên.
 */
export function BookingsDateRange({ query }: { query: BookingsQuery }) {
  const router = useRouter();
  // Nonce ĐẶT LẠI ô nhập (vòng vá review F6). Xem `go` bên dưới: có một ca mà
  // URL không đổi nhưng ô vẫn phải quay về giá trị đang lọc, và `key` theo
  // URL một mình không kéo nổi nó về.
  const [resetNonce, setResetNonce] = React.useState(0);

  /**
   * Đổi một đầu của khoảng.
   *
   * Ca phải xử riêng: giá trị vừa chốt bị luật khoảng-ngược của `bookingsHref`
   * VỨT ĐI — điều hướng lúc đó chỉ tổ hại (URL không đổi, hoặc tệ hơn: nhảy
   * về trang 1 mà chẳng lọc thêm gì), còn ô thì đứng đó khoe một bộ lọc
   * không tồn tại vì React không dựng lại nó. Bump nonce để ô snap về đúng
   * thứ URL đang nói. (Lịch làm mờ ngày ngoài khoảng, nhưng ô CHỮ vẫn gõ tay
   * được, nên ca này tới được — y như hồi `min`/`max` của ô date native chỉ
   * làm value :invalid chứ không chặn gõ.)
   *
   * Phát hiện "patch bị vứt" bằng cách so PHẦN LỌC với `page` GHIM CÙNG MỘT
   * GIÁ TRỊ ở cả hai vế (vòng vá review F6 lần 2): bản đầu so `next` với
   * href-hiện-tại trần, nhưng hai vế đó tính `page` theo hai luật khác nhau
   * — patch (dù bị vứt) vẫn làm `scopeChanged=true` nên vế patch mất `page`
   * khỏi URL, còn vế `{}` giữ trang hiện tại. Từ trang 2+ hai chuỗi khác
   * nhau CHỈ VÌ page, guard trượt, và bug "ô khoe bộ lọc ma" tái hiện y
   * nguyên (bảng nhảy về trang 1, `to` vẫn bị vứt, ô không remount).
   */
  function go(patch: BookingsHrefPatch) {
    const filtersUnchanged =
      bookingsHref(query, { ...patch, page: 1 }) === bookingsHref(query, { page: 1 });
    if (filtersUnchanged) {
      setResetNonce((nonce) => nonce + 1);
      return;
    }
    router.push(bookingsHref(query, patch));
  }

  return (
    // `<fieldset>` chứ không phải div trần: hai ô là MỘT bộ lọc, và nhãn
    // chung ("Filter by booking date") chỉ gắn được vào phần tử có role —
    // fieldset mang sẵn role `group` mà không cần thuộc tính ARIA nào.
    <fieldset aria-label={t.dateFilterLabel} className="flex items-center gap-1.5">
      <DatePickerField
        id="bookings-from"
        label={t.dateFrom}
        openLabel={t.pickDateFrom}
        placeholder={t.datePlaceholder}
        // `key` ép React dựng lại ô sau mỗi lần điều hướng nên ô luôn khớp
        // URL mà không cần effect đồng bộ (cùng nếp `TableSearchForm`); nonce
        // là đường kéo về cho ca URL-không-đổi (xem `go`).
        key={`from-${query.from ?? ''}-${resetNonce}`}
        value={query.from ?? ''}
        max={query.to}
        onCommit={(iso) => go({ from: iso || null })}
      />
      <span aria-hidden="true" className="text-muted-foreground">
        –
      </span>
      <DatePickerField
        id="bookings-to"
        label={t.dateTo}
        openLabel={t.pickDateTo}
        placeholder={t.datePlaceholder}
        key={`to-${query.to ?? ''}-${resetNonce}`}
        value={query.to ?? ''}
        min={query.from}
        onCommit={(iso) => go({ to: iso || null })}
      />
      {/* Xoá cả hai đầu trong một cú bấm — nếp `TableSearchForm`. Không có nó
          thì bỏ lọc nghĩa là quét trắng từng ô rồi rời ô, và nó cũng là lối
          thoát cho ca ô bị kéo về ở `go` (review F6). */}
      {query.from || query.to ? (
        <Button
          type="button"
          variant="ghost"
          className={TOOLBAR_BUTTON}
          onClick={() => go({ from: null, to: null })}
        >
          {t.clearDates}
        </Button>
      ) : null}
    </fieldset>
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
