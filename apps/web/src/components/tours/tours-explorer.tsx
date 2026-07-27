'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tourism/ui/components/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@tourism/ui/components/sheet';
import {
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  XIcon,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PaginationBar } from '@/components/tours/pagination-bar';
import { TourListCard } from '@/components/tours/tour-list-card';
import { type FacetCounts, type FacetKey, ToursFilters } from '@/components/tours/tours-filters';
import { ToursHero } from '@/components/tours/tours-hero';
import { paginate } from '@/lib/paginate';
import {
  countActiveFilters,
  EMPTY_TOUR_FILTERS,
  facetOptionCounts,
  featuredOptionCount,
  filterTours,
  searchTours,
  sortTours,
  type TourFilterState,
  type TourSortKey,
} from '@/lib/tours';
import type { MockDestination, MockTourCard } from '@/mocks/types';

// Limit mặc định của ToursListQuerySchema. Giữ đúng con số đó ngay từ tầng tĩnh
// để lúc gắn API không phải chỉnh lại danh sách.
const PAGE_SIZE = 12;

type SortValue = 'newest' | 'priceAsc' | 'priceDesc' | 'durationAsc';
const SORT_ORDER: SortValue[] = ['newest', 'priceAsc', 'priceDesc', 'durationAsc'];
const SORT_MAP: Record<SortValue, { key: TourSortKey; order: 'asc' | 'desc' }> = {
  newest: { key: 'createdAt', order: 'desc' },
  priceAsc: { key: 'basePrice', order: 'asc' },
  priceDesc: { key: 'basePrice', order: 'desc' },
  durationAsc: { key: 'durationDays', order: 'asc' },
};

/** Trần bậc thang animation vào của card. Không kẹp thì card thứ 12 phải chờ
    12×40ms = 0.48s mới hiện — cảm giác trang ì. */
const MAX_STAGGER = 6;

/** Khoá localStorage nhớ trạng thái thu sidebar (nâng cấp D). */
const SIDEBAR_KEY = 'tours:sidebar-collapsed';

/** Facet nào đọc được từ URL. Giá trị trong URL là danh sách ngăn bằng dấu phẩy
    (`?categories=trekking,food`) — ngắn và người đọc URL vẫn hiểu. */
const FACET_PARAMS: FacetKey[] = [
  'categories',
  'destinations',
  'durations',
  'prices',
  'difficulties',
];

export interface ToursExplorerInitial {
  categories?: string;
  destinations?: string;
  durations?: string;
  prices?: string;
  difficulties?: string;
  featured?: boolean;
  q?: string;
  sort?: string;
  page?: number;
}

function parseList(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

// Lọc + tìm chạy phía client để bấm tới đâu thấy tới đó, nhưng trạng thái vẫn
// ghi vào URL nên link chia sẻ được và F5 không mất bộ lọc. HTML đầu tiên do
// server render với ĐÚNG initial này nên lần render client đầu khớp hệt.
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
  const [filters, setFilters] = useState<TourFilterState>({
    categories: parseList(initial.categories),
    destinations: parseList(initial.destinations),
    durations: parseList(initial.durations) as TourFilterState['durations'],
    prices: parseList(initial.prices) as TourFilterState['prices'],
    difficulties: parseList(initial.difficulties) as TourFilterState['difficulties'],
    featured: Boolean(initial.featured),
  });
  const [query, setQuery] = useState(initial.q ?? '');
  const [sort, setSort] = useState<SortValue>(
    initial.sort && initial.sort in SORT_MAP ? (initial.sort as SortValue) : 'newest',
  );
  const [page, setPage] = useState(Math.max(1, initial.page ?? 1));
  // Khởi tạo FALSE ở cả server lẫn lần render client đầu, rồi mới đọc
  // localStorage trong effect. Đọc thẳng trong useState sẽ lệch HTML server và
  // gây hydration mismatch.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    if (localStorage.getItem(SIDEBAR_KEY) === 'true') setSidebarCollapsed(true);
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((v) => {
      localStorage.setItem(SIDEBAR_KEY, String(!v));
      return !v;
    });
  }
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Đồng bộ URL: ghi đè mục hiện tại thay vì thêm mục mới vào lịch sử duyệt,
  // để nút Back đưa người dùng RỜI trang chứ không lùi qua từng lần tích ô.
  const firstRender = useRef(true);
  useEffect(() => {
    // Bỏ qua lần mount đầu: URL lúc đó đã đúng rồi (server render theo chính
    // nó), replace lại là ghi đè vô ích.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const params = new URLSearchParams();
    for (const facet of FACET_PARAMS) {
      const values = filters[facet];
      if (values.length > 0) params.set(facet, values.join(','));
    }
    if (filters.featured) params.set('featured', 'true');
    if (query.trim()) params.set('q', query.trim());
    // Giá trị mặc định KHÔNG ghi vào URL — link chia sẻ giữ sạch.
    if (sort !== 'newest') params.set('sort', sort);
    if (page > 1) params.set('page', String(page));
    // URLSearchParams mã hoá dấu phẩy thành %2C. Dấu phẩy là sub-delim hợp lệ
    // trong query (RFC 3986) và URLSearchParams đọc lại nó bình thường, nên trả
    // về dạng chữ để link chia sẻ còn đọc được: ?categories=trekking,food
    const qs = params.toString().replace(/%2C/g, ',');

    // history.replaceState CHỨ KHÔNG PHẢI router.replace. Đo được 27/07:
    // router.replace kích hoạt một RSC round-trip mỗi lần đổi bộ lọc — 4 lần
    // bấm checkbox sinh 6 request về /tours?_rsc=…, tức server render lại toàn
    // trang cho một thay đổi thuần client. Khi gắn API thật thì mỗi lần tích ô
    // là thêm một lượt gọi API.
    //
    // Lọc ở đây là trạng thái CLIENT; URL chỉ cần phản ánh nó để chia sẻ được
    // và F5 khôi phục được. replaceState làm đúng chừng đó, không điều hướng.
    // Đánh đổi: usePathname/useSearchParams không cập nhật theo — không sao vì
    // nguồn sự thật sau khi mount là state trong component này.
    window.history.replaceState(
      null,
      '',
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, [filters, query, sort, page]);

  /** Bật/tắt một option. Mọi thay đổi bộ lọc đều đưa page về 1 — giữ nguyên
      page là cách chắc chắn nhất để ra màn hình trắng (lọc còn 3 tour trong
      khi đang ở trang 2). */
  function toggleFacet(facet: FacetKey, optionValue: string) {
    setFilters((prev) => {
      const current = prev[facet] as readonly string[];
      const next = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue];
      return { ...prev, [facet]: next };
    });
    setPage(1);
  }

  function toggleFeatured() {
    setFilters((prev) => ({ ...prev, featured: !prev.featured }));
    setPage(1);
  }

  function clearAll() {
    setFilters(EMPTY_TOUR_FILTERS);
    setQuery('');
    setPage(1);
  }

  const { key, order } = SORT_MAP[sort];

  // Ba khối dẫn xuất dưới đây đều memo. Với 16 tour mock thì thừa, nhưng
  // `facetOptionCounts` chạy MỘT lượt filterTours cho MỖI option (6+9+3+3+3 =
  // 24 lượt); ở catalogue thật vài trăm tour, tính lại sau từng phím gõ là
  // hàng chục nghìn phép so sánh. Memo theo đúng thứ nó phụ thuộc.
  //
  // Số đếm facet tính trên danh sách ĐÃ lọc theo ô tìm kiếm — search thu hẹp
  // mọi facet, nên đếm theo toàn catalogue sẽ hứa nhiều hơn thực tế.
  const searched = useMemo(() => searchTours(tours, query), [tours, query]);
  const matched = useMemo(
    () => sortTours(filterTours(searched, filters), key, order),
    [searched, filters, key, order],
  );
  const paged = paginate(matched, page, PAGE_SIZE);
  const activeCount = countActiveFilters(filters);

  const counts: FacetCounts = useMemo(
    () => ({
      categories: facetOptionCounts(
        searched,
        filters,
        'categories',
        categories.map((c) => c.slug),
      ),
      destinations: facetOptionCounts(
        searched,
        filters,
        'destinations',
        destinations.map((d) => d.slug),
      ),
      durations: facetOptionCounts(searched, filters, 'durations', ['1', '2-3', '4+']),
      prices: facetOptionCounts(searched, filters, 'prices', ['<100', '100-300', '300+']),
      difficulties: facetOptionCounts(searched, filters, 'difficulties', [
        'EASY',
        'MODERATE',
        'CHALLENGING',
      ]),
      featured: featuredOptionCount(searched, filters),
    }),
    [searched, filters, categories, destinations],
  );

  /** Nhãn hiển thị cho chip đang bật. Tra ngược từ slug sang tên người đọc
      được; giá trị lạ giữ nguyên slug để người dùng thấy chính thứ trong URL. */
  const chips = FACET_PARAMS.flatMap((facet) =>
    (filters[facet] as readonly string[]).map((value) => {
      const label =
        facet === 'categories'
          ? (categories.find((c) => c.slug === value)?.name ?? value)
          : facet === 'destinations'
            ? (destinations.find((d) => d.slug === value)?.name ?? value)
            : facet === 'durations'
              ? messages.toursPage.durationLabels[
                  value as keyof typeof messages.toursPage.durationLabels
                ]
              : facet === 'prices'
                ? messages.toursPage.priceLabels[
                    value as keyof typeof messages.toursPage.priceLabels
                  ]
                : messages.toursPage.difficultyLabels[
                    value as keyof typeof messages.toursPage.difficultyLabels
                  ];
      return { facet, value, label: label ?? value };
    }),
  );

  /** Hai chỗ dùng bộ lọc nằm trên hai nền khác nhau nên phải truyền nền vào,
      xem comment `surfaceClassName` trong ToursFilters. */
  function renderFilters(surfaceClassName: string) {
    return (
      <ToursFilters
        surfaceClassName={surfaceClassName}
        value={filters}
        counts={counts}
        onToggle={toggleFacet}
        onToggleFeatured={toggleFeatured}
        onClearAll={clearAll}
        categoryOptions={categories}
        destinations={destinations}
        activeCount={activeCount}
      />
    );
  }

  return (
    <>
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
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={messages.toursPage.searchPlaceholder}
            aria-label={messages.toursPage.searchAriaLabel}
            className="h-11 rounded-full bg-background pr-4 pl-11 text-sm"
          />
        </div>
      </ToursHero>

      <div className="w-full px-4 py-14 md:px-16 md:py-16 lg:px-24 xl:px-32">
        <div
          className={`mx-auto max-w-7xl lg:grid lg:gap-12 ${
            sidebarCollapsed ? 'lg:grid-cols-1' : 'lg:grid-cols-[16rem_1fr]'
          }`}
        >
          <aside className={sidebarCollapsed ? 'hidden' : 'hidden lg:block'}>
            {/* top-28 = chiều cao navbar pill khi đã cuộn + thở */}
            {/* Cuộn ĐỘC LẬP (nâng cấp C): sáu nhóm mở hết cao hơn màn hình;
                không có max-h thì sidebar đẩy chiều cao cả trang và phải cuộn
                qua hết bộ lọc mới tới kết quả. pr-1/-mr-1 chừa chỗ thanh cuộn
                mà không thụt nội dung. */}
            <div className="scrollbar-slim lg:sticky lg:top-28 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:pr-3">
              {renderFilters('bg-background')}
            </div>
          </aside>

          <div className="min-w-0">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* Mobile: mở drawer */}
                <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                  <SheetTrigger
                    render={
                      <Button variant="outline" size="sm" className="lg:hidden">
                        <SlidersHorizontalIcon className="size-4" aria-hidden="true" />
                        {messages.toursPage.filtersLabel}
                        {activeCount > 0 ? (
                          <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                            {activeCount}
                          </span>
                        ) : null}
                      </Button>
                    }
                  />
                  {/* KHÔNG pt ở đây: padding trên nằm TRONG vùng cuộn nên nội
                      dung trôi qua khoảng đó trước khi chạm header dính, tạo một
                      vệt 24px lộ chữ. Padding trên chuyển vào chính header. */}
                  <SheetContent side="left" className="w-[19rem] overflow-y-auto px-6 pb-6">
                    <SheetHeader className="sr-only">
                      <SheetTitle>{messages.toursPage.filtersLabel}</SheetTitle>
                    </SheetHeader>
                    {renderFilters('bg-popover pt-6')}
                  </SheetContent>
                </Sheet>

                {/* Desktop: thu/mở sidebar */}
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden lg:inline-flex"
                  onClick={toggleSidebar}
                  aria-expanded={!sidebarCollapsed}
                >
                  {sidebarCollapsed ? (
                    <PanelLeftOpenIcon className="size-4" aria-hidden="true" />
                  ) : (
                    <PanelLeftCloseIcon className="size-4" aria-hidden="true" />
                  )}
                  {sidebarCollapsed
                    ? messages.toursPage.showFilters
                    : messages.toursPage.hideFilters}
                  {sidebarCollapsed && activeCount > 0 ? (
                    <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                      {activeCount}
                    </span>
                  ) : null}
                </Button>

                <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
                  {messages.toursPage.resultCount(matched.length)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* sr-only chứ KHÔNG phải `hidden`: display:none loại phần tử
                    khỏi cây trợ năng, nên trên mobile aria-labelledby trỏ vào
                    một nhãn rỗng và trình đọc màn hình chỉ nghe "Newest first"
                    mà không biết nút này để làm gì. */}
                <span
                  id="tours-sort-label"
                  className="sr-only text-sm text-muted-foreground sm:not-sr-only"
                >
                  {messages.toursPage.sortLabel}
                </span>
                {/* Select của @tourism/ui (Base UI) — bản <select> gốc trước đây
                    dùng khung vẽ của hệ điều hành nên lạc hẳn khỏi phần còn lại
                    của trang. Đánh đổi: phải mock/điều khiển bằng click trong
                    test thay vì userEvent.selectOptions. */}
                <Select
                  value={sort}
                  onValueChange={(value) => {
                    setSort(value as SortValue);
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    id="tours-sort"
                    aria-labelledby="tours-sort-label tours-sort"
                    className="w-44"
                  >
                    {/* Base UI Select.Value in ra GIÁ TRỊ thô nếu không được
                        bảo cách hiển thị — nút sẽ hiện "newest" thay vì
                        "Newest first". Truyền hàm render để tra sang nhãn. */}
                    <SelectValue>
                      {(value) => messages.toursPage.sortOptions[value as SortValue]}
                    </SelectValue>
                  </SelectTrigger>
                  {/* alignItemWithTrigger mặc định của Base UI là kiểu select
                      macOS: popup PHỦ LÊN trigger, canh mục đang chọn vào đúng
                      chỗ nút. Trên thanh công cụ trông như bị lệch — đổi sang
                      dropdown thường, mở xuống dưới và canh mép phải nút. */}
                  <SelectContent alignItemWithTrigger={false} align="end">
                    {SORT_ORDER.map((value) => (
                      <SelectItem key={value} value={value}>
                        {messages.toursPage.sortOptions[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {chips.length > 0 ? (
              <div className="mb-6 flex flex-wrap items-center gap-2">
                {chips.map((chip) => (
                  <button
                    key={`${chip.facet}-${chip.value}`}
                    type="button"
                    onClick={() => toggleFacet(chip.facet, chip.value)}
                    aria-label={messages.toursPage.removeFilter(chip.label)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-sm text-foreground/80 transition-colors hover:text-foreground"
                  >
                    <span aria-hidden="true">{chip.label}</span>
                    <XIcon className="size-3.5" aria-hidden="true" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearAll}
                  className="ml-1 cursor-pointer text-sm font-medium text-primary hover:underline"
                >
                  {messages.toursPage.clearAll}
                </button>
              </div>
            ) : null}

            {paged.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed px-6 py-20 text-center">
                <h2 className="font-heading text-xl font-medium text-foreground">
                  {messages.toursPage.empty.title}
                </h2>
                <p className="mt-2 text-pretty text-muted-foreground">
                  {messages.toursPage.empty.body}
                </p>
                <Button variant="outline" className="mt-6" onClick={clearAll}>
                  {messages.toursPage.empty.cta}
                </Button>
              </div>
            ) : (
              <>
                {/* H2 ẩn khỏi thị giác nhưng đọc được cho trình đọc màn hình —
                    không thì trang nhảy thẳng H1 → H3 (tiêu đề card). */}
                <h2 className="sr-only">All tours</h2>
                <div className="flex flex-col gap-5">
                  {paged.items.map((tour, index) => (
                    <div
                      key={tour.slug}
                      className="animate-tour-card-in"
                      style={
                        { '--card-index': Math.min(index, MAX_STAGGER) } as React.CSSProperties
                      }
                    >
                      <TourListCard tour={tour} />
                    </div>
                  ))}
                </div>

                <PaginationBar page={paged.page} totalPages={paged.totalPages} onChange={setPage} />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
