import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, View } from 'react-native';
import { AppImage } from './app-image';
import { AppText } from './app-text';
import { Icon } from './icon';
import { type CardParallax, PressableScale, useMotionScale } from './motion';
import type { FeatherIconName } from './text-field';
import { withAlpha } from './theme';
import { useTheme } from './theme-provider';

export interface TourListCardProps {
  imageUrl: string | null;
  imageAlt: string;
  title: string;
  /** Danh mục ("Trekking & Adventure") — dòng chữ nhỏ viết hoa trên tên, như web; bỏ trống = ẩn. */
  categoryLabel?: string | null;
  /** Địa danh chính; `null` (tour chưa gắn địa danh) = chỉ còn thời lượng. */
  locationLabel: string | null;
  /** "1 day" — đã dịch sẵn. */
  durationLabel: string;
  /** `explore.` nhãn "From" đứng trước giá — mảng chữ tĩnh, truyền vào để
      card không phụ thuộc `@tourism/i18n` (ranh giới package, ADR-0040 §2). */
  fromLabel: string;
  priceLabel: string;
  /** Giá gạch — chỉ khi có khuyến mãi thật (`priceFrom < basePrice`). */
  compareAtPriceLabel: string | null;
  /** `null` = chưa ai đánh giá — ẩn hẳn chip sao, không in "0.0". */
  rating: number | null;
  /** Nhãn biên tập đầu tiên (`badges[0]`), đã dịch sẵn; tối đa MỘT badge trên ảnh. */
  badgeLabel?: string | null;
  /** "−15%" — chip giảm giá màu nhấn đứng trước badge (như chip `discount` của thẻ web). */
  discountLabel?: string | null;
  /** "Next departure: Nov 3" hoặc "Dates on request"; `null`/bỏ trống = ẩn dòng đợt. */
  departureLabel?: string | null;
  /** "8 seats left" — đứng cuối dòng đợt. */
  seatsLabel?: string | null;
  /** Đợt sắp kín: số chỗ đổi sang màu cảnh báo. */
  almostFull?: boolean;
  /** Tour đã gỡ (Saved): thẻ mờ 55%, chip `unavailableLabel` thay chip sao, bỏ dòng đợt. */
  unavailable?: boolean;
  unavailableLabel?: string;
  favorited: boolean;
  favoriteLabel: string;
  onFavoritePress: () => void;
  onPress: () => void;
  /** Xem `AppImageProps.transformUrl` — mặc định không transform. */
  transformUrl?: (source: string, width: number) => string;
  width: number;
  /** Parallax ảnh khi cuộn danh sách — bỏ trống thì ảnh đứng yên trong khung. */
  parallax?: CardParallax;
}

/** Ảnh vẽ dư mỗi chiều dọc chừng này dp để có chỗ trôi; `RATE` là tỉ lệ trôi so với cuộn. */
const PARALLAX_RANGE = 28;
const PARALLAX_RATE = 0.15;
const IMAGE_HEIGHT = 180;

/**
 * Thẻ tour của Explore và Saved (B2, bản vẽ Material 3): KHÔNG khung — ảnh cao 180
 * bo 14, chip sao và tối đa một badge trên ảnh, nút tim 44 góc phải; bên dưới là tên
 * và giá, địa danh · số ngày, rồi dòng đợt khởi hành kế tiếp.
 */
export function TourListCard({
  imageUrl,
  imageAlt,
  title,
  categoryLabel = null,
  locationLabel,
  durationLabel,
  fromLabel,
  priceLabel,
  compareAtPriceLabel,
  rating,
  badgeLabel = null,
  discountLabel = null,
  departureLabel = null,
  seatsLabel = null,
  almostFull = false,
  unavailable = false,
  unavailableLabel,
  favorited,
  favoriteLabel,
  onFavoritePress,
  onPress,
  transformUrl,
  width,
  parallax,
}: TourListCardProps) {
  const theme = useTheme();
  const motionScale = useMotionScale();
  // Ảnh trôi tối đa ±PARALLAX_RANGE dp quanh lúc thẻ nằm giữa màn hình, nhân hệ số giảm chuyển động.
  const shift =
    parallax === undefined
      ? undefined
      : Animated.multiply(
          parallax.scrollY.interpolate({
            inputRange: [
              parallax.cellY +
                IMAGE_HEIGHT / 2 -
                parallax.viewport / 2 -
                PARALLAX_RANGE / PARALLAX_RATE,
              parallax.cellY +
                IMAGE_HEIGHT / 2 -
                parallax.viewport / 2 +
                PARALLAX_RANGE / PARALLAX_RATE,
            ],
            outputRange: [-PARALLAX_RANGE, PARALLAX_RANGE],
            extrapolate: 'clamp',
          }),
          motionScale,
        );
  const bleed = shift === undefined ? 0 : PARALLAX_RANGE;
  // Tim nảy lên khi vừa được lưu (không nảy lúc mount với thẻ đã lưu sẵn, cũng không nảy khi bỏ lưu).
  const heartScale = useRef(new Animated.Value(1)).current;
  // Vòng đỏ nở ra rồi tan quanh tim (cùng hiệu ứng tim ở tour detail); thẻ nằm trong khung ảnh bo/cắt nên vòng
  // chỉ nở tới 1.6 lần để ít bị cắt ở mép thẻ.
  const heartRing = useRef(new Animated.Value(1)).current;
  const wasFavorited = useRef(favorited);
  useEffect(() => {
    if (favorited && !wasFavorited.current) {
      heartScale.setValue(0.5);
      Animated.spring(heartScale, {
        toValue: 1,
        friction: 3,
        tension: 200,
        useNativeDriver: true,
      }).start();
      AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
        if (reduced) return;
        heartRing.setValue(0);
        Animated.timing(heartRing, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    }
    wasFavorited.current = favorited;
  }, [favorited, heartScale, heartRing]);
  // Nút tim theo spec: scrim alpha 0,55. Chip sao và badge đậm hơn (0,72): hai chip đứng
  // sát nhau trên ảnh rối (phố đêm, biển hiệu) thì nền 0,55 lẫn vào ảnh, nhìn như một khối.
  const chipBackground = withAlpha(theme.colors.scrim, 0.72);
  const heartBackground = withAlpha(theme.colors.scrim, 0.55);
  const chipStyle = {
    height: theme.spacing(7),
    paddingHorizontal: theme.spacing(2.5),
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
    backgroundColor: chipBackground,
  } as const;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={{ width, gap: theme.spacing(3), opacity: unavailable ? 0.55 : 1 }}
    >
      <View
        style={{
          width,
          height: IMAGE_HEIGHT,
          borderRadius: 14,
          overflow: 'hidden',
          backgroundColor: theme.colors.muted,
        }}
      >
        {imageUrl === null ? null : (
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: -bleed,
              bottom: -bleed,
              transform: shift === undefined ? [] : [{ translateY: shift }],
            }}
          >
            <AppImage
              source={imageUrl}
              width={width}
              alt={imageAlt}
              transformUrl={transformUrl}
              fill
              reveal
            />
          </Animated.View>
        )}

        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: theme.spacing(3),
            left: theme.spacing(3),
            flexDirection: 'row',
            gap: theme.spacing(2),
          }}
        >
          {unavailable ? (
            <View testID="tour-list-card-unavailable" style={chipStyle}>
              <AppText variant="caption" tone="media" style={{ fontWeight: theme.weight.medium }}>
                {unavailableLabel}
              </AppText>
            </View>
          ) : (
            <>
              {rating === null ? null : (
                <View testID="tour-list-card-rating" style={chipStyle}>
                  {/* Feather chỉ có sao viền — cần sao ĐẶC nên dùng MaterialCommunityIcons (cùng gói
                      @expo/vector-icons, không thêm phụ thuộc). */}
                  <MaterialCommunityIcons name="star" size={12} color={theme.colors.rating} />
                  <AppText
                    variant="caption"
                    tone="media"
                    style={{ fontWeight: theme.weight.medium }}
                  >
                    {rating.toFixed(1)}
                  </AppText>
                </View>
              )}
              {discountLabel === null ? null : (
                <View
                  testID="tour-list-card-discount"
                  style={[chipStyle, { backgroundColor: theme.colors.primary }]}
                >
                  <AppText
                    variant="caption"
                    style={{
                      color: theme.colors['primary-foreground'],
                      fontWeight: theme.weight.semibold,
                    }}
                  >
                    {discountLabel}
                  </AppText>
                </View>
              )}
              {badgeLabel === null ? null : (
                <View testID="tour-list-card-badge" style={chipStyle}>
                  <AppText
                    variant="caption"
                    tone="media"
                    style={{ fontWeight: theme.weight.medium }}
                  >
                    {badgeLabel}
                  </AppText>
                </View>
              )}
            </>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favoriteLabel}
          accessibilityState={{ selected: favorited }}
          onPress={onFavoritePress}
          style={{
            position: 'absolute',
            top: theme.spacing(1.5),
            right: theme.spacing(1.5),
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: heartBackground,
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: 44,
              height: 44,
              borderRadius: 22,
              borderWidth: 2,
              borderColor: theme.colors['destructive-emphasis'],
              opacity: heartRing.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
              transform: [
                { scale: heartRing.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) },
              ],
            }}
          />
          {/* Feather không có biến thể "đặc" — tim ĐẶC RUỘT + đổi màu lúc đã lưu. */}
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            {favorited ? (
              <MaterialCommunityIcons
                name="heart"
                size={20}
                color={theme.colors['destructive-emphasis']}
              />
            ) : (
              <Icon name="heart" size={20} color={theme.colors['on-media']} />
            )}
          </Animated.View>
        </Pressable>
      </View>

      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing(3) }}>
          <View style={{ flex: 1 }}>
            {categoryLabel === null ? null : (
              <AppText
                testID="tour-list-card-category"
                variant="caption"
                numberOfLines={1}
                style={{
                  color: theme.colors['primary-emphasis'],
                  fontWeight: theme.weight.semibold,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                }}
              >
                {categoryLabel}
              </AppText>
            )}
            <AppText variant="heading" numberOfLines={1}>
              {title}
            </AppText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {compareAtPriceLabel === null ? (
              <AppText variant="caption" tone="muted">
                {fromLabel}
              </AppText>
            ) : (
              <AppText
                variant="caption"
                tone="muted"
                style={{ textDecorationLine: 'line-through' }}
              >
                {compareAtPriceLabel}
              </AppText>
            )}
            <AppText variant="heading">{priceLabel}</AppText>
          </View>
        </View>
        {/* Thông tin phụ: mỗi mục một icon, cách nhau bằng khoảng trắng — không nối bằng " · "
            (user 01/11: dấu chấm giữa nhìn "kiểu AI"). */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: theme.spacing(4) }}>
          {locationLabel === null ? null : <CardMeta icon="map-pin" label={locationLabel} />}
          <CardMeta icon="clock" label={durationLabel} />
        </View>
        {unavailable || departureLabel === null ? null : (
          <View
            testID="tour-list-card-departure"
            style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: theme.spacing(4) }}
          >
            <CardMeta icon="calendar" label={departureLabel} />
            {seatsLabel === null ? null : (
              <CardMeta
                testID="tour-list-card-seats"
                icon="users"
                label={seatsLabel}
                color={almostFull ? theme.colors['warning-emphasis'] : undefined}
                emphasis
              />
            )}
          </View>
        )}
      </View>
    </PressableScale>
  );
}

/** Một mục thông tin phụ của thẻ: icon nhỏ + chữ. */
function CardMeta({
  icon,
  label,
  color,
  emphasis = false,
  testID,
}: {
  icon: FeatherIconName;
  label: string;
  /** Mặc định `muted-foreground`; số chỗ sắp kín truyền màu cảnh báo. */
  color?: string;
  emphasis?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  const tint = color ?? theme.colors['muted-foreground'];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1.5) }}>
      <Icon name={icon} size={14} color={tint} />
      <AppText
        testID={testID}
        variant="caption"
        style={{ color: tint, fontWeight: emphasis ? theme.weight.medium : theme.weight.normal }}
      >
        {label}
      </AppText>
    </View>
  );
}
