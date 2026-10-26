import { ORPCError } from '@orpc/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { MyReviewDetailScreen } from '@/features/reviews/my-review-detail-screen';
import { myReviewNextStep } from '@/features/reviews/my-reviews';
import { RetractSheet } from '@/features/reviews/retract-sheet';
import { ReviewLoadState } from '@/features/reviews/review-load-state';
import { useMyReviews } from '@/features/reviews/use-my-reviews';
import { mediaCreditText } from '@/features/tour-detail/photo-viewer';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';

/** Chi tiết một bài đánh giá của tôi — mở từ thẻ ở R4; đọc từ cache `reviews.mine`. */
export default function MyReviewDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const copy = messages.reviews.mine;
  const retractCopy = messages.reviews.retract;
  const queryClient = useQueryClient();
  const [retractOpen, setRetractOpen] = useState(false);
  const [retractError, setRetractError] = useState<string | null>(null);

  const listQuery = useMyReviews();
  const review = listQuery.data?.items.find((item) => item.id === id);
  const retractMutation = useMutation(
    orpc.reviews.retract.mutationOptions({ context: withMobileAuth() }),
  );

  if (listQuery.isPending || listQuery.isError || review === undefined) {
    return (
      <ReviewLoadState
        state={listQuery.isPending ? 'loading' : 'error'}
        errorText={
          listQuery.isError
            ? messages.reviews.loadError
            : (messages.reviews.errors.REVIEW_NOT_FOUND ?? messages.reviews.loadError)
        }
        retryLabel={messages.reviews.loadErrorRetry}
        onRetry={() => void listQuery.refetch()}
      />
    );
  }

  function closeRetract() {
    setRetractOpen(false);
    setRetractError(null);
  }

  function confirmRetract() {
    if (review === undefined) return;
    setRetractError(null);
    retractMutation.mutate(
      { id: review.id },
      {
        onSuccess: () => {
          closeRetract();
          void queryClient.invalidateQueries({ queryKey: orpc.reviews.mine.key() });
          // Cùng cách `reviews/mine.tsx`: tấm trượt đóng và pill đổi sang "Retracted" là kết quả
          // chỉ người nhìn thấy, nên đọc kết quả cho người dùng trình đọc màn hình. `queue` (iOS)
          // xếp câu này sau câu VoiceOver đang đọc lúc tấm trượt đóng.
          const { done } = retractCopy.toast;
          AccessibilityInfo.announceForAccessibilityWithOptions(`${done.title}. ${done.body}`, {
            queue: true,
          });
        },
        onError: (error) => {
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

  const tourSlug = review.tourSlug;

  return (
    <>
      <MyReviewDetailScreen
        copy={copy}
        viewerCloseLabel={messages.tourDetail.gallery.close}
        viewerCounterFor={messages.tourDetail.gallery.counter}
        review={{
          moderationState: review.moderationState,
          dateIso: review.createdAt,
          rating: review.rating,
          title: review.title,
          body: review.body,
          tourTitle: review.tourTitle,
          tourImageUrl: review.tourImage?.url ?? null,
          moderationNote: review.moderationNote,
          photos: review.media.map((m) => ({
            url: m.url,
            alt: m.alt,
            creditLine: mediaCreditText(m.author, m.license),
          })),
        }}
        nextStep={myReviewNextStep(review)}
        onRetract={() => setRetractOpen(true)}
        onRewrite={() => router.push(`/reviews/rewrite?id=${review.id}`)}
        onWhy={() => router.push(`/reviews/exhausted?id=${review.id}`)}
        onOpenTour={tourSlug === null ? undefined : () => router.push(`/tours/${tourSlug}`)}
        transformUrl={cloudinaryUrl}
      />
      <RetractSheet
        visible={retractOpen}
        copy={retractCopy}
        pending={retractMutation.isPending}
        errorText={retractError}
        onConfirm={confirmRetract}
        onClose={closeRetract}
      />
    </>
  );
}
