'use client';

import { messages } from '@tourism/i18n';
import { Checkbox } from '@tourism/ui/components/checkbox';
import type { ReactNode } from 'react';
import { useState } from 'react';
import type { DestinationVM, TourCardVM } from '@/lib/api/tours';
import type { ArrayFacetKey, DurationBucket, PriceBucket, TourFilterState } from '@/lib/tours';

type Difficulty = NonNullable<TourCardVM['difficulty']>;

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

/** Số option hiện trước khi phải bấm "Show all" — chỉ áp cho danh sách dài. */
const COLLAPSED_OPTIONS = 6;

interface Option {
  value: string;
  label: string;
  count: number;
}

/** Đuôi CHỈ trình đọc màn hình nghe được, gắn cuối nhãn.
 *
 * Không có nó thì nhãn và số đếm dính thành "Cruises3". Và KHÔNG chữa bằng
 * `aria-label` trên `<Checkbox>`: Base UI tự nối `aria-labelledby` tới `<label>`
 * nên aria-label không thắng; còn `aria-hidden` nội dung label thì tên trợ năng
 * thành RỖNG (đã thử, tệ hơn). */
function countSuffix(count: number): string {
  return `, ${count} ${count === 1 ? 'tour' : 'tours'}`;
}

/**
 * Vỏ một nhóm facet: thẻ có viền, tiêu đề ngăn bằng đường kẻ chạy hết mép thẻ.
 *
 * Mượn Drawer 01 (shadcnspace) — bọc cả nhóm trong MỘT thẻ rồi chia hàng bằng
 * `border-b` bên trong, thay vì thả `Separator` rời giữa các nhóm như Sheet 04.
 * Với 6 nhóm thì mắt cần biết nhóm bắt đầu và kết thúc ở đâu; viền bao làm việc
 * đó, đường kẻ rời thì không.
 */
function FacetCard({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border">
      <h3 className="border-b bg-muted/30 px-4 py-2.5 font-mono text-xs font-medium tracking-widest text-muted-foreground uppercase">
        {heading}
      </h3>
      {children}
    </section>
  );
}

/** Hàng checkbox — CẢ HÀNG là vùng bấm (mượn Drawer 01), không chỉ ô vuông. */
function OptionRow({
  option,
  checked,
  last,
  onToggle,
}: {
  option: Option;
  checked: boolean;
  last: boolean;
  onToggle: () => void;
}) {
  // Option ra 0 kết quả bị khoá — chặn ngõ cụt "bấm thêm một ô rồi trắng trang".
  // KHÔNG khoá option đang bật, nếu không người dùng tự nhốt mình.
  const dead = option.count === 0 && !checked;
  const id = `facet-${option.value}`;

  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
        last ? '' : 'border-b'
      } ${
        dead
          ? 'cursor-not-allowed text-muted-foreground/45'
          : 'cursor-pointer text-foreground/90 hover:bg-muted/40'
      }`}
    >
      <Checkbox id={id} checked={checked} disabled={dead} onCheckedChange={onToggle} />
      <span className="line-clamp-1 flex-1">{option.label}</span>
      <span className="sr-only">{countSuffix(option.count)}</span>
      {/* Số đếm giữ cột cố định bên phải — mắt quét cột này để biết chọn thêm
          gì còn ra kết quả. Vẫn hiện số 0 chứ không ẩn option: ẩn đi thì danh
          sách đổi chiều cao mỗi lần lọc, gây mất phương hướng. */}
      <span aria-hidden="true" className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {option.count}
      </span>
    </label>
  );
}

/** Danh sách dài (Category, Destination) — hàng checkbox xếp dọc, có "Show all". */
function OptionList({
  options,
  selected,
  onToggle,
}: {
  options: Option[];
  selected: readonly string[];
  onToggle: (value: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  // Option đang bật luôn phải thấy được, kể cả khi nó nằm ngoài 6 mục đầu —
  // nếu không, chip hiện ở thanh kết quả mà không tìm ra ô nào để bỏ chọn.
  const hasHiddenActive = options.slice(COLLAPSED_OPTIONS).some((o) => selected.includes(o.value));
  const expanded = showAll || hasHiddenActive;
  const visible = expanded ? options : options.slice(0, COLLAPSED_OPTIONS);
  const canCollapse = expanded && !hasHiddenActive;
  const hiddenCount = options.length - visible.length;
  const hasFooterRow = hiddenCount > 0 || canCollapse;

  return (
    <div>
      {visible.map((option, i) => (
        <OptionRow
          key={option.value}
          option={option}
          checked={selected.includes(option.value)}
          last={i === visible.length - 1 && !hasFooterRow}
          onToggle={() => onToggle(option.value)}
        />
      ))}
      {hasFooterRow ? (
        <button
          type="button"
          onClick={() => setShowAll(!expanded)}
          className="w-full cursor-pointer px-4 py-2.5 text-left text-sm font-medium text-primary-emphasis hover:bg-muted/40"
        >
          {hiddenCount > 0 ? `Show all ${options.length}` : 'Show less'}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Danh sách ngắn (Duration, Price, Pace) — hàng pill thay vì checkbox dọc.
 *
 * Ba lựa chọn xếp dọc tốn ba hàng cho một quyết định đơn giản; pill gói chúng
 * vào 1–2 hàng và tách thị giác "chọn một khoảng" khỏi "chọn từ danh sách".
 * Mẫu Category Filter 6 (shadcnstudio) làm đúng vậy.
 *
 * Vẫn là ĐA CHỌN: `aria-pressed` chứ không phải radio.
 */
function OptionPills({
  options,
  selected,
  onToggle,
}: {
  options: Option[];
  selected: readonly string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 p-3">
      {options.map((option) => {
        const checked = selected.includes(option.value);
        const dead = option.count === 0 && !checked;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            aria-pressed={checked}
            disabled={dead}
            aria-label={`${option.label}${countSuffix(option.count)}`}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors ${
              checked
                ? 'border-primary bg-primary text-primary-foreground'
                : dead
                  ? 'cursor-not-allowed border-border text-muted-foreground/45'
                  : 'border-border text-foreground/90 hover:bg-muted/40'
            }`}
          >
            <span aria-hidden="true">{option.label}</span>
            <span aria-hidden="true" className="ml-1.5 text-xs opacity-70 tabular-nums">
              {option.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Thân bộ lọc — dùng chung cho drawer ở MỌI kích thước màn hình.
 *
 * Không còn biến thể sidebar: bố cục hai cột làm trang tour trông như trang
 * quản trị và làm hero mất trọng lượng ở cả light lẫn dark (spec §5.1).
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
  categoryOptions,
  destinations,
}: {
  value: TourFilterState;
  counts: FacetCounts;
  onToggle: (facet: FacetKey, optionValue: string) => void;
  onToggleFeatured: () => void;
  categoryOptions: { slug: string; name: string }[];
  destinations: DestinationVM[];
}) {
  const t = messages.toursPage;

  return (
    <div className="space-y-4">
      <FacetCard heading={t.facets.category}>
        <OptionList
          options={categoryOptions.map((c) => ({
            value: c.slug,
            label: c.name,
            count: counts.categories[c.slug] ?? 0,
          }))}
          selected={value.categories}
          onToggle={(v) => onToggle('categories', v)}
        />
      </FacetCard>

      <FacetCard heading={t.facets.destination}>
        <OptionList
          options={destinations.map((d) => ({
            value: d.slug,
            label: d.name,
            count: counts.destinations[d.slug] ?? 0,
          }))}
          selected={value.destinations}
          onToggle={(v) => onToggle('destinations', v)}
        />
      </FacetCard>

      <FacetCard heading={t.facets.duration}>
        <OptionPills
          options={DURATIONS.map((d) => ({
            value: d,
            label: t.durationLabels[d],
            count: counts.durations[d] ?? 0,
          }))}
          selected={value.durations}
          onToggle={(v) => onToggle('durations', v)}
        />
      </FacetCard>

      <FacetCard heading={t.facets.price}>
        <OptionPills
          options={PRICES.map((p) => ({
            value: p,
            label: t.priceLabels[p],
            count: counts.prices[p] ?? 0,
          }))}
          selected={value.prices}
          onToggle={(v) => onToggle('prices', v)}
        />
      </FacetCard>

      <FacetCard heading={t.facets.difficulty}>
        <OptionPills
          options={DIFFICULTIES.map((d) => ({
            value: d,
            label: t.difficultyLabels[d],
            count: counts.difficulties[d] ?? 0,
          }))}
          selected={value.difficulties}
          onToggle={(v) => onToggle('difficulties', v)}
        />
      </FacetCard>

      <FacetCard heading={t.facets.highlights}>
        <OptionRow
          option={{ value: 'featured', label: t.featuredLabel, count: counts.featured }}
          checked={value.featured}
          last
          onToggle={onToggleFeatured}
        />
      </FacetCard>
    </div>
  );
}
