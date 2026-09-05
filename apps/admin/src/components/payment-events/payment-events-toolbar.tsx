'use client';

import { PaymentProviderSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Toggle } from '@tourism/ui/components/toggle';
import { CircleDashedIcon, CreditCardIcon, ListIcon, WalletIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL, StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { TableSearchForm } from '@/components/kit/table-search-form';
import { clearFiltersHref, ToolbarClearFilters } from '@/components/kit/toolbar-clear-filters';
import { TOOLBAR_BUTTON } from '@/components/kit/toolbar-metrics';
import { type PaymentEventsQuery, paymentEventsHref } from '@/lib/payment-events-query';

/**
 * Ba mẩu điều khiển của `/payment-events` (spec P4c §3-F8): tab provider
 * (khe trái — kit `StatusFilterTabs`, ở đây là segmented control theo
 * provider chứ không phải trạng thái, dùng đúng vai "dải lựa chọn liền
 * khối"), ô tìm eventId và toggle "Unprocessed only" (khe phải). Cả ba chỉ
 * làm một việc: đổi URL; server component đọc lại `searchParams` rồi fetch
 * (spec P4b §2.2), không có state danh sách nào ở client.
 *
 * Mẩu thứ tư — lọc theo type — tách sang `payment-events-type-menu.tsx` ngày
 * 03/09: nó thôi là Select và thành menu theo khuôn `dropdown-menu-10`.
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

export function PaymentEventsSearch({ query }: { query: PaymentEventsQuery }) {
  const router = useRouter();

  return (
    <TableSearchForm
      inputId="payment-events-search"
      label={t.list.searchLabel}
      placeholder={t.list.searchPlaceholder}
      value={query.search}
      onSearch={(term) => router.push(paymentEventsHref(query, { search: term }))}
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

/**
 * Nút xoá DUY NHẤT của hàng điều khiển `/payment-events` (05/09) — vỏ mỏng quanh kit
 * `ToolbarClearFilters`, xem JSDoc ở đó cho luật chung.
 *
 * Không đụng dải tab provider: nó nằm ở khe `views`, tự đã có mục "All", và
 * sidebar link thẳng vào những URL mang nó.
 *
 * Hai href đều GHIM `page: 1` — không ghim thì từ trang 2 trở đi chúng khác
 * nhau chỉ vì `page` và nút không bao giờ tự ẩn.
 */
export function PaymentEventsClearFilters({ query }: { query: PaymentEventsQuery }) {
  const router = useRouter();

  return (
    <ToolbarClearFilters
      label={messages.admin.table.clearFilters}
      href={clearFiltersHref(
        paymentEventsHref(query, { search: null, type: null, unprocessed: false, page: 1 }),
        paymentEventsHref(query, { page: 1 }),
      )}
      onNavigate={router.push}
    />
  );
}
