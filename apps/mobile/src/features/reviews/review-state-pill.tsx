import type { messages } from '@tourism/i18n';
import { AppText, useTheme, withAlpha } from '@tourism/mobile-ui';
import { View } from 'react-native';
import { type MyReviewModerationState, myReviewTone } from './my-reviews';

/** Tông → khoá màu có trong bảng màu theme. */
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

export function reviewStateLabel(
  copy: typeof messages.reviews.mine,
  state: MyReviewModerationState,
): string {
  if (state === 'approved') return copy.publishedLabel;
  if (state === 'pending') return copy.pendingLabel;
  if (state === 'rejected') return copy.notPublishedLabel;
  return copy.retractedLabel;
}

/** Pill trạng thái bài — dùng chung cho danh sách (R4) và màn chi tiết. */
export function ReviewStatePill({
  copy,
  state,
}: {
  copy: typeof messages.reviews.mine;
  state: MyReviewModerationState;
}) {
  const theme = useTheme();
  const toneKey = myReviewTone(state);
  // Chờ duyệt giữ chữ sáng như mockup; Retracted: nền xám sáng + chữ sáng; còn lại chữ lấy vai
  // mực của tông (`TONE_INK`).
  const retracted = state === 'retracted';
  const pillText =
    state === 'pending' || retracted ? theme.colors.foreground : theme.colors[TONE_INK[toneKey]];
  const pillBg = retracted ? theme.colors['muted-foreground'] : theme.colors[TONE_COLOR[toneKey]];

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: theme.spacing(3),
        paddingVertical: theme.spacing(1),
        borderRadius: 999,
        backgroundColor: withAlpha(pillBg, retracted ? 0.24 : 0.16),
      }}
    >
      <AppText variant="caption" style={{ color: pillText, fontWeight: theme.weight.semibold }}>
        {reviewStateLabel(copy, state)}
      </AppText>
    </View>
  );
}
