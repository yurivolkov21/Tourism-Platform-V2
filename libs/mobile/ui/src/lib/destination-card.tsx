import { LinearGradient } from 'expo-linear-gradient';
import { Animated, StyleSheet, View } from 'react-native';
import { AppImage } from './app-image';
import { AppText } from './app-text';
import { Icon } from './icon';
import { IconButton } from './icon-button';
import { FadeIn, PressableScale, useMotionScale } from './motion';
import { withAlpha } from './theme';
import { useTheme } from './theme-provider';

export interface DestinationCardProps {
  /** URL ảnh gốc (chưa transform) — `null` chỉ vẽ nền `muted` phẳng. */
  imageUrl: string | null;
  imageAlt: string;
  name: string;
  regionLabel: string;
  description: string;
  /** Chữ chip góc trên-trái, đã format sẵn (vd "11 tours") — `explore.resultsCount(n)`. */
  tourCountLabel: string;
  /** Nhãn "Recommended" phía trên tên — `home.recommendedEyebrow`. */
  eyebrow: string;
  /** `accessibilityLabel` của nút mũi tên góc dưới-phải. */
  goToLabel: string;
  onPress: () => void;
  /** Xem `AppImageProps.transformUrl` — mặc định không transform. */
  transformUrl?: (source: string, width: number) => string;
  width: number;
  /**
   * `'100%'` để thẻ cao hết khung cha (carousel quyết chiều cao), hoặc một số
   * dp khi cần khung cố định (khung xám lúc tải).
   */
  height: number | '100%';
  /**
   * Parallax khi vuốt carousel: ảnh trôi chậm hơn thẻ. `scrollX` là vị trí cuộn ngang của
   * ScrollView chứa thẻ, `index` là thứ tự thẻ, `interval` là bề ngang một nhịp snap.
   * Bỏ trống thì ảnh đứng yên trong thẻ như cũ.
   */
  parallax?: { scrollX: Animated.Value; index: number; interval: number };
}

/** Ảnh được vẽ rộng thêm mỗi bên chừng này dp để có chỗ trôi mà không lộ mép. */
const PARALLAX_RANGE = 36;

/**
 * Thẻ địa danh khổ lớn của carousel Home: ảnh phủ kín, chip số tour ở góc
 * TRÊN-TRÁI, chân thẻ xếp dọc eyebrow → tên khổ lớn → dòng vị trí → mô tả cắt
 * 3 dòng, nút mũi tên TRÒN ở góc dưới-phải. Mọi màu đi qua token v2.
 */
export function DestinationCard({
  imageUrl,
  imageAlt,
  name,
  regionLabel,
  description,
  tourCountLabel,
  eyebrow,
  goToLabel,
  onPress,
  transformUrl,
  width,
  height,
  parallax,
}: DestinationCardProps) {
  const theme = useTheme();
  const motionScale = useMotionScale();
  const shift =
    parallax === undefined
      ? undefined
      : Animated.multiply(
          parallax.scrollX.interpolate({
            inputRange: [
              (parallax.index - 1) * parallax.interval,
              (parallax.index + 1) * parallax.interval,
            ],
            outputRange: [-PARALLAX_RANGE, PARALLAX_RANGE],
            extrapolate: 'clamp',
          }),
          motionScale,
        );
  const bleed = shift === undefined ? 0 : PARALLAX_RANGE;

  return (
    <PressableScale
      containerStyle={{ width, height }}
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={onPress}
      style={{
        width,
        height,
        borderRadius: theme.radius.base * 4,
        overflow: 'hidden',
        backgroundColor: theme.colors.muted,
      }}
    >
      {imageUrl === null ? null : (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: -bleed,
            right: -bleed,
            transform: shift === undefined ? [] : [{ translateX: shift }],
          }}
        >
          {/* `fill`: chiều cao do khung thẻ quyết, `width` vẫn dùng dựng URL
              transform Cloudinary đúng cỡ cần tải. */}
          <AppImage
            source={imageUrl}
            width={width + bleed * 2}
            alt={imageAlt}
            transformUrl={transformUrl}
            fill
            reveal
          />
        </Animated.View>
      )}
      {/* Dải tối chân ảnh để chữ đọc được: trong suốt ở nửa trên, tối dần
          xuống đáy. */}
      <LinearGradient
        colors={['transparent', theme.colors.scrim]}
        locations={[0.42, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Chip số tour — góc TRÊN-TRÁI trên ảnh. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: theme.spacing(4),
          left: theme.spacing(4),
          flexDirection: 'row',
          alignItems: 'center',
          height: theme.spacing(7),
          paddingHorizontal: theme.spacing(2.5),
          borderRadius: 999,
          gap: theme.spacing(1),
          backgroundColor: withAlpha(theme.colors.scrim, 0.45),
        }}
      >
        <Icon name="compass" size={12} color={theme.colors.rating} />
        <AppText
          variant="caption"
          style={{ color: theme.colors['on-media'], fontWeight: theme.weight.semibold }}
        >
          {tourCountLabel}
        </AppText>
      </View>

      {/* Chân thẻ: eyebrow → tên → vị trí → mô tả, nút mũi tên tròn ở hàng cuối. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: theme.spacing(5),
          gap: theme.spacing(1),
        }}
      >
        {/* Chữ hiện so le sau khi ảnh lộ ra: eyebrow + tên, rồi vị trí, rồi mô tả, rồi nút. */}
        <FadeIn delay={200} style={{ gap: theme.spacing(1) }}>
          <AppText variant="caption" tone="media" style={{ opacity: 0.85 }}>
            {eyebrow}
          </AppText>
          <AppText variant="brand" tone="media" numberOfLines={2}>
            {name}
          </AppText>
        </FadeIn>
        {regionLabel === '' ? null : (
          <FadeIn delay={280}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) }}>
              <Icon name="map-pin" size={13} color={theme.colors['on-media']} />
              <AppText variant="caption" tone="media" numberOfLines={1} style={{ opacity: 0.9 }}>
                {regionLabel}
              </AppText>
            </View>
          </FadeIn>
        )}
        {description === '' ? null : (
          <FadeIn delay={360}>
            <AppText
              variant="subtitle"
              tone="media"
              numberOfLines={3}
              style={{ marginTop: theme.spacing(2), opacity: 0.85 }}
            >
              {description}
            </AppText>
          </FadeIn>
        )}
        <FadeIn
          delay={440}
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            marginTop: theme.spacing(3),
          }}
        >
          <IconButton
            icon="arrow-right"
            accessibilityLabel={goToLabel}
            onPress={onPress}
            variant="glass"
            size={22}
          />
        </FadeIn>
      </View>
    </PressableScale>
  );
}
