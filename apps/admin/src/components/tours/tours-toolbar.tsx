'use client';

import { CalendarMonthSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  CalendarClockIcon,
  CalendarIcon,
  CircleQuestionMarkIcon,
  CircleSlashIcon,
  ListIcon,
  ShoppingBagIcon,
  TagIcon,
  TagsIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL, fromFreeValue, toFreeValue } from '@/components/kit/filter-value';
import { StatusFilterTabs } from '@/components/kit/status-filter-tabs';
import { clearFiltersHref, ToolbarClearFilters } from '@/components/kit/toolbar-clear-filters';
import {
  ToolbarFilterMenu,
  type ToolbarFilterMenuGroup,
} from '@/components/kit/toolbar-filter-menu';
import type { TourCategoryOption } from '@/lib/api/tours';
import { groupMonthOptions, type MonthOption } from '@/lib/month-options';
import { type ToursQuery, toursHref } from '@/lib/tours-query';
import { categoryOptionLabel } from '@/lib/tours-view';

/**
 * Bốn mẩu điều khiển của `/tours` (spec P4e-1 §3-F11). Cả bốn chỉ làm một
 * việc: đổi URL; server component đọc lại `searchParams` rồi fetch (spec P4b
 * §2.2), không có state danh sách nào ở client.
 */
const t = messages.admin.tours.list;

/**
 * Ba tab = ba trạng thái của cờ `isPublished`. Value trên tab là CHUỖI
 * ('true'/'false'/ALL) vì `StatusFilterTabs` nói bằng chuỗi; chỗ đổi ngược về
 * boolean là `go()` bên dưới, một chỗ duy nhất (nếp `/subscribers`).
 */
const TAB_ITEMS = [
  { label: t.statusAll, value: ALL, icon: ListIcon },
  { label: t.statusLive, value: 'true', icon: ShoppingBagIcon },
  { label: t.statusDraft, value: 'false', icon: CircleSlashIcon },
];

export function ToursStatusTabs({ query }: { query: ToursQuery }) {
  const router = useRouter();
  const value = query.isPublished === undefined ? ALL : String(query.isPublished);

  function go(next: string) {
    // Value lạ từ Select/Tabs rơi êm về "All" thay vì ném giữa event handler
    // (nếp bookings, review F1).
    const isPublished = next === 'true' ? true : next === 'false' ? false : null;
    router.push(toursHref(query, { isPublished }));
  }

  return (
    <StatusFilterTabs
      items={TAB_ITEMS}
      value={value}
      label={t.statusLabel}
      selectId="tours-status-selector"
      onSelect={go}
    />
  );
}

/**
 * Lọc theo danh mục — kit `ToolbarFilterMenu`.
 *
 * Danh sách mục đến từ `admin.categories.list` — endpoint ADMIN, trả CẢ danh
 * mục đã tắt. Đổi nguồn ở P4e-2 (22/09) đúng như bản P4e-1 đã hẹn: từ F14
 * admin có nút Hide, mà đường công khai chỉ trả hàng đang bật, nên ẩn một danh
 * mục là mất luôn cách lọc ra các tour thuộc nó để đi sửa.
 *
 * Mục TẠM (`unknownItem`) vẫn giữ: nó đỡ ca `?category=<uuid>` gõ tay và ca
 * lời gọi danh mục hỏng (khi ấy danh sách rỗng, xem `fetchTourCategories`).
 */
export function ToursCategoryMenu({
  query,
  categories,
}: {
  query: ToursQuery;
  categories: readonly TourCategoryOption[];
}) {
  const router = useRouter();
  const current = query.categoryId;
  const known = categories.find((category) => category.id === current);

  const groups: ToolbarFilterMenuGroup[] =
    categories.length > 0
      ? [
          {
            key: 'categories',
            items: categories.map((category) => ({
              label: categoryOptionLabel(category),
              value: toFreeValue(category.id),
              icon: TagIcon,
            })),
          },
        ]
      : [];

  return (
    <ToolbarFilterMenu
      label={t.categoryLabel}
      value={current === undefined ? ALL : toFreeValue(current)}
      allItem={{ value: ALL, label: t.categoryAll, icon: TagsIcon }}
      // Đang lọc theo một danh mục không có trong danh sách (đã tắt, hoặc
      // `?category=` gõ tay): bày một mục tạm mang chính uuid, không thì nút
      // nói "All categories" trong khi bảng đang lọc thật.
      unknownItem={
        current !== undefined && !known
          ? { label: current, value: toFreeValue(current), icon: CircleQuestionMarkIcon }
          : undefined
      }
      groups={groups}
      onSelect={(next) => router.push(toursHref(query, { categoryId: fromFreeValue(next) }))}
    />
  );
}

/**
 * Chọn KHOẢNG ĐẾM của cột "Open departures" — không phải một bộ lọc hàng.
 *
 * Mục "tất cả" ở đây là "Upcoming" (từ hôm nay trở đi), khác hẳn ô tháng của
 * `/reports` vốn cố ý KHÔNG có mục tất cả: một báo cáo luôn thuộc đúng một
 * tháng, còn "chuyến sắp tới" là câu hỏi mặc định của màn này.
 *
 * Separator cắt ở mỗi lần đổi năm (`groupMonthOptions`, logic thuần có test) —
 * dải 12 tháng tới gần như luôn vắt qua hai năm.
 */
export function ToursMonthMenu({ query, options }: { query: ToursQuery; options: MonthOption[] }) {
  const router = useRouter();

  const groups: ToolbarFilterMenuGroup[] = groupMonthOptions(options).map((group) => ({
    key: group.key,
    items: group.months.map((option) => ({ ...option, icon: CalendarIcon })),
  }));

  return (
    <ToolbarFilterMenu
      label={t.monthLabel}
      value={query.month ?? ALL}
      allItem={{ value: ALL, label: t.monthUpcoming, icon: CalendarClockIcon }}
      groups={groups}
      onSelect={(next) => {
        if (next === ALL) {
          router.push(toursHref(query, { month: null }));
          return;
        }
        // `safeParse` chứ không `parse`: tháng lạ dừng ở đây, không đẩy tiếp
        // lên URL (nếp bookings, review F1).
        const parsed = CalendarMonthSchema.safeParse(next);
        if (parsed.success) router.push(toursHref(query, { month: parsed.data }));
      }}
    />
  );
}

/**
 * Nút xoá của hàng điều khiển `/tours` — vỏ mỏng quanh kit
 * `ToolbarClearFilters`, xem JSDoc ở đó cho luật chung.
 *
 * KHÔNG đụng dải tab trạng thái (`isPublished`): nó nằm ở khe `views` và tự
 * đã có mục "All" — cùng lý do với `/subscribers`.
 *
 * Hai href đều GHIM `page: 1`: không ghim thì từ trang 2 trở đi chúng khác
 * nhau chỉ vì `page` và nút không bao giờ tự ẩn.
 */
export function ToursClearFilters({ query }: { query: ToursQuery }) {
  const router = useRouter();

  return (
    <ToolbarClearFilters
      label={messages.admin.table.clearFilters}
      href={clearFiltersHref(
        toursHref(query, { categoryId: null, month: null, page: 1 }),
        toursHref(query, { page: 1 }),
      )}
      onNavigate={router.push}
    />
  );
}
