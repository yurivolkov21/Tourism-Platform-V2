'use client';

import { messages } from '@tourism/i18n';
import { Input } from '@tourism/ui/components/input';
import { SearchIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { PaginationBar } from '@/components/tours/pagination-bar';
import { TourCard } from '@/components/tours/tour-card';
import { type SortValue, TourToolbar } from '@/components/tours/tour-toolbar';
import { ToursHero } from '@/components/tours/tours-hero';
import { paginate } from '@/lib/paginate';
import {
  filterToursByCategory,
  filterToursByDestination,
  filterToursByFeatured,
  searchTours,
  sortTours,
  type TourSortKey,
} from '@/lib/tours';
import type { MockDestination, MockTourCard } from '@/mocks/types';

// Limit mặc định của ToursListQuerySchema. Giữ đúng con số đó ngay từ tầng tĩnh
// để lúc gắn API không phải chỉnh lại lưới.
const PAGE_SIZE = 12;

const SORT_MAP: Record<SortValue, { key: TourSortKey; order: 'asc' | 'desc' }> = {
  newest: { key: 'createdAt', order: 'desc' },
  priceAsc: { key: 'basePrice', order: 'asc' },
  priceDesc: { key: 'basePrice', order: 'desc' },
  durationAsc: { key: 'durationDays', order: 'asc' },
};

const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

export interface ToursExplorerInitial {
  category?: string;
  destination?: string;
  featured?: boolean;
  q?: string;
  sort?: string;
  page?: number;
}

// Lọc + tìm chạy phía client để gõ tới đâu thấy tới đó, nhưng trạng thái vẫn
// được ghi vào URL nên link chia sẻ được và F5 không mất bộ lọc. HTML đầu tiên
// do server render với ĐÚNG initial này nên lần render client đầu khớp hệt —
// không có hydration mismatch. (Cùng mẫu đã chạy thật ở BlogExplorer.)
export function ToursExplorer({
  tours,
  categories,
  destinations,
  initial,
}: {
  tours: MockTourCard[];
  categories: { slug: string; name: string; count: number }[];
  destinations: MockDestination[];
  initial: ToursExplorerInitial;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [category, setCategory] = useState(initial.category);
  const [destination, setDestination] = useState(initial.destination);
  const [featured, setFeatured] = useState(Boolean(initial.featured));
  const [query, setQuery] = useState(initial.q ?? '');
  const [sort, setSort] = useState<SortValue>(
    initial.sort && initial.sort in SORT_MAP ? (initial.sort as SortValue) : 'newest',
  );
  const [page, setPage] = useState(Math.max(1, initial.page ?? 1));

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
    if (category) params.set('category', category);
    if (destination) params.set('destination', destination);
    if (featured) params.set('featured', 'true');
    if (query.trim()) params.set('q', query.trim());
    // Giá trị mặc định KHÔNG ghi vào URL — link chia sẻ giữ sạch.
    if (sort !== 'newest') params.set('sort', sort);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [category, destination, featured, query, sort, page, pathname, router]);

  /** Mọi thao tác đổi bộ lọc phải đi qua đây: đổi filter mà giữ nguyên page là
      cách chắc chắn nhất để ra màn hình trắng (lọc còn 3 tour trong khi đang ở
      trang 2). */
  function applyFilter(change: () => void) {
    change();
    setPage(1);
  }

  function clearAll() {
    setCategory(undefined);
    setDestination(undefined);
    setFeatured(false);
    setQuery('');
    setPage(1);
  }

  const { key, order } = SORT_MAP[sort];
  const matched = sortTours(
    searchTours(
      filterToursByFeatured(
        filterToursByDestination(filterToursByCategory(tours, category), destination),
        featured ? true : undefined,
      ),
      query,
    ),
    key,
    order,
  );
  const paged = paginate(matched, page, PAGE_SIZE);

  const activeFilters = [
    category
      ? {
          label: categories.find((c) => c.slug === category)?.name ?? category,
          onRemove: () => applyFilter(() => setCategory(undefined)),
        }
      : null,
    destination
      ? {
          label: destinations.find((d) => d.slug === destination)?.name ?? destination,
          onRemove: () => applyFilter(() => setDestination(undefined)),
        }
      : null,
    featured
      ? {
          label: messages.toursPage.featuredLabel,
          onRemove: () => applyFilter(() => setFeatured(false)),
        }
      : null,
  ].filter((f): f is { label: string; onRemove: () => void } => f !== null);

  return (
    <>
      {/* Hero nằm TRONG explorer vì ô tìm kiếm sống trong hero (spec §5.1) mà
          state của nó lại ở đây. ToursHero vốn đã là client component (motion),
          nên không mất gì — H1 vẫn được server render bình thường. */}
      <ToursHero
        eyebrow={messages.toursPage.resultSummary(tours.length, destinations.length)}
        title={messages.toursPage.title}
        subtitle={messages.toursPage.subtitle}
      >
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-4 z-10 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => applyFilter(() => setQuery(e.target.value))}
            placeholder={messages.toursPage.searchPlaceholder}
            aria-label={messages.toursPage.searchAriaLabel}
            className="h-11 rounded-full bg-background pr-4 pl-11 text-sm"
          />
        </div>
      </ToursHero>

      <div className="w-full px-4 pb-16 md:px-16 md:pb-20 lg:px-24 xl:px-32">
        <div className="mx-auto max-w-7xl">
          <TourToolbar
            categories={categories}
            destinations={destinations}
            activeCategory={category}
            activeDestination={destination}
            featured={featured}
            sort={sort}
            resultCount={matched.length}
            activeFilters={activeFilters}
            onSelectCategory={(slug) => applyFilter(() => setCategory(slug))}
            onSelectDestination={(slug) => applyFilter(() => setDestination(slug))}
            onToggleFeatured={() => applyFilter(() => setFeatured((v) => !v))}
            onSelectSort={(value) => applyFilter(() => setSort(value))}
            onClearAll={clearAll}
          />

          {paged.items.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed p-12 text-center">
              <h2 className="font-heading text-xl font-medium text-foreground">
                {messages.toursPage.empty.title}
              </h2>
              <p className="mt-2 text-pretty text-muted-foreground">
                {messages.toursPage.empty.body}
              </p>
              <button
                type="button"
                onClick={clearAll}
                className="mt-5 cursor-pointer text-sm font-medium text-primary hover:underline"
              >
                {messages.toursPage.empty.cta}
              </button>
            </div>
          ) : (
            <>
              {/* H2 ẩn khỏi thị giác nhưng đọc được cho trình đọc màn hình —
                  không thì trang nhảy thẳng H1 → H3 (tiêu đề card). */}
              <h2 className="sr-only">All tours</h2>
              <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout" initial={false}>
                  {paged.items.map((tour, index) => (
                    <motion.article
                      key={tour.slug}
                      layout
                      initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
                      transition={{ ...SPRING, delay: index * 0.03 }}
                    >
                      <TourCard tour={tour} />
                    </motion.article>
                  ))}
                </AnimatePresence>
              </div>

              <PaginationBar page={paged.page} totalPages={paged.totalPages} onChange={setPage} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
