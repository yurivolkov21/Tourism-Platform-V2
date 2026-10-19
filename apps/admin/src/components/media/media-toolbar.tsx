'use client';

import { messages } from '@tourism/i18n';
import {
  CircleHelpIcon,
  CompassIcon,
  FileTextIcon,
  ImagesIcon,
  LayoutGridIcon,
  MapPinIcon,
  PaletteIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { ALL_FILTER_VALUE as ALL } from '@/components/kit/filter-value';
import { TableSearchForm } from '@/components/kit/table-search-form';
import { clearFiltersHref, ToolbarClearFilters } from '@/components/kit/toolbar-clear-filters';
import { ToolbarFilterMenu } from '@/components/kit/toolbar-filter-menu';
import { type MediaQuery, mediaHref, parseMediaShow, parseMediaUsed } from '@/lib/media-query';

/**
 * Hàng điều khiển của tab In use (spec P4f Media §6.2): số ảnh đang hiện bên trái; ô tìm, Used
 * in, Show và nút xoá bộ lọc bên phải — cùng khuôn hàng điều khiển của các bảng admin. Mọi thứ chỉ
 * đổi URL; lưới đọc lại URL rồi lọc.
 */
const t = messages.admin.media;
const f = t.filters;

const USED_ALL = { value: ALL, label: f.usedAll, icon: LayoutGridIcon };
const USED_GROUPS = [
  {
    key: 'used',
    items: [
      { value: 'tours', label: f.used.tours, icon: CompassIcon },
      { value: 'library', label: f.used.library, icon: MapPinIcon },
      { value: 'posts', label: f.used.posts, icon: FileTextIcon },
      { value: 'site', label: f.used.site, icon: PaletteIcon },
    ],
  },
];

const SHOW_ALL = { value: ALL, label: f.showAll, icon: ImagesIcon };
const SHOW_GROUPS = [
  {
    key: 'show',
    items: [
      { value: 'attention', label: f.showAttention, icon: TriangleAlertIcon },
      { value: 'nocredit', label: f.showNoCredit, icon: CircleHelpIcon },
    ],
  },
];

export function MediaToolbar({
  query,
  shownCount,
  totalCount,
  onNavigate,
}: {
  query: MediaQuery;
  shownCount: number;
  totalCount: number;
  onNavigate: (href: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 lg:px-6">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t.count(shownCount, totalCount)}
      </p>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        <TableSearchForm
          inputId="media-search"
          label={f.searchLabel}
          placeholder={f.searchPlaceholder}
          value={query.search}
          onSearch={(term) => onNavigate(mediaHref(query, { search: term }))}
        />
        <ToolbarFilterMenu
          label={f.usedIn}
          value={query.used ?? ALL}
          allItem={USED_ALL}
          groups={USED_GROUPS}
          onSelect={(next) => onNavigate(mediaHref(query, { used: parseMediaUsed(next) }))}
        />
        <ToolbarFilterMenu
          label={f.show}
          value={query.show ?? ALL}
          allItem={SHOW_ALL}
          groups={SHOW_GROUPS}
          onSelect={(next) => onNavigate(mediaHref(query, { show: parseMediaShow(next) }))}
        />
        <ToolbarClearFilters
          label={messages.admin.table.clearFilters}
          href={clearFiltersHref(
            mediaHref(query, { used: null, show: null, search: null }),
            mediaHref(query, {}),
          )}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}
