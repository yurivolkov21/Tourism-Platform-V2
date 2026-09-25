import { AppImage, AppText, useTheme, withAlpha } from '@tourism/mobile-ui';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

export interface SearchResultDestination {
  slug: string;
  imageUrl: string | null;
  name: string;
  /** `explore.resultsCount(n)` đã format sẵn (vd "11 tours"). */
  tourCountLabel: string;
}

export interface SearchResultTour {
  slug: string;
  imageUrl: string | null;
  title: string;
  /** "Hà Giang · 4 days · From $329" — ghép sẵn ở route. */
  locationLabel: string;
}

export interface SearchResultsProps {
  destinationsTitle: string;
  destinations: readonly SearchResultDestination[];
  toursCountLabel: string;
  tours: readonly SearchResultTour[];
  onDestinationPress: (slug: string) => void;
  onTourPress: (slug: string) => void;
  transformUrl?: (source: string, width: number) => string;
}

/**
 * Kết quả ô tìm chung (`.mini-dest`/`.result-row` bản vẽ 18/09, E2 —
 * ADR-0047 T3): nhóm Destinations cuộn ngang trước, nhóm Tours danh sách dọc
 * sau. Nhóm nào rỗng thì ẩn hẳn tiêu đề của nhóm đó — route đã đảm bảo không
 * bao giờ CẢ HAI cùng rỗng (rơi về E5 thay vì tới đây).
 */
export function SearchResults({
  destinationsTitle,
  destinations,
  toursCountLabel,
  tours,
  onDestinationPress,
  onTourPress,
  transformUrl,
}: SearchResultsProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing(5) }}>
      {destinations.length === 0 ? null : (
        <View style={{ gap: theme.spacing(2) }}>
          <AppText variant="caption" tone="muted">
            {destinationsTitle}
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.spacing(3) }}
          >
            {destinations.map((destination) => (
              <MiniDestinationCard
                key={destination.slug}
                destination={destination}
                onPress={() => onDestinationPress(destination.slug)}
                transformUrl={transformUrl}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {tours.length === 0 ? null : (
        <View style={{ gap: theme.spacing(2) }}>
          <AppText variant="caption" tone="muted">
            {toursCountLabel}
          </AppText>
          <View style={{ gap: theme.spacing(2) }}>
            {tours.map((tour) => (
              <ResultRow
                key={tour.slug}
                tour={tour}
                onPress={() => onTourPress(tour.slug)}
                transformUrl={transformUrl}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

/** Thẻ nhỏ 140×100 (`.mini-dest`) — ảnh phủ kín, tên + số tour đè đáy. */
function MiniDestinationCard({
  destination,
  onPress,
  transformUrl,
}: {
  destination: SearchResultDestination;
  onPress: () => void;
  transformUrl?: (source: string, width: number) => string;
}) {
  const theme = useTheme();
  const width = 140;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={destination.name}
      onPress={onPress}
      style={{
        width,
        height: 100,
        borderRadius: theme.radius.base * 2.5,
        overflow: 'hidden',
        backgroundColor: theme.colors.muted,
        justifyContent: 'flex-end',
        padding: theme.spacing(2.5),
      }}
    >
      {destination.imageUrl === null ? null : (
        <View style={StyleSheet.absoluteFill}>
          <AppImage
            source={destination.imageUrl}
            width={width}
            alt={destination.name}
            transformUrl={transformUrl}
            fill
          />
        </View>
      )}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(theme.colors.scrim, 0.5) }]}
      />
      <AppText variant="label" tone="media" numberOfLines={1}>
        {destination.name}
      </AppText>
      <AppText variant="caption" tone="media" style={{ opacity: 0.85 }}>
        {destination.tourCountLabel}
      </AppText>
    </Pressable>
  );
}

/** Hàng kết quả tour (`.result-row`/`.thumb`) — ảnh vuông nhỏ + tiêu đề + vị trí. */
function ResultRow({
  tour,
  onPress,
  transformUrl,
}: {
  tour: SearchResultTour;
  onPress: () => void;
  transformUrl?: (source: string, width: number) => string;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tour.title}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), height: 64 }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: theme.radius.base * 2,
          overflow: 'hidden',
          backgroundColor: theme.colors.muted,
        }}
      >
        {tour.imageUrl === null ? null : (
          <AppImage
            source={tour.imageUrl}
            width={56}
            alt={tour.title}
            transformUrl={transformUrl}
            fill
          />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="label" numberOfLines={1}>
          {tour.title}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {tour.locationLabel}
        </AppText>
      </View>
    </Pressable>
  );
}
