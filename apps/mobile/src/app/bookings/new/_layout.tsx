import { messages } from '@tourism/i18n';
import { useTheme } from '@tourism/mobile-ui';
import { Stack } from 'expo-router';

/**
 * Cụm đặt tour (P5b-3, mockup B1-B9) — Stack RIÊNG lồng trong stack gốc, cùng
 * khuôn nhóm `(auth)`: mỗi bước là một route push, header NATIVE tự vẽ nút lùi
 * (khác cụm auth — ở đây header SHOWN vì `compact-head` mockup đúng là header
 * native, không phải nút tự vẽ đè ảnh). `success` (B8) là màn CUỐI, không có
 * đường lùi — `headerShown:false` + `gestureEnabled:false`, cùng lý do `tours/[slug]` không có header.
 */
export default function BookingNewLayout() {
  const theme = useTheme();
  const { titles } = messages.mobile.appShell;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.foreground,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="travellers" options={{ title: titles.bookThisTour }} />
      <Stack.Screen name="contact" options={{ title: titles.bookThisTour }} />
      <Stack.Screen name="review" options={{ title: titles.reviewAndPay }} />
      <Stack.Screen name="checkout" options={{ title: titles.payment }} />
      <Stack.Screen name="verify" options={{ title: titles.payment }} />
      <Stack.Screen name="success" options={{ headerShown: false, gestureEnabled: false }} />
    </Stack>
  );
}
