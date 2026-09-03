'use client';

import { messages } from '@tourism/i18n';
import { CircleSlashIcon, ListIcon, MailCheckIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL, StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { TableSearchForm } from '@/components/kit/table-search-form';
import { ToolbarSelect } from '@/components/kit/toolbar-select';
import { type SubscribersQuery, subscribersHref } from '@/lib/subscribers-query';

/**
 * Ba mẩu điều khiển của `/subscribers` (spec P4c §3-F10): tab Active/
 * Unsubscribed/All (khe trái — kit `StatusFilterTabs`), Select lọc theo nguồn
 * và ô tìm email (khe phải). Cả ba chỉ làm một việc: đổi URL; server component
 * đọc lại `searchParams` rồi fetch (spec P4b §2.2), không có state danh sách
 * nào ở client.
 */
const t = messages.admin.subscribers.list;

/**
 * Ba tab = ba trạng thái của cờ `active`. Value trên tab là CHUỖI ('true'/
 * 'false'/ALL) vì `StatusFilterTabs` nói bằng chuỗi; chỗ đổi ngược về boolean
 * là `go()` bên dưới, một chỗ duy nhất.
 *
 * "All" giữ lại (quyết định tự chọn F10) chứ không rút còn hai tab: nó là
 * cách DUY NHẤT thấy trọn lịch sử một địa chỉ trên một màn hình khi tìm theo
 * email, và là tập mà nút Export dựng ra file "cả danh sách" — hai tab thì
 * không có đường nào xuất được một file đầy đủ.
 */
const TAB_ITEMS = [
  { label: t.all, value: ALL, icon: ListIcon },
  { label: t.active, value: 'true', icon: MailCheckIcon },
  { label: t.unsubscribed, value: 'false', icon: CircleSlashIcon },
];

export function SubscribersStatusTabs({ query }: { query: SubscribersQuery }) {
  const router = useRouter();
  const value = query.active === undefined ? ALL : String(query.active);

  function go(next: string) {
    // Value lạ từ Select/Tabs rơi êm về "All" thay vì ném giữa event handler
    // (nếp bookings, review F1).
    const active = next === 'true' ? true : next === 'false' ? false : null;
    router.push(subscribersHref(query, { active }));
  }

  return (
    <StatusFilterTabs
      items={TAB_ITEMS}
      value={value}
      label={t.filterLabel}
      selectId="subscribers-status-selector"
      onSelect={go}
    />
  );
}

/**
 * Lọc theo nguồn đăng ký. Danh sách mục đến từ CHÍNH response của list
 * (`sources` distinct toàn bảng) chứ không phải một mảng viết cứng ở đây
 * (quyết định tự chọn F10): `source` là chuỗi tự do do đường ghi tự khai, và
 * hôm nay KHÔNG đường nào khai cả — một Select viết cứng sẽ là danh sách mà
 * mọi mục đều trả 0 hàng.
 *
 * Bảng chưa có nguồn nào thì KHÔNG render gì: một control chỉ có mục "All
 * sources" là một ô chiếm chỗ mà không lọc được gì. Ngày một landing page bắt
 * đầu gửi `source`, nó tự xuất hiện.
 *
 * Giá trị đang lọc mà không nằm trong danh sách (gõ tay `?source=`, hoặc hàng
 * cuối cùng của nguồn đó vừa bị lọc mất) vẫn được thêm một mục TẠM — cùng
 * cách filter `type` của payment events xử, để ô không hiện nhầm "All sources"
 * trong khi bảng đang lọc thật.
 *
 * GIỚI HẠN đã biết: một `source` viết đúng chữ `ALL` sẽ trùng với giá trị
 * sentinel của kit (`ALL_FILTER_VALUE`) và không chọn được từ ô này (URL
 * `?source=ALL` vẫn lọc thật). Chấp nhận: `source` do CHÍNH code của ta ghi
 * khi thêm một đường đăng ký mới, nên đây là một cái tên cần tránh, không
 * phải một chuỗi từ ngoài vào.
 */
export function SubscribersSourceSelect({
  query,
  sources,
}: {
  query: SubscribersQuery;
  sources: readonly string[];
}) {
  const router = useRouter();
  const current = query.source;
  const unknown = current !== undefined && !sources.includes(current);

  // Bảng chưa có nguồn nào VÀ không đang lọc theo nguồn lạ: không vẽ gì.
  if (sources.length === 0 && !unknown) return null;

  const items = [
    { label: t.sourceAll, value: ALL },
    ...(unknown ? [{ label: current, value: current }] : []),
    ...sources.map((source) => ({ label: source, value: source })),
  ];

  return (
    <ToolbarSelect
      id="subscribers-source-selector"
      label={t.sourceLabel}
      value={current ?? ALL}
      items={items}
      onSelect={(next) =>
        router.push(subscribersHref(query, { source: next === ALL ? null : next }))
      }
    />
  );
}

export function SubscribersSearch({ query }: { query: SubscribersQuery }) {
  const router = useRouter();

  return (
    <TableSearchForm
      inputId="subscribers-search"
      label={t.searchLabel}
      placeholder={t.searchPlaceholder}
      clearLabel={t.clear}
      value={query.search}
      onSearch={(term) => router.push(subscribersHref(query, { search: term }))}
      onClear={() => router.push(subscribersHref(query, { search: null }))}
    />
  );
}
