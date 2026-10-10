import { ORPCError } from '@orpc/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import { useState } from 'react';
import { type MyReviewCardVM, MyReviewsScreen } from '@/features/reviews/my-reviews-screen';
import { RetractSheet } from '@/features/reviews/retract-sheet';
import { ReviewLoadState } from '@/features/reviews/review-load-state';
import { useMyReviews } from '@/features/reviews/use-my-reviews';
import { orpc, withMobileAuth } from '@/lib/api/client';

/** R4 + R7 — "Đánh giá của tôi" và tấm xác nhận rút bài. Route trả CẢ bài chưa duyệt. */
export default function MyReviewsRoute() {
  const copy = messages.reviews.mine;
  const retractCopy = messages.reviews.retract;
  const queryClient = useQueryClient();
  const [retractId, setRetractId] = useState<string | null>(null);
  const [retractError, setRetractError] = useState<string | null>(null);

  const query = useMyReviews();

  const retractMutation = useMutation(
    orpc.reviews.retract.mutationOptions({ context: withMobileAuth() }),
  );

  const items: MyReviewCardVM[] = (query.data?.items ?? []).map((review) => ({
    id: review.id,
    title: review.title ?? null,
    tourTitle: review.tourTitle ?? null,
    moderationState: review.moderationState,
    rejectionCount: review.rejectionCount,
    dateIso: review.createdAt,
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
        onRetract={(id) => setRetractId(id)}
        onRewrite={(id) => router.push(`/reviews/rewrite?id=${id}`)}
        onWhy={(id) => router.push(`/reviews/exhausted?id=${id}`)}
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
