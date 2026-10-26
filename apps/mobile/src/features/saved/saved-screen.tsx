import {
  AppRefreshControl,
  AppText,
  Button,
  EmptyState,
  ExitCollapse,
  FadeIn,
  Icon,
  LargeTitleHeader,
  ParallaxCell,
  Presence,
  SCREEN_EDGES_UNDER_TABS,
  Screen,
  Skeleton,
  SwipeToRemove,
  TourListCard,
  useTheme,
} from '@tourism/mobile-ui';
import { useRef, useState } from 'react';
import { Animated, useWindowDimensions, View } from 'react-native';

export type SavedStatus = 'loading' | 'error' | 'content';

export interface SavedTourVM {
  tourId: string;
  slug: string;
  imageUrl: string | null;
  title: string;
  /** "Hội An · 1 day" — địa danh chính + thời lượng đã ghép sẵn, cùng khuôn
      `ExploreScreen`. Route tự nối, `null destinationName` rơi về chỉ số ngày. */
  locationLabel: string;
  priceLabel: string;
  rating: number | null;
  unavailable: boolean;
}

export interface SavedScreenProps {
  /** Kéo xuống để làm mới — route giữ trạng thái và gọi refetch; vắng thì không có. */
  refresh?: { refreshing: boolean; onRefresh: () => void };
  status: SavedStatus;
  title: string;
  items: readonly SavedTourVM[];
  onTourPress: (slug: string) => void;
  onRemovePress: (tourId: string) => void;
  removeLabel: string;
  unavailableLabel: string;
  fromLabel: string;
  errorTitle: string;
  retryLabel: string;
  onRetry: () => void;
  /** S1 — dòng đếm dưới tiêu đề ("3 tours"), `null` khi rỗng/lỗi/đang tải (S2/mockup
      không có dòng này ngoài trạng thái có dữ liệu). */
  countLabel: string | null;
  emptyTitle: string;
  browseLabel: string;
  onBrowse: () => void;
  /** S1 — lỗi ngắn khi bỏ lưu (`wishlist.set`) thất bại; `null` = không có gì để báo.
      Cùng khuôn `ExploreScreen`/`TourDetailScreen`. */
  wishlistErrorLabel?: string | null;
  transformUrl?: (source: string, width: number) => string;
}

/**
 * Saved — S1/S2 (mục 2 spec P5b-4). S3 (chưa đăng nhập) là `AuthGateScreen`
 * riêng, KHÔNG vẽ ở đây — route quyết định vẽ cái nào theo `signedIn`.
 */
export function SavedScreen({
  refresh,
  status,
  title,
  items,
  onTourPress,
  onRemovePress,
  removeLabel,
  unavailableLabel,
  fromLabel,
  errorTitle,
  retryLabel,
  onRetry,
  countLabel,
  emptyTitle,
  browseLabel,
  onBrowse,
  wishlistErrorLabel = null,
  transformUrl,
}: SavedScreenProps) {
  const theme = useTheme();
  // Thẻ đang chạy hiệu ứng "đi ra" — gỡ khỏi dữ liệu (onRemovePress) chỉ SAU khi hiệu ứng xong.
  const [removingIds, setRemovingIds] = useState<ReadonlySet<string>>(new Set());
  // Vị trí cuộn — nuôi parallax ảnh thẻ (native driver).
  const scrollY = useRef(new Animated.Value(0)).current;
  const windowHeight = useWindowDimensions().height;
  // Bề rộng thẻ = màn − đệm hai bên (spacing(4) mỗi bên) — cùng khuôn ExploreScreen.
  const cardWidth = useWindowDimensions().width - theme.spacing(8);

  return (
    <Screen edges={SCREEN_EDGES_UNDER_TABS} padded={false} scrollable={false}>
      {/* gap(2) chứ không gap(4) như trước: card đầu tiên phải NẰM GẦN dòng
          đếm hơn là cách xa nó — khoảng cách title↔count (gap(4) trong khối
          bên dưới) mới là khoảng lớn, count↔card phải hẹp hơn. */}
      <View style={{ flex: 1, gap: theme.spacing(2) }}>
        <Presence
          show={wishlistErrorLabel !== null}
          style={{
            position: 'absolute',
            top: theme.spacing(2),
            left: theme.spacing(4),
            right: theme.spacing(4),
            zIndex: 10,
          }}
        >
          <View
            style={{
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
        </Presence>
        <LargeTitleHeader title={title} subtitle={countLabel} />

        {status === 'loading' ? (
          <SavedLoading />
        ) : status === 'error' ? (
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing(4) }}>
            <EmptyState
              icon={<SquareIcon name="wifi-off" />}
              title={errorTitle}
              titleVariant="subtitle"
              titleTone="muted"
              surface={false}
              // maxWidth 250 khớp mockup (`.t-subtitle` `max-width:250px`) — chữ
              // xuống dòng đúng điểm ngắt của bản vẽ thay vì kéo hết bề ngang màn.
              style={{ maxWidth: 250, alignSelf: 'center' }}
            >
              <View style={{ width: 200 }}>
                <Button label={retryLabel} onPress={onRetry} shape="pill" />
              </View>
            </EmptyState>
          </View>
        ) : items.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing(4) }}>
            <EmptyState
              icon={<SquareIcon name="heart" />}
              title={emptyTitle}
              titleVariant="subtitle"
              titleTone="muted"
              surface={false}
              style={{ maxWidth: 250, alignSelf: 'center' }}
            >
              <View style={{ width: 200 }}>
                <Button label={browseLabel} onPress={onBrowse} shape="pill" />
              </View>
            </EmptyState>
          </View>
        ) : (
          <Animated.ScrollView
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
              useNativeDriver: true,
            })}
            scrollEventThrottle={16}
            contentContainerStyle={{
              paddingHorizontal: theme.spacing(4),
              paddingBottom: theme.spacing(4),
            }}
            style={{ flex: 1 }}
            refreshControl={refresh === undefined ? undefined : <AppRefreshControl {...refresh} />}
          >
            {items.map((item, index) => (
              <ParallaxCell key={item.tourId} scrollY={scrollY} viewport={windowHeight}>
                {(parallax) => (
                  <ExitCollapse
                    gap={theme.spacing(3)}
                    exiting={removingIds.has(item.tourId)}
                    onExited={() => {
                      setRemovingIds((current) => {
                        const next = new Set(current);
                        next.delete(item.tourId);
                        return next;
                      });
                      onRemovePress(item.tourId);
                    }}
                  >
                    <FadeIn index={index}>
                      <SwipeToRemove
                        label={removeLabel}
                        disabled={removingIds.has(item.tourId)}
                        onRemove={() =>
                          setRemovingIds((current) => new Set(current).add(item.tourId))
                        }
                      >
                        <TourListCard
                          imageUrl={item.imageUrl}
                          imageAlt={item.title}
                          title={item.title}
                          locationLabel={item.locationLabel}
                          fromLabel={fromLabel}
                          priceLabel={item.priceLabel}
                          compareAtPriceLabel={null}
                          rating={item.unavailable ? null : item.rating}
                          unavailable={item.unavailable}
                          unavailableLabel={unavailableLabel}
                          favorited
                          favoriteLabel={removeLabel}
                          onFavoritePress={() =>
                            setRemovingIds((current) => new Set(current).add(item.tourId))
                          }
                          onPress={item.unavailable ? () => {} : () => onTourPress(item.slug)}
                          transformUrl={transformUrl}
                          width={cardWidth}
                          parallax={parallax}
                        />
                      </SwipeToRemove>
                    </FadeIn>
                  </ExitCollapse>
                )}
              </ParallaxCell>
            ))}
          </Animated.ScrollView>
        )}
      </View>
    </Screen>
  );
}

function SquareIcon({ name }: { name: 'wifi-off' | 'heart' }) {
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
      <Icon name={name} size={28} color={theme.colors['primary-emphasis']} />
    </View>
  );
}

function SavedLoading() {
  const theme = useTheme();
  return (
    <View style={{ paddingHorizontal: theme.spacing(4), gap: theme.spacing(3) }}>
      {[0, 1].map((i) => (
        <Skeleton
          key={i}
          style={{
            height: theme.spacing(42),
            borderRadius: theme.radius.base * 3,
          }}
        />
      ))}
    </View>
  );
}
