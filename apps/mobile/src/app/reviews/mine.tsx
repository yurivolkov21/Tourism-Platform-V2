import { ORPCError } from '@orpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { AWAITING_REVIEW_BOOKINGS_INPUT, tripsAwaitingReview } from '@/features/reviews/my-reviews';
import {
  type AwaitingReviewTripVM,
  type MyReviewCardVM,
  MyReviewsScreen,
} from '@/features/reviews/my-reviews-screen';
import { RetractSheet } from '@/features/reviews/retract-sheet';
import { ReviewLoadState } from '@/features/reviews/review-load-state';
import { useMyReviews } from '@/features/reviews/use-my-reviews';
import { formatDepartureRange } from '@/features/tour-detail/departures';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import { useServerClock } from '@/lib/use-server-clock';

/** R4 + R7 — "Đánh giá của tôi" và tấm xác nhận rút bài. Route trả CẢ bài chưa duyệt. */
export default function MyReviewsRoute() {
  const copy = messages.reviews.mine;
  const retractCopy = messages.reviews.retract;
  const queryClient = useQueryClient();
  const [retractId, setRetractId] = useState<string | null>(null);
  const [retractError, setRetractError] = useState<string | null>(null);

  const query = useMyReviews();
  // Khối "chờ viết bài" đầu màn (card "Thêm khối", 15/10). Danh sách đơn lỗi thì khối im lặng: đó
  // là lối phụ, bài của khách vẫn hiện, và chuyến vẫn viết được từ P6 hay hoá đơn. `now` theo đồng
  // hồ server vì cổng review của API so ngày UTC (cùng hoá đơn).
  const bookingsQuery = useQuery(
    orpc.bookings.mine.queryOptions({
      input: AWAITING_REVIEW_BOOKINGS_INPUT,
      context: withMobileAuth(),
    }),
  );
  const { now } = useServerClock();

  const retractMutation = useMutation(
    orpc.reviews.retract.mutationOptions({ context: withMobileAuth() }),
  );

  const reviews = query.data?.items ?? [];
  const items: MyReviewCardVM[] = reviews.map((review) => ({
    id: review.id,
    title: review.title ?? null,
    tourTitle: review.tourTitle ?? null,
    moderationState: review.moderationState,
    rejectionCount: review.rejectionCount,
    dateIso: review.createdAt,
  }));
  const awaiting: AwaitingReviewTripVM[] = tripsAwaitingReview(
    bookingsQuery.data?.items ?? [],
    reviews,
    now,
  ).map((booking) => ({
    code: booking.code,
    tourTitle: booking.tourTitle,
    dateRangeLabel: formatDepartureRange(booking.departureStartDate, booking.departureEndDate),
    imageUrl: booking.tourImage?.url ?? null,
  }));

  function closeRetract() {
    setRetractId(null);
    setRetractError(null);
  }

  function confirmRetract() {
    if (retractId === null) return;
    setRetractError(null);
    retractMutation.mutate(
      { id: retractId },
      {
        onSuccess: () => {
          closeRetract();
          void queryClient.invalidateQueries({ queryKey: orpc.reviews.mine.key() });
          // Open-items P5b-5 mục 2 (card "Màn kết quả", 15/10): web báo bằng toast, app chưa có
          // toast. Người nhìn thấy thẻ đổi sang "Retracted"; người dùng trình đọc màn hình thì
          // không, nên đọc kết quả cho họ. `queue` (iOS) xếp câu này sau câu VoiceOver đang đọc lúc
          // tấm trượt đóng, thay vì bị nó cắt ngang.
          const { done } = retractCopy.toast;
          AccessibilityInfo.announceForAccessibilityWithOptions(`${done.title}. ${done.body}`, {
            queue: true,
          });
        },
        onError: (error) => {
          // Mã đã biết → copy riêng (kể cả đã rút/không còn: làm mới danh sách).
          if (error instanceof ORPCError && error.code in retractCopy.errors) {
            setRetractError(retractCopy.errors[error.code as keyof typeof retractCopy.errors]);
            void queryClient.invalidateQueries({ queryKey: orpc.reviews.mine.key() });
            return;
          }
          setRetractError(retractCopy.toast.error.body);
        },
      },
    );
  }

  // Đang tải / lỗi KHÔNG được rơi vào "chưa có đánh giá nào" (V1).
  if (query.isPending || query.isError) {
    return (
      <ReviewLoadState
        state={query.isPending ? 'loading' : 'error'}
        errorText={messages.reviews.loadError}
        retryLabel={messages.reviews.loadErrorRetry}
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <>
      <MyReviewsScreen
        copy={copy}
        items={items}
        awaiting={awaiting}
        onRetract={(id) => setRetractId(id)}
        onRewrite={(id) => router.push(`/reviews/rewrite?id=${id}`)}
        onWhy={(id) => router.push(`/reviews/exhausted?id=${id}`)}
        onWriteReview={(code) => router.push(`/trips/${code}/review?from=my-reviews`)}
        transformUrl={cloudinaryUrl}
      />
      <RetractSheet
        visible={retractId !== null}
        copy={retractCopy}
        pending={retractMutation.isPending}
        errorText={retractError}
        onConfirm={confirmRetract}
        onClose={closeRetract}
      />
    </>
  );
}
