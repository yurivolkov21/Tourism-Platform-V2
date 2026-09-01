'use client';

import { BookingStatusSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { Input } from '@tourism/ui/components/input';
import { Label } from '@tourism/ui/components/label';
import { DownloadIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL, StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { TableSearchForm } from '@/components/kit/table-search-form';
import { type BookingsQuery, bookingsExportHref, bookingsHref } from '@/lib/bookings-query';

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

const TAB_ITEMS = [
  { label: t.all, value: ALL },
  ...STATUSES.map((status) => ({ label: messages.admin.bookings.status[status], value: status })),
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
 * Khoảng ngày ĐẶT BOOKING (spec P4b §3-F6) — hai ô `<input type="date">`
 * thuần, 0 dependency (freeze dep 15/10) và sẵn lịch native của trình duyệt.
 *
 * Đổi ngày là ĐIỀU HƯỚNG ngay, cùng nếp với tab trạng thái: trình duyệt chỉ
 * phát `change` khi ô date đủ ba phần (hoặc bị xoá trắng), nên không có cảnh
 * mỗi phím gõ một lần đẩy URL. Giá trị rác không tới được đây, nhưng
 * `bookingsHref` vẫn lọc lần nữa — cùng luật khoan dung với đường URL gõ tay.
 *
 * CỐ Ý chưa nâng lên `components/kit/`: đây mới là consumer ĐẦU TIÊN, và luật
 * §2.1 là kit mọc từ vùng thật chứ không dựng abstraction trước (bookings là
 * vùng duy nhất hiện có bộ lọc ngày — `/cancellations` và `/reviews` không
 * khai `from`/`to` trong contract). Vùng thứ hai xuất hiện thì nâng lên.
 */
export function BookingsDateRange({ query }: { query: BookingsQuery }) {
  const router = useRouter();

  return (
    // `<fieldset>` chứ không phải div trần: hai ô là MỘT bộ lọc, và nhãn
    // chung ("Filter by booking date") chỉ gắn được vào phần tử có role —
    // fieldset mang sẵn role `group` mà không cần thuộc tính ARIA nào.
    <fieldset aria-label={t.dateFilterLabel} className="flex items-center gap-1.5">
      <Label htmlFor="bookings-from" className="sr-only">
        {t.dateFrom}
      </Label>
      <Input
        id="bookings-from"
        type="date"
        className="w-36"
        aria-label={t.dateFrom}
        title={t.dateFrom}
        // `key` ép React dựng lại ô sau mỗi lần điều hướng nên ô luôn khớp
        // URL mà không cần effect đồng bộ (cùng nếp `TableSearchForm`).
        key={`from-${query.from ?? ''}`}
        defaultValue={query.from ?? ''}
        max={query.to}
        onChange={(event) => router.push(bookingsHref(query, { from: event.target.value }))}
      />
      <span aria-hidden="true" className="text-muted-foreground">
        –
      </span>
      <Label htmlFor="bookings-to" className="sr-only">
        {t.dateTo}
      </Label>
      <Input
        id="bookings-to"
        type="date"
        className="w-36"
        aria-label={t.dateTo}
        title={t.dateTo}
        key={`to-${query.to ?? ''}`}
        defaultValue={query.to ?? ''}
        // Lịch native tự chặn ngày trước `from` — người dùng không dựng được
        // khoảng ngược ngay từ đầu, còn `parseBookingsSearchParams` lo nốt
        // đường URL gõ tay.
        min={query.from}
        onChange={(event) => router.push(bookingsHref(query, { to: event.target.value }))}
      />
    </fieldset>
  );
}

/**
 * Nút tải CSV của ĐÚNG tập đang lọc. Là `<a>` thật (ButtonLink) chứ không phải
 * `next/link` hay một nút gọi fetch: đích là route handler trả
 * `Content-Disposition: attachment`, và điều hướng phía client sẽ biến một cú
 * tải file thành một cú render trang hỏng.
 */
export function BookingsExportLink({ query }: { query: BookingsQuery }) {
  return (
    <ButtonLink variant="outline" size="sm" href={bookingsExportHref(query)}>
      <DownloadIcon data-icon="inline-start" aria-hidden="true" />
      {t.exportCsv}
    </ButtonLink>
  );
}
