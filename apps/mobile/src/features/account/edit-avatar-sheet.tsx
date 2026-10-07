import Feather from '@expo/vector-icons/Feather';
import { AppText, BottomSheet, Button, FormMessage, useTheme } from '@tourism/mobile-ui';
import { Pressable, View } from 'react-native';

export interface EditAvatarSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  takePhotoLabel: string;
  chooseLibraryLabel: string;
  removePhotoLabel: string;
  cancelLabel: string;
  /** Chỉ hiện dòng "Remove photo" khi ĐANG có ảnh (mockup A4). */
  showRemove: boolean;
  /** Đang chạy sign→upload→setAvatar hoặc gỡ ảnh — khoá cả ba dòng. */
  pending: boolean;
  errorText: string | null;
  onTakePhoto: () => void;
  onChooseLibrary: () => void;
  onRemove: () => void;
}

/**
 * A4 (spec P5b-4 §4, ADR-0040 AMEND 5) — tấm chọn nguồn ảnh đại diện. Lỗi
 * (vượt trần/sai định dạng/mạng) báo NGAY trong tấm này, không đóng tấm rồi
 * mới báo (mockup ghi rõ) — route truyền `errorText`, sheet KHÔNG tự đóng.
 */
export function EditAvatarSheet({
  visible,
  onClose,
  title,
  takePhotoLabel,
  chooseLibraryLabel,
  removePhotoLabel,
  cancelLabel,
  showRemove,
  pending,
  errorText,
  onTakePhoto,
  onChooseLibrary,
  onRemove,
}: EditAvatarSheetProps) {
  const theme = useTheme();

  const rows: {
    key: string;
    icon: 'camera' | 'image' | 'trash-2';
    label: string;
    onPress: () => void;
    destructive?: boolean;
  }[] = [
    { key: 'camera', icon: 'camera', label: takePhotoLabel, onPress: onTakePhoto },
    { key: 'library', icon: 'image', label: chooseLibraryLabel, onPress: onChooseLibrary },
    ...(showRemove
      ? [
          {
            key: 'remove',
            icon: 'trash-2' as const,
            label: removePhotoLabel,
            onPress: onRemove,
            destructive: true,
          },
        ]
      : []),
  ];

  return (
    // N3 (rà 07/10): đang upload thì backdrop/kéo tay nắm/back Android không
    // đóng được tấm (nút Cancel đã khoá sẵn) — đóng giữa chừng là nuốt mất lỗi.
    <BottomSheet visible={visible} onClose={pending ? () => {} : onClose}>
      <View style={{ paddingTop: theme.spacing(3) }}>
        <AppText variant="heading">{title}</AppText>
        <View style={{ marginTop: theme.spacing(2) }}>
          {rows.map((row, index) => (
            <Pressable
              key={row.key}
              accessibilityRole="button"
              accessibilityLabel={row.label}
              disabled={pending}
              onPress={row.onPress}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing(3),
                // 52dp LITERAL, không phải `theme.touchTargetMin` (44) — khớp
                // `.menu-row` mockup A4 VÀ dòng menu A1 (`account-screen.tsx`),
                // không phải sàn a11y chung.
                minHeight: 52,
                opacity: pending ? 0.6 : 1,
                borderBottomWidth: index === rows.length - 1 ? 0 : 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <Feather
                name={row.icon}
                size={20}
                color={
                  row.destructive === true
                    ? theme.colors['destructive-emphasis']
                    : theme.colors.foreground
                }
              />
              <AppText
                variant="label"
                // MẢNG, không phải một object — `color: undefined` trong CÙNG
                // object đè mất màu mặc định của `AppText` (RN merge style
                // bằng Object.assign, key có mặt dù giá trị undefined vẫn
                // ghi đè). Bug thật: hai dòng không-destructive từng ra chữ
                // đen thay vì `foreground` (phản hồi 27/09, ảnh so sánh
                // mockup). Mảng bỏ qua entry falsy nên object thứ hai chỉ có
                // mặt khi thật sự cần đổi màu.
                style={[
                  { flex: 1 },
                  row.destructive === true && { color: theme.colors['destructive-emphasis'] },
                ]}
              >
                {row.label}
              </AppText>
            </Pressable>
          ))}
        </View>
        {errorText === null ? null : (
          <View style={{ marginTop: theme.spacing(3) }}>
            <FormMessage tone="error">{errorText}</FormMessage>
          </View>
        )}
        <View style={{ marginTop: theme.spacing(3) }}>
          <Button
            shape="pill"
            variant="ghost"
            label={cancelLabel}
            disabled={pending}
            onPress={onClose}
          />
        </View>
      </View>
    </BottomSheet>
  );
}
