'use client';

import { Input } from '@tourism/ui/components/input';
import { SearchIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { CategoryChips } from '@/components/blog/category-chips';
import { PostCard } from '@/components/blog/post-card';
import { PaginationBar } from '@/components/tours/pagination-bar';
import { filterPostsByCategory, searchPosts, sortPostsByDate } from '@/lib/blog';
import { paginate } from '@/lib/paginate';
import type { MockJournalPost } from '@/mocks/types';

// Lọc + tìm chạy phía client để gõ tới đâu thấy tới đó, nhưng trạng thái vẫn
// được ghi vào URL (?tag=&q=&page=) nên link chia sẻ được và F5 không mất bộ lọc.
// HTML đầu tiên do server render với ĐÚNG initial* này, nên lần render client đầu
// tiên khớp hệt — không có hydration mismatch.
const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

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
  categories,
  initialTag,
  initialQuery,
  initialPage,
}: {
  posts: MockJournalPost[];
  categories: string[];
  initialTag?: string;
  initialQuery?: string;
  initialPage?: number;
}) {
  const [tag, setTag] = useState(initialTag);
  const [query, setQuery] = useState(initialQuery ?? '');
  const [page, setPage] = useState(Math.max(1, initialPage ?? 1));

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
    if (tag) params.set('tag', tag);
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
  }, [tag, query, page]);

  const visible = sortPostsByDate(searchPosts(filterPostsByCategory(posts, tag), query));
  const filtering = Boolean(tag) || query.trim().length > 0;
  const paged = paginate(visible, page, PAGE_SIZE);
  // Trang 1 mới có card featured tràn 2 cột: ở trang 2 thì bài đầu của trang chỉ
  // là bài thứ 7 theo ngày, cho nó khổ lớn là nói sai về thứ bậc nội dung.
  const showFeatured = !filtering && page === 1;

  // Đổi bộ lọc/tìm kiếm thì về trang 1 — cùng quy tắc ToursExplorer. Không reset
  // thì đang ở trang 2 mà lọc còn 3 kết quả sẽ ra màn hình trắng.
  function changeTag(next: string | undefined) {
    setTag(next);
    setPage(1);
  }

  function changeQuery(next: string) {
    setQuery(next);
    setPage(1);
  }

  return (
    <div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <CategoryChips
          categories={categories}
          active={tag}
          query={query.trim()}
          onSelect={changeTag}
        />

        <div className="relative w-full lg:max-w-xs">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-4 z-10 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => changeQuery(e.target.value)}
            placeholder="Search the journal…"
            aria-label="Search journal posts by title or summary"
            className="h-11 rounded-full bg-background pr-4 pl-11 text-sm"
          />
        </div>
      </div>

      <p aria-live="polite" className="mt-6 text-sm text-muted-foreground">
        {visible.length} {visible.length === 1 ? 'story' : 'stories'}
      </p>

      {visible.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed p-12 text-center">
          <h2 className="font-heading text-xl font-medium text-foreground">Nothing here yet</h2>
          <p className="mt-2 text-pretty text-muted-foreground">
            Try another topic or a different word.
          </p>
          <button
            type="button"
            onClick={() => {
              changeTag(undefined);
              changeQuery('');
            }}
            className="mt-5 cursor-pointer text-sm font-medium text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {/* H2 ẩn khỏi thị giác nhưng đọc được cho trình đọc màn hình — /blog
              trước đây nhảy thẳng H1 → H3 (tiêu đề card), không có H2 nào. */}
          <h2 className="sr-only">All stories</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 [&:has(a:hover)_a:not(:hover)]:opacity-55 [&:has(a:hover)_a:not(:hover)]:grayscale motion-safe:[&_a]:transition-[opacity,filter] motion-safe:[&_a]:duration-300 sm:grid-cols-2 lg:grid-cols-3">
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
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
