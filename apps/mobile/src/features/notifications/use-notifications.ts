import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { MY_REVIEWS_INPUT } from '@/features/reviews/my-reviews';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { getAuthClient } from '@/lib/auth-client';
import { useServerToday } from '@/lib/use-server-clock';
import { buildNotifications, countUnread } from './notifications';
import { useReadState } from './read-state';

/**
 * Gom dữ liệu cho chuông ở Home và màn Notifications: hai truy vấn dùng chung cache với tab Trips
 * (`bookings.mine`) và My reviews (`reviews.mine`), suy danh sách bằng `buildNotifications`, cộng trạng thái
 * đã đọc lưu theo tài khoản. Khách chưa đăng nhập: không gọi gì, danh sách rỗng.
 */
export function useNotifications() {
  const { data: session } = getAuthClient().useSession();
  const userId = session?.user.id ?? null;
  const signedIn = userId !== null;
  const today = useServerToday();

  const bookingsQuery = useQuery(
    orpc.bookings.mine.queryOptions({
      input: { page: 1, limit: 50 },
      context: withMobileAuth(),
      enabled: signedIn,
    }),
  );
  const reviewsQuery = useQuery(
    orpc.reviews.mine.queryOptions({
      input: MY_REVIEWS_INPUT,
      context: withMobileAuth(),
      enabled: signedIn,
    }),
  );

  const bookings = bookingsQuery.data?.items;
  const reviews = reviewsQuery.data?.items;
  const notifications = useMemo(
    () =>
      signedIn
        ? buildNotifications({
            bookings: bookings ?? [],
            reviews: reviews ?? [],
            today,
            now: new Date(),
          })
        : [],
    [signedIn, bookings, reviews, today],
  );

  // Dùng chung với mọi nơi gọi hook này (chuông Home, màn Notifications) — xem `read-state.ts`.
  const { readIds, markRead, markAllRead } = useReadState(userId);

  return {
    signedIn,
    notifications,
    readIds,
    unreadCount: countUnread(notifications, readIds),
    isPending: signedIn && (bookingsQuery.isPending || reviewsQuery.isPending),
    isError: bookingsQuery.isError || reviewsQuery.isError,
    refetch: () => {
      void bookingsQuery.refetch();
      void reviewsQuery.refetch();
    },
    markRead,
    markAllRead: () => markAllRead(notifications.map((notification) => notification.id)),
  };
}
