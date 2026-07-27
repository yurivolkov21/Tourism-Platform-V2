'use client';

import { messages } from '@tourism/i18n';
import { Checkbox } from '@tourism/ui/components/checkbox';
import { MinusIcon, PlusIcon } from 'lucide-react';
import { useId, useState } from 'react';
import type { ArrayFacetKey, DurationBucket, PriceBucket, TourFilterState } from '@/lib/tours';
import type { MockDestination, MockTourCard } from '@/mocks/types';

type Difficulty = NonNullable<MockTourCard['difficulty']>;

export type FacetKey = ArrayFacetKey;

/** Số kết quả mỗi option sẽ cho, tính ở tầng cha bằng `facetOptionCounts`. */
export interface FacetCounts {
  categories: Record<string, number>;
  destinations: Record<string, number>;
  durations: Record<string, number>;
  prices: Record<string, number>;
  difficulties: Record<string, number>;
  featured: number;
}

const DURATIONS: DurationBucket[] = ['1', '2-3', '4+'];
const PRICES: PriceBucket[] = ['<100', '100-300', '300+'];
const DIFFICULTIES: Difficulty[] = ['EASY', 'MODERATE', 'CHALLENGING'];

interface Option {
  value: string;
  label: string;
  count: number;
}

/** Phần đuôi CHỈ trình đọc màn hình nghe được, gắn vào cuối <label>.
 *
 * Không có nó thì hai <span> cạnh nhau dính thành "Cruises3" — trình đọc màn
 * hình phát ra đúng chuỗi đó. Và KHÔNG chữa bằng aria-label trên <Checkbox>:
 * Base UI tự nối aria-labelledby tới <label>, nên aria-label không thắng; còn
 * aria-hidden nội dung label thì tên trợ năng thành RỖNG (đã thử, tệ hơn). */
function countSuffix(count: number): string {
  return `, ${count} ${count === 1 ? 'tour' : 'tours'}`;
}

/** Một nhóm facet: tiêu đề bấm mở/đóng + danh sách checkbox.
 *
 * MỞ SẴN, khác Nexora (họ đóng hết "to save space"). Lý do đổi: cả lý do tồn
 * tại của sidebar so với thanh lọc ngang là thấy được lựa chọn mà không phải
 * bấm. Sáu nhóm đóng hết thì sidebar chỉ còn sáu dòng tiêu đề — tệ hơn cả
 * thanh ngang. Vẫn thu lại được từng nhóm, và cả sidebar cũng thu được. */
function FacetGroup({
  heading,
  options,
  selected,
  onToggle,
}: {
  heading: string;
  options: Option[];
  selected: readonly string[];
  onToggle: (value: string) => void;
}) {
  const activeInGroup = options.filter((o) => selected.includes(o.value)).length;
  const [open, setOpen] = useState(true);
  const panelId = useId();

  return (
    <div className="border-b border-border pb-5 last:border-b-0 last:pb-0">
      <h3>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full cursor-pointer items-center justify-between gap-2 text-foreground"
        >
          <span className="font-mono text-xs font-medium tracking-widest uppercase">
            {heading}
            {activeInGroup > 0 ? (
              <span className="ml-1.5 text-primary normal-case">({activeInGroup})</span>
            ) : null}
          </span>
          {open ? (
            <MinusIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <PlusIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
        </button>
      </h3>

      {open ? (
        <ul id={panelId} className="mt-3.5 space-y-2.5">
          {options.map((option) => {
            const id = `${panelId}-${option.value}`;
            const checked = selected.includes(option.value);
            // Option ra 0 kết quả bị vô hiệu hoá — chặn ngõ cụt "bấm thêm một ô
            // rồi trắng trang". KHÔNG vô hiệu hoá option đang bật, nếu không
            // người dùng tự khoá mình lại không bỏ chọn được.
            const dead = option.count === 0 && !checked;
            return (
              <li key={option.value} className="flex items-center gap-2.5">
                <Checkbox
                  id={id}
                  checked={checked}
                  disabled={dead}
                  onCheckedChange={() => onToggle(option.value)}
                />
                <label
                  htmlFor={id}
                  className={`flex flex-1 items-center justify-between gap-2 text-sm transition-colors ${
                    dead
                      ? 'cursor-not-allowed text-muted-foreground/45'
                      : 'cursor-pointer text-foreground/90 hover:text-foreground'
                  }`}
                >
                  {/* Nhãn giới hạn MỘT dòng: tên destination dài không được đẩy
                      số đếm rơi xuống hàng và phá nhịp dọc của sidebar. */}
                  <span className="line-clamp-1">{option.label}</span>
                  <span className="sr-only">{countSuffix(option.count)}</span>
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-xs text-muted-foreground tabular-nums"
                  >
                    {option.count}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Sáu nhóm facet dùng chung cho sidebar desktop và drawer mobile.
 *
 * Duration · Price · Pace hiện CHỈ chạy được nhờ lọc client trên mock —
 * `ToursListQuerySchema` không có tham số tương ứng. Xem nợ mở rộng contract
 * trong spec §8 trước khi wire API.
 */
export function ToursFilters({
  value,
  counts,
  onToggle,
  onToggleFeatured,
  onClearAll,
  categoryOptions,
  destinations,
  activeCount,
}: {
  value: TourFilterState;
  counts: FacetCounts;
  onToggle: (facet: FacetKey, optionValue: string) => void;
  onToggleFeatured: () => void;
  onClearAll: () => void;
  categoryOptions: { slug: string; name: string }[];
  destinations: MockDestination[];
  activeCount: number;
}) {
  const t = messages.toursPage;
  const featuredDead = counts.featured === 0 && !value.featured;

  return (
    <div className="space-y-5">
      {/* Header DÍNH trong vùng cuộn của sidebar: ở Nexora, cuộn xuống nhóm
          Price là nút "Clear all" trôi mất khỏi màn hình. Nền đặc để nội dung
          cuộn bên dưới không lộ qua. */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-background pb-3">
        <h2 className="font-heading text-lg font-medium">
          {t.filtersLabel}
          {activeCount > 0 ? (
            <span className="ml-1.5 text-primary text-sm">({activeCount})</span>
          ) : null}
        </h2>
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={onClearAll}
            className="cursor-pointer text-sm font-medium text-primary hover:underline"
          >
            {t.clearAll}
          </button>
        ) : null}
      </div>

      <FacetGroup
        heading={t.facets.category}
        options={categoryOptions.map((c) => ({
          value: c.slug,
          label: c.name,
          count: counts.categories[c.slug] ?? 0,
        }))}
        selected={value.categories}
        onToggle={(v) => onToggle('categories', v)}
      />
      <FacetGroup
        heading={t.facets.destination}
        options={destinations.map((d) => ({
          value: d.slug,
          label: d.name,
          count: counts.destinations[d.slug] ?? 0,
        }))}
        selected={value.destinations}
        onToggle={(v) => onToggle('destinations', v)}
      />
      <FacetGroup
        heading={t.facets.duration}
        options={DURATIONS.map((d) => ({
          value: d,
          label: t.durationLabels[d],
          count: counts.durations[d] ?? 0,
        }))}
        selected={value.durations}
        onToggle={(v) => onToggle('durations', v)}
      />
      <FacetGroup
        heading={t.facets.price}
        options={PRICES.map((p) => ({
          value: p,
          label: t.priceLabels[p],
          count: counts.prices[p] ?? 0,
        }))}
        selected={value.prices}
        onToggle={(v) => onToggle('prices', v)}
      />
      <FacetGroup
        heading={t.facets.difficulty}
        options={DIFFICULTIES.map((d) => ({
          value: d,
          label: t.difficultyLabels[d],
          count: counts.difficulties[d] ?? 0,
        }))}
        selected={value.difficulties}
        onToggle={(v) => onToggle('difficulties', v)}
      />

      {/* Featured là công tắc đơn nên không dùng FacetGroup — vẫn giữ hình dạng
          checkbox để mắt đọc sidebar thấy một mạch. */}
      <div className="border-b border-border pb-5 last:border-b-0 last:pb-0">
        <h3 className="font-mono text-xs font-medium tracking-widest text-foreground uppercase">
          {t.facets.highlights}
        </h3>
        <div className="mt-3.5 flex items-center gap-2.5">
          <Checkbox
            id="tours-featured"
            checked={value.featured}
            disabled={featuredDead}
            onCheckedChange={onToggleFeatured}
          />
          <label
            htmlFor="tours-featured"
            className={`flex flex-1 items-center justify-between gap-2 text-sm transition-colors ${
              featuredDead
                ? 'cursor-not-allowed text-muted-foreground/45'
                : 'cursor-pointer text-foreground/90 hover:text-foreground'
            }`}
          >
            <span className="line-clamp-1">{t.featuredLabel}</span>
            <span className="sr-only">{countSuffix(counts.featured)}</span>
            <span
              aria-hidden="true"
              className="shrink-0 text-xs text-muted-foreground tabular-nums"
            >
              {counts.featured}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
