import Feather from '@expo/vector-icons/Feather';
import {
  AppImage,
  AppText,
  Button,
  Chip,
  EmptyState,
  SCREEN_EDGES_UNDER_TABS,
  Screen,
  SearchField,
  TourListCard,
  useTheme,
  withAlpha,
} from '@tourism/mobile-ui';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { type SearchResultDestination, SearchResults } from './search-results';

export type ExploreStatus = 'loading' | 'error' | 'content';

export interface ExploreTourVM {
  slug: string;
  imageUrl: string | null;
  title: string;
  locationLabel: string;
  priceLabel: string;
  compareAtPriceLabel: string | null;
  rating: number | null;
  favorited: boolean;
}

export interface ExploreDestinationHeader {
  name: string;
  /** `Destination.region` thô ('Northern Vietnam'…) — màn tự suy nhãn hiển thị. */
  region: string | null;
  description: string | null;
  imageUrl: string | null;
}

export interface ExploreScreenProps {
  status: ExploreStatus;
  title: string;
  searchValue: string;
  searchPlaceholder: string;
  onChangeSearch: (value: string) => void;
  onRetry: () => void;
  activeFilterCount: number;
  onOpenFilters: () => void;
  filtersLabel: string;
  clearFiltersLabel: string;
  categories: readonly { slug: string; name: string }[];
  /** `null` = "All". */
  selectedCategory: string | null;
  onSelectCategory: (slug: string | null) => void;
  allCategoriesLabel: string;
  /** Có mặt = đang lọc theo ĐÚNG một địa danh (E4) — thay hàng chip danh mục
      bằng chip địa danh gỡ được + đầu trang. */
  destinationHeader: ExploreDestinationHeader | null;
  onClearDestination: () => void;
  /** Đặt lại TOÀN BỘ bộ lọc (danh mục, facet, ô tìm, địa danh) — nút ở trạng
      thái rỗng, khác `onClearDestination` (chỉ gỡ mỗi chip địa danh ở E4). */
  onClearFilters: () => void;
  /** Ô tìm KHÔNG rỗng (E2, handoff §1) — thay hàng chip + danh sách tour bằng
      kết quả gộp Destinations/Tours. `searchDestinations` tính ở route
      (`matchDestinationsByPrefix`, chỉ dùng khi mảng này). */
  destinationsTitle: string;
  searchDestinations: readonly SearchResultDestination[];
  onSelectDestination: (slug: string) => void;
  resultsCountLabel: string;
  tours: readonly ExploreTourVM[];
  onTourPress: (slug: string) => void;
  onFavoritePress: (slug: string) => void;
  fromLabel: string;
  favoriteLabelFor: (title: string) => string;
  emptyTitle: string;
  errorTitle: string;
  retryLabel: string;
  readMoreLabel?: string;
  /** E1/E4 — lỗi ngắn khi lưu/bỏ wishlist thất bại (đã lạc quan rồi trả lại ở
      route); `null` = không có gì để báo. Cùng khuôn `TourDetailScreen` D6. */
  wishlistErrorLabel?: string | null;
  transformUrl?: (source: string, width: number) => string;
}

/**
 * Explore — bố cục bê từ bản vẽ 18/09 (E1/E3/E4 — ADR-0047 T2): tiêu đề + ô
 * tìm + nút lọc trên cùng, hàng chip (danh mục HOẶC địa danh đang lọc), đầu
 * trang địa danh khi có (E4), rồi danh sách thẻ tour dọc.
 *
 * MÀN CHỈ VẼ — mọi state (fetch, bộ lọc, ô tìm) nằm ở route
 * `app/(tabs)/explore.tsx` (ADR-0047 §2, khuôn `features/home`). Ngoại lệ duy
 * nhất: mở/thu mô tả địa danh (`readMoreOpen`) — thuần UI hiển thị, không
 * chạm dữ liệu, cùng tiền lệ `HomeLoading`'s `slow` timer.
 */
export function ExploreScreen({
  status,
  title,
  searchValue,
  searchPlaceholder,
  onChangeSearch,
  onRetry,
  activeFilterCount,
  onOpenFilters,
  filtersLabel,
  clearFiltersLabel,
  categories,
  selectedCategory,
  onSelectCategory,
  allCategoriesLabel,
  destinationHeader,
  onClearDestination,
  onClearFilters,
  destinationsTitle,
  searchDestinations,
  onSelectDestination,
  resultsCountLabel,
  tours,
  onTourPress,
  onFavoritePress,
  fromLabel,
  favoriteLabelFor,
  emptyTitle,
  errorTitle,
  retryLabel,
  readMoreLabel,
  wishlistErrorLabel = null,
  transformUrl,
}: ExploreScreenProps) {
  const theme = useTheme();
  const [readMoreOpen, setReadMoreOpen] = useState(false);
  // Bề rộng thẻ = màn − đệm hai bên (spacing(4) mỗi bên, y hệt padding của
  // ScrollView chứa nó) — trước đây là một số dp cứng, lệch với máy thật khác
  // độ rộng khung thiết kế (đo được 23/09: thẻ tràn mép / lệch cột).
  const cardWidth = useWindowDimensions().width - theme.spacing(8);
  const searching = searchValue.trim().length > 0;
  const searchHasNoResults = searching && searchDestinations.length === 0 && tours.length === 0;

  return (
    <Screen edges={SCREEN_EDGES_UNDER_TABS} padded={false} scrollable={false}>
      <View style={{ flex: 1, paddingTop: theme.spacing(3), gap: theme.spacing(4) }}>
        {wishlistErrorLabel === null ? null : (
          <View
            style={{
              position: 'absolute',
              top: theme.spacing(2),
              left: theme.spacing(4),
              right: theme.spacing(4),
              zIndex: 10,
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors['destructive-emphasis'],
              borderRadius: theme.radius.base * 2,
              paddingVertical: theme.spacing(2.5),
              paddingHorizontal: theme.spacing(3),
            }}
          >
            <AppText variant="label" style={{ textAlign: 'center' }}>
              {wishlistErrorLabel}
            </AppText>
          </View>
        )}
        <View style={{ paddingHorizontal: theme.spacing(4), gap: theme.spacing(3) }}>
          <AppText variant="title">{title}</AppText>
          <View style={{ flexDirection: 'row', gap: theme.spacing(2), alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <SearchField
                value={searchValue}
                onChangeText={onChangeSearch}
                placeholder={searchPlaceholder}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={filtersLabel}
              onPress={onOpenFilters}
              style={{
                width: theme.touchTargetMin,
                height: theme.touchTargetMin,
                borderRadius: theme.radius.base * 2.5,
                backgroundColor: theme.colors.card,
                borderWidth: 1,
                borderColor: theme.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="sliders" size={20} color={theme.colors.foreground} />
              {activeFilterCount > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    minWidth: theme.spacing(4.5),
                    height: theme.spacing(4.5),
                    borderRadius: 999,
                    backgroundColor: theme.colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 2,
                  }}
                >
                  <AppText
                    variant="caption"
                    style={{
                      color: theme.colors['primary-foreground'],
                      fontFamily: theme.fonts.semibold,
                    }}
                  >
                    {activeFilterCount}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        {/* Hàng chip (danh mục HOẶC địa danh đang lọc) biến mất khi 0 kết quả
            (E5) hoặc khi đang gõ ô tìm (E2 thay bằng kết quả gộp) — bản vẽ 18/09. */}
        {!searching && (status !== 'content' || tours.length > 0) ? (
          destinationHeader === null ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              // `flexGrow`/`flexShrink: 0`: hàng chip đứng giữa header và thân
              // màn trong một flex column — thiếu hai dòng này, cột cha có thể
              // ép chiều cao ScrollView theo layout còn lại thay vì theo đúng
              // chiều cao chip (spacing(8)), làm chip cuối bị cắt/đè lên "N tours".
              style={{ flexGrow: 0, flexShrink: 0, height: theme.spacing(8) }}
              contentContainerStyle={{
                gap: theme.spacing(2),
                paddingHorizontal: theme.spacing(4),
              }}
            >
              <Chip
                label={allCategoriesLabel}
                variant={selectedCategory === null ? 'selected' : 'default'}
                onPress={() => onSelectCategory(null)}
              />
              {categories.map((category) => (
                <Chip
                  key={category.slug}
                  label={category.name}
                  variant={selectedCategory === category.slug ? 'selected' : 'default'}
                  onPress={() => onSelectCategory(category.slug)}
                />
              ))}
            </ScrollView>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing(2),
                paddingHorizontal: theme.spacing(4),
              }}
            >
              <Chip
                label={destinationHeader.name}
                variant="removable"
                onRemove={onClearDestination}
              />
              <AppText
                variant="label"
                tone="link"
                accessibilityRole="button"
                onPress={onClearDestination}
              >
                {clearFiltersLabel}
              </AppText>
            </View>
          )
        ) : null}

        {status === 'loading' ? (
          <ExploreLoading />
        ) : status === 'error' ? (
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing(4) }}>
            <EmptyState icon={<SquareIcon name="wifi-off" />} title={errorTitle} surface={false}>
              <Button label={retryLabel} onPress={onRetry} shape="pill" />
            </EmptyState>
          </View>
        ) : searchHasNoResults || (!searching && tours.length === 0) ? (
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing(4) }}>
            <EmptyState icon={<SquareIcon name="search" />} title={emptyTitle} surface={false}>
              <Button
                label={clearFiltersLabel}
                variant="ghost"
                shape="pill"
                onPress={onClearFilters}
              />
            </EmptyState>
          </View>
        ) : searching ? (
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: theme.spacing(4),
              paddingBottom: theme.spacing(4),
            }}
          >
            <SearchResults
              destinationsTitle={destinationsTitle}
              destinations={searchDestinations}
              toursCountLabel={resultsCountLabel}
              tours={tours.map((tour) => ({
                slug: tour.slug,
                imageUrl: tour.imageUrl,
                title: tour.title,
                locationLabel: `${tour.locationLabel} · ${fromLabel} ${tour.priceLabel}`,
              }))}
              onDestinationPress={onSelectDestination}
              onTourPress={onTourPress}
              transformUrl={transformUrl}
            />
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: theme.spacing(4), gap: theme.spacing(4) }}
          >
            {destinationHeader === null ? null : (
              <DestinationHeaderBlock
                header={destinationHeader}
                open={readMoreOpen}
                onToggleOpen={() => setReadMoreOpen((v) => !v)}
                readMoreLabel={readMoreLabel ?? 'Read more'}
                transformUrl={transformUrl}
                width={cardWidth}
              />
            )}
            <AppText variant="caption" tone="muted">
              {resultsCountLabel}
            </AppText>
            <View style={{ gap: theme.spacing(3), paddingBottom: theme.spacing(4) }}>
              {tours.map((tour) => (
                <TourListCard
                  key={tour.slug}
                  imageUrl={tour.imageUrl}
                  imageAlt={tour.title}
                  title={tour.title}
                  locationLabel={tour.locationLabel}
                  fromLabel={fromLabel}
                  priceLabel={tour.priceLabel}
                  compareAtPriceLabel={tour.compareAtPriceLabel}
                  rating={tour.rating}
                  favorited={tour.favorited}
                  favoriteLabel={favoriteLabelFor(tour.title)}
                  onFavoritePress={() => onFavoritePress(tour.slug)}
                  onPress={() => onTourPress(tour.slug)}
                  transformUrl={transformUrl}
                  width={cardWidth}
                />
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}

function DestinationHeaderBlock({
  header,
  open,
  onToggleOpen,
  readMoreLabel,
  transformUrl,
  width,
}: {
  header: ExploreDestinationHeader;
  open: boolean;
  onToggleOpen: () => void;
  readMoreLabel: string;
  transformUrl?: (source: string, width: number) => string;
  width: number;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing(3) }}>
      <View
        style={{
          height: theme.spacing(33),
          borderRadius: theme.radius.base * 3,
          overflow: 'hidden',
          backgroundColor: theme.colors.muted,
          justifyContent: 'flex-end',
          padding: theme.spacing(4),
        }}
      >
        {header.imageUrl === null ? null : (
          <View style={StyleSheet.absoluteFill}>
            <AppImage
              source={header.imageUrl}
              width={width}
              alt={header.name}
              transformUrl={transformUrl}
              fill
            />
          </View>
        )}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: withAlpha(theme.colors.scrim, 0.45) },
          ]}
        />
        <AppText variant="title" tone="media">
          {header.name}
        </AppText>
        {header.region === null ? null : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) }}>
            <Feather name="map-pin" size={12} color={theme.colors['on-media']} />
            <AppText variant="caption" tone="media" style={{ opacity: 0.9 }}>
              {header.region}
            </AppText>
          </View>
        )}
      </View>
      {header.description === null ? null : (
        <View>
          <AppText variant="subtitle" tone="muted" numberOfLines={open ? undefined : 2}>
            {header.description}
          </AppText>
          <AppText variant="label" tone="link" accessibilityRole="button" onPress={onToggleOpen}>
            {readMoreLabel}
          </AppText>
        </View>
      )}
    </View>
  );
}

/** Khung vuông bo + icon giữa cho tri-state lỗi/rỗng — cùng khuôn Home's `SquareIconPanel`. */
function SquareIcon({ name }: { name: 'wifi-off' | 'search' }) {
  const theme = useTheme();

  return (
    <View
      style={{
        width: theme.spacing(16),
        height: theme.spacing(16),
        borderRadius: theme.radius.base * 2,
        backgroundColor: theme.colors.secondary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Feather name={name} size={28} color={theme.colors['primary-emphasis']} />
    </View>
  );
}

/** Khung xám cùng bố cục thẻ thật — hai thẻ giữ chỗ đủ để không giật layout khi tải xong. */
function ExploreLoading() {
  const theme = useTheme();

  return (
    <View style={{ paddingHorizontal: theme.spacing(4), gap: theme.spacing(3) }}>
      {[0, 1].map((i) => (
        <View
          key={i}
          style={{
            height: theme.spacing(42),
            borderRadius: theme.radius.base * 3,
            backgroundColor: theme.colors.muted,
          }}
        />
      ))}
    </View>
  );
}
