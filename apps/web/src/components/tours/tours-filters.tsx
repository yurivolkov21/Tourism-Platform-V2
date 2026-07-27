'use client';

import { messages } from '@tourism/i18n';
import { Checkbox } from '@tourism/ui/components/checkbox';
import { MinusIcon, PlusIcon } from 'lucide-react';
import { useId, useState } from 'react';
import type { DurationBucket, PriceBucket, TourFilterState } from '@/lib/tours';
import type { MockDestination, MockTourCard } from '@/mocks/types';

type Difficulty = NonNullable<MockTourCard['difficulty']>;

/** Khoá facet dạng mảng — `featured` tách riêng vì nó là công tắc boolean. */
export type FacetKey = 'categories' | 'destinations' | 'durations' | 'prices' | 'difficulties';

const DURATIONS: DurationBucket[] = ['1', '2-3', '4+'];
const PRICES: PriceBucket[] = ['<100', '100-300', '300+'];
const DIFFICULTIES: Difficulty[] = ['EASY', 'MODERATE', 'CHALLENGING'];

interface Option {
  value: string;
  label: string;
  /** Số tour khớp option này trong TOÀN BỘ catalogue — không phải trong kết quả
      đang lọc. Đếm theo kết quả sẽ về 0 ngay khi chọn facet khác và người dùng
      tưởng option đó hỏng. */
  count?: number;
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
            return (
              <li key={option.value} className="flex items-center gap-2.5">
                <Checkbox
                  id={id}
                  checked={selected.includes(option.value)}
                  onCheckedChange={() => onToggle(option.value)}
                />
                <label
                  htmlFor={id}
                  className="flex flex-1 cursor-pointer items-center justify-between gap-2 text-sm text-foreground/90 transition-colors hover:text-foreground"
                >
                  {/* Nhãn giới hạn MỘT dòng: tên destination dài không được đẩy
                      số đếm rơi xuống hàng và phá nhịp dọc của sidebar. */}
                  <span className="line-clamp-1">{option.label}</span>
                  {option.count !== undefined ? (
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {option.count}
                    </span>
                  ) : null}
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
 * Hai nhóm cuối (Price, Pace) và nhóm Duration hiện CHỈ chạy được nhờ lọc
 * client trên mock — `ToursListQuerySchema` không có tham số tương ứng. Xem nợ
 * mở rộng contract trong spec §8 trước khi wire API.
 */
export function ToursFilters({
  value,
  onToggle,
  onToggleFeatured,
  onClearAll,
  categoryOptions,
  destinations,
  activeCount,
}: {
  value: TourFilterState;
  onToggle: (facet: FacetKey, optionValue: string) => void;
  onToggleFeatured: () => void;
  onClearAll: () => void;
  categoryOptions: { slug: string; name: string; count: number }[];
  destinations: MockDestination[];
  activeCount: number;
}) {
  const t = messages.toursPage;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-medium">{t.filtersLabel}</h2>
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
        options={categoryOptions.map((c) => ({ value: c.slug, label: c.name, count: c.count }))}
        selected={value.categories}
        onToggle={(v) => onToggle('categories', v)}
      />
      <FacetGroup
        heading={t.facets.destination}
        options={destinations.map((d) => ({ value: d.slug, label: d.name }))}
        selected={value.destinations}
        onToggle={(v) => onToggle('destinations', v)}
      />
      <FacetGroup
        heading={t.facets.duration}
        options={DURATIONS.map((d) => ({ value: d, label: t.durationLabels[d] }))}
        selected={value.durations}
        onToggle={(v) => onToggle('durations', v)}
      />
      <FacetGroup
        heading={t.facets.price}
        options={PRICES.map((p) => ({ value: p, label: t.priceLabels[p] }))}
        selected={value.prices}
        onToggle={(v) => onToggle('prices', v)}
      />
      <FacetGroup
        heading={t.facets.difficulty}
        options={DIFFICULTIES.map((d) => ({ value: d, label: t.difficultyLabels[d] }))}
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
            onCheckedChange={onToggleFeatured}
          />
          <label
            htmlFor="tours-featured"
            className="cursor-pointer text-sm text-foreground/90 transition-colors hover:text-foreground"
          >
            {t.featuredLabel}
          </label>
        </div>
      </div>
    </div>
  );
}
