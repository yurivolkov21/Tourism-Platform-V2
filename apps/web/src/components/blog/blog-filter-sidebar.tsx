'use client';

import { Input } from '@tourism/ui/components/input';
import { cn } from '@tourism/ui/lib/utils';
import { CheckIcon, SearchIcon, XIcon } from 'lucide-react';
import type { FacetCounts, TagLike } from '@/lib/blog';

/**
 * Sidebar lọc /blog — dựng theo wireframe đã duyệt
 * (`docs/design/mockups/blog-filter-sidebar.src.html`, khung xương mượn từ
 * ReUI filter-sidebar-1, chất liệu là token dự án).
 *
 * ── Bỏ gì so với mẫu ReUI, và vì sao ──
 * · Price/Color/Size → blog không có trục nào tương ứng.
 * · Footer "Apply filters"/"Reset" → trang lọc TỨC THÌ; thêm nút Apply là bắt
 *   người dùng thêm một cú bấm cho thứ vốn tự chạy. "Reset" cũng trùng
 *   "Clear all" ở header.
 * · Section tác giả → dữ liệu thật chỉ có ĐÚNG MỘT tác giả.
 *
 * ── Hai cột + cuộn ──
 * Lựa chọn xếp lưới 2 cột (góp ý user): panel từ 746 xuống 522px. Nhưng 2 cột
 * chỉ chia đôi chiều cao, không giải được "50 tag" — nên quá `SCROLL_AFTER`
 * mục thì section chặn cao và cuộn tại chỗ. Dưới ngưỡng KHÔNG bật cuộn: không
 * ai phải cuộn để thấy thứ vốn đã vừa màn hình.
 */

/** Quá số này thì section chặn cao và cuộn. 14 = 7 hàng × 2 cột, ≈ 220px. */
const SCROLL_AFTER = 14;

function FacetSection({
  title,
  tags,
  counts,
  selected,
  onToggle,
}: {
  title: string;
  tags: readonly TagLike[];
  counts: FacetCounts;
  selected: readonly string[];
  onToggle: (slug: string) => void;
}) {
  if (tags.length === 0) return null;
  const scrolls = tags.length > SCROLL_AFTER;
  // id phải kèm tên nhóm: 'sa-pa' có thể xuất hiện ở cả hai section, trùng id
  // thì label trỏ nhầm ô của section kia.
  const inputId = (slug: string) => `facet-${title.toLowerCase()}-${slug}`;

  const list = (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
      {tags.map((tag) => {
        const on = selected.includes(tag.slug);
        const n = counts.get(tag.slug);
        // Mục hết bài thì LÀM MỜ chứ không giấu: giấu thì danh sách nhảy chồm
        // mỗi lần tick, và người đọc mất cảm giác về hình dạng dữ liệu.
        const empty = n === 0 && !on;
        return (
          <li
            key={tag.slug}
            className={cn('flex min-w-0 items-center gap-2.5', empty && 'opacity-40')}
          >
            {/* Input là ANH EM của label, ghép bằng id/htmlFor — KHÔNG lồng
                input vào trong label của chính nó. Lồng vào thì một cú click
                kích hoạt hai lần (trực tiếp + label chuyển tiếp), hàm toggle
                chạy đôi và kết quả về đúng chỗ cũ: giao diện trông như bấm
                không ăn. Đã dính đúng lỗi này lúc dựng 17/08. */}
            <input
              id={inputId(tag.slug)}
              type="checkbox"
              checked={on}
              onChange={() => onToggle(tag.slug)}
              className="peer sr-only"
            />
            <label
              htmlFor={inputId(tag.slug)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-[18px] shrink-0 items-center justify-center rounded-(--radius) border transition-colors',
                  on ? 'border-primary bg-primary' : 'border-border',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
                )}
              >
                {on ? (
                  <CheckIcon className="size-3 text-primary-foreground" strokeWidth={3} />
                ) : null}
              </span>
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2 text-sm">
                <span className="truncate">{tag.name}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">{n}</span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );

  return (
    // `fieldset` + `legend` chứ không phải `div role="group"`: đây đúng nghĩa
    // là một nhóm ô chọn của form, và thẻ ngữ nghĩa thật thì trình đọc màn
    // hình đọc được tên nhóm mà không cần `aria-label` bù.
    <fieldset className="flex flex-col gap-3.5 px-5">
      <legend className="flex w-full items-baseline justify-between">
        <span className="text-sm leading-5 font-semibold">{title}</span>
        {scrolls ? <span className="text-xs text-muted-foreground">{tags.length} tags</span> : null}
      </legend>
      {scrolls ? (
        <div
          // biome-ignore lint/a11y/noNoninteractiveTabindex: WCAG 2.1.1 — vùng CUỘN bắt buộc thao tác được bằng bàn phím; không có tabIndex thì người dùng bàn phím không có cách nào tới các tag nằm dưới vạch cắt 220px. Luật này nhắm vào tabIndex rải bừa lên phần tử tĩnh, đây là ngoại lệ chính danh của nó.
          tabIndex={0}
          className="max-h-[220px] overflow-y-auto pr-1.5 [mask-image:linear-gradient(to_bottom,#000_86%,transparent)] focus-visible:ring-2 focus-visible:ring-ring"
        >
          {list}
        </div>
      ) : (
        list
      )}
    </fieldset>
  );
}

export function BlogFilterSidebar({
  topics,
  places,
  topicCounts,
  placeCounts,
  selectedTopics,
  selectedPlaces,
  query,
  onToggleTopic,
  onTogglePlace,
  onQueryChange,
  onClearAll,
  resultCount,
}: {
  topics: readonly TagLike[];
  places: readonly TagLike[];
  topicCounts: FacetCounts;
  placeCounts: FacetCounts;
  selectedTopics: readonly string[];
  selectedPlaces: readonly string[];
  query: string;
  onToggleTopic: (slug: string) => void;
  onTogglePlace: (slug: string) => void;
  onQueryChange: (value: string) => void;
  onClearAll: () => void;
  /** Số bài sau lọc — hiện ở hàng đầu cạnh "Filters" (dời từ dòng riêng trên
      lưới, 19/08 theo góp ý user). `aria-live` để trình đọc màn hình nghe số
      đổi khi tick. */
  resultCount: number;
}) {
  const byName = (slugs: readonly string[], pool: readonly TagLike[]) =>
    slugs.map((s) => pool.find((t) => t.slug === s)).filter((t): t is TagLike => Boolean(t));
  const activeChips = [
    ...byName(selectedTopics, topics).map((t) => ({ ...t, onRemove: () => onToggleTopic(t.slug) })),
    ...byName(selectedPlaces, places).map((t) => ({ ...t, onRemove: () => onTogglePlace(t.slug) })),
  ];
  const anyActive = activeChips.length > 0 || query.trim().length > 0;

  return (
    <aside className="w-full lg:w-96 lg:shrink-0">
      <div className="flex flex-col rounded-2xl border bg-card shadow-(--shadow-card)">
        <div className="flex items-center justify-between gap-3 px-5 pt-5">
          <div className="flex items-baseline gap-2">
            <h2 className="text-base leading-6 font-semibold">Filters</h2>
            <span aria-live="polite" className="text-[13px] text-muted-foreground tabular-nums">
              {resultCount} {resultCount === 1 ? 'story' : 'stories'}
            </span>
          </div>
          {anyActive ? (
            <button
              type="button"
              onClick={onClearAll}
              className="cursor-pointer text-[13px] text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          ) : null}
        </div>

        <div className="px-5 pt-4">
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-4 z-10 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search the journal…"
              aria-label="Search journal posts by title or summary"
              className="h-11 rounded-full bg-background pr-4 pl-11 text-sm"
            />
          </div>
        </div>

        {/* Hàng chip ĐANG LỌC — món giá trị nhất mượn từ ReUI. Chip cũ của
            /blog vừa là bộ chọn vừa là trạng thái, nên không chỗ nào nói rõ
            "đang lọc những gì" một cách tách bạch. */}
        {activeChips.length > 0 ? (
          <div className="flex flex-wrap gap-2 px-5 pt-4">
            {activeChips.map((chip) => (
              <button
                key={chip.slug}
                type="button"
                onClick={chip.onRemove}
                aria-label={`Remove filter ${chip.name}`}
                className="inline-flex h-[30px] cursor-pointer items-center gap-2 rounded-full border border-primary bg-primary px-3 text-[13px] font-medium text-primary-foreground"
              >
                {chip.name}
                <XIcon className="size-3 opacity-80" aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : null}

        <div className="px-5 py-5">
          <span aria-hidden="true" className="block h-px bg-border" />
        </div>

        <FacetSection
          title="Topic"
          tags={topics}
          counts={topicCounts}
          selected={selectedTopics}
          onToggle={onToggleTopic}
        />

        {places.length > 0 ? (
          <>
            <div className="px-5 py-5">
              <span aria-hidden="true" className="block h-px bg-border" />
            </div>
            <FacetSection
              title="Place"
              tags={places}
              counts={placeCounts}
              selected={selectedPlaces}
              onToggle={onTogglePlace}
            />
          </>
        ) : null}

        <div className="pb-5" />
      </div>
    </aside>
  );
}
