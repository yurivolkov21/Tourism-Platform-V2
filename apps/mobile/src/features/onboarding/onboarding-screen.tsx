import { messages } from '@tourism/i18n';
import {
  AppText,
  AuroraGradient,
  Button,
  FadeIn,
  Icon,
  useMotionScale,
  useTheme,
  withAlpha,
} from '@tourism/mobile-ui';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, View } from 'react-native';
import Reanimated, {
  interpolate,
  interpolateColor,
  Easing as ReanimatedEasing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
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
      <View style={{ flex: 1 }}>
        <OnboardingPhotos index={index} />
        {/* Màu thương hiệu giao thoa chạy chậm phủ lên ảnh, dưới dải tối của chữ. */}
        <AuroraGradient intensity={0.32} />
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
            <FadeIn key={index}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) }}>
                <Icon name="map-pin" size={12} color={theme.colors['on-media']} />
                <AppText variant="caption" tone="media">
                  {page.place}
                </AppText>
              </View>

              <AppText variant="brand" tone="media" style={{ marginTop: theme.spacing(2) }}>
                {page.title}
              </AppText>
              <AppText
                variant="subtitle"
                tone="media"
                style={{ marginTop: theme.spacing(1.5), opacity: 0.78 }}
              >
                {page.body}
              </AppText>
            </FadeIn>

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
                  <Icon name="arrow-right" size={22} color={theme.colors['primary-foreground']} />
                </Pressable>
              </View>
            )}
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

/**
 * Các ảnh xếp chồng, ảnh của trang đang xem hiện dần đè lên ảnh cũ (crossfade) và lắng từ
 * phóng 108% về 100% — lật trang thấy ảnh "trôi" sang chứ không đổi cái bụp. Cả ba ảnh nạp sẵn
 * (ảnh cục bộ) nên không có khoảng chờ.
 */
function OnboardingPhotos({ index }: { index: number }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      {AUTH_PHOTOS.onboarding.map((source, position) => (
        <PhotoLayer
          // biome-ignore lint/suspicious/noArrayIndexKey: danh sách ảnh tĩnh, thứ tự cố định
          key={position}
          source={source}
          active={position === index}
          testID={position === index ? 'onboarding-photo' : undefined}
        />
      ))}
    </View>
  );
}

function PhotoLayer({
  source,
  active,
  testID,
}: {
  source: (typeof AUTH_PHOTOS.onboarding)[number];
  active: boolean;
  testID: string | undefined;
}) {
  const opacity = useRef(new Animated.Value(active ? 1 : 0)).current;
  const settle = useRef(new Animated.Value(active ? 0 : 1)).current;
  const motionScale = useMotionScale();

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: active ? 1 : 0,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    if (active) {
      settle.setValue(1);
      Animated.timing(settle, {
        toValue: 0,
        duration: 1100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [active, opacity, settle]);

  // 1 + 0.08 × (settle: 1 → 0) × hệ số chuyển động (0 khi bật "giảm chuyển động").
  const scale = Animated.add(1, Animated.multiply(Animated.multiply(settle, 0.08), motionScale));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity, transform: [{ scale }] }]}
    >
      <Image testID={testID} source={source} resizeMode="cover" style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

/** Ba chấm; chấm đang xem dài ra và đổi màu — chuyển trang thì co giãn mượt. */
function Dots({ index }: { index: number }) {
  const theme = useTheme();

  return (
    <View
      testID="onboarding-dots"
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(0.75) }}
    >
      {PAGES.map((page, position) => (
        <Dot key={page.place} active={position === index} />
      ))}
    </View>
  );
}

function Dot({ active }: { active: boolean }) {
  const theme = useTheme();
  const progress = useSharedValue(active ? 1 : 0);
  const idle = withAlpha(theme.colors['on-media'], 0.4);
  const current = theme.colors['primary-emphasis'];
  const small = theme.spacing(1.5);
  const large = theme.spacing(5.5);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, {
      duration: 260,
      easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
    });
  }, [active, progress]);

  // Bề rộng và màu nền chạy thẳng trên luồng UI.
  const style = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [small, large]),
    backgroundColor: interpolateColor(progress.value, [0, 1], [idle, current]),
  }));

  return (
    <Reanimated.View
      style={[{ height: theme.spacing(1.5), borderRadius: theme.spacing(0.75) }, style]}
    />
  );
}
