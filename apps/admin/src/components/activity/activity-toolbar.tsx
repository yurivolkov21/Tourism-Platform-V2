'use client';

import {
  ACTIVITY_AREAS,
  type ActivityArea,
  type AdminActivityActorOption,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  CalendarDaysIcon,
  CircleQuestionMarkIcon,
  CompassIcon,
  FileBarChartIcon,
  FileTextIcon,
  ImageIcon,
  LayersIcon,
  MailIcon,
  MapPinIcon,
  MessageSquareIcon,
  PaletteIcon,
  SendIcon,
  ShieldCheckIcon,
  ShieldIcon,
  StarIcon,
  TagsIcon,
  TicketIcon,
  UsersIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL, fromFreeValue, toFreeValue } from '@/components/kit/filter-value';
import { clearFiltersHref, ToolbarClearFilters } from '@/components/kit/toolbar-clear-filters';
import { ToolbarDateRange } from '@/components/kit/toolbar-date-range';
import { ToolbarFilterMenu } from '@/components/kit/toolbar-filter-menu';
import { type ActivityQuery, activityHref, asActivityArea } from '@/lib/activity-query';
import { activityAreaLabel } from '@/lib/activity-view';
import { roleLabel } from '@/lib/role-label';

/**
 * Bốn mẩu điều khiển của `/activity` (ADR-0061, spec §6): People, Area, khoảng ngày và nút xoá
 * lọc. Cả bốn chỉ đổi URL; server component đọc lại `searchParams` rồi fetch.
 */
const t = messages.admin.activity.list;

/** Icon của mỗi khu vực — cùng icon với mục sidebar của nó (chuyến không có mục riêng). */
const AREA_ICONS: Record<ActivityArea, typeof TicketIcon> = {
  bookings: TicketIcon,
  reviews: StarIcon,
  reports: FileBarChartIcon,
  enquiries: MessageSquareIcon,
  subscribers: MailIcon,
  tours: CompassIcon,
  departures: CalendarDaysIcon,
  categories: TagsIcon,
  destinations: MapPinIcon,
  posts: FileTextIcon,
  media: ImageIcon,
  appearance: PaletteIcon,
  outbox: SendIcon,
  users: UsersIcon,
};

/**
 * Người làm: danh sách đến từ chính response (người có trong nhật ký), không phải danh sách tài
 * khoản. Người đang lọc mà rời danh sách (tài khoản vừa bị xoá cứng) vẫn có một mục tạm, để nút
 * không nói "All people" trong khi bảng đang lọc thật — luật của kit.
 */
export function ActivityPeopleMenu({
  query,
  actors,
}: {
  query: ActivityQuery;
  actors: readonly AdminActivityActorOption[];
}) {
  const router = useRouter();
  const current = query.actorId;
  const unknown = current !== undefined && !actors.some((actor) => actor.id === current);

  return (
    <ToolbarFilterMenu
      label={t.peopleLabel}
      value={current === undefined ? ALL : toFreeValue(current)}
      allItem={{ value: ALL, label: t.allPeople, icon: UsersIcon }}
      unknownItem={
        unknown && current !== undefined
          ? { value: toFreeValue(current), label: current, icon: CircleQuestionMarkIcon }
          : undefined
      }
      groups={[
        {
          key: 'people',
          items: actors.map((actor) => ({
            value: toFreeValue(actor.id),
            label: actor.label,
            hint: roleLabel(actor.role),
            icon: actor.role === 'ADMIN' ? ShieldCheckIcon : ShieldIcon,
          })),
        },
      ]}
      onSelect={(next) => router.push(activityHref(query, { actorId: fromFreeValue(next) }))}
    />
  );
}

export function ActivityAreaMenu({ query }: { query: ActivityQuery }) {
  const router = useRouter();
  return (
    <ToolbarFilterMenu
      label={t.areaLabel}
      value={query.area ?? ALL}
      allItem={{ value: ALL, label: t.allAreas, icon: LayersIcon }}
      groups={[
        {
          key: 'areas',
          items: ACTIVITY_AREAS.map((area) => ({
            value: area,
            label: activityAreaLabel(area),
            icon: AREA_ICONS[area],
          })),
        },
      ]}
      // Giá trị lạ (không thể có từ menu) rơi êm về "All areas" thay vì ném giữa event handler.
      onSelect={(next) => router.push(activityHref(query, { area: asActivityArea(next) }))}
    />
  );
}

export function ActivityDateRange({ query }: { query: ActivityQuery }) {
  const router = useRouter();
  return (
    <ToolbarDateRange
      idPrefix="activity"
      label={t.dateFilterLabel}
      from={query.from}
      to={query.to}
      hrefFor={(patch) => activityHref(query, patch)}
      onNavigate={router.push}
    />
  );
}

/** Hai href đều ghim `page: 1`, không thì từ trang 2 trở đi nút không bao giờ tự ẩn. */
export function ActivityClearFilters({ query }: { query: ActivityQuery }) {
  const router = useRouter();
  return (
    <ToolbarClearFilters
      label={messages.admin.table.clearFilters}
      href={clearFiltersHref(
        activityHref(query, { actorId: null, area: null, from: null, to: null, page: 1 }),
        activityHref(query, { page: 1 }),
      )}
      onNavigate={router.push}
    />
  );
}
