import Feather from '@expo/vector-icons/Feather';
import { messages } from '@tourism/i18n';
import { AppText, Button, useTheme, withAlpha } from '@tourism/mobile-ui';
import { LinearGradient } from 'expo-linear-gradient';
import { ImageBackground, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AUTH_PHOTOS } from '@/features/auth/auth-media';

export interface OnboardingScreenProps {
  /** Trang đang xem, 0-based. */
  index: number;
  onNext: () => void;
  onSkip: () => void;
  onStart: () => void;
  onSignIn: () => void;
}

const PAGES = messages.mobile.onboarding.pages;

/**
 * Ba trang giới thiệu, chỉ hiện lần đầu mở app (khung 1b–1d).
 *
 * Ảnh phủ TOÀN màn, chữ nằm đè lên phần chân ảnh đã tối đi — nên mọi chữ ở đây
 * dùng tông `media`, không phải tông chữ thường của app.
 */
export function OnboardingScreen({
  index,
  onNext,
  onSkip,
  onStart,
  onSignIn,
}: OnboardingScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const copy = messages.mobile.onboarding;
  const page = PAGES[index] ?? PAGES[0];
  const isLast = index === PAGES.length - 1;

  if (page === undefined) return null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ImageBackground
        testID="onboarding-photo"
        source={AUTH_PHOTOS.onboarding[index] ?? AUTH_PHOTOS.onboarding[0]}
        resizeMode="cover"
        style={{ flex: 1 }}
      >
        {/* Năm chặng: tối nhẹ ở đỉnh cho chữ trạng thái, trong ở khoảng giữa để
            ảnh còn là ảnh, rồi đặc dần về chân màn cho chữ đọc được. */}
        <LinearGradient
          colors={[
            withAlpha(theme.colors.scrim, 0.45),
            withAlpha(theme.colors.scrim, 0),
            withAlpha(theme.colors.scrim, 0.15),
            withAlpha(theme.colors.scrim, 0.82),
            withAlpha(theme.colors.scrim, 0.94),
          ]}
          locations={[0, 0.22, 0.45, 0.72, 1]}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          {isLast ? null : (
            <View
              style={{
                position: 'absolute',
                // Đo từ inset chứ không đặt cứng: bản vẽ có thanh trạng thái
                // giả cao 40px, máy thật cao hơn.
                top: insets.top + theme.spacing(3),
                right: theme.spacing(4),
              }}
            >
              <Pressable onPress={onSkip} hitSlop={theme.spacing(2)}>
                <AppText variant="label" tone="media">
                  {copy.skip}
                </AppText>
              </Pressable>
            </View>
          )}

          <View
            style={{
              paddingHorizontal: theme.spacing(6),
              paddingBottom: insets.bottom + theme.spacing(6),
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) }}>
              <Feather name="map-pin" size={12} color={theme.colors['on-media']} />
              <AppText variant="caption" tone="media">
                {page.place}
              </AppText>
            </View>

            <AppText variant="display" tone="media" style={{ marginTop: theme.spacing(2) }}>
              {page.title}
            </AppText>
            <AppText
              variant="subtitle"
              tone="media"
              style={{ marginTop: theme.spacing(1.5), opacity: 0.78 }}
            >
              {page.body}
            </AppText>

            {isLast ? (
              <View style={{ marginTop: theme.spacing(5.5), gap: theme.spacing(2) }}>
                <Dots index={index} />
                <Button shape="pill" label={copy.start} onPress={onStart} />
                <Button shape="pill" variant="media" label={copy.haveAccount} onPress={onSignIn} />
              </View>
            ) : (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: theme.spacing(6.5),
                }}
              >
                <Dots index={index} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.next}
                  onPress={onNext}
                  style={{
                    width: theme.spacing(13.5),
                    height: theme.spacing(13.5),
                    borderRadius: theme.spacing(13.5) / 2,
                    backgroundColor: theme.colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Feather
                    name="arrow-right"
                    size={22}
                    color={theme.colors['primary-foreground']}
                  />
                </Pressable>
              </View>
            )}
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

/** Ba chấm; chấm đang xem dài ra và đổi màu — không cần đếm mới biết đang ở đâu. */
function Dots({ index }: { index: number }) {
  const theme = useTheme();

  return (
    <View
      testID="onboarding-dots"
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(0.75) }}
    >
      {PAGES.map((page, position) => (
        <View
          key={page.place}
          style={{
            width: position === index ? theme.spacing(5.5) : theme.spacing(1.5),
            height: theme.spacing(1.5),
            borderRadius: theme.spacing(0.75),
            backgroundColor:
              position === index
                ? theme.colors['primary-emphasis']
                : withAlpha(theme.colors['on-media'], 0.4),
          }}
        />
      ))}
    </View>
  );
}
