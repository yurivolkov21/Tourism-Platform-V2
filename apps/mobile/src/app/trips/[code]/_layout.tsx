import { messages } from '@tourism/i18n';
import { useTheme } from '@tourism/mobile-ui';
import { Stack } from 'expo-router';

/**
 * Cụm P (W7/W8, mockup `mobile-booking-screens` mục 4) — Stack riêng lồng
 * trong stack gốc, cùng khuôn `bookings/new/_layout.tsx`: mỗi màn là một
 * route push, header NATIVE. `index` có tiêu đề TĨNH mặc định ("Your trip")
 * nhưng P5 (đang trong chuyến) tự đè bằng tiêu đề động "Day {n} of {total}"
 * qua `<Stack.Screen>` của chính route đó (khuôn `bookings/[code].tsx`).
 */
export default function TripLayout() {
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
      <Stack.Screen name="index" options={{ title: titles.yourTrip }} />
      <Stack.Screen name="notes" options={{ title: titles.beforeYouGo }} />
      <Stack.Screen name="itinerary" options={{ title: titles.yourItinerary }} />
      <Stack.Screen name="review" options={{ title: messages.reviews.heading }} />
    </Stack>
  );
}
