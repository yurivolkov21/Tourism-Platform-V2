'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BlogFilterSidebar } from '@/components/blog/blog-filter-sidebar';
import { PostCard } from '@/components/blog/post-card';
import { PaginationBar } from '@/components/tours/pagination-bar';
import type { JournalPost } from '@/lib/api/posts';
import {
  facetCounts,
  filterPostsByFacets,
  searchPosts,
  serializeFacetParams,
  sortPostsByDate,
  splitTagFamilies,
  type TagLike,
} from '@/lib/blog';
import { SPRING } from '@/lib/motion';
import { paginate } from '@/lib/paginate';

// Lọc + tìm chạy phía client để gõ tới đâu thấy tới đó, nhưng trạng thái vẫn
// được ghi vào URL (?tag=&q=&page=) nên link chia sẻ được và F5 không mất bộ lọc.
// HTML đầu tiên do server render với ĐÚNG initial* này, nên lần render client đầu
// tiên khớp hệt — không có hydration mismatch.

/**
 * Sáu bài mỗi trang, KHÔNG phải 9 như plan ghi.
 *
 * Lý do: mock có đúng 9 bài, nên `limit = 9` cho `totalPages = 1` và
 * `PaginationBar` tự ẩn (`totalPages <= 1` → không render) — tức là ship một
 * tính năng không bao giờ chạy và không ai kiểm được. Sáu thì trang 2 là THẬT
 * (6 + 3). Đây đúng lý lẽ mà Task 3 đã dùng khi chọn 16 tour cho `limit = 12`:
 * "có đủ 16 tour để limit=12 sinh ra trang 2 thật".
 *
 * Sáu cũng vừa lưới: 2 hàng × 3 cột ở `lg`, 3 hàng × 2 cột ở `sm`.
 */
const PAGE_SIZE = 6;

export function BlogExplorer({
  posts,
  tags,
  destinationSlugs,
  initialTopics,
  initialPlaces,
  initialLegacyTag,
  initialQuery,
  initialPage,
}: {
  posts: JournalPost[];
  /** Nguồn `fetchPostTags()` — hiển thị `name`, URL/so khớp theo `slug`. */
  tags: TagLike[];
  /** Slug địa danh từ `fetchDestinations()` — dùng để tách tag thành hai họ. */
  destinationSlugs: string[];
  initialTopics?: string[];
  initialPlaces?: string[];
  /** `?tag=` của link CŨ; chuẩn hoá về đúng họ ngay lúc mount. */
  initialLegacyTag?: string;
  initialQuery?: string;
  initialPage?: number;
}) {
  const { topics, places } = useMemo(
    () => splitTagFamilies(tags, destinationSlugs),
    [tags, destinationSlugs],
  );

  // Link cũ `?tag=sa-pa` phải chạy tiếp — /blog đã phát hành link dạng đó qua
  // chip, RSS và chia sẻ. Chuẩn hoá về đúng họ NGAY lúc mount thay vì giữ một
  // nhánh lọc riêng: một khi đã vào đúng ô, mọi thứ phía sau chỉ còn một đường.
  const legacy = useMemo(() => {
    if (!initialLegacyTag) return { topics: [] as string[], places: [] as string[] };
    return places.some((t) => t.slug === initialLegacyTag)
      ? { topics: [], places: [initialLegacyTag] }
      : { topics: [initialLegacyTag], places: [] };
  }, [initialLegacyTag, places]);

  const [selectedTopics, setSelectedTopics] = useState<string[]>(
    initialTopics?.length ? initialTopics : legacy.topics,
  );
  const [selectedPlaces, setSelectedPlaces] = useState<string[]>(
    initialPlaces?.length ? initialPlaces : legacy.places,
  );
  const [query, setQuery] = useState(initialQuery ?? '');
  const [page, setPage] = useState(Math.max(1, initialPage ?? 1));

  // Đổi trang qua thanh phân trang → cuộn về ĐẦU LƯỚI (bug user báo 19/08:
  // "sang trang 2 footer bị đẩy lên, lộ khoảng trắng"). Đo bằng Chromium:
  // không phải load chậm — bài đã ở client hết. Lưới co ngay từ 1832 → 829px
  // (trang 2 chỉ 3 bài) nhưng viewport vẫn đứng ở toạ độ thanh phân trang CŨ,
  // giờ là vùng footer; đồng thời 6 ghost đang thoát (popLayout →
  // `position:absolute` tại chỗ cũ ~600ms) kéo chiều cao cuộn của trang theo,
  // nên dưới footer hở ~320px trắng cho tới khi ghost unmount. Cuộn về đầu
  // lưới là hành vi mọi phân trang; `overflow-clip` ở lưới chặn ghost kéo
  // chiều cao (xem chỗ render). CHỈ khi bấm phân trang — lọc/tìm cũng
  // setPage(1) nhưng người dùng đang đứng ở sidebar, cuộn họ đi là giật.
  const gridRef = useRef<HTMLDivElement>(null);
  function goToPage(next: number) {
    setPage(next);
    const top = gridRef.current?.getBoundingClientRect().top;
    if (top === undefined) return;
    // Trừ navbar pill fixed: 128px (article-body/faq dùng `scroll-mt-28` =
    // 112 cho TIÊU ĐỀ có lề trên; ở đây thẻ mở đầu bằng ẢNH sát mép nên chừa
    // thêm 16px kẻo mép ảnh chui dưới bóng pill — đo ảnh chụp 19/08). Cùng API
    // `window.scrollTo` với ScrollToTop (đã sống chung với Lenis).
    window.scrollTo({ top: window.scrollY + top - 128, behavior: 'smooth' });
  }

  // Ghi URL bằng `history.replaceState`, KHÔNG `router.replace`: cái sau kích
  // hoạt một vòng RSC mỗi lần bấm dù trang này lọc hoàn toàn ở client — đúng vấn
  // đề đã sửa cho ToursExplorer ở `29df3bb` ("gỡ RSC round-trip khỏi bộ lọc").
  // /blog vẫn còn bản cũ; sửa luôn ở đây vì phân trang làm số lần ghi URL tăng
  // hẳn lên. `replaceState` cũng không nhét mục mới vào lịch sử duyệt, nên nút
  // Back đưa người dùng RỜI trang thay vì lùi qua từng lần bấm.
  const firstRender = useRef(true);
  useEffect(() => {
    // Bỏ qua lần mount đầu: URL lúc đó đã đúng rồi (server render theo chính
    // nó), ghi lại là ghi đè vô ích.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const params = new URLSearchParams();
    const facet = serializeFacetParams({ topics: selectedTopics, places: selectedPlaces });
    if (facet.topic) params.set('topic', facet.topic);
    if (facet.place) params.set('place', facet.place);
    if (query.trim()) params.set('q', query.trim());
    // `page=1` không ghi vào URL: nó là mặc định, ghi ra chỉ làm link dài và
    // khiến hai URL khác nhau cùng trỏ một nội dung.
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    window.history.replaceState(
      null,
      '',
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, [selectedTopics, selectedPlaces, query, page]);

  const facets = { topics: selectedTopics, places: selectedPlaces };
  const visible = sortPostsByDate(searchPosts(filterPostsByFacets(posts, facets), query));
  const filtering =
    selectedTopics.length > 0 || selectedPlaces.length > 0 || query.trim().length > 0;

  // Số đếm tính trên tập đã lọc theo TÌM KIẾM, để con số khớp thứ người dùng
  // đang thấy. Còn việc bỏ qua lựa chọn của chính trục đang đếm nằm trong
  // `facetCounts` — xem lý do ở đó.
  const searched = searchPosts(posts, query);
  const topicCounts = facetCounts(searched, facets, 'topics');
  const placeCounts = facetCounts(searched, facets, 'places');
  const paged = paginate(visible, page, PAGE_SIZE);
  // Trang 1 mới có card featured tràn 2 cột: ở trang 2 thì bài đầu của trang chỉ
  // là bài thứ 7 theo ngày, cho nó khổ lớn là nói sai về thứ bậc nội dung.
  const showFeatured = !filtering && page === 1;

  // Đổi bộ lọc/tìm kiếm thì về trang 1 — cùng quy tắc ToursExplorer. Không reset
  // thì đang ở trang 2 mà lọc còn 3 kết quả sẽ ra màn hình trắng.
  const toggle = (list: string[], slug: string) =>
    list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];

  function toggleTopic(slug: string) {
    setSelectedTopics((prev) => toggle(prev, slug));
    setPage(1);
  }

  function togglePlace(slug: string) {
    setSelectedPlaces((prev) => toggle(prev, slug));
    setPage(1);
  }

  function clearAll() {
    setSelectedTopics([]);
    setSelectedPlaces([]);
    setQuery('');
    setPage(1);
  }

  function changeQuery(next: string) {
    setQuery(next);
    setPage(1);
  }

  return (
    // Sidebar + lưới. Đo trên wireframe đã duyệt: vùng 1184 − sidebar 384 −
    // khe 32 = 768 cho lưới, tức 2 cột 372 (thẻ cũ 379 — hụt 7px).
    // Mobile chưa làm ngăn kéo (user hoãn 17/08): sidebar xếp trên lưới.
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <BlogFilterSidebar
        topics={topics}
        places={places}
        topicCounts={topicCounts}
        placeCounts={placeCounts}
        selectedTopics={selectedTopics}
        selectedPlaces={selectedPlaces}
        query={query}
        onToggleTopic={toggleTopic}
        onTogglePlace={togglePlace}
        onQueryChange={changeQuery}
        onClearAll={clearAll}
        resultCount={visible.length}
      />

      <div className="min-w-0 flex-1">
        {/* Dòng "N stories" đã dời vào hàng đầu của sidebar (cạnh "Filters",
            19/08 theo góp ý user) — ở đây nó chiếm riêng một dòng trên lưới. */}
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <h2 className="font-heading text-xl font-medium text-foreground">Nothing here yet</h2>
            <p className="mt-2 text-pretty text-muted-foreground">
              Try another topic or a different word.
            </p>
            <button
              type="button"
              onClick={clearAll}
              className="mt-5 cursor-pointer text-sm font-medium text-primary-emphasis hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            {/* H2 ẩn khỏi thị giác nhưng đọc được cho trình đọc màn hình — /blog
              trước đây nhảy thẳng H1 → H3 (tiêu đề card), không có H2 nào. */}
            <h2 className="sr-only">All stories</h2>
            {/* `overflow-clip` + clip-margin: thẻ đang thoát của popLayout là
                `position:absolute` ở toạ độ CŨ — khi lưới co (trang 2 ít bài),
                chúng thò ra ngoài lưới, đè lên thanh phân trang/footer và KÉO
                chiều cao cuộn của trang thêm ~320px trong ~600ms (bug 19/08).
                `clip` (không phải `hidden`) không tạo scroll container; margin
                16px chừa chỗ cho focus ring của link ở mép lưới. */}
            <div
              ref={gridRef}
              className="relative grid grid-cols-1 gap-6 overflow-clip [overflow-clip-margin:16px] [&:has(a:hover)_a:not(:hover)]:opacity-55 [&:has(a:hover)_a:not(:hover)]:grayscale motion-safe:[&_a]:transition-[opacity,filter] motion-safe:[&_a]:duration-300 sm:grid-cols-2"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {paged.items.map((post, index) => (
                  <motion.div
                    key={post.slug}
                    layout
                    // Vào bằng blur → nét (ý tưởng "Blur Fade" của MagicUI, dựng
                    // thẳng bằng motion/react đang có, khỏi vendor thêm component):
                    // ảnh hiện dần như phim đang tráng — hợp một tạp chí du ký.
                    // CHÚ Ý: blur đặt trên motion.div này, còn grayscale của hiệu
                    // ứng chroma đặt trên thẻ <a> bên trong — hai phần tử khác
                    // nhau, nếu dồn cùng một phần tử thì chúng ghi đè `filter`.
                    initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
                    transition={{ ...SPRING, delay: index * 0.04 }}
                    className={showFeatured && index === 0 ? 'sm:col-span-2' : ''}
                  >
                    <PostCard post={post} featured={showFeatured && index === 0} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* PaginationBar dùng lại từ cụm Tours — nó tự ẩn khi chỉ có 1 trang,
              nên không cần bọc điều kiện ở đây. `onPageSizeChange` bỏ trống: số
              bài mỗi trang gắn với hình dạng lưới của trang này, không phải thứ
              người đọc cần điều chỉnh. */}
            <PaginationBar
              page={paged.page}
              totalPages={paged.totalPages}
              total={visible.length}
              pageSize={PAGE_SIZE}
              onChange={goToPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
