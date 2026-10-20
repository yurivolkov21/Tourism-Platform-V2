import type { messages } from '@tourism/i18n';
import { AppText, Screen, useTheme, withAlpha } from '@tourism/mobile-ui';
import { Pressable, ScrollView, View } from 'react-native';
import { BookingTripCard } from '@/features/booking/booking-parts';
import { formatFullDate } from '@/features/tour-detail/departures';
import { type MyReviewModerationState, myReviewNextStep, myReviewTone } from './my-reviews';

export interface MyReviewCardVM {
  id: string;
  title: string | null;
  tourTitle: string | null;
  moderationState: MyReviewModerationState;
  rejectionCount: number;
  /** Mốc ngày hiển thị theo trạng thái (ISO). */
  dateIso: string;
}

/** Một chuyến đã về mà khách chưa viết bài — một thẻ của khối đầu R4. */
export interface AwaitingReviewTripVM {
  code: string;
  tourTitle: string;
  dateRangeLabel: string;
  imageUrl: string | null;
}

export interface MyReviewsScreenProps {
  copy: typeof messages.reviews.mine;
  items: readonly MyReviewCardVM[];
  /** Chuyến chờ viết bài (`tripsAwaitingReview`); rỗng thì màn giữ nguyên như trước khối này. */
  awaiting: readonly AwaitingReviewTripVM[];
  onRetract: (id: string) => void;
  onRewrite: (id: string) => void;
  onWhy: (id: string) => void;
  onWriteReview: (bookingCode: string) => void;
  transformUrl?: (source: string, width: number) => string;
}

/** Tông → khoá màu có trong bảng màu theme (không có khoá `destructive` trần). */
const TONE_COLOR = {
  success: 'success',
  warning: 'warning',
  destructive: 'destructive-emphasis',
  muted: 'muted',
} as const;

/**
 * Tông → khoá MỰC cho chữ pill (G47, ADR-0019 AMEND 4): chữ 12dp nằm trên lớp tô 16% của chính
 * tông ấy, mà `success` trần chỉ 2,83:1 ở theme sáng — nên chữ dùng token vai mực, lớp tô giữ
 * `TONE_COLOR`.
 */
const TONE_INK = {
  ...TONE_COLOR,
  success: 'success-emphasis',
  warning: 'warning-emphasis',
} as const;

/**
 * R4 — "Đánh giá của tôi": bốn trạng thái. Pill chỉ nói trạng thái; ngày nằm bên phải cùng hàng.
 *
 * Đầu màn là khối chuyến chờ viết bài (card "Thêm khối", 15/10): mockup R4 chưa vẽ chỗ cho nó, nên
 * thẻ mượn đúng thẻ chuyến đầu màn R1 (`BookingTripCard`), và nút viết bài là link chữ như mọi nút
 * khác trong thẻ R4.
 */
export function MyReviewsScreen({
  copy,
  items,
  awaiting,
  onRetract,
  onRewrite,
  onWhy,
  onWriteReview,
  transformUrl,
}: MyReviewsScreenProps) {
  const theme = useTheme();
  const hasAwaiting = awaiting.length > 0;

  function stateLabel(state: MyReviewModerationState): string {
    if (state === 'approved') return copy.publishedLabel;
    if (state === 'pending') return copy.pendingLabel;
    if (state === 'rejected') return copy.notPublishedLabel;
    return copy.retractedLabel;
  }

  return (
    <Screen edges={[]} padded={false} scrollable={false}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing(6),
          paddingVertical: theme.spacing(4),
          gap: theme.spacing(3),
        }}
      >
        {hasAwaiting ? (
          <AppText variant="label" accessibilityRole="header">
            {copy.awaitingHeading}
          </AppText>
        ) : null}
        {awaiting.map((trip) => (
          <BookingTripCard
            key={trip.code}
            imageUrl={trip.imageUrl}
            title={trip.tourTitle}
            dateRangeLabel={trip.dateRangeLabel}
            editLabel={copy.writeReview}
            editAccessibilityLabel={copy.writeReviewFor(trip.tourTitle)}
            onEdit={() => onWriteReview(trip.code)}
            transformUrl={transformUrl}
          />
        ))}
        {hasAwaiting && items.length > 0 ? (
          <AppText
            variant="label"
            accessibilityRole="header"
            style={{ marginTop: theme.spacing(3) }}
          >
            {copy.writtenHeading}
          </AppText>
        ) : null}
        {items.length === 0 ? (
          <AppText
            variant="subtitle"
            tone="muted"
            style={{ textAlign: 'center', marginTop: hasAwaiting ? theme.spacing(3) : 0 }}
          >
            {copy.empty}
          </AppText>
        ) : null}
        {items.map((item) => {
          const toneKey = myReviewTone(item.moderationState);
          const tone = TONE_COLOR[toneKey];
          const step = myReviewNextStep(item);
          // Chữ pill đúng màu tông (chờ duyệt giữ chữ sáng như mockup).
          // Retracted: nền xám sáng + chữ sáng (mockup); các trạng thái khác: chữ và nền cùng tông,
          // chữ lấy vai mực của tông ấy (`TONE_INK`).
          const retracted = item.moderationState === 'retracted';
          const pillText =
            item.moderationState === 'pending' || retracted
              ? theme.colors.foreground
              : theme.colors[TONE_INK[toneKey]];
          const pillBg = retracted ? theme.colors['muted-foreground'] : theme.colors[tone];
          return (
            <View
              key={item.id}
              style={{
                padding: theme.spacing(4),
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.base * 3,
                backgroundColor: theme.colors.card,
                gap: theme.spacing(2),
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View
                  style={{
                    paddingHorizontal: theme.spacing(3),
                    paddingVertical: theme.spacing(1),
                    borderRadius: 999,
                    backgroundColor: withAlpha(pillBg, retracted ? 0.24 : 0.16),
                  }}
                >
                  <AppText
                    variant="caption"
                    style={{ color: pillText, fontFamily: theme.fonts.semibold }}
                  >
                    {stateLabel(item.moderationState)}
                  </AppText>
                </View>
                <AppText variant="caption" tone="muted">
                  {formatFullDate(item.dateIso)}
                </AppText>
              </View>
              {item.title === null ? null : <AppText variant="label">{item.title}</AppText>}
              {item.tourTitle === null ? null : (
                <AppText variant="caption" tone="muted">
                  {item.tourTitle}
                </AppText>
              )}
              {step === 'retract' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onRetract(item.id)}
                  style={{ alignSelf: 'flex-start' }}
                >
                  <AppText variant="caption" style={{ color: theme.colors['primary-emphasis'] }}>
                    {copy.retractAction}
                  </AppText>
                </Pressable>
              ) : null}
              {step === 'rewrite' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onRewrite(item.id)}
                  style={{ alignSelf: 'flex-start' }}
                >
                  <AppText variant="caption" style={{ color: theme.colors['primary-emphasis'] }}>
                    {copy.seeWhy}
                  </AppText>
                </Pressable>
              ) : null}
              {/* Hết lượt (R6): nút sửa đã đóng nên nhãn không được mời "rewrite" (mockup R6). */}
              {step === 'exhausted' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onWhy(item.id)}
                  style={{ alignSelf: 'flex-start' }}
                >
                  <AppText variant="caption" style={{ color: theme.colors['primary-emphasis'] }}>
                    {copy.seeWhyFinal}
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
