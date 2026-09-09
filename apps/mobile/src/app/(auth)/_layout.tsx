import { messages } from '@tourism/i18n';
import { AppText, useTheme } from '@tourism/mobile-ui';
import { router, Stack } from 'expo-router';
import { Pressable } from 'react-native';

/**
 * Nút đóng của nhóm auth. Bắt buộc phải có: nhóm này trình bày dạng modal, mà
 * màn ĐẦU của một Stack không bao giờ có `headerLeft` mặc định — nên nếu không
 * tự vẽ, người vào bằng `nexora://login` chỉ còn cách tắt app (iOS modal không
 * có gì phía dưới để chạm, Android modal không có swipe-to-dismiss).
 *
 * `replace('/')` chứ không `back()`: đây là nút ĐÓNG cả nhóm, không phải lùi
 * một bước — đứng ở `register` sau khi đi từ `login` thì người dùng muốn thoát
 * hẳn, không phải quay về `login`. Cùng cách `+not-found` đã dùng.
 */
function HeaderCloseButton() {
  const theme = useTheme();
  const { close } = messages.mobile.appShell;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={close}
      onPress={() => router.replace('/')}
      hitSlop={theme.spacing(2)}
      style={{
        minWidth: theme.touchTargetMin,
        minHeight: theme.touchTargetMin,
        justifyContent: 'center',
      }}
    >
      <AppText variant="label" tone="muted">
        {close}
      </AppText>
    </Pressable>
  );
}

/**
 * Nhóm auth — trình bày dạng modal (đặt ở `_layout` gốc). Header ở đây KHÔNG tự
 * sinh đường thoát, nên phải gắn `headerLeft` tay (xem `HeaderCloseButton`).
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
        headerLeft: () => <HeaderCloseButton />,
      }}
    >
      <Stack.Screen name="login" options={{ title: titles.login }} />
      <Stack.Screen name="register" options={{ title: titles.register }} />
      <Stack.Screen name="forgot-password" options={{ title: titles.forgotPassword }} />
    </Stack>
  );
}
