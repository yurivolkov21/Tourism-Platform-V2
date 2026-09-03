'use client';

import {
  PAYMENT_EVENT_TYPES,
  PaymentEventTypeSchema,
  PaymentProviderSchema,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Toggle } from '@tourism/ui/components/toggle';
import { CircleDashedIcon, CreditCardIcon, ListIcon, WalletIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL, StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { TableSearchForm } from '@/components/kit/table-search-form';
import { TOOLBAR_BUTTON } from '@/components/kit/toolbar-metrics';
import { fromFreeValue, ToolbarSelect, toFreeValue } from '@/components/kit/toolbar-select';
import { type PaymentEventsQuery, paymentEventsHref } from '@/lib/payment-events-query';

/**
 * Bốn mẩu điều khiển của `/payment-events` (spec P4c §3-F8): tab provider
 * (khe trái — kit `StatusFilterTabs`, ở đây là segmented control theo
 * provider chứ không phải trạng thái, dùng đúng vai "dải lựa chọn liền
 * khối"), Select type, ô tìm eventId và toggle "Unprocessed only" (khe phải).
 * Cả bốn chỉ làm một việc: đổi URL; server component đọc lại `searchParams`
 * rồi fetch (spec P4b §2.2), không có state danh sách nào ở client.
 */
const t = messages.admin.paymentEvents;

/** Nguồn danh sách = enum/tuple contract, không chép tay lần hai. */
const PROVIDERS = PaymentProviderSchema.options;

/** Icon theo provider — `Record` trên enum để quên một member là đỏ ở typecheck. */
const PROVIDER_ICONS: Record<(typeof PROVIDERS)[number], typeof CreditCardIcon> = {
  STRIPE: CreditCardIcon,
  PAYPAL: WalletIcon,
};

const TAB_ITEMS = [
  { label: t.list.all, value: ALL, icon: ListIcon },
  ...PROVIDERS.map((provider) => ({
    label: t.provider[provider],
    value: provider,
    icon: PROVIDER_ICONS[provider],
  })),
];

// Giá trị thật mang tiền tố của kit (`toFreeValue`) để type tự do từ DB không
// bao giờ đụng sentinel "All" (vòng vá review F10).
const TYPE_ITEMS = [
  { label: t.list.typeAll, value: ALL },
  ...PAYMENT_EVENT_TYPES.map((type) => ({ label: t.type[type], value: toFreeValue(type) })),
];

export function PaymentEventsProviderTabs({ query }: { query: PaymentEventsQuery }) {
  const router = useRouter();
  const value = query.provider ?? ALL;

  function go(next: string) {
    // `safeParse` chứ không `parse`: value lạ rơi êm về "All" (nếp bookings).
    const parsed = PaymentProviderSchema.safeParse(next);
    router.push(paymentEventsHref(query, { provider: parsed.success ? parsed.data : null }));
  }

  return (
    <StatusFilterTabs
      items={TAB_ITEMS}
      value={value}
      label={t.list.filterLabel}
      selectId="payment-events-provider-selector"
      onSelect={go}
    />
  );
}

/**
 * Lọc theo type — Select (quyết định tự chọn F8): tập type gateway biết
 * (`PAYMENT_EVENT_TYPES`) đủ nhỏ để liệt kê và đủ khác nhau để operator chọn
 * thay vì gõ; ô tìm dành cho eventId — thứ không liệt kê được.
 *
 * Cột DB là chuỗi tự do (vòng vá review F8): một `?type=` NGOÀI tuple vẫn
 * lọc thật ở API, nên Select phải HIỆN đúng giá trị đó — thêm một mục tạm
 * (nhãn = chuỗi thô) thay vì nhảy về "All" trong khi bảng đang lọc theo thứ
 * khác. Giá trị đi thẳng lên URL; trần độ dài do `payment-events-query` cắt.
 */
export function PaymentEventsTypeSelect({ query }: { query: PaymentEventsQuery }) {
  const router = useRouter();
  const value = query.type === undefined ? ALL : toFreeValue(query.type);
  const items =
    query.type && !PaymentEventTypeSchema.safeParse(query.type).success
      ? [...TYPE_ITEMS, { label: query.type, value: toFreeValue(query.type) }]
      : TYPE_ITEMS;

  function go(next: string) {
    router.push(paymentEventsHref(query, { type: fromFreeValue(next) }));
  }

  return (
    <ToolbarSelect
      id="payment-events-type-selector"
      label={t.list.typeLabel}
      value={value}
      items={items}
      onSelect={go}
    />
  );
}

export function PaymentEventsSearch({ query }: { query: PaymentEventsQuery }) {
  const router = useRouter();

  return (
    <TableSearchForm
      inputId="payment-events-search"
      label={t.list.searchLabel}
      placeholder={t.list.searchPlaceholder}
      clearLabel={t.list.clear}
      value={query.search}
      onSearch={(term) => router.push(paymentEventsHref(query, { search: term }))}
      onClear={() => router.push(paymentEventsHref(query, { search: null }))}
    />
  );
}

/**
 * Toggle "Unprocessed only" — trạng thái là URL param `?unprocessed=true`
 * (spec §3-F8: không state client). `Toggle` outline cùng chiều cao hàng
 * điều khiển; `aria-pressed` do primitive lo nên trình đọc màn hình biết
 * đang bật hay tắt.
 */
export function PaymentEventsUnprocessedToggle({ query }: { query: PaymentEventsQuery }) {
  const router = useRouter();

  return (
    <Toggle
      variant="outline"
      pressed={query.unprocessed === true}
      onPressedChange={(pressed) => router.push(paymentEventsHref(query, { unprocessed: pressed }))}
      className={TOOLBAR_BUTTON}
    >
      <CircleDashedIcon data-icon="inline-start" aria-hidden="true" />
      {t.list.unprocessedOnly}
    </Toggle>
  );
}
