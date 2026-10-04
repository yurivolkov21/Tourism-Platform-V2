import type { messages } from '@tourism/i18n';
import { AppText, Screen, useTheme, withAlpha } from '@tourism/mobile-ui';
import { Pressable, ScrollView, View } from 'react-native';
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

export interface MyReviewsScreenProps {
  copy: typeof messages.reviews.mine;
  items: readonly MyReviewCardVM[];
  onRetract: (id: string) => void;
  onRewrite: (id: string) => void;
  onWhy: (id: string) => void;
}

/** Tông → khoá màu có trong bảng màu theme (không có khoá `destructive` trần). */
const TONE_COLOR = {
  success: 'success',
  warning: 'warning',
  destructive: 'destructive-emphasis',
  muted: 'muted',
} as const;

/** R4 — "Đánh giá của tôi": bốn trạng thái. Pill chỉ nói trạng thái; ngày nằm bên phải cùng hàng. */
export function MyReviewsScreen({
  copy,
  items,
  onRetract,
  onRewrite,
  onWhy,
}: MyReviewsScreenProps) {
  const theme = useTheme();

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
        {items.length === 0 ? (
          <AppText variant="subtitle" tone="muted" style={{ textAlign: 'center' }}>
            {copy.empty}
          </AppText>
        ) : null}
        {items.map((item) => {
          const tone = TONE_COLOR[myReviewTone(item.moderationState)];
          const step = myReviewNextStep(item);
          // Chữ pill đúng màu tông (chờ duyệt giữ chữ sáng như mockup).
          // Retracted: nền xám sáng + chữ sáng (mockup); các trạng thái khác: chữ và nền cùng tông.
          const retracted = item.moderationState === 'retracted';
          const pillText =
            item.moderationState === 'pending' || retracted
              ? theme.colors.foreground
              : theme.colors[tone];
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
                  {formatFullDate(item.dateIso.slice(0, 10))}
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
              {step === 'exhausted' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onWhy(item.id)}
                  style={{ alignSelf: 'flex-start' }}
                >
                  <AppText variant="caption" style={{ color: theme.colors['primary-emphasis'] }}>
                    {copy.seeWhy}
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
