import { useMutation, useQuery } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AuthGateSheet } from '@/features/auth/auth-gate-sheet';
import { matchDestinationsByPrefix } from '@/features/explore/destination-search';
import { ExploreScreen, type ExploreStatus } from '@/features/explore/explore-screen';
import { FilterSheet, type SortKey } from '@/features/explore/filter-sheet';
import {
  countActiveFilters,
  destinationRegionMap,
  EMPTY_TOUR_FILTERS,
  filterTours,
  searchTours,
  type TourFilterState,
} from '@/features/explore/tour-filters';
import { HOME_REGIONS } from '@/features/home/group-destinations-by-region';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { getAuthClient } from '@/lib/auth-client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import { formatMoney } from '@/lib/format-money';
import { toggleWishedId } from '@/lib/wishlist';

/**
 * Sort chạy SERVER (handoff §6.1): đúng 4 kiểu `toursPage.sortOptions` — API
 * đỡ đủ. KHÔNG dùng `mobile.explore.sort` (popular/rating), bị bỏ có chủ ý.
 */
const SORT_PARAMS: Record<
  SortKey,
  { sort: 'createdAt' | 'basePrice' | 'durationDays'; order: 'asc' | 'desc' }
> = {
  newest: { sort: 'createdAt', order: 'desc' },
  priceAsc: { sort: 'basePrice', order: 'asc' },
  priceDesc: { sort: 'basePrice', order: 'desc' },
  durationAsc: { sort: 'durationDays', order: 'asc' },
};

const DURATION_KEYS = ['1', '2-3', '4+'] as const;
const PRICE_KEYS = ['<100', '100-300', '300+'] as const;
const DIFFICULTY_KEYS = ['EASY', 'MODERATE', 'CHALLENGING'] as const;

/**
 * Route Explore: gọi `catalog.tours.list` (category/destination/search/sort lọc
 * SERVER) rồi lọc thêm client-side bốn facet chưa có tham số (region/duration/
 * price/difficulty — `tour-filters.ts`). `ExploreScreen`/`FilterSheet` chỉ vẽ
 * (ADR-0047 §2, khuôn `features/home`).
 */
export default function ExploreRoute() {
  const params = useLocalSearchParams<{ destination?: string }>();
  const [destinationSlug, setDestinationSlug] = useState<string | null>(params.destination ?? null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<TourFilterState>(EMPTY_TOUR_FILTERS);
  const [sort, setSort] = useState<SortKey>('newest');
  const [sheetOpen, setSheetOpen] = useState(false);
  // E1/E4 — tim trên thẻ tour; cùng khuôn D6 ở `tours/[slug].tsx`.
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [wishedIds, setWishedIds] = useState<ReadonlySet<string>>(new Set());
  const [wishlistError, setWishlistError] = useState<string | null>(null);

  const { data: session } = getAuthClient().useSession();
  const signedIn = Boolean(session?.user);

  // Tab (tabs) KHÔNG bị gỡ khi chuyển tab (expo-router giữ mount) — bấm thẻ
  // địa danh ở Home rồi nhảy `/explore?destination=x` khi Explore ĐÃ mount sẵn
  // từ trước thì state chỉ đọc param một lần lúc mount là kẹt nguyên giá trị
  // cũ, không tự vào E4. Đồng bộ lại mỗi khi param thật sự đổi.
  useEffect(() => {
    if (params.destination !== undefined) setDestinationSlug(params.destination);
  }, [params.destination]);

  // Chờ ~300ms sau phím cuối mới gọi API (handoff §1) — gõ liên tục không bắn
  // một request mỗi phím.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const { explore, home } = messages.mobile;

  // `search` KHÔNG gửi cho API (handoff §6.2): API tìm bằng ILIKE, có dấu —
  // gõ "ha" phải ra Hà Nội/Hạ Long/Hà Giang, ILIKE không làm được. Lọc ở máy
  // bằng `searchTours` (bỏ dấu, cùng cách `apps/web/src/lib/tours.ts` đã né
  // vấn đề này từ trước), cùng khuôn với bốn facet region/duration/price/
  // difficulty đã lọc client-side sẵn.
  const toursQuery = useQuery(
    orpc.catalog.tours.list.queryOptions({
      input: {
        limit: 50,
        category: selectedCategory ?? undefined,
        destination: destinationSlug ?? undefined,
        ...SORT_PARAMS[sort],
      },
    }),
  );
  const categoriesQuery = useQuery(orpc.catalog.categories.list.queryOptions());
  const destinationsQuery = useQuery(orpc.catalog.destinations.list.queryOptions());

  const regionBySlug = useMemo(
    () => destinationRegionMap(destinationsQuery.data ?? []),
    [destinationsQuery.data],
  );
  const allTours = toursQuery.data?.items ?? [];
  const filteredTours = useMemo(
    () => filterTours(searchTours(allTours, search), filters, regionBySlug),
    [allTours, search, filters, regionBySlug],
  );

  // E1/E4 — trạng thái wished cho CẢ TRANG một lần (batch, trần 100 id của
  // contract) — không hỏi riêng từng thẻ (N+1). `idsKey` ổn định để effect
  // không chạy lại mỗi render vì mảng mới tham chiếu.
  const tourIds = allTours.map((tour) => tour.id);
  const wishlistCheckQuery = useQuery(
    orpc.wishlist.check.queryOptions({
      input: { tourIds: tourIds.slice(0, 100) },
      context: withMobileAuth(),
      enabled: signedIn && tourIds.length > 0,
    }),
  );
  useEffect(() => {
    if (wishlistCheckQuery.data !== undefined) {
      setWishedIds(new Set(wishlistCheckQuery.data.wishedTourIds));
    }
  }, [wishlistCheckQuery.data]);
  useEffect(() => {
    if (!signedIn) setWishedIds(new Set());
  }, [signedIn]);
  useEffect(() => {
    if (wishlistError === null) return;
    const id = setTimeout(() => setWishlistError(null), 3000);
    return () => clearTimeout(id);
  }, [wishlistError]);

  const setWishlistMutation = useMutation(
    orpc.wishlist.set.mutationOptions({ context: withMobileAuth() }),
  );

  function handleFavoritePress(slug: string) {
    if (!signedIn) {
      setAuthGateOpen(true);
      return;
    }
    const tour = allTours.find((t) => t.slug === slug);
    if (tour === undefined) return;
    const next = !wishedIds.has(tour.id);
    // Lạc quan (D6): đổi ngay, hỏng thì trả lại + báo lỗi ngắn.
    setWishedIds((current) => toggleWishedId(current, tour.id));
    setWishlistMutation.mutate(
      { tourId: tour.id, wished: next },
      {
        onError: () => {
          setWishedIds((current) => toggleWishedId(current, tour.id));
          setWishlistError(messages.wishlist.error);
        },
      },
    );
  }
  // E2: dùng CHUNG `search` đã debounce với tours.list — địa danh và tour
  // xuất hiện cùng lúc thay vì địa danh nhảy sớm hơn tour ~300ms.
  const searchDestinations = useMemo(
    () => matchDestinationsByPrefix(destinationsQuery.data ?? [], search),
    [destinationsQuery.data, search],
  );

  const status: ExploreStatus = toursQuery.isPending
    ? 'loading'
    : toursQuery.isError
      ? 'error'
      : 'content';

  const activeDestination =
    destinationSlug === null
      ? null
      : ((destinationsQuery.data ?? []).find((d) => d.slug === destinationSlug) ?? null);

  const regionOptions = HOME_REGIONS.map((region) => ({
    key: region,
    label: home.regionShort[region] ?? region,
  }));
  const durationOptions = DURATION_KEYS.map((key) => ({ key, label: explore.duration[key] }));
  const priceOptions = PRICE_KEYS.map((key) => ({ key, label: explore.price[key] }));
  const difficultyOptions = DIFFICULTY_KEYS.map((key) => ({
    key,
    label: messages.toursPage.difficultyLabels[key],
  }));
  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'newest', label: messages.toursPage.sortOptions.newest },
    { key: 'priceAsc', label: messages.toursPage.sortOptions.priceAsc },
    { key: 'priceDesc', label: messages.toursPage.sortOptions.priceDesc },
    { key: 'durationAsc', label: messages.toursPage.sortOptions.durationAsc },
  ];

  return (
    <>
      <ExploreScreen
        status={status}
        title={explore.title}
        searchValue={searchInput}
        searchPlaceholder={explore.searchPlaceholder}
        onChangeSearch={setSearchInput}
        onRetry={() => void toursQuery.refetch()}
        activeFilterCount={countActiveFilters(filters)}
        onOpenFilters={() => setSheetOpen(true)}
        filtersLabel={explore.filtersCta}
        clearFiltersLabel={explore.clearFilters}
        categories={categoriesQuery.data ?? []}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        allCategoriesLabel={explore.allOption}
        destinationHeader={
          activeDestination === null
            ? null
            : {
                name: activeDestination.name,
                region: activeDestination.region,
                description: activeDestination.description,
                imageUrl: activeDestination.cover?.url ?? null,
              }
        }
        onClearDestination={() => setDestinationSlug(null)}
        onClearFilters={() => {
          setDestinationSlug(null);
          setSelectedCategory(null);
          setSearchInput('');
          setFilters(EMPTY_TOUR_FILTERS);
        }}
        destinationsTitle={explore.destinationsTitle}
        searchDestinations={searchDestinations.map((d) => ({
          slug: d.slug,
          imageUrl: d.cover?.url ?? null,
          name: d.name,
          tourCountLabel: explore.resultsCount(d.tourCount),
        }))}
        onSelectDestination={(slug) => {
          // Bấm thẻ địa danh → E4 (handoff §1): lọc theo địa danh đó, thoát
          // khỏi trạng thái tìm.
          setDestinationSlug(slug);
          setSearchInput('');
        }}
        resultsCountLabel={explore.resultsCount(filteredTours.length)}
        tours={filteredTours.map((tour) => {
          const primary = tour.destinations.find((d) => d.isPrimary) ?? tour.destinations[0];
          // Giá gạch CHỈ khi có khuyến mãi thật (luật 15/09 của web) — không in
          // `tour.compareAtPrice` (giá niêm yết) cấp tour.
          const showCompare = Number(tour.priceFrom) < Number(tour.basePrice);
          return {
            slug: tour.slug,
            imageUrl: tour.cover?.url ?? null,
            title: tour.title,
            locationLabel: `${primary?.name ?? ''} · ${home.durationDays(tour.durationDays)}`,
            priceLabel: formatMoney(tour.priceFrom, tour.currency),
            compareAtPriceLabel: showCompare ? formatMoney(tour.basePrice, tour.currency) : null,
            rating: tour.ratingAvg,
            favorited: wishedIds.has(tour.id),
          };
        })}
        onTourPress={(slug) => router.navigate(`/tours/${slug}`)}
        onFavoritePress={handleFavoritePress}
        fromLabel={home.from}
        favoriteLabelFor={(title) => messages.toursPage.wishlistLabel(title)}
        emptyTitle={explore.empty}
        errorTitle={explore.error}
        retryLabel={explore.retry}
        readMoreLabel={explore.readMore}
        wishlistErrorLabel={wishlistError}
        transformUrl={cloudinaryUrl}
      />
      <FilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        regionOptions={regionOptions}
        durationOptions={durationOptions}
        priceOptions={priceOptions}
        difficultyOptions={difficultyOptions}
        sortOptions={sortOptions}
        filters={filters}
        onChangeFilters={setFilters}
        sort={sort}
        onChangeSort={setSort}
        resultCount={filteredTours.length}
        onClearAll={() => setFilters(EMPTY_TOUR_FILTERS)}
        labels={{
          title: explore.filtersCta,
          clearAll: explore.clearAll,
          regionTitle: explore.regionTitle,
          durationTitle: explore.durationTitle,
          priceTitle: explore.priceTitle,
          difficultyTitle: explore.difficultyTitle,
          sortTitle: explore.sortTitle,
          allRegions: explore.allOption,
          showResults: explore.showResults,
        }}
      />
      <AuthGateSheet
        visible={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        title={messages.mobile.authPrompts.savedGateTitle}
        body={messages.mobile.authPrompts.wishlistReason}
        signInLabel={messages.mobile.authPrompts.signIn}
        createAccountLabel={messages.mobile.authPrompts.createAccount}
        // Cùng nợ với D6 ở tour-detail: chưa giữ ý định "quay lại + tự lưu"
        // sau khi đăng nhập xong.
        onSignIn={() => {
          setAuthGateOpen(false);
          router.navigate('/login');
        }}
        onCreateAccount={() => {
          setAuthGateOpen(false);
          router.navigate('/register');
        }}
      />
    </>
  );
}
