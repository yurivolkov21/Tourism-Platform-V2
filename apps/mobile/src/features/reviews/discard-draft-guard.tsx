import { messages } from '@tourism/i18n';
import { AppText, BottomSheet, Button, useTheme } from '@tourism/mobile-ui';
import { useNavigation } from 'expo-router';
import { type NavigationAction, usePreventRemove } from 'expo-router/react-navigation';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

export interface DiscardDraftGuardProps {
  /** Rời màn lúc này có làm mất bài khách đang viết không — bật thì mọi lệnh rời đều hỏi lại. */
  active: boolean;
  copy: typeof messages.reviews.unsentDraft;
}

/**
 * Chặn rời R1, R5 khi bài còn dở (open-items P5b-5 mục 4). Back cứng Android, nút back ở header
 * và vuốt back iOS đều là lệnh gỡ màn khỏi stack, nên một `usePreventRemove` chặn được cả ba
 * (native stack tự tắt vuốt iOS bằng `preventNativeDismiss` khi màn đang bị chặn). Bị chặn thì
 * giữ lại lệnh rời và mở tấm hỏi; "Discard and leave" mới cho lệnh ấy chạy tiếp.
 *
 * Tấm cùng khuôn tấm rút bài (R7): nút bỏ là viền destructive, nút ở lại là nút đặc — ở lại phải
 * dễ bấm hơn bỏ.
 */
export function DiscardDraftGuard({ active, copy }: DiscardDraftGuardProps) {
  const theme = useTheme();
  const navigation = useNavigation();
  const [blocked, setBlocked] = useState<NavigationAction | null>(null);

  usePreventRemove(active, ({ data }) => setBlocked(data.action));

  function discard() {
    if (blocked === null) return;
    // Đóng tấm trước khi rời, cùng thứ tự với tấm huỷ đơn ở hoá đơn: Modal còn mở dễ đè màn kế.
    setBlocked(null);
    // Lệnh rời đã ghi dấu màn này là "đã hỏi" nên chạy lại không bị chặn lần nữa.
    navigation.dispatch(blocked);
  }

  return (
    <BottomSheet
      visible={blocked !== null}
      closeLabel={messages.mobile.appShell.close}
      onClose={() => setBlocked(null)}
    >
      <View style={{ paddingTop: theme.spacing(3), gap: theme.spacing(3) }}>
        <View style={{ gap: theme.spacing(1) }}>
          <AppText variant="heading">{copy.title}</AppText>
          <AppText tone="muted">{copy.body}</AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={discard}
          style={{
            height: theme.spacing(12),
            borderRadius: 999,
            borderWidth: 1,
            borderColor: theme.colors['destructive-emphasis'],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText variant="label" style={{ color: theme.colors['destructive-emphasis'] }}>
            {copy.discard}
          </AppText>
        </Pressable>
        <Button label={copy.keep} onPress={() => setBlocked(null)} shape="pill" />
      </View>
    </BottomSheet>
  );
}
