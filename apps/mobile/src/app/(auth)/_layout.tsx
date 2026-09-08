import { messages } from '@tourism/i18n';
import { useTheme } from '@tourism/mobile-ui';
import { Stack } from 'expo-router';

/**
 * Nhóm auth — trình bày dạng modal (đặt ở `_layout` gốc) nên stack này giữ
 * header để người dùng có đường đóng lại.
 */
export default function AuthLayout() {
  const theme = useTheme();
  const { titles } = messages.mobile.appShell;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.card },
        headerTintColor: theme.colors.foreground,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="login" options={{ title: titles.login }} />
      <Stack.Screen name="register" options={{ title: titles.register }} />
      <Stack.Screen name="forgot-password" options={{ title: titles.forgotPassword }} />
    </Stack>
  );
}
