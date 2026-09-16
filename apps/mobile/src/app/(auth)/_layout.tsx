import { messages } from '@tourism/i18n';
import { useTheme } from '@tourism/mobile-ui';
import { Stack } from 'expo-router';

/**
 * Nhóm auth — trình bày dạng modal (đặt ở `_layout` gốc), và KHÔNG màn nào có
 * header.
 *
 * Từ P5b-1, mỗi màn tự vẽ đường thoát của mình đè lên nội dung: X đóng cả nhóm ở
 * màn đầu (Sign in, Reset password mở từ link), mũi tên lùi một bước ở màn đi
 * tiếp (Create account, Forgot password, Verify email), và màn kết quả thì không
 * có đường lui nào. Header chung không làm được chuyện đó — nó chỉ có một kiểu
 * nút cho mọi màn, lại cắt mất ảnh tràn mép của hai màn form.
 *
 * `title` giữ lại dù header ẩn: OS vẫn đọc nó khi liệt kê màn, và đó là chỗ duy
 * nhất tên màn còn dính với `@tourism/i18n`.
 */
export default function AuthLayout() {
  const theme = useTheme();
  const { titles } = messages.mobile.appShell;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="login" options={{ title: titles.login }} />
      <Stack.Screen name="register" options={{ title: titles.register }} />
      <Stack.Screen name="forgot-password" options={{ title: titles.forgotPassword }} />
      <Stack.Screen name="verify-email" options={{ title: titles.verifyEmail }} />
      <Stack.Screen name="reset-password" options={{ title: titles.resetPassword }} />
      <Stack.Screen name="success" options={{ title: titles.success }} />
    </Stack>
  );
}
