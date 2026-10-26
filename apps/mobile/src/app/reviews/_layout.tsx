import { messages } from '@tourism/i18n';
import { useTheme } from '@tourism/mobile-ui';
import { Stack } from 'expo-router';
import { STACK_TRANSITION } from '@/lib/stack-transition';

/** Cụm review của khách (R4–R7, mockup `mobile-review-screens` mục 2). Khuôn Stack
 * như `trips/[code]/_layout.tsx`: mỗi màn push, header NATIVE. */
export default function ReviewsLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        ...STACK_TRANSITION,
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.foreground,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="mine" options={{ title: messages.reviews.mine.title }} />
      <Stack.Screen name="[id]" options={{ title: messages.reviews.mine.detailTitle }} />
      <Stack.Screen name="rewrite" options={{ title: messages.reviews.rewriteHeading }} />
      <Stack.Screen name="exhausted" options={{ title: messages.reviews.rejectedFinalTitle }} />
    </Stack>
  );
}
