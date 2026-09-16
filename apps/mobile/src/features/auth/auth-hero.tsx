import Feather from '@expo/vector-icons/Feather';
import { AppText, type FeatherIconName, IconButton, useTheme, withAlpha } from '@tourism/mobile-ui';
import { LinearGradient } from 'expo-linear-gradient';
import { ImageBackground, type ImageSourcePropType, View } from 'react-native';

export interface AuthHeroProps {
  image: ImageSourcePropType;
  /** Địa danh in góc phải ảnh. Bỏ trống khi ảnh chỉ là nền trang trí. */
  place?: string;
  /** Nút thoát góc trái. Không truyền thì không vẽ nút nào (màn kết quả). */
  exit?: { icon: Extract<FeatherIconName, 'x' | 'arrow-left'>; label: string; onPress: () => void };
  /** `short` cho màn form dài như Create account. */
  height?: 'tall' | 'short';
}

/**
 * Ảnh đầu trang của cụm auth: ảnh thật, mờ dần xuống nền app, nút thoát và nhãn
 * địa danh nằm đè lên.
 *
 * Dải mờ suy TỪ TOKEN qua `withAlpha` — bốn chặng để chỗ giáp ranh không thành
 * một vạch: tối nhẹ ở đỉnh cho chữ trạng thái đọc được, trong suốt ở giữa để ảnh
 * còn là ảnh, rồi đặc dần về đúng màu nền ở chân.
 */
export function AuthHero({ image, place, exit, height = 'tall' }: AuthHeroProps) {
  const theme = useTheme();
  const photoHeight = height === 'tall' ? theme.spacing(75) : theme.spacing(57.5);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
      <ImageBackground
        testID="auth-hero-photo"
        source={image}
        resizeMode="cover"
        style={{ height: photoHeight }}
      >
        <LinearGradient
          colors={[
            withAlpha(theme.colors.scrim, 0.45),
            withAlpha(theme.colors.background, 0),
            withAlpha(theme.colors.background, 0.55),
            theme.colors.background,
          ]}
          locations={[0, 0.3, 0.66, 1]}
          style={{ flex: 1 }}
        />
      </ImageBackground>

      {exit === undefined ? null : (
        <View style={{ position: 'absolute', top: theme.spacing(11), left: theme.spacing(3) }}>
          <IconButton
            icon={exit.icon}
            accessibilityLabel={exit.label}
            variant="glass"
            onPress={exit.onPress}
          />
        </View>
      )}

      {place === undefined ? null : (
        <View
          style={{
            position: 'absolute',
            top: theme.spacing(14),
            right: theme.spacing(4.5),
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing(1),
          }}
        >
          <Feather name="map-pin" size={12} color={theme.colors['on-media']} />
          <AppText variant="caption" tone="media">
            {place}
          </AppText>
        </View>
      )}
    </View>
  );
}
