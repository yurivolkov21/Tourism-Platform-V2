import { BottomSheet, Button, FormMessage, TextField, useTheme } from '@tourism/mobile-ui';
import { View } from 'react-native';

export interface EditNameSheetProps {
  visible: boolean;
  onClose: () => void;
  label: string;
  value: string;
  error?: string;
  formError: string | null;
  pending: boolean;
  saveLabel: string;
  savingLabel: string;
  onChangeText: (value: string) => void;
  onSave: () => void;
}

/**
 * A3 (spec P5b-4 §3) — "Một việc, một tấm trượt". Dùng chung cho CẢ nút bút chì
 * ở A1 lẫn dòng menu "Personal details" (A4/A7 — avatar, xoá tài khoản — chưa
 * dựng, xem mục 4/5 spec): tên là thứ DUY NHẤT sửa được lúc này.
 */
export function EditNameSheet({
  visible,
  onClose,
  label,
  value,
  error,
  formError,
  pending,
  saveLabel,
  savingLabel,
  onChangeText,
  onSave,
}: EditNameSheetProps) {
  const theme = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingTop: theme.spacing(3) }}>
        <TextField
          label={label}
          value={value}
          error={error}
          onChangeText={onChangeText}
          autoCapitalize="words"
          autoComplete="name"
        />
        {formError === null ? null : (
          <View style={{ marginTop: theme.spacing(3) }}>
            <FormMessage tone="error">{formError}</FormMessage>
          </View>
        )}
        <View style={{ marginTop: theme.spacing(5) }}>
          <Button
            shape="pill"
            label={pending ? savingLabel : saveLabel}
            disabled={pending}
            onPress={onSave}
          />
        </View>
      </View>
    </BottomSheet>
  );
}
