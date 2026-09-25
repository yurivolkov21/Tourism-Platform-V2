import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppImage } from './app-image';
import { AppText } from './app-text';
import { IconButton } from './icon-button';
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
}

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
}: DestinationCardProps) {
  const theme = useTheme();

  return (
    <Pressable
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
        <View style={StyleSheet.absoluteFill}>
          {/* `fill`: chiều cao do khung thẻ quyết, `width` vẫn dùng dựng URL
              transform Cloudinary đúng cỡ cần tải. */}
          <AppImage
            source={imageUrl}
            width={width}
            alt={imageAlt}
            transformUrl={transformUrl}
            fill
          />
        </View>
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
        <Feather name="compass" size={12} color={theme.colors.rating} />
        <AppText
          variant="caption"
          style={{ color: theme.colors['on-media'], fontFamily: theme.fonts.semibold }}
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
        <AppText variant="caption" tone="media" style={{ opacity: 0.85 }}>
          {eyebrow}
        </AppText>
        <AppText variant="display" tone="media" numberOfLines={2}>
          {name}
        </AppText>
        {regionLabel === '' ? null : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) }}>
            <Feather name="map-pin" size={13} color={theme.colors['on-media']} />
            <AppText variant="caption" tone="media" numberOfLines={1} style={{ opacity: 0.9 }}>
              {regionLabel}
            </AppText>
          </View>
        )}
        {description === '' ? null : (
          <AppText
            variant="subtitle"
            tone="media"
            numberOfLines={3}
            style={{ marginTop: theme.spacing(2), opacity: 0.85 }}
          >
            {description}
          </AppText>
        )}
        <View
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
        </View>
      </View>
    </Pressable>
  );
}
