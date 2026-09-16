import Feather from '@expo/vector-icons/Feather';
import { View } from 'react-native';
import { AppText } from './app-text';
import { withAlpha } from './theme';
import { useTheme } from './theme-provider';

export interface FormMessageProps {
  /** `error` cho lỗi không quy được về ô nào; `info` cho tin báo (vd đã gửi mã mới). */
  tone: 'error' | 'info';
  children: string;
}

/**
 * Khung thông báo cấp form — kênh 2 của luật lỗi (spec P5b-1 §5). MỖI form chỉ
 * có một chỗ này và nó luôn nằm ngay trên nút chính, nên lỗi "không thuộc ô
 * nào" (sai thông tin đăng nhập, thử quá nhiều lần, mất mạng) có một chỗ đứng
 * cố định thay vì mỗi màn một kiểu.
 *
 * `accessibilityRole="alert"` để trình đọc màn hình đọc ngay khi nó xuất hiện.
 */
export function FormMessage({ tone, children }: FormMessageProps) {
  const theme = useTheme();
  const isError = tone === 'error';

  return (
    <View
      // `accessible` là bắt buộc: không có nó thì View không nổi lên cây trợ
      // năng, trình đọc màn hình bỏ qua và `getByRole('alert')` cũng không thấy.
      accessible
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing(2.5),
        padding: theme.spacing(2.5),
        borderRadius: theme.radius.base * 2,
        backgroundColor: isError
          ? withAlpha(theme.colors['destructive-emphasis'], 0.16)
          : theme.colors.secondary,
        borderWidth: isError ? 1 : 0,
        borderColor: isError
          ? withAlpha(theme.colors['destructive-emphasis'], 0.45)
          : theme.colors.secondary,
      }}
    >
      <Feather
        name={isError ? 'alert-circle' : 'mail'}
        size={16}
        color={isError ? theme.colors['destructive-emphasis'] : theme.colors['primary-emphasis']}
      />
      <AppText variant="caption" tone={isError ? 'default' : 'muted'} style={{ flex: 1 }}>
        {children}
      </AppText>
    </View>
  );
}
