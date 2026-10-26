import type { Destination } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  AppImage,
  AppText,
  Button,
  DestinationCard,
  EmptyState,
  FadeIn,
  Icon,
  IconButton,
  PopIn,
  RegionRail,
  type RegionRailItem,
  SCREEN_EDGES_UNDER_TABS,
  Screen,
  Skeleton,
  useTheme,
} from '@tourism/mobile-ui';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, useWindowDimensions, View } from 'react-native';
import { type HomeMetrics, homeMetrics } from './home-metrics';

export type HomeStatus = 'loading' | 'error' | 'content';

export interface HomeScreenProps {
  status: HomeStatus;
  regions: RegionRailItem[];
  selectedRegion: string;
  onSelectRegion: (key: string) => void;
  /** Địa danh CỦA vùng đang chọn, đã xếp `tourCount` giảm dần. */
  destinations: Destination[];
  onRetry: () => void;
  onSearchPress: () => void;
  onAvatarPress: () => void;
  onDestinationPress: (slug: string) => void;
  onSeeAllTours: () => void;
  /** `user.name` của phiên thật; chưa đăng nhập → `home.guestName` ("Traveller"). */
  userName: string;
  /** `user.image` của phiên thật; `null`/chưa đăng nhập → giữ icon `user` (mặc định cũ). */
  avatarUrl?: string | null;
  transformUrl?: (source: string, width: number) => string;
  /** Chuông thông báo ở bên phải hàng đầu — bỏ trống (khách chưa đăng nhập) thì không vẽ. */
  notifications?: { unreadCount: number; label: string; onPress: () => void };
}

/**
 * Home — bố cục bê từ bản v1 (Nexora Screen-17), token/chữ/i18n giữ của v2:
 * khối header (avatar + lời chào) · hàng tiêu đề "Recommendations" kèm kính
 * lúp và đường kẻ mảnh chạy từ lề trái ra mép màn · khu duyệt theo vùng chiếm
 * TOÀN BỘ chỗ còn lại giữa đường kẻ và thanh tab.
 *
 * MÀN CHỈ VẼ — mọi state (fetch, vùng đang chọn) nằm ở route
 * `app/(tabs)/index.tsx` (ADR-0055 §2, khuôn `features/auth`).
 */
export function HomeScreen({
  status,
  regions,
  selectedRegion,
  onSelectRegion,
  destinations,
  onRetry,
  onSearchPress,
  onAvatarPress,
  onDestinationPress,
  onSeeAllTours,
  userName,
  avatarUrl = null,
  transformUrl,
  notifications,
}: HomeScreenProps) {
  const theme = useTheme();
  const { home, tabs } = messages.mobile;
  const metrics = homeMetrics(useWindowDimensions());
  // Vị trí cuộn ngang của rail thẻ — nuôi parallax ảnh (native driver, không qua JS mỗi khung hình).
  const scrollX = useRef(new Animated.Value(0)).current;
  const cardInterval = metrics.cardWidth + theme.spacing(3);
  // ScrollView mới ở vùng mới bắt đầu từ 0 — đặt lại giá trị parallax cho khớp.
  // biome-ignore lint/correctness/useExhaustiveDependencies: chạy khi đổi vùng
  useEffect(() => {
    scrollX.setValue(0);
  }, [selectedRegion]);

  return (
    <Screen edges={SCREEN_EDGES_UNDER_TABS} padded={false} scrollable={false}>
      <View style={{ flex: 1, paddingTop: theme.spacing(3), gap: theme.spacing(5) }}>
        {/* Header: ô avatar + "Welcome / Traveller" (v1 `HomeHeader`). */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing(3),
            paddingHorizontal: theme.spacing(4),
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tabs.account}
            onPress={onAvatarPress}
            style={{
              width: theme.spacing(12),
              height: theme.spacing(12),
              // Tròn hoàn toàn — khớp `.avatar` mockup (border-radius:99px),
              // trước đó bo góc vuông theo nhầm khuôn ô icon vuông (phản hồi
              // 26/09).
              borderRadius: theme.spacing(6),
              backgroundColor: theme.colors.muted,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {avatarUrl === null ? (
              <Icon name="user" size={20} color={theme.colors['primary-emphasis']} />
            ) : (
              <AppImage
                source={avatarUrl}
                width={theme.spacing(12)}
                alt={userName}
                transformUrl={transformUrl}
                fill
              />
            )}
          </Pressable>
          <View style={{ flex: 1, gap: 1 }}>
            <AppText variant="caption" tone="muted">
              {home.welcome}
            </AppText>
            <AppText variant="heading" numberOfLines={1}>
              {userName}
            </AppText>
          </View>
          {notifications === undefined ? null : (
            <NotificationBell
              unreadCount={notifications.unreadCount}
              label={notifications.label}
              onPress={notifications.onPress}
            />
          )}
        </View>

        {/* Tiêu đề khổ lớn + kính lúp trần trên cùng một hàng; đường kẻ mảnh
            chạy từ lề trái RA HẾT mép phải màn (v1). */}
        <View style={{ gap: theme.spacing(3) }}>
          <View
            style={{
              paddingHorizontal: theme.spacing(4),
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing(3),
            }}
          >
            <AppText
              variant="display"
              tone="link"
              numberOfLines={1}
              // Bán đậm riêng ở Home để tiêu đề khu chính nổi trên ảnh thẻ to bên dưới; bậc
              // `display` dùng chung giữ nguyên.
              style={{ flex: 1, fontWeight: theme.weight.semibold }}
            >
              {home.browseHeadline}
            </AppText>
            <IconButton
              icon="search"
              variant="link"
              accessibilityLabel={home.searchButton}
              onPress={onSearchPress}
              // To hơn và cùng màu tiêu đề "Recommendations" — nhìn thành một cặp.
              size={28}
            />
          </View>
          <View
            style={{
              height: 1,
              marginLeft: theme.spacing(4),
              backgroundColor: theme.colors.border,
            }}
          />
        </View>

        {/* Khu duyệt theo vùng: rail xoay dọc CAO HẾT chỗ còn lại + thẻ cao
            100% theo rail (v1). */}
        {status === 'loading' ? (
          <HomeLoading metrics={metrics} />
        ) : status === 'error' ? (
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              paddingHorizontal: theme.spacing(4),
            }}
          >
            <SquareIconPanel icon="wifi-off" title={home.error}>
              <Button label={home.retry} onPress={onRetry} />
            </SquareIconPanel>
          </View>
        ) : (
          <View style={{ flex: 1, flexDirection: 'row', paddingLeft: theme.spacing(4) }}>
            <RegionRail items={regions} selected={selectedRegion} onSelect={onSelectRegion} />
            {destinations.length === 0 ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  paddingHorizontal: theme.spacing(4),
                }}
              >
                <SquareIconPanel icon="compass" title={home.regionEmpty}>
                  <AppText
                    variant="label"
                    tone="link"
                    accessibilityRole="button"
                    onPress={onSeeAllTours}
                  >
                    {home.seeAllTours}
                  </AppText>
                </SquareIconPanel>
              </View>
            ) : (
              <Animated.ScrollView
                // `key` theo vùng: đổi vùng thì dựng ScrollView mới, nằm ở thẻ đầu — dùng chung một ScrollView thì vị trí
                // cuộn cũ (vd thẻ cuối của North) vượt quá nội dung vùng mới ít thẻ hơn → màn trống tới khi chạm.
                key={selectedRegion}
                horizontal
                style={{ flex: 1 }}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
                  useNativeDriver: true,
                })}
                scrollEventThrottle={16}
                showsHorizontalScrollIndicator={false}
                // Vuốt dừng đúng mép từng thẻ — thẻ kế luôn ló ra cùng một
                // lượng, không dừng lửng lơ giữa hai thẻ (v1 `snapToInterval`).
                snapToInterval={cardInterval}
                decelerationRate="fast"
                contentContainerStyle={{
                  gap: theme.spacing(3),
                  paddingRight: theme.spacing(4),
                  // Khung nội dung phải có chiều cao XÁC ĐỊNH thì `height: '100%'`
                  // của thẻ mới quy chiếu được — thiếu dòng này thẻ co lại bằng
                  // chiều cao chữ.
                  height: '100%',
                }}
              >
                {destinations.map((destination, index) => (
                  <FadeIn key={destination.id} index={index} style={{ height: '100%' }}>
                    <Animated.View
                      style={{
                        height: '100%',
                        // Thẻ nằm sát mép trái (đang xem) to và rõ nhất; thẻ ló ra bên cạnh nhỏ và
                        // mờ dần theo khoảng cách tới vị trí snap — chạy bằng native driver.
                        opacity: scrollX.interpolate({
                          inputRange: [
                            (index - 1) * cardInterval,
                            index * cardInterval,
                            (index + 1) * cardInterval,
                          ],
                          outputRange: [0.75, 1, 0.75],
                          extrapolate: 'clamp',
                        }),
                        transform: [
                          {
                            scale: scrollX.interpolate({
                              inputRange: [
                                (index - 1) * cardInterval,
                                index * cardInterval,
                                (index + 1) * cardInterval,
                              ],
                              outputRange: [0.94, 1, 0.94],
                              extrapolate: 'clamp',
                            }),
                          },
                        ],
                      }}
                    >
                      <DestinationCard
                        imageUrl={destination.cover?.url ?? null}
                        imageAlt={destination.name}
                        name={destination.name}
                        regionLabel={destination.region ?? ''}
                        description={destination.description ?? ''}
                        tourCountLabel={messages.mobile.explore.resultsCount(destination.tourCount)}
                        eyebrow={home.recommendedEyebrow}
                        goToLabel={destination.name}
                        onPress={() => onDestinationPress(destination.slug)}
                        transformUrl={transformUrl}
                        width={metrics.cardWidth}
                        // Cao HẾT khu duyệt vùng (khuôn v1) — rail và thẻ cùng
                        // một chiều cao, không còn thẻ lùn tịt giữa rail dài.
                        height="100%"
                        parallax={{ scrollX, index, interval: cardInterval }}
                      />
                    </Animated.View>
                  </FadeIn>
                ))}
              </Animated.ScrollView>
            )}
          </View>
        )}
      </View>
    </Screen>
  );
}

/** Chuông thông báo: chấm đỏ kèm số chưa đọc (9+ khi nhiều) nảy vào khi xuất hiện. */
function NotificationBell({
  unreadCount,
  label,
  onPress,
}: {
  unreadCount: number;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <View>
      <IconButton icon="bell" accessibilityLabel={label} onPress={onPress} size={24} />
      {unreadCount === 0 ? null : (
        <PopIn style={{ position: 'absolute', top: 4, right: 2 }}>
          <View
            testID="notification-badge"
            pointerEvents="none"
            style={{
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              paddingHorizontal: 4,
              backgroundColor: theme.colors.destructive,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText
              variant="caption"
              style={{
                color: theme.colors['primary-foreground'],
                fontSize: 11,
                lineHeight: 14,
                fontWeight: theme.weight.semibold,
              }}
            >
              {unreadCount > 9 ? '9+' : String(unreadCount)}
            </AppText>
          </View>
        </PopIn>
      )}
    </View>
  );
}

/** Khối "icon vuông + câu" của trạng thái lỗi/rỗng — hành động đi qua `children`. */
function SquareIconPanel({
  icon,
  title,
  children,
}: {
  icon: 'wifi-off' | 'compass';
  title: string;
  children: ReactNode;
}) {
  const theme = useTheme();

  return (
    <EmptyState
      icon={
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
          <Icon name={icon} size={28} color={theme.colors['primary-emphasis']} />
        </View>
      }
      title={title}
      surface={false}
    >
      {children}
    </EmptyState>
  );
}

/** Khung xám đúng bố cục rail + thẻ thật (v1 dùng `Skeleton` cùng ý). */
function HomeLoading({ metrics }: { metrics: HomeMetrics }) {
  const theme = useTheme();
  const [slow, setSlow] = useState(false);

  // ADR-0055 §3: hẹn giờ bằng setTimeout TRONG hook màn — đây là logic UI theo
  // thời gian, khác tri-state thuần của resilience.ts.
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(id);
  }, []);

  return (
    <View style={{ flex: 1, paddingLeft: theme.spacing(4) }}>
      <View style={{ flex: 1, flexDirection: 'row', gap: theme.spacing(3) }}>
        <Skeleton
          style={{
            width: theme.spacing(11),
            height: '80%',
            borderRadius: theme.radius.base,
          }}
        />
        <Skeleton
          style={{
            width: metrics.cardWidth,
            height: '100%',
            borderRadius: theme.radius.base * 4,
          }}
        />
      </View>
      {slow ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing(2),
            paddingVertical: theme.spacing(3),
          }}
        >
          <Icon name="loader" size={14} color={theme.colors['muted-foreground']} />
          <AppText variant="caption" tone="muted">
            {messages.mobile.home.slowServer}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
