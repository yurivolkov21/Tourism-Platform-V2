import type { BookingPhase, BookingStatusValue } from '@tourism/contract';
import {
  AppImage,
  AppRefreshControl,
  AppText,
  Button,
  EmptyState,
  FadeIn,
  Icon,
  LargeTitleHeader,
  PopIn,
  SCREEN_EDGES_UNDER_TABS,
  Screen,
  SegmentedControl,
  Skeleton,
  useTheme,
  withAlpha,
} from '@tourism/mobile-ui';
import { Pressable, ScrollView, View } from 'react-native';
import { NextTripCard, type NextTripVM } from './next-trip-card';
import type { TripPillTone, TripWindow } from './trips-list';

export type TripsStatus = 'loading' | 'error' | 'content';

export interface TripListItemVM {
  code: string;
  status: BookingStatusValue;
  pillTone: TripPillTone;
  imageUrl: string | null;
  title: string;
  dateRangeLabel: string;
  /** Giai đoạn đơn (`bookingPhase`, ADR-0054 AMEND 1) — route lọc chip bằng trường này
   *  TRƯỚC khi truyền `items` vào; màn chỉ đọc nó để biết còn mời trả tiền không. */
  phase: BookingPhase;
  /** Nhãn thay thế cho chuyến đang đi (giai đoạn `on_tour`). */
  pillLabel?: string;
  travellersLabel: string;
  amountLabel: string;
}

export interface TripsScreenProps {
  /** Kéo xuống để làm mới — route giữ trạng thái và gọi refetch; vắng thì không có. */
  refresh?: { refreshing: boolean; onRefresh: () => void };
  status: TripsStatus;
  title: string;
  /** `false` = chưa từng có booking nào (T2, không chip) — khác "lọc ra rỗng". */
  hasAnyTrips: boolean;
  window: TripWindow;
  onChangeWindow: (window: TripWindow) => void;
  chipAllLabel: string;
  chipUpcomingLabel: string;
  chipPastLabel: string;
  /** B5 — thẻ lớn đầu danh sách; `null` = ẩn (không có đơn upcoming/on_tour). */
  nextTrip?: NextTripVM | null;
  /** Nhãn nhóm phía trên thẻ lớn ("Next trip"). */
  nextTripLabel?: string;
  /** Đã lọc theo `window` — route lo lọc (logic thuần `filterTripsByWindow`). */
  items: readonly TripListItemVM[];
  statusLabel: (status: BookingStatusValue) => string;
  onTripPress: (code: string) => void;
  finishPaymentLabel: string;
  errorTitle: string;
  retryLabel: string;
  onRetry: () => void;
  emptyTitle: string;
  browseLabel: string;
  onBrowse: () => void;
  transformUrl?: (source: string, width: number) => string;
}

const PILL_TONE_COLORS: Record<
  TripPillTone,
  { bg: 'success' | 'warning' | 'muted'; alpha: number }
> = {
  paid: { bg: 'success', alpha: 0.18 },
  pending: { bg: 'warning', alpha: 0.22 },
  muted: { bg: 'muted', alpha: 1 },
};

function StatusPill({ tone, label }: { tone: TripPillTone; label: string }) {
  const theme = useTheme();
  const { bg, alpha } = PILL_TONE_COLORS[tone];
  const bgColor = bg === 'muted' ? theme.colors.muted : theme.colors[bg];
  // mockup: chữ `.paid` tô `success`, `.pending` tô `foreground` (KHÔNG phải
  // warning), `.off` tô `muted-foreground` — đo `getComputedStyle` trực tiếp.
  // Riêng `.paid` lệch mockup có chủ đích (G47, ADR-0019 AMEND 4): `success`
  // trần trên lớp tô 18% của chính nó chỉ 2,77:1 ở theme sáng, nên dùng token
  // vai mực `success-emphasis` (5,49 sáng, 4,55 tối).
  const textColor =
    tone === 'paid'
      ? theme.colors['success-emphasis']
      : tone === 'pending'
        ? theme.colors.foreground
        : theme.colors['muted-foreground'];

  return (
    <View
      style={{
        height: theme.spacing(6),
        paddingHorizontal: theme.spacing(2.5),
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: alpha === 1 ? bgColor : withAlpha(bgColor, alpha),
      }}
    >
      <AppText variant="caption" style={{ color: textColor, fontWeight: theme.weight.semibold }}>
        {label}
      </AppText>
    </View>
  );
}

function TripCard({
  item,
  finishPaymentLabel,
  statusLabel,
  onPress,
  transformUrl,
}: {
  item: TripListItemVM;
  finishPaymentLabel: string;
  statusLabel: (status: BookingStatusValue) => string;
  onPress: () => void;
  transformUrl?: (source: string, width: number) => string;
}) {
  const theme = useTheme();
  const thumbSize = theme.spacing(18);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        gap: theme.spacing(3),
        padding: theme.spacing(3),
        // Thẻ Material 3 (N3): bo 16, không viền — nền `card` trên nền màn là đủ tách lớp.
        borderRadius: 16,
        backgroundColor: theme.colors.card,
      }}
    >
      <View
        style={{
          width: thumbSize,
          height: thumbSize,
          borderRadius: theme.radius.base * 2,
          overflow: 'hidden',
          backgroundColor: theme.colors.muted,
        }}
      >
        {item.imageUrl === null ? null : (
          <AppImage
            source={item.imageUrl}
            width={thumbSize}
            height={thumbSize}
            alt=""
            transformUrl={transformUrl}
            fill
          />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing(2) }}
        >
          <PopIn delay={200} style={{ alignSelf: 'flex-start' }}>
            <StatusPill tone={item.pillTone} label={item.pillLabel ?? statusLabel(item.status)} />
          </PopIn>
          <AppText variant="caption" tone="muted">
            {item.travellersLabel}
          </AppText>
        </View>
        <AppText variant="label" numberOfLines={1} style={{ marginTop: theme.spacing(1.5) }}>
          {item.title}
        </AppText>
        <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
          {item.dateRangeLabel}
        </AppText>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: theme.spacing(1.5),
          }}
        >
          <AppText variant="caption" tone="muted">
            {item.code}
          </AppText>
          <AppText variant="label">{item.amountLabel}</AppText>
        </View>
        {/* Chỉ đơn còn trả được: PENDING quá hạn chót (`lapsed`) API không mở phiên nào nữa. */}
        {item.phase !== 'awaiting_payment' ? null : (
          <AppText variant="caption" tone="link" style={{ marginTop: theme.spacing(1.5) }}>
            {finishPaymentLabel}
          </AppText>
        )}
      </View>
    </Pressable>
  );
}

function SquareIcon() {
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
      <Icon name="briefcase" size={28} color={theme.colors['primary-emphasis']} />
    </View>
  );
}

function TripsLoading() {
  const theme = useTheme();
  return (
    <View style={{ paddingHorizontal: theme.spacing(4), gap: theme.spacing(3) }}>
      {[0, 1, 2].map((i) => (
        <Skeleton
          key={i}
          style={{
            height: theme.spacing(28),
            borderRadius: theme.radius.base * 3,
          }}
        />
      ))}
    </View>
  );
}

/** T1 (danh sách) + T2 (rỗng), mục 3 spec P5b-3. T3 (chưa đăng nhập) là
 *  `AuthGateScreen` riêng, route quyết định vẽ cái nào theo `signedIn`. */
export function TripsScreen({
  refresh,
  status,
  title,
  hasAnyTrips,
  window,
  onChangeWindow,
  chipAllLabel,
  chipUpcomingLabel,
  chipPastLabel,
  items,
  nextTrip = null,
  nextTripLabel,
  statusLabel,
  onTripPress,
  finishPaymentLabel,
  errorTitle,
  retryLabel,
  onRetry,
  emptyTitle,
  browseLabel,
  onBrowse,
  transformUrl,
}: TripsScreenProps) {
  const theme = useTheme();

  return (
    <Screen edges={SCREEN_EDGES_UNDER_TABS} padded={false} scrollable={false}>
      <View style={{ flex: 1, gap: theme.spacing(4) }}>
        <LargeTitleHeader title={title} />

        {status === 'loading' ? (
          <TripsLoading />
        ) : status === 'error' ? (
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing(4) }}>
            <EmptyState
              icon={<SquareIcon />}
              title={errorTitle}
              titleVariant="subtitle"
              titleTone="muted"
              surface={false}
              style={{ maxWidth: 250, alignSelf: 'center' }}
            >
              <View style={{ width: 200 }}>
                <Button label={retryLabel} onPress={onRetry} shape="pill" />
              </View>
            </EmptyState>
          </View>
        ) : !hasAnyTrips ? (
          <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing(4) }}>
            <EmptyState
              icon={<SquareIcon />}
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
          <>
            <SegmentedControl
              options={[
                { value: 'all', label: chipAllLabel },
                { value: 'upcoming', label: chipUpcomingLabel },
                { value: 'past', label: chipPastLabel },
              ]}
              value={window}
              onChange={onChangeWindow}
            />

            <ScrollView
              contentContainerStyle={{
                gap: theme.spacing(3),
                paddingBottom: theme.spacing(4),
              }}
              style={{ flex: 1 }}
              refreshControl={
                refresh === undefined ? undefined : <AppRefreshControl {...refresh} />
              }
            >
              {nextTrip === null ? null : (
                <View style={{ gap: theme.spacing(2) }}>
                  {nextTripLabel === undefined ? null : (
                    <AppText
                      variant="label"
                      style={{
                        paddingHorizontal: theme.spacing(4),
                        color: theme.colors['primary-emphasis'],
                      }}
                    >
                      {nextTripLabel}
                    </AppText>
                  )}
                  <FadeIn>
                    <NextTripCard
                      trip={nextTrip}
                      onPress={onTripPress}
                      transformUrl={transformUrl}
                    />
                  </FadeIn>
                </View>
              )}
              <View style={{ paddingHorizontal: theme.spacing(4), gap: theme.spacing(3) }}>
                {items.map((item, index) => (
                  <FadeIn key={item.code} index={index}>
                    <TripCard
                      item={item}
                      finishPaymentLabel={finishPaymentLabel}
                      statusLabel={statusLabel}
                      onPress={() => onTripPress(item.code)}
                      transformUrl={transformUrl}
                    />
                  </FadeIn>
                ))}
              </View>
            </ScrollView>
          </>
        )}
      </View>
    </Screen>
  );
}
