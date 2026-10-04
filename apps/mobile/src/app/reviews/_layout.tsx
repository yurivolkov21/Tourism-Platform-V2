import { messages } from '@tourism/i18n';
import { useTheme } from '@tourism/mobile-ui';
import { Stack } from 'expo-router';

/** Cụm review của khách (R4–R7, mockup `mobile-review-screens` mục 2). Khuôn Stack
 * như `trips/[code]/_layout.tsx`: mỗi màn push, header NATIVE. */
export default function ReviewsLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.foreground,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="mine" options={{ title: messages.reviews.mine.title }} />
      <Stack.Screen name="rewrite" options={{ title: messages.reviews.heading }} />
      <Stack.Screen name="exhausted" options={{ title: messages.reviews.rejectedFinalTitle }} />
    </Stack>
  );
}
