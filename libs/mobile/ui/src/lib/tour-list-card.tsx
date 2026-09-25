import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppImage } from './app-image';
import { AppText } from './app-text';
import { withAlpha } from './theme';
import { useTheme } from './theme-provider';

export interface TourListCardProps {
  imageUrl: string | null;
  imageAlt: string;
  title: string;
  /** "Hội An · 1 day" — địa danh chính + thời lượng, đã ghép sẵn. */
  locationLabel: string;
  /** `explore.` nhãn "From" đứng trước giá — mảng chữ tĩnh, truyền vào để
      card không phụ thuộc `@tourism/i18n` (ranh giới package, ADR-0040 §2). */
  fromLabel: string;
  priceLabel: string;
  /** Giá gạch — chỉ khi có khuyến mãi thật (`priceFrom < basePrice`). */
  compareAtPriceLabel: string | null;
  /** `null` = chưa ai đánh giá — ẩn hẳn chip sao, không in "0.0". */
  rating: number | null;
  favorited: boolean;
  favoriteLabel: string;
  onFavoritePress: () => void;
  onPress: () => void;
  /** Xem `AppImageProps.transformUrl` — mặc định không transform. */
  transformUrl?: (source: string, width: number) => string;
  width: number;
}

/**
 * Thẻ tour ngang của Explore (`.list-card` bản vẽ 18/09 — ADR-0047 T2): ảnh
 * phủ kín cao `spacing(42)`, chip sao góc trên-trái, nút tim kính mờ góc
 * trên-phải, tiêu đề + vị trí góc dưới-trái, giá góc dưới-phải.
 */
export function TourListCard({
  imageUrl,
  imageAlt,
  title,
  locationLabel,
  fromLabel,
  priceLabel,
  compareAtPriceLabel,
  rating,
  favorited,
  favoriteLabel,
  onFavoritePress,
  onPress,
  transformUrl,
  width,
}: TourListCardProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={{
        width,
        height: theme.spacing(42),
        borderRadius: theme.radius.base * 3,
        overflow: 'hidden',
        backgroundColor: theme.colors.muted,
      }}
    >
      {imageUrl === null ? null : (
        <View style={StyleSheet.absoluteFill}>
          <AppImage
            source={imageUrl}
            width={width}
            alt={imageAlt}
            transformUrl={transformUrl}
            fill
          />
        </View>
      )}
      {/* Scrim đậm hơn DestinationCard (35%→88%): thẻ này thấp hơn nên chữ
          chân thẻ cần nền tối dày hơn mới đọc được trên ảnh sáng. */}
      <LinearGradient
        colors={[
          withAlpha(theme.colors.scrim, 0.35),
          withAlpha(theme.colors.scrim, 0),
          withAlpha(theme.colors.scrim, 0.1),
          withAlpha(theme.colors.scrim, 0.88),
        ]}
        locations={[0, 0.3, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {rating === null ? null : (
        <View
          testID="tour-list-card-rating"
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: theme.spacing(3),
            left: theme.spacing(3),
            flexDirection: 'row',
            alignItems: 'center',
            height: theme.spacing(7),
            paddingHorizontal: theme.spacing(2.5),
            borderRadius: 999,
            gap: theme.spacing(1),
            backgroundColor: withAlpha(theme.colors.scrim, 0.45),
          }}
        >
          {/* Feather chỉ có sao viền — mockup muốn sao ĐẶC (data-fill="1"),
              đổi sang Ionicons (cùng gói @expo/vector-icons, không thêm phụ thuộc). */}
          <Ionicons name="star" size={12} color={theme.colors.rating} />
          <AppText
            variant="caption"
            style={{ color: theme.colors['on-media'], fontFamily: theme.fonts.semibold }}
          >
            {rating.toFixed(1)}
          </AppText>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={favoriteLabel}
        accessibilityState={{ selected: favorited }}
        onPress={onFavoritePress}
        style={{
          position: 'absolute',
          top: theme.spacing(1),
          right: theme.spacing(1),
          width: theme.touchTargetMin,
          height: theme.touchTargetMin,
          borderRadius: theme.touchTargetMin / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: withAlpha(theme.colors.scrim, 0.45),
        }}
      >
        {/* Feather không có biến thể "đặc" — đổi sang Ionicons lúc đã lưu
            (cùng gói @expo/vector-icons, không thêm phụ thuộc; cùng cách
            `star`/`data-fill="1"` phía trên): tim ĐẶC RUỘT + đổi màu, không
            chỉ đổi màu icon viền. */}
        {favorited ? (
          <Ionicons name="heart" size={20} color={theme.colors['destructive-emphasis']} />
        ) : (
          <Feather name="heart" size={20} color={theme.colors['on-media']} />
        )}
      </Pressable>

      <View
        style={{
          position: 'absolute',
          left: theme.spacing(4),
          right: theme.spacing(24),
          bottom: theme.spacing(3.5),
          gap: 2,
        }}
      >
        <AppText variant="heading" tone="media" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" tone="media" style={{ opacity: 0.85 }} numberOfLines={1}>
          {locationLabel}
        </AppText>
      </View>

      <View
        style={{
          position: 'absolute',
          right: theme.spacing(4),
          bottom: theme.spacing(3.5),
          alignItems: 'flex-end',
        }}
      >
        {compareAtPriceLabel === null ? (
          <AppText variant="caption" tone="media" style={{ opacity: 0.8 }}>
            {fromLabel}
          </AppText>
        ) : (
          <AppText
            variant="caption"
            tone="media"
            style={{ opacity: 0.7, textDecorationLine: 'line-through' }}
          >
            {compareAtPriceLabel}
          </AppText>
        )}
        <AppText variant="label" tone="media">
          {priceLabel}
        </AppText>
      </View>
    </Pressable>
  );
}
