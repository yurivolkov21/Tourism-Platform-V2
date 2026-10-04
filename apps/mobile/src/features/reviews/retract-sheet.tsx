import type { messages } from '@tourism/i18n';
import { AppText, BottomSheet, Button, FormMessage, useTheme } from '@tourism/mobile-ui';
import { Pressable, View } from 'react-native';

export interface RetractSheetProps {
  visible: boolean;
  copy: typeof messages.reviews.retract;
  /** Đang gọi `reviews.retract` — khoá cả hai nút. */
  pending: boolean;
  errorText: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * R7 — rút bài đã đăng (mockup `mobile-review-screens` mục 2). Rút là CHUNG CUỘC
 * (ADR-0032 AMEND 1): tấm này nói rõ điều đó trước khi bấm. Nút rút là VIỀN
 * destructive, không phải nút đặc — nút giữ bài phải dễ bấm không kém.
 */
export function RetractSheet({
  visible,
  copy,
  pending,
  errorText,
  onConfirm,
  onClose,
}: RetractSheetProps) {
  const theme = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingTop: theme.spacing(3), gap: theme.spacing(3) }}>
        <AppText variant="heading">{copy.confirm}</AppText>
        {errorText === null ? null : <FormMessage tone="error">{errorText}</FormMessage>}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: pending }}
          disabled={pending}
          onPress={onConfirm}
          style={{
            height: theme.spacing(12),
            borderRadius: 999,
            borderWidth: 1,
            borderColor: theme.colors['destructive-emphasis'],
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pending ? 0.6 : 1,
          }}
        >
          <AppText variant="label" style={{ color: theme.colors['destructive-emphasis'] }}>
            {pending ? copy.retracting : copy.button}
          </AppText>
        </Pressable>
        <Button label={copy.cancel} onPress={onClose} disabled={pending} shape="pill" />
      </View>
    </BottomSheet>
  );
}
