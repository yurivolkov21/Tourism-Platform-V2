'use client';

import { messages } from '@tourism/i18n';
import { XIcon } from 'lucide-react';
import type { MockDestination } from '@/mocks/types';

/** Khoá lựa chọn sắp xếp bày ra UI. Ánh xạ sang TourSortKey + order nằm ở
    ToursExplorer — ở đây chỉ là nhãn. Nexora còn "Most popular"/"Top rated";
    bỏ vì ToursListQuerySchema không whitelist rating (nợ ghi trong spec §8). */
export type SortValue = 'newest' | 'priceAsc' | 'priceDesc' | 'durationAsc';

const SORT_ORDER: SortValue[] = ['newest', 'priceAsc', 'priceDesc', 'durationAsc'];

export interface ActiveFilter {
  /** Nhãn hiển thị trên chip, vd "Trekking" hoặc "Sa Pa". */
  label: string;
  onRemove: () => void;
}

// Thanh công cụ DÍNH: chip chuyên mục cuộn ngang + dòng đếm + chip bộ lọc đang
// bật + select destination/sort + toggle featured.
//
// Không dùng sidebar: API chỉ có 3 chiều lọc (category · destination · featured).
// Một rail 280px chứa 3 nhóm là khoảng rỗng trông thấy — Baymard cũng khuyến
// nghị thanh ngang khi ≤8 nhóm filter, sidebar chỉ hợp khi ≥5–10.
//
// Cũng không dùng drawer trên mobile (khác plan ban đầu): với đúng 3 điều khiển
// thì giấu chúng sau một nút là thêm một cú bấm để đổi lấy không gì. Chúng xếp
// dọc và cuộn ngang là đủ.
export function TourToolbar({
  categories,
  destinations,
  activeCategory,
  activeDestination,
  featured,
  sort,
  resultCount,
  activeFilters,
  onSelectCategory,
  onSelectDestination,
  onToggleFeatured,
  onSelectSort,
  onClearAll,
}: {
  categories: { slug: string; name: string; count: number }[];
  destinations: MockDestination[];
  activeCategory?: string;
  activeDestination?: string;
  featured: boolean;
  sort: SortValue;
  resultCount: number;
  activeFilters: ActiveFilter[];
  onSelectCategory: (slug?: string) => void;
  onSelectDestination: (slug?: string) => void;
  onToggleFeatured: () => void;
  onSelectSort: (value: SortValue) => void;
  onClearAll: () => void;
}) {
  const chipBase =
    'shrink-0 cursor-pointer rounded-full border px-4 py-1.5 text-sm transition-colors';

  return (
    <div className="sticky top-(--banner-offset) z-(--z-sticky) -mx-4 border-b bg-background/80 px-4 py-4 backdrop-blur-xl md:-mx-16 md:px-16 lg:-mx-24 lg:px-24 xl:-mx-32 xl:px-32">
      <div className="mx-auto max-w-7xl">
        {/* Hàng 1 — chip chuyên mục, cuộn ngang trên màn hẹp */}
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => onSelectCategory(undefined)}
            aria-pressed={!activeCategory}
            className={`${chipBase} ${
              activeCategory
                ? 'border-border text-muted-foreground hover:bg-muted'
                : 'border-primary bg-primary text-primary-foreground'
            }`}
          >
            {messages.toursPage.allCategories}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => onSelectCategory(cat.slug)}
              aria-pressed={activeCategory === cat.slug}
              // Không để trình đọc màn hình phát ra "Trekking 3" cụt lủn: số
              // đếm nằm trong nút nên nó vào tên trợ năng, phải diễn đạt thành
              // câu. Phần chữ vẫn hiện nguyên cho mắt nhìn.
              aria-label={`${cat.name}, ${cat.count} ${cat.count === 1 ? 'tour' : 'tours'}`}
              className={`${chipBase} ${
                activeCategory === cat.slug
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {cat.name}
              <span className="ml-1.5 text-xs opacity-70 tabular-nums">{cat.count}</span>
            </button>
          ))}
        </div>

        {/* Hàng 2 — đếm + chip đang bật bên trái, điều khiển bên phải */}
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              {messages.toursPage.resultCount(resultCount)}
            </p>

            {activeFilters.map((filter) => (
              <button
                key={filter.label}
                type="button"
                onClick={filter.onRemove}
                aria-label={messages.toursPage.removeFilter(filter.label)}
                className="flex cursor-pointer items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground transition-colors hover:bg-muted"
              >
                {filter.label}
                <XIcon className="size-3" aria-hidden="true" />
              </button>
            ))}

            {activeFilters.length > 0 ? (
              <button
                type="button"
                onClick={onClearAll}
                className="cursor-pointer text-xs font-medium text-primary hover:underline"
              >
                {messages.toursPage.clearAll}
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Select GỐC thay vì Select của Base UI: đây là lựa chọn đơn, native
                cho trợ năng và UX mobile miễn phí, không portal, không JS. */}
            <label className="sr-only" htmlFor="tours-destination">
              {messages.toursPage.facets.destination}
            </label>
            <select
              id="tours-destination"
              value={activeDestination ?? ''}
              onChange={(e) => onSelectDestination(e.target.value || undefined)}
              className="h-9 cursor-pointer rounded-full border bg-background px-3 text-sm text-foreground"
            >
              <option value="">{messages.toursPage.facets.destination}</option>
              {destinations.map((dest) => (
                <option key={dest.slug} value={dest.slug}>
                  {dest.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onToggleFeatured}
              aria-pressed={featured}
              className={`h-9 cursor-pointer rounded-full border px-4 text-sm transition-colors ${
                featured
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {messages.toursPage.featuredLabel}
            </button>

            <label className="sr-only" htmlFor="tours-sort">
              {messages.toursPage.sortLabel}
            </label>
            <select
              id="tours-sort"
              value={sort}
              onChange={(e) => onSelectSort(e.target.value as SortValue)}
              className="h-9 cursor-pointer rounded-full border bg-background px-3 text-sm text-foreground"
            >
              {SORT_ORDER.map((value) => (
                <option key={value} value={value}>
                  {messages.toursPage.sortOptions[value]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
