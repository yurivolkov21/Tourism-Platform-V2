import { AppText, BottomSheet, Button, FormMessage, TextField, useTheme } from '@tourism/mobile-ui';
import { View } from 'react-native';

export interface DeleteAccountSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  body: string;
  passwordLabel: string;
  password: string;
  passwordError?: string;
  /** Lỗi cấp form (booking còn mở, phiên hết hạn…) — `null` là không có. */
  formError: string | null;
  /** Đang gọi API: khoá nút xác nhận, đổi nhãn sang `deletingLabel`. */
  pending: boolean;
  revealLabel: string;
  hideLabel: string;
  confirmLabel: string;
  deletingLabel: string;
  cancelLabel: string;
  onChangePassword: (value: string) => void;
  onConfirm: () => void;
}

/**
 * A7 (mockup) — tấm xác nhận xoá tài khoản. Component thuần trình bày: route
 * `personal-details.tsx` giữ state và gọi `DELETE /api/account` (ADR-0017
 * §7b) qua `submitDeleteAccount`. Lỗi ô mật khẩu nằm dưới ô, lỗi cấp form
 * nằm trong `FormMessage` trên hai nút (cùng khuôn `EditNameSheet`).
 */
export function DeleteAccountSheet({
  visible,
  onClose,
  title,
  body,
  passwordLabel,
  password,
  passwordError,
  formError,
  pending,
  revealLabel,
  hideLabel,
  confirmLabel,
  deletingLabel,
  cancelLabel,
  onChangePassword,
  onConfirm,
}: DeleteAccountSheetProps) {
  const theme = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingTop: theme.spacing(3) }}>
        <AppText variant="heading">{title}</AppText>
        <AppText variant="subtitle" tone="muted" style={{ marginTop: theme.spacing(2) }}>
          {body}
        </AppText>
        <View style={{ marginTop: theme.spacing(4) }}>
          <TextField
            label={passwordLabel}
            icon="lock"
            iconVariant="boxed"
            secure
            revealLabel={revealLabel}
            hideLabel={hideLabel}
            value={password}
            error={passwordError}
            onChangeText={onChangePassword}
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
          />
        </View>
        {formError === null ? null : (
          <View style={{ marginTop: theme.spacing(3) }}>
            <FormMessage tone="error">{formError}</FormMessage>
          </View>
        )}
        <View style={{ marginTop: theme.spacing(5), gap: theme.spacing(2) }}>
          <Button
            shape="pill"
            variant="destructive"
            label={pending ? deletingLabel : confirmLabel}
            disabled={pending}
            onPress={onConfirm}
          />
          <Button shape="pill" variant="ghost" label={cancelLabel} onPress={onClose} />
        </View>
      </View>
    </BottomSheet>
  );
}
