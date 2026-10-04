import Feather from '@expo/vector-icons/Feather';
import { AppText, Screen, useTheme } from '@tourism/mobile-ui';
import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, ScrollView, View } from 'react-native';
import {
  BookingBottomBar,
  BookingFloatNote,
  BookingStepProgress,
  BookingTripCard,
} from './booking-parts';

export interface BookingTravellersScreenProps {
  step: number;
  totalSteps: number;
  stepLabel: string;
  tripHeading: string;
  trip: { imageUrl: string | null; title: string; dateRangeLabel: string };
  editTripLabel: string;
  onEditTrip: () => void;
  travellersHeading: string;
  adultsLabel: string;
  adultPriceLabel: string;
  numAdults: number;
  onDecreaseAdults: () => void;
  onIncreaseAdults: () => void;
  adultsAtMin: boolean;
  adultsAtCap: boolean;
  decreaseAdultsLabel: string;
  increaseAdultsLabel: string;
  childrenLabel: string;
  childrenPriceNote: string;
  numChildren: number;
  onDecreaseChildren: () => void;
  onIncreaseChildren: () => void;
  childrenAtCap: boolean;
  decreaseChildrenLabel: string;
  increaseChildrenLabel: string;
  /** "12 seats left on this date" hoặc "Up to 16 guests on this tour" (B1). */
  capHintNote: string;
  /** Dải nhắc nổi khi chạm trần (B2) — `null` = ẩn. */
  capReachedNote: string | null;
  totalLabel: string;
  totalAmount: string;
  continueLabel: string;
  onContinue: () => void;
  transformUrl?: (source: string, width: number) => string;
}

function StepperRow({
  label,
  hint,
  count,
  onDecrease,
  onIncrease,
  atMin,
  atCap,
  decreaseLabel,
  increaseLabel,
  bordered,
}: {
  label: string;
  hint: string;
  count: number;
  onDecrease: () => void;
  onIncrease: () => void;
  atMin: boolean;
  atCap: boolean;
  decreaseLabel: string;
  increaseLabel: string;
  bordered: boolean;
}) {
  const theme = useTheme();

  function stepBtn(disabled: boolean, icon: 'minus' | 'plus', label2: string, onPress: () => void) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label2}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        hitSlop={theme.spacing(2)}
        style={{
          width: 36,
          height: 36,
          borderRadius: 99,
          borderWidth: 1,
          borderColor: disabled ? theme.colors.muted : theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather
          name={icon}
          size={18}
          color={disabled ? theme.colors['muted-foreground'] : theme.colors.foreground}
        />
      </Pressable>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing(3),
        borderBottomWidth: bordered ? 1 : 0,
        borderBottomColor: theme.colors.border,
      }}
    >
      <View>
        <AppText variant="label">{label}</AppText>
        <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
          {hint}
        </AppText>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(4) }}>
        {stepBtn(atMin, 'minus', decreaseLabel, onDecrease)}
        <AppText variant="heading">{count}</AppText>
        {stepBtn(atCap, 'plus', increaseLabel, onIncrease)}
      </View>
    </View>
  );
}

/**
 * B1 (số khách) + B2 (chạm trần nhóm) — cùng MỘT màn, `capReachedNote` chỉ là
 * một khối thêm vào khi đã ở trần, không phải hai route riêng (mockup: khác
 * biệt duy nhất giữa B1/B2 là dải nhắc nổi + nút + tắt).
 */
export function BookingTravellersScreen({
  step,
  totalSteps,
  stepLabel,
  tripHeading,
  trip,
  editTripLabel,
  onEditTrip,
  travellersHeading,
  adultsLabel,
  adultPriceLabel,
  numAdults,
  onDecreaseAdults,
  onIncreaseAdults,
  adultsAtMin,
  adultsAtCap,
  decreaseAdultsLabel,
  increaseAdultsLabel,
  childrenLabel,
  childrenPriceNote,
  numChildren,
  onDecreaseChildren,
  onIncreaseChildren,
  childrenAtCap,
  decreaseChildrenLabel,
  increaseChildrenLabel,
  capHintNote,
  capReachedNote,
  totalLabel,
  totalAmount,
  continueLabel,
  onContinue,
  transformUrl,
}: BookingTravellersScreenProps) {
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

        <AppText variant="heading">{travellersHeading}</AppText>
        <StepperRow
          label={adultsLabel}
          hint={adultPriceLabel}
          count={numAdults}
          onDecrease={onDecreaseAdults}
          onIncrease={onIncreaseAdults}
          atMin={adultsAtMin}
          atCap={adultsAtCap}
          decreaseLabel={decreaseAdultsLabel}
          increaseLabel={increaseAdultsLabel}
          bordered
        />
        <StepperRow
          label={childrenLabel}
          hint={childrenPriceNote}
          count={numChildren}
          onDecrease={onDecreaseChildren}
          onIncrease={onIncreaseChildren}
          // Children không có sàn riêng — 0 luôn hợp lệ, nút trừ tắt ở 0.
          atMin={numChildren === 0}
          atCap={childrenAtCap}
          decreaseLabel={decreaseChildrenLabel}
          increaseLabel={increaseChildrenLabel}
          bordered={false}
        />
        <AppText variant="caption" tone="muted" style={{ marginTop: theme.spacing(3) }}>
          {capHintNote}
        </AppText>
      </ScrollView>

      {capReachedNote === null ? null : (
        <BookingFloatNote message={capReachedNote} barHeight={barHeight} />
      )}

      <View onLayout={(e: LayoutChangeEvent) => setBarHeight(e.nativeEvent.layout.height)}>
        <BookingBottomBar
          totalLabel={totalLabel}
          totalAmount={totalAmount}
          ctaLabel={continueLabel}
          onPress={onContinue}
        />
      </View>
    </Screen>
  );
}
