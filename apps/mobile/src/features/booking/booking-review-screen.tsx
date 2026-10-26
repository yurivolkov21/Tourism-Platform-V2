import type { PaymentProviderValue } from '@tourism/contract';
import {
  AppText,
  CountUpText,
  Icon,
  Screen,
  usePop,
  useTheme,
  withAlpha,
} from '@tourism/mobile-ui';
import { useState } from 'react';
import { Animated, type LayoutChangeEvent, Pressable, ScrollView, View } from 'react-native';
import {
  BookingBottomBar,
  BookingFloatNote,
  BookingStepProgress,
  BookingTripCard,
} from './booking-parts';

export interface BookingReviewScreenProps {
  step: number;
  totalSteps: number;
  /** B4 — tên các bước dưới vạch tiến trình. */
  stepNames?: readonly string[];
  stepLabel: string;
  tripHeading: string;
  trip: { imageUrl: string | null; title: string; dateRangeLabel: string };
  editTripLabel: string;
  onEditTrip: () => void;
  travellersTotalLine: string;
  priceTotal: string;
  totalRowLabel: string;
  cancellationNote: string;
  paymentMethodHeading: string;
  stripeLabel: string;
  payPalLabel: string;
  paymentProvider: PaymentProviderValue;
  onSelectProvider: (provider: PaymentProviderValue) => void;
  browserNote: string;
  totalLabel: string;
  payLabel: string;
  onPay: () => void;
  pending: boolean;
  errorMessage: string | null;
  /** B9 — đường đi tiếp cạnh `errorMessage` ("Choose another date"). `undefined`
   *  khi lỗi chỉ cần giữ nguyên màn (`CHECKOUT_FAILED` và các lỗi khác). */
  errorAction?: { label: string; onPress: () => void };
  transformUrl?: (source: string, width: number) => string;
}

/**
 * Mockup dùng icon "shield-check" (khiên + dấu tick lồng bên trong, hai path
 * SVG riêng — đo trực tiếp trên mockup). Bộ Feather (`@expo/vector-icons`)
 * app này dùng không có glyph ghép sẵn đó, chỉ có `shield` trơn và `check`
 * rời — chồng hai glyph Feather lên nhau thay vì thêm thư viện icon mới
 * (`react-native-svg`) chỉ để vẽ một icon.
 */
function ShieldCheckIcon({ size, color }: { size: number; color: string }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="shield" size={size} color={color} />
      <Icon name="check" size={size * 0.5} color={color} style={{ position: 'absolute' }} />
    </View>
  );
}

function ProviderRow({
  icon,
  label,
  selected,
  onPress,
  first = true,
  last = true,
}: {
  icon: 'credit-card';
  label: string;
  selected: boolean;
  onPress: () => void;
  first?: boolean;
  last?: boolean;
}) {
  const theme = useTheme();
  const pop = usePop(selected, 0.7);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      // C3 (N6): cổng thanh toán là hàng thẻ rời, radio đặt đầu hàng như Material 3.
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(4),
        minHeight: 56,
        paddingVertical: theme.spacing(3),
        paddingHorizontal: theme.spacing(4),
        borderTopLeftRadius: first ? 20 : 4,
        borderTopRightRadius: first ? 20 : 4,
        borderBottomLeftRadius: last ? 20 : 4,
        borderBottomRightRadius: last ? 20 : 4,
        backgroundColor: theme.colors.card,
      }}
    >
      <Animated.View
        style={{
          width: 20,
          height: 20,
          borderRadius: 99,
          borderWidth: selected ? 6 : 2,
          borderColor: selected ? theme.colors['primary-emphasis'] : theme.colors.input,
          transform: [{ scale: pop }],
        }}
      />
      <Icon name={icon} size={24} color={theme.colors['muted-foreground']} />
      <AppText variant="label" style={{ flex: 1 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** B4 — bước 3: xem lại và chọn cổng. Màn cuối trước khi rời app sang trình duyệt. */
export function BookingReviewScreen({
  step,
  totalSteps,
  stepNames,
  stepLabel,
  tripHeading,
  trip,
  editTripLabel,
  onEditTrip,
  travellersTotalLine,
  priceTotal,
  totalRowLabel,
  cancellationNote,
  paymentMethodHeading,
  stripeLabel,
  payPalLabel,
  paymentProvider,
  onSelectProvider,
  browserNote,
  totalLabel,
  payLabel,
  onPay,
  pending,
  errorMessage,
  errorAction,
  transformUrl,
}: BookingReviewScreenProps) {
  const theme = useTheme();
  const [barHeight, setBarHeight] = useState(0);

  return (
    // `edges={[]}`: header native lo đỉnh, `BookingBottomBar` tự lo vùng an
    // toàn đáy bằng đúng màu nền `card` của nó (xem JSDoc `booking-parts.tsx`).
    <Screen
      edges={[]}
      padded={false}
      scrollable={false}
      style={{ backgroundColor: theme.surfaces.grouped }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing(6),
          paddingVertical: theme.spacing(4),
        }}
      >
        <BookingStepProgress
          step={step}
          total={totalSteps}
          label={stepLabel}
          stepNames={stepNames}
        />

        <AppText variant="heading" style={{ marginTop: theme.spacing(4) }}>
          {tripHeading}
        </AppText>
        <View style={{ marginTop: theme.spacing(2), marginBottom: theme.spacing(4) }}>
          <BookingTripCard
            imageUrl={trip.imageUrl}
            title={trip.title}
            dateRangeLabel={trip.dateRangeLabel}
            editLabel={editTripLabel}
            onEdit={onEditTrip}
            transformUrl={transformUrl}
          />
        </View>

        {/* C3 (N6): giá là danh sách thẻ rời — hai hàng cách nhau 2dp. */}
        <View style={{ gap: 2, marginTop: theme.spacing(2) }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              minHeight: 56,
              paddingHorizontal: theme.spacing(4),
              backgroundColor: theme.colors.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderBottomLeftRadius: 4,
              borderBottomRightRadius: 4,
            }}
          >
            <AppText variant="subtitle" tone="muted">
              {travellersTotalLine}
            </AppText>
            <CountUpText variant="label" text={priceTotal} />
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              minHeight: 56,
              paddingHorizontal: theme.spacing(4),
              backgroundColor: theme.colors.card,
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
            }}
          >
            <AppText variant="label">{totalRowLabel}</AppText>
            <CountUpText variant="title" text={priceTotal} />
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            gap: theme.spacing(2.5),
            alignItems: 'center',
            padding: theme.spacing(3),
            borderRadius: theme.radius.base * 2,
            backgroundColor: withAlpha(theme.colors.success, 0.14),
            marginTop: theme.spacing(2),
          }}
        >
          {/* mockup `.note.good`: chỉ NỀN pha success 14%, icon/chữ vẫn màu
              `foreground` bình thường (đo `getComputedStyle` trên mockup —
              icon KHÔNG tô success) — khác badge "Almost full" tô cả icon. */}
          <ShieldCheckIcon size={18} color={theme.colors.foreground} />
          <AppText variant="subtitle" style={{ flex: 1 }}>
            {cancellationNote}
          </AppText>
        </View>

        <AppText variant="heading" style={{ marginTop: theme.spacing(5) }}>
          {paymentMethodHeading}
        </AppText>
        <View style={{ gap: 2, marginTop: theme.spacing(2) }}>
          <ProviderRow
            icon="credit-card"
            label={stripeLabel}
            selected={paymentProvider === 'STRIPE'}
            onPress={() => onSelectProvider('STRIPE')}
            last={false}
          />
          <ProviderRow
            icon="credit-card"
            label={payPalLabel}
            selected={paymentProvider === 'PAYPAL'}
            onPress={() => onSelectProvider('PAYPAL')}
            first={false}
          />
        </View>
        <AppText variant="caption" tone="muted" style={{ marginTop: theme.spacing(3) }}>
          {browserNote}
        </AppText>
      </ScrollView>

      {errorMessage === null ? null : (
        <BookingFloatNote message={errorMessage} barHeight={barHeight} action={errorAction} />
      )}

      <View onLayout={(e: LayoutChangeEvent) => setBarHeight(e.nativeEvent.layout.height)}>
        <BookingBottomBar
          totalLabel={totalLabel}
          totalAmount={priceTotal}
          animateAmount
          ctaLabel={payLabel}
          onPress={onPay}
          ctaDisabled={pending}
        />
      </View>
    </Screen>
  );
}
