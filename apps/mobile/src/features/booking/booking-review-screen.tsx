import Feather from '@expo/vector-icons/Feather';
import type { PaymentProviderValue } from '@tourism/contract';
import { AppText, Screen, useTheme, withAlpha } from '@tourism/mobile-ui';
import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, ScrollView, View } from 'react-native';
import {
  BookingBottomBar,
  BookingFloatNote,
  BookingStepProgress,
  BookingTripCard,
} from './booking-parts';

export interface BookingReviewScreenProps {
  step: number;
  totalSteps: number;
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
      <Feather name="shield" size={size} color={color} />
      <Feather name="check" size={size * 0.5} color={color} style={{ position: 'absolute' }} />
    </View>
  );
}

function ProviderRow({
  icon,
  label,
  selected,
  onPress,
}: {
  icon: 'credit-card';
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(3),
        padding: theme.spacing(3.5),
        borderRadius: theme.radius.base * 2.5,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? theme.colors['primary-emphasis'] : theme.colors.border,
        marginTop: theme.spacing(2),
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 99,
          borderWidth: selected ? 6 : 2,
          borderColor: selected ? theme.colors['primary-emphasis'] : theme.colors.input,
        }}
      />
      <Feather name={icon} size={20} color={theme.colors.foreground} />
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
    <Screen edges={[]} padded={false} scrollable={false}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing(6),
          paddingVertical: theme.spacing(4),
        }}
      >
        <BookingStepProgress step={step} total={totalSteps} label={stepLabel} />

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

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: theme.spacing(2.5),
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          }}
        >
          <AppText variant="subtitle" tone="muted">
            {travellersTotalLine}
          </AppText>
          <AppText variant="label">{priceTotal}</AppText>
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: theme.spacing(2.5),
          }}
        >
          <AppText variant="label">{totalRowLabel}</AppText>
          <AppText variant="title">{priceTotal}</AppText>
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
        <ProviderRow
          icon="credit-card"
          label={stripeLabel}
          selected={paymentProvider === 'STRIPE'}
          onPress={() => onSelectProvider('STRIPE')}
        />
        <ProviderRow
          icon="credit-card"
          label={payPalLabel}
          selected={paymentProvider === 'PAYPAL'}
          onPress={() => onSelectProvider('PAYPAL')}
        />
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
          ctaLabel={payLabel}
          onPress={onPay}
          ctaDisabled={pending}
        />
      </View>
    </Screen>
  );
}
