import Feather from '@expo/vector-icons/Feather';
import type { BookingStatusValue } from '@tourism/contract';
import {
  AppImage,
  AppText,
  Button,
  Chip,
  EmptyState,
  SCREEN_EDGES_UNDER_TABS,
  Screen,
  useTheme,
  withAlpha,
} from '@tourism/mobile-ui';
import { Pressable, ScrollView, View } from 'react-native';
import type { TripPillTone, TripWindow } from './trips-list';

export type TripsStatus = 'loading' | 'error' | 'content';

export interface TripListItemVM {
  code: string;
  status: BookingStatusValue;
  pillTone: TripPillTone;
  imageUrl: string | null;
  title: string;
  dateRangeLabel: string;
  /** Chỉ route dùng (lọc `filterTripsByWindow` TRƯỚC khi truyền `items` vào
   *  đây) — màn không tự đọc trường này. */
  departureStartDate: string;
  departureEndDate: string;
  /** Nhãn thay thế cho chuyến đang đi (PAID, hôm nay nằm trong ngày đi–về). */
  pillLabel?: string;
  travellersLabel: string;
  amountLabel: string;
}

export interface TripsScreenProps {
  status: TripsStatus;
  title: string;
  /** `false` = chưa từng có booking nào (T2, không chip) — khác "lọc ra rỗng". */
  hasAnyTrips: boolean;
  window: TripWindow;
  onChangeWindow: (window: TripWindow) => void;
  chipAllLabel: string;
  chipUpcomingLabel: string;
  chipPastLabel: string;
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
  const textColor =
    tone === 'paid'
      ? theme.colors.success
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
      <AppText variant="caption" style={{ color: textColor, fontFamily: theme.fonts.semibold }}>
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
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.base * 3,
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
          <StatusPill tone={item.pillTone} label={item.pillLabel ?? statusLabel(item.status)} />
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
        {item.status !== 'PENDING' ? null : (
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
      <Feather name="briefcase" size={28} color={theme.colors['primary-emphasis']} />
    </View>
  );
}

function TripsLoading() {
  const theme = useTheme();
  return (
    <View style={{ paddingHorizontal: theme.spacing(4), gap: theme.spacing(3) }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            height: theme.spacing(28),
            borderRadius: theme.radius.base * 3,
            backgroundColor: theme.colors.muted,
          }}
        />
      ))}
    </View>
  );
}

/** T1 (danh sách) + T2 (rỗng), mục 3 spec P5b-3. T3 (chưa đăng nhập) là
 *  `AuthGateScreen` riêng, route quyết định vẽ cái nào theo `signedIn`. */
export function TripsScreen({
  status,
  title,
  hasAnyTrips,
  window,
  onChangeWindow,
  chipAllLabel,
  chipUpcomingLabel,
  chipPastLabel,
  items,
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
      <View style={{ flex: 1, paddingTop: theme.spacing(3), gap: theme.spacing(4) }}>
        <AppText variant="title" style={{ paddingHorizontal: theme.spacing(4) }}>
          {title}
        </AppText>

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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: theme.spacing(4),
                paddingVertical: theme.spacing(1),
                gap: theme.spacing(2),
              }}
              style={{ flexGrow: 0, flexShrink: 0, height: theme.spacing(8) + theme.spacing(2) }}
            >
              <Chip
                label={chipAllLabel}
                variant={window === 'all' ? 'selected' : 'default'}
                onPress={() => onChangeWindow('all')}
              />
              <Chip
                label={chipUpcomingLabel}
                variant={window === 'upcoming' ? 'selected' : 'default'}
                onPress={() => onChangeWindow('upcoming')}
              />
              <Chip
                label={chipPastLabel}
                variant={window === 'past' ? 'selected' : 'default'}
                onPress={() => onChangeWindow('past')}
              />
            </ScrollView>

            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: theme.spacing(4),
                gap: theme.spacing(3),
                paddingBottom: theme.spacing(4),
              }}
            >
              {items.map((item) => (
                <TripCard
                  key={item.code}
                  item={item}
                  finishPaymentLabel={finishPaymentLabel}
                  statusLabel={statusLabel}
                  onPress={() => onTripPress(item.code)}
                  transformUrl={transformUrl}
                />
              ))}
            </ScrollView>
          </>
        )}
      </View>
    </Screen>
  );
}
