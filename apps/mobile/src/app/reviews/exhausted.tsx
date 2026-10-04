import { useQuery } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import { AppText, Button, Screen, useTheme } from '@tourism/mobile-ui';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { orpc, withMobileAuth } from '@/lib/api/client';

/**
 * R6 — "Hết lượt viết lại" (mockup `mobile-review-screens` mục 2). Bị bác hai lần:
 * không còn nút sửa, và màn nói rõ vì sao. Đường đi tiếp là form liên hệ (E1),
 * không phải một nút vô hiệu.
 */
export default function ExhaustedReviewRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const copy = messages.reviews;

  const listQuery = useQuery(
    orpc.reviews.mine.queryOptions({ input: { page: 1, limit: 50 }, context: withMobileAuth() }),
  );
  const review = listQuery.data?.items.find((item) => item.id === id);
  if (review === undefined) return null;

  return (
    <Screen edges={[]} padded={false} scrollable={false}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing(6),
          paddingVertical: theme.spacing(6),
          alignItems: 'center',
          gap: theme.spacing(4),
        }}
      >
        <View
          style={{
            width: theme.spacing(16),
            height: theme.spacing(16),
            borderRadius: theme.radius.base * 2,
            backgroundColor: theme.colors.secondary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText variant="title">!</AppText>
        </View>
        <AppText variant="title" style={{ textAlign: 'center' }}>
          {copy.rejectedFinalTitle}
        </AppText>
        <AppText variant="subtitle" tone="muted" style={{ textAlign: 'center' }}>
          {copy.rejectedFinalBody}
        </AppText>
        <View
          style={{
            alignSelf: 'stretch',
            gap: theme.spacing(2),
            padding: theme.spacing(4),
            borderRadius: theme.radius.base * 3,
            backgroundColor: theme.colors.card,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <AppText variant="caption" tone="muted">
            {copy.rejectedFinalReason}
          </AppText>
          <AppText variant="subtitle">{review.moderationNote ?? ''}</AppText>
        </View>
        <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }}>
          {copy.rejectedFinalContact}
        </AppText>
        <View style={{ width: '75%' }}>
          <Button
            label={messages.mobile.booking.detail.contactLinkLabel}
            onPress={() => router.push('/enquiry')}
            shape="pill"
          />
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <AppText variant="caption" style={{ color: theme.colors['primary-emphasis'] }}>
            {copy.backToTrip}
          </AppText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
