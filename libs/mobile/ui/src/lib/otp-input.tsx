import { TextInput, View } from 'react-native';
import { AppText } from './app-text';
import { useTheme } from './theme-provider';

export interface OtpInputProps {
  value: string;
  onChangeText: (next: string) => void;
  /** Nhãn cho trình đọc màn hình — ô nhập thật nằm trong suốt phía trên các ô vẽ. */
  accessibilityLabel: string;
  length?: number;
  /** Mã sai: mọi ô đổi sang màu lỗi (kênh 1 của luật lỗi). */
  invalid?: boolean;
  autoFocus?: boolean;
}

/**
 * Ô nhập mã xác minh: MỘT `TextInput` trong suốt phủ lên trên, phía dưới là các ô
 * vẽ bằng `View`. Làm sáu ô nhập riêng thì phải tự lo nhảy ô, xoá lùi và dán mã —
 * ba thứ hệ điều hành đã làm sẵn cho một ô duy nhất.
 *
 * Mã chia 3+3 như bản web để mắt bắt nhịp, và lọc phi-số ngay tại đây: bàn phím
 * số của iOS vẫn gõ được dấu chấm và dấu trừ.
 */
export function OtpInput({
  value,
  onChangeText,
  accessibilityLabel,
  length = 6,
  invalid = false,
  autoFocus = false,
}: OtpInputProps) {
  const theme = useTheme();
  // Dựng sẵn danh sách ô kèm danh tính theo VỊ TRÍ: ô thứ ba luôn là ô thứ ba,
  // không bao giờ bị chèn hay đổi chỗ, nên vị trí chính là khoá ổn định.
  const cells = Array.from({ length }, (_, position) => ({
    id: `otp-cell-${position}`,
    digit: value[position] ?? '',
    position,
  }));
  const half = Math.ceil(length / 2);

  const lineColor = (index: number) => {
    if (invalid) return theme.colors['destructive-emphasis'];
    if (index <= value.length && index < length) return theme.colors['primary-emphasis'];
    return theme.colors.border;
  };

  return (
    <View style={{ marginTop: theme.spacing(6) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1.75) }}>
        {cells.map((cell) => (
          <View
            key={cell.id}
            testID="otp-cell"
            style={{
              width: theme.spacing(8.5),
              height: theme.spacing(12.5),
              alignItems: 'center',
              justifyContent: 'center',
              borderBottomWidth: 2,
              borderBottomColor: lineColor(cell.position),
            }}
          >
            <AppText variant="title">{cell.digit}</AppText>
          </View>
        ))}
        {/* Gạch ngang chia 3+3 — vẽ sau cùng rồi đẩy về đúng chỗ bằng thứ tự flex. */}
      </View>
      <TextInput
        value={value}
        onChangeText={(next) => onChangeText(next.replace(/\D/g, '').slice(0, length))}
        accessibilityLabel={accessibilityLabel}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        maxLength={length}
        // Ô thật phủ đúng lên dải ô vẽ và trong suốt hoàn toàn: người dùng chạm
        // vào ô nào cũng mở bàn phím, còn con trỏ hệ thống thì không lộ ra.
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: theme.spacing(12.5),
          opacity: 0,
        }}
      />
      <View
        aria-hidden
        style={{
          position: 'absolute',
          top: theme.spacing(6.25),
          left: half * theme.spacing(8.5) + (half - 1) * theme.spacing(1.75),
          width: theme.spacing(2.5),
          height: 2,
          backgroundColor: theme.colors.border,
        }}
      />
    </View>
  );
}
