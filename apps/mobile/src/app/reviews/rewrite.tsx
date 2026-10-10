import { useMutation, useQueryClient } from '@tanstack/react-query';
import { REVIEW_REJECTION_LIMIT } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { canSubmitReview, reviewSubmitErrorMessage } from '@/features/reviews/review-form';
import { ReviewLoadState } from '@/features/reviews/review-load-state';
import { useMyReviews } from '@/features/reviews/use-my-reviews';
import { useReviewPhotos } from '@/features/reviews/use-review-photos';
import { type ReviewPhase, WriteReviewScreen } from '@/features/reviews/write-review-screen';
import { formatFullDate } from '@/features/tour-detail/departures';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';

/**
 * R5 — "Bị bác — viết lại" (mockup `mobile-review-screens` mục 2). Form R1 điền
 * sẵn nội dung cũ, mở đầu bằng lý do người duyệt viết. Gửi bằng `reviews.update`:
 * bài quay lại hàng đợi duyệt. Ảnh THAY TRỌN: giữ/gỡ ảnh cũ, thêm ảnh mới
 * (ký upload theo `bookingCode` của bài).
 */
export default function RewriteReviewRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reviewId = id ?? '';
  const copy = messages.reviews;
  const queryClient = useQueryClient();

  const listQuery = useMyReviews();
  const updateMutation = useMutation(
    orpc.reviews.update.mutationOptions({ context: withMobileAuth() }),
  );

  const review = listQuery.data?.items.find((item) => item.id === reviewId);
  const bookingCode = review?.bookingCode ?? '';
  const photoState = useReviewPhotos(bookingCode, copy.photos);

  const [rating, setRating] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [phase, setPhase] = useState<ReviewPhase>('form');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const seeded = useRef(false);

  // Điền sẵn đúng một lần khi bài tải về — sau đó khách sửa tự do, không bị ghi đè.
  useEffect(() => {
    if (review === undefined || seeded.current) return;
    seeded.current = true;
    setRating(review.rating);
    setTitle(review.title ?? '');
    setBody(review.body);
    photoState.setPhotos(
      review.media.map((media) => ({
        key: media.publicId,
        // Ô thumbnail 72pt (~216px ở 3x): không tải ảnh nguyên cỡ (V9).
        uri: cloudinaryUrl(media.url, 216),
        ext: 'jpg',
        status: 'done',
        publicId: media.publicId,
      })),
    );
  }, [review, photoState]);

  if (listQuery.isPending) {
    return (
      <ReviewLoadState
        state="loading"
        errorText={copy.loadError}
        retryLabel={copy.loadErrorRetry}
        onRetry={() => void listQuery.refetch()}
      />
    );
  }
  if (listQuery.isError || review === undefined) {
    return (
      <ReviewLoadState
        state="error"
        errorText={
          listQuery.isError ? copy.loadError : (copy.errors.REVIEW_NOT_FOUND ?? copy.loadError)
        }
        retryLabel={copy.loadErrorRetry}
        onRetry={() => void listQuery.refetch()}
      />
    );
  }

  const draft = { rating, title, body };
  const { photoIds } = photoState;
  const canSubmit = canSubmitReview(draft) && photoIds !== null;
  const remaining = REVIEW_REJECTION_LIMIT - review.rejectionCount;

  function submit() {
    if (!canSubmit || photoIds === null || rating === null) return;
    setErrorMessage(null);
    // Ảnh THAY TRỌN: luôn gửi đủ danh sách hiện tại (kể cả `[]` khi đã gỡ hết).
    const trimmedTitle = title.trim();
    updateMutation.mutate(
      {
        id: reviewId,
        rating,
        body: body.trim(),
        ...(trimmedTitle === '' ? {} : { title: trimmedTitle }),
        photos: photoIds,
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: orpc.reviews.mine.key() });
          setPhase('submitted');
        },
        onError: (error) => setErrorMessage(reviewSubmitErrorMessage(error)),
      },
    );
  }

  return (
    <WriteReviewScreen
      copy={copy}
      phase={phase}
      bookingCode={bookingCode}
      tourTitle={review.tourTitle ?? ''}
      imageUrl={review.tourImage?.url ?? null}
      transformUrl={cloudinaryUrl}
      dateRangeLabel={formatFullDate(review.createdAt.slice(0, 10))}
      rating={rating}
      onRatingChange={setRating}
      title={title}
      onTitleChange={setTitle}
      body={body}
      onBodyChange={setBody}
      canSubmit={canSubmit}
      submitting={updateMutation.isPending}
      errorMessage={errorMessage}
      onSubmit={submit}
      onBack={() => router.back()}
      onSeeReviews={() => router.push('/reviews/mine')}
      photos={photoState.photos}
      maxPhotos={5}
      photoError={photoState.photoError}
      sheetOpen={photoState.sheetOpen}
      sheetBusy={false}
      sheetError={photoState.sheetError}
      onOpenSheet={() => {
        photoState.setSheetError(null);
        photoState.setSheetOpen(true);
      }}
      onCloseSheet={() => {
        photoState.setSheetError(null);
        photoState.setSheetOpen(false);
      }}
      onTakePhoto={() => void photoState.pickPhoto('camera')}
      onChooseLibrary={() => void photoState.pickPhoto('library')}
      onRetryPhoto={photoState.retryPhoto}
      onRemovePhoto={photoState.removePhoto}
      allowAddPhoto={review.bookingCode !== null}
      submitLabel={copy.resubmit}
      submittingLabel={copy.resubmitting}
      rejection={{
        title: copy.rejectedTitle,
        body: copy.rejectedBody,
        reasonLabel: copy.rejectedReason,
        reason: review.moderationNote ?? '',
        footnote: remaining === 1 ? copy.rewriteLeft : '',
      }}
    />
  );
}
