'use client';

import { Input } from '@tourism/ui/components/input';
import { SearchIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CategoryChips } from '@/components/blog/category-chips';
import { PostCard } from '@/components/blog/post-card';
import { filterPostsByCategory, searchPosts, sortPostsByDate } from '@/lib/blog';
import type { MockJournalPost } from '@/mocks/types';

// Lọc + tìm chạy phía client để gõ tới đâu thấy tới đó, nhưng trạng thái vẫn
// được ghi vào URL (?tag=&q=) nên link chia sẻ được và F5 không mất bộ lọc.
// HTML đầu tiên do server render với ĐÚNG initialTag/initialQuery này, nên
// lần render client đầu tiên khớp hệt — không có hydration mismatch.
const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

export function BlogExplorer({
  posts,
  categories,
  initialTag,
  initialQuery,
}: {
  posts: MockJournalPost[];
  categories: string[];
  initialTag?: string;
  initialQuery?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tag, setTag] = useState(initialTag);
  const [query, setQuery] = useState(initialQuery ?? '');

  // Đồng bộ URL bằng replace (không nhét thêm mục vào lịch sử duyệt) và
  // scroll:false (gõ tìm mà trang nhảy về đầu thì rất khó chịu).
  const firstRender = useRef(true);
  useEffect(() => {
    // Bỏ qua lần mount đầu: URL lúc đó đã đúng rồi (server render theo chính
    // nó), replace lại là ghi đè vô ích.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (tag) params.set('tag', tag);
    if (query.trim()) params.set('q', query.trim());
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [tag, query, pathname, router]);

  const visible = sortPostsByDate(searchPosts(filterPostsByCategory(posts, tag), query));
  const filtering = Boolean(tag) || query.trim().length > 0;

  return (
    <div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <CategoryChips
          categories={categories}
          active={tag}
          query={query.trim()}
          onSelect={setTag}
        />

        <div className="relative w-full lg:max-w-xs">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-4 z-10 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
              setTag(undefined);
              setQuery('');
            }}
            className="mt-5 cursor-pointer text-sm font-medium text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 [&:has(a:hover)_a:not(:hover)]:opacity-55 [&:has(a:hover)_a:not(:hover)]:grayscale motion-safe:[&_a]:transition-[opacity,filter] motion-safe:[&_a]:duration-300 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((post, index) => (
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
                className={!filtering && index === 0 ? 'sm:col-span-2' : ''}
              >
                <PostCard post={post} featured={!filtering && index === 0} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
