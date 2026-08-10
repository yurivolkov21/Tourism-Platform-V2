'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@tourism/ui/components/drawer';
import { Input } from '@tourism/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tourism/ui/components/select';
import { SearchIcon, SlidersHorizontalIcon, XIcon } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PAGE_SIZES, PaginationBar } from '@/components/tours/pagination-bar';
import { TourListCard } from '@/components/tours/tour-list-card';
import { type FacetCounts, type FacetKey, ToursFilters } from '@/components/tours/tours-filters';
import { ToursHero } from '@/components/tours/tours-hero';
import { WishlistProvider } from '@/components/tours/wishlist-store';
import type { DestinationVM, TourCardVM } from '@/lib/api/tours';
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

/** Số tour mỗi trang mặc định. Contract mặc định 12, ta chọn 10 cho trang ngắn
    hơn — không xung đột vì client luôn gửi `limit` tường minh. Người dùng đổi
    được ở thanh phân trang (10/20/50, đều ≤ trần 50 của contract). Nexora có
    rows-per-page mà v2 thiếu — khoản nợ này đóng luôn ở đây. */
const DEFAULT_PAGE_SIZE = 10;

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
  limit?: number;
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
  tours: TourCardVM[];
  categories: { slug: string; name: string; count: number }[];
  destinations: DestinationVM[];
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
  const [pageSize, setPageSize] = useState(
    initial.limit && PAGE_SIZES.includes(initial.limit as (typeof PAGE_SIZES)[number])
      ? initial.limit
      : DEFAULT_PAGE_SIZE,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Đồng bộ URL: ghi đè mục hiện tại thay vì thêm mục mới vào lịch sử duyệt,
  // để nút Back đưa người dùng RỜI trang chứ không lùi qua từng lần tích ô.
  const firstRender = useRef(true);
  useEffect(() => {
    // Bỏ qua lần mount đầu: URL lúc đó đã đúng rồi (server render theo chính
    // nó), ghi lại là ghi đè vô ích.
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
    if (pageSize !== DEFAULT_PAGE_SIZE) params.set('limit', String(pageSize));
    // URLSearchParams mã hoá dấu phẩy thành %2C. Dấu phẩy là sub-delim hợp lệ
    // trong query (RFC 3986) và URLSearchParams đọc lại được, nên trả về dạng
    // chữ để link chia sẻ còn đọc được: ?categories=trekking,food
    const qs = params.toString().replace(/%2C/g, ',');

    // history.replaceState CHỨ KHÔNG PHẢI router.replace. Đo được 27/07:
    // router.replace kích hoạt một RSC round-trip mỗi lần đổi bộ lọc — 4 lần
    // bấm sinh 6 request về /tours?_rsc=…, tức server render lại toàn trang
    // cho một thay đổi thuần client. Khi gắn API thật thì mỗi lần tích ô là
    // thêm một lượt gọi API.
    window.history.replaceState(
      null,
      '',
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, [filters, query, sort, page, pageSize]);

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
  const paged = paginate(matched, page, pageSize);
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

  const filtersNode = (
    <ToursFilters
      value={filters}
      counts={counts}
      onToggle={toggleFacet}
      onToggleFeatured={toggleFeatured}
      categoryOptions={categories}
      destinations={destinations}
    />
  );

  // Chỉ hỏi trạng thái tim cho tour ĐANG hiện trên trang, không phải cả bộ:
  // `wishlist.check` có trần 100 id, và tô tim cho thứ khách không nhìn thấy
  // là tốn một vòng mạng vô ích.
  const pagedTourIds = paged.items.map((tour) => tour.id);

  return (
    <WishlistProvider tourIds={pagedTourIds}>
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
        <div className="mx-auto max-w-7xl">
          {/* HÀNG TIÊU ĐỀ KHU VỰC — KHÔNG khung, KHÔNG nền, KHÔNG dính.
              Ba bản trước đều sai cùng một kiểu: vẽ một cái thẻ rộng gần hết
              màn hình rồi nhét ba thứ nhỏ vào, nên giữa trống hoác. Khảo sát 13
              sản phẩm thật (27/07) cho thấy gốc rễ không phải ít phần tử mà là
              CÁI KHUNG vẽ quanh chúng — ASOS/Booking/Zalando/Etsy/G Adventures
              đặt đúng 2–3 điều khiển trên dải 1300px và không ai thấy sai, vì
              họ không vẽ container nào.
              Cách chữa: nâng số kết quả lên cỡ TIÊU ĐỀ (h2) làm neo trái, điều
              khiển bám mép phải cùng baseline, một đường kẻ khép khoảng hở và
              kiêm cạnh trên của danh sách. Hàng lập tức đọc thành "tiêu đề +
              điều khiển đuôi" — hình dạng 6/13 sản phẩm dùng.
              KHÔNG dính: 9/13 sản phẩm không dính gì; Baymard KHÔNG có số liệu
              nào về sticky toolbar trên desktop (luật sticky của họ chỉ áp cho
              mobile). Với 10 tour/trang và phân trang đánh số, cuộn sâu nhất
              cũng chỉ ~2 màn hình. */}
          <section aria-labelledby="tours-results-heading" className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <h2
                id="tours-results-heading"
                role="status"
                aria-live="polite"
                className="font-heading text-2xl font-medium tracking-tight text-foreground"
              >
                {messages.toursPage.resultsHeading(matched.length, tours.length)}
              </h2>

              <div className="flex shrink-0 items-center gap-2">
                {/* sr-only chứ KHÔNG phải `hidden`: display:none loại phần tử khỏi
                  cây trợ năng, nên trên mobile aria-labelledby trỏ vào nhãn rỗng
                  và trình đọc màn hình chỉ nghe "Newest first". */}
                <span
                  id="tours-sort-label"
                  className="sr-only text-sm text-muted-foreground sm:not-sr-only"
                >
                  {messages.toursPage.sortLabel}
                </span>
                {/* Sort ở NGOÀI trang, không nhét vào drawer: lọc thu hẹp tập kết
                  quả, sắp xếp đổi thứ tự cùng tập — hai mô hình khác nhau, gộp
                  chung dạy người dùng sai. Và sort được dùng nhiều hơn lọc,
                  chôn nó sau hai cú bấm là phạt đúng hành vi phổ biến nhất. */}
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
                    className="w-40"
                  >
                    {/* Base UI Select.Value in GIÁ TRỊ thô nếu không truyền hàm
                      render — nút sẽ hiện "newest" thay vì "Newest first". */}
                    <SelectValue>
                      {(value) => messages.toursPage.sortOptions[value as SortValue]}
                    </SelectValue>
                  </SelectTrigger>
                  {/* alignItemWithTrigger mặc định là kiểu select macOS: popup PHỦ
                    LÊN trigger. Đổi sang dropdown thường, mở xuống, canh mép phải. */}
                  <SelectContent alignItemWithTrigger={false} align="end">
                    {SORT_ORDER.map((value) => (
                      <SelectItem key={value} value={value}>
                        {messages.toursPage.sortOptions[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} swipeDirection="right">
                  <DrawerTrigger
                    render={
                      <Button variant="outline" size="sm" className="h-9">
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
                  {/* 30rem thay vì 24rem mặc định: đủ để hàng pill của
                    Duration/Price/Pace nằm gọn một hàng, nên chỉ Category và
                    Destination cần cuộn. rounded-none để panel dính mép màn
                    hình như một tấm bảng, không phải card trôi nổi.
                    PHẢI dùng tiền tố `data-[swipe-axis=x]:sm:` đúng như class
                    gốc — viết `sm:` trần thì bộ chọn của component (có thêm
                    thuộc tính data) ưu tiên cao hơn và đè mất. */}
                  <DrawerContent className="data-[swipe-axis=x]:sm:[--drawer-content-width:30rem] data-[swipe-direction=right]:rounded-none">
                    {/* Header 2 tầng (mượn Drawer 01): tầng 1 danh tính + lối
                      thoát, tầng 2 TRẠNG THÁI ĐỊNH LƯỢNG. Drawer 01 để thanh
                      progress ở đây; lọc thì không có đích nên thay bằng số kết
                      quả sống — nó biến header thành phản hồi, không phải nhãn. */}
                    {/* pb-4: DrawerHeader gốc là `p-4 pb-0` (giả định không viền),
                      nên thêm border-b không thôi thì chữ dính sát đường kẻ. */}
                    <DrawerHeader className="border-b pb-4">
                      <div className="flex items-center justify-between gap-2">
                        <DrawerTitle>{messages.toursPage.filtersLabel}</DrawerTitle>
                        <DrawerClose
                          render={
                            <Button variant="ghost" size="icon-sm" aria-label="Close filters">
                              <XIcon />
                            </Button>
                          }
                        />
                      </div>
                      <DrawerDescription aria-live="polite">
                        {messages.toursPage.matchCount(matched.length)}
                      </DrawerDescription>
                    </DrawerHeader>

                    {/* data-lenis-prevent: Lenis (smooth scroll toàn site, bật ở
                      root layout) chặn wheel trên cả tài liệu, nên lăn chuột
                      trong drawer lại cuộn TRANG CHÍNH — đo được: thân drawer
                      scrollTop đứng im 0 trong khi window.scrollY nhảy 600px.
                      Thuộc tính này là cơ chế Lenis cung cấp sẵn để trả wheel
                      lại cho vùng cuộn lồng bên trong. */}
                    <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto p-4">
                      {filtersNode}
                    </div>

                    {/* Footer KHÔNG chia 50/50 như Sheet 04 — hai nút không cùng
                      trọng lượng. Nút phải là LỐI THOÁT MANG KẾT QUẢ, không phải
                      lệnh commit: lọc đã áp dụng tức thì rồi (số đếm trên từng
                      option chỉ trung thực nếu state đã áp dụng). */}
                    {/* pt-4: DrawerFooter gốc là `p-4 pt-0` — cùng lý do như header. */}
                    <DrawerFooter className="flex-row items-center justify-between gap-3 border-t pt-4">
                      <Button
                        variant="ghost"
                        onClick={clearAll}
                        disabled={activeCount === 0 && !query.trim()}
                      >
                        {messages.toursPage.clearAll}
                      </Button>
                      <DrawerClose
                        render={<Button>{messages.toursPage.showResults(matched.length)}</Button>}
                      />
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
              </div>
            </div>

            {/* Chip là DÒNG THỨ HAI, chỉ render khi có bộ lọc bật — không chiếm
                chỗ ở trạng thái rỗng. Khi drawer đóng, đây là chỗ DUY NHẤT nói
                cho người dùng biết họ đang lọc gì (Baymard: 72% site có phần
                này, và "chỉ hiện số trên nút Filters" là lỗi khả dụng). */}
            {chips.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
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

            {/* Đường kẻ khép khoảng hở giữa hai cụm và kiêm cạnh trên danh sách
                — khoảng trắng ở giữa thành khoảng trắng CÓ BIÊN, không trôi nổi. */}
            <div className="mt-4 border-b" />
          </section>

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
                    style={{ '--card-index': Math.min(index, MAX_STAGGER) } as React.CSSProperties}
                  >
                    <TourListCard tour={tour} />
                  </div>
                ))}
              </div>

              <PaginationBar
                page={paged.page}
                totalPages={paged.totalPages}
                total={matched.length}
                pageSize={pageSize}
                onChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  // Đổi số/trang mà giữ nguyên page là ra màn hình trắng: đang
                  // ở trang 2 với 10/trang, đổi sang 50/trang thì chỉ còn 1
                  // trang và trang 2 rỗng.
                  setPage(1);
                }}
              />
            </>
          )}
        </div>
      </div>
    </WishlistProvider>
  );
}
