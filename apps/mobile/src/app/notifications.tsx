import { messages } from '@tourism/i18n';
import { Button, EmptyState, SCREEN_EDGES_UNDER_HEADER, Screen } from '@tourism/mobile-ui';
import { router } from 'expo-router';
import { View } from 'react-native';
import { setPendingReturn } from '@/features/auth/return-to';
import { describeNotification } from '@/features/notifications/notification-copy';
import { notificationTarget } from '@/features/notifications/notifications';
import {
  NotificationsScreen,
  type NotificationsStatus,
} from '@/features/notifications/notifications-screen';
import { useNotifications } from '@/features/notifications/use-notifications';
import { cloudinaryUrl } from '@/lib/cloudinary-url';

/**
 * Route Notifications (spec 2026-10-25): danh sách suy ra từ đơn và review đã có, không gọi API riêng. Bấm một
 * thông báo thì đánh dấu đã đọc rồi mở đúng chuyến/review.
 */
export default function NotificationsRoute() {
  const state = useNotifications();
  const copy = messages.mobile.notifications;

  if (!state.signedIn) {
    return (
      <Screen edges={SCREEN_EDGES_UNDER_HEADER} scrollable={false}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState title={copy.signedOutTitle} body={copy.signedOutBody} surface={false}>
            <Button
              shape="pill"
              label={copy.signIn}
              onPress={() => {
                setPendingReturn({ path: '/notifications' });
                router.navigate('/login');
              }}
            />
          </EmptyState>
        </View>
      </Screen>
    );
  }

  const status: NotificationsStatus = state.isPending
    ? 'loading'
    : state.isError
      ? 'error'
      : 'content';

  return (
    <NotificationsScreen
      status={status}
      rows={state.notifications.map((notification) =>
        describeNotification(notification, !state.readIds.has(notification.id)),
      )}
      unreadCount={state.unreadCount}
      markAllLabel={copy.markAllRead}
      onMarkAllRead={state.markAllRead}
      onRowPress={(id) => {
        const notification = state.notifications.find((item) => item.id === id);
        if (notification === undefined) return;
        state.markRead(id);
        router.push(notificationTarget(notification));
      }}
      unreadLabel={copy.unreadLabel}
      emptyTitle={copy.emptyTitle}
      emptyBody={copy.emptyBody}
      errorTitle={copy.loadError}
      retryLabel={copy.retry}
      onRetry={state.refetch}
      transformUrl={cloudinaryUrl}
    />
  );
}
