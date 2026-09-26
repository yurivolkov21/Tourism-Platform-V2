import { AppText, BottomSheet, Button, useTheme } from '@tourism/mobile-ui';
import { View } from 'react-native';

export interface SignOutSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
}

/** A5 (spec P5b-4 §3) — hỏi lại trước khi đăng xuất. */
export function SignOutSheet({
  visible,
  onClose,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
}: SignOutSheetProps) {
  const theme = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingTop: theme.spacing(3) }}>
        <AppText variant="heading">{title}</AppText>
        <AppText variant="subtitle" tone="muted" style={{ marginTop: theme.spacing(2) }}>
          {body}
        </AppText>
        <View style={{ marginTop: theme.spacing(5), gap: theme.spacing(2) }}>
          <Button shape="pill" variant="destructive" label={confirmLabel} onPress={onConfirm} />
          <Button shape="pill" variant="ghost" label={cancelLabel} onPress={onClose} />
        </View>
      </View>
    </BottomSheet>
  );
}
