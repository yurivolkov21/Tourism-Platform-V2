import Feather from '@expo/vector-icons/Feather';
import {
  AppText,
  Button,
  EmptyState,
  SCREEN_EDGES_UNDER_TABS,
  Screen,
  TourListCard,
  useTheme,
  withAlpha,
} from '@tourism/mobile-ui';
import { ScrollView, useWindowDimensions, View } from 'react-native';

export type SavedStatus = 'loading' | 'error' | 'content';

export interface SavedTourVM {
  tourId: string;
  slug: string;
  imageUrl: string | null;
  title: string;
  durationLabel: string;
  priceLabel: string;
  rating: number | null;
  unavailable: boolean;
}

export interface SavedScreenProps {
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
  // Bề rộng thẻ = màn − đệm hai bên (spacing(4) mỗi bên) — cùng khuôn ExploreScreen.
  const cardWidth = useWindowDimensions().width - theme.spacing(8);

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
        {/* gap(4)=16dp khớp mockup (title `top:s*2`, count `top:s*14` — lệch
            s*12=48dp trừ chiều cao dòng title ~32dp ≈ 16dp khoảng cách thật). */}
        <View style={{ paddingHorizontal: theme.spacing(4), gap: theme.spacing(4) }}>
          <AppText variant="title">{title}</AppText>
          {countLabel === null ? null : (
            <AppText variant="caption" tone="muted">
              {countLabel}
            </AppText>
          )}
        </View>

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
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: theme.spacing(4),
              gap: theme.spacing(3),
              paddingBottom: theme.spacing(4),
            }}
          >
            {items.map((item) => (
              <View key={item.tourId} style={{ opacity: item.unavailable ? 0.55 : 1 }}>
                <TourListCard
                  imageUrl={item.imageUrl}
                  imageAlt={item.title}
                  title={item.title}
                  locationLabel={item.durationLabel}
                  fromLabel={fromLabel}
                  priceLabel={item.priceLabel}
                  compareAtPriceLabel={null}
                  rating={item.unavailable ? null : item.rating}
                  favorited
                  favoriteLabel={removeLabel}
                  onFavoritePress={() => onRemovePress(item.tourId)}
                  onPress={item.unavailable ? () => {} : () => onTourPress(item.slug)}
                  transformUrl={transformUrl}
                  width={cardWidth}
                />
                {item.unavailable ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: theme.spacing(3),
                      left: theme.spacing(3),
                      height: theme.spacing(7),
                      paddingHorizontal: theme.spacing(2.5),
                      borderRadius: 999,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: withAlpha(theme.colors.scrim, 0.6),
                    }}
                  >
                    <AppText
                      variant="caption"
                      style={{ color: theme.colors['on-media'], fontFamily: theme.fonts.semibold }}
                    >
                      {unavailableLabel}
                    </AppText>
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
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
      <Feather name={name} size={28} color={theme.colors['primary-emphasis']} />
    </View>
  );
}

function SavedLoading() {
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
