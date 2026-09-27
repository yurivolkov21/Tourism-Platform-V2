import { AppText, BottomSheet, Button, TextField, useTheme } from '@tourism/mobile-ui';
import { View } from 'react-native';

export interface DeleteAccountSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  body: string;
  passwordLabel: string;
  password: string;
  passwordError?: string;
  revealLabel: string;
  hideLabel: string;
  confirmLabel: string;
  cancelLabel: string;
  onChangePassword: (value: string) => void;
  onConfirm: () => void;
}

/**
 * A7 (mockup) — UI TRƯỚC, CHƯA nối API thật (chốt 27/09): `deleteUser` không
 * tồn tại ở server (kể cả web), cần một ADR riêng cho luật cascade (booking
 * đã trả tiền giữ lại, review/wishlist xoá thế nào) trước khi `onConfirm` gọi
 * bất cứ thứ gì thật. Route hiện đưa vào một `onConfirm` no-op — sheet CHỈ vẽ
 * đúng khung mockup, không tự phát minh hành vi.
 */
export function DeleteAccountSheet({
  visible,
  onClose,
  title,
  body,
  passwordLabel,
  password,
  passwordError,
  revealLabel,
  hideLabel,
  confirmLabel,
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
        <View style={{ marginTop: theme.spacing(5), gap: theme.spacing(2) }}>
          <Button shape="pill" variant="destructive" label={confirmLabel} onPress={onConfirm} />
          <Button shape="pill" variant="ghost" label={cancelLabel} onPress={onClose} />
        </View>
      </View>
    </BottomSheet>
  );
}
