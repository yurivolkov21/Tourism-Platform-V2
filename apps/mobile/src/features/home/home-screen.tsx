import Feather from '@expo/vector-icons/Feather';
import type { Destination } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  AppText,
  Button,
  DestinationCard,
  EmptyState,
  IconButton,
  RegionRail,
  type RegionRailItem,
  SCREEN_EDGES_UNDER_TABS,
  Screen,
  useTheme,
} from '@tourism/mobile-ui';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
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
  transformUrl?: (source: string, width: number) => string;
}

/**
 * Home — bố cục bê từ bản v1 (Nexora Screen-17), token/chữ/i18n giữ của v2:
 * khối header (avatar + lời chào) · hàng tiêu đề "Recommendations" kèm kính
 * lúp và đường kẻ mảnh chạy từ lề trái ra mép màn · khu duyệt theo vùng chiếm
 * TOÀN BỘ chỗ còn lại giữa đường kẻ và thanh tab.
 *
 * MÀN CHỈ VẼ — mọi state (fetch, vùng đang chọn) nằm ở route
 * `app/(tabs)/index.tsx` (ADR-0047 §2, khuôn `features/auth`).
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
  transformUrl,
}: HomeScreenProps) {
  const theme = useTheme();
  const { home, tabs } = messages.mobile;
  const metrics = homeMetrics(useWindowDimensions());

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
            }}
          >
            <Feather name="user" size={20} color={theme.colors['primary-emphasis']} />
          </Pressable>
          <View style={{ flex: 1, gap: 1 }}>
            <AppText variant="caption" tone="muted">
              {home.welcome}
            </AppText>
            <AppText variant="heading" numberOfLines={1}>
              {userName}
            </AppText>
          </View>
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
            <AppText variant="display" tone="link" numberOfLines={1} style={{ flex: 1 }}>
              {home.browseHeadline}
            </AppText>
            <IconButton
              icon="search"
              accessibilityLabel={home.searchButton}
              onPress={onSearchPress}
              size={24}
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
              <ScrollView
                horizontal
                style={{ flex: 1 }}
                showsHorizontalScrollIndicator={false}
                // Vuốt dừng đúng mép từng thẻ — thẻ kế luôn ló ra cùng một
                // lượng, không dừng lửng lơ giữa hai thẻ (v1 `snapToInterval`).
                snapToInterval={metrics.cardWidth + theme.spacing(3)}
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
                {destinations.map((destination) => (
                  <DestinationCard
                    key={destination.id}
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
                  />
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>
    </Screen>
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
          <Feather name={icon} size={28} color={theme.colors['primary-emphasis']} />
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

  // ADR-0047 §3: hẹn giờ bằng setTimeout TRONG hook màn — đây là logic UI theo
  // thời gian, khác tri-state thuần của resilience.ts.
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(id);
  }, []);

  return (
    <View style={{ flex: 1, paddingLeft: theme.spacing(4) }}>
      <View style={{ flex: 1, flexDirection: 'row', gap: theme.spacing(3) }}>
        <View
          style={{
            width: theme.spacing(11),
            height: '80%',
            borderRadius: theme.radius.base,
            backgroundColor: theme.colors.muted,
          }}
        />
        <View
          style={{
            width: metrics.cardWidth,
            height: '100%',
            borderRadius: theme.radius.base * 4,
            backgroundColor: theme.colors.muted,
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
          <Feather name="loader" size={14} color={theme.colors['muted-foreground']} />
          <AppText variant="caption" tone="muted">
            {messages.mobile.home.slowServer}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
