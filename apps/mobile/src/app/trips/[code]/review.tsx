import { ORPCError } from '@orpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  buildReviewInput,
  canSubmitReview,
  reviewSubmitErrorMessage,
} from '@/features/reviews/review-form';
import { ReviewLoadState } from '@/features/reviews/review-load-state';
import { useReviewPhotos } from '@/features/reviews/use-review-photos';
import { type ReviewPhase, WriteReviewScreen } from '@/features/reviews/write-review-screen';
import { formatDepartureRange } from '@/features/tour-detail/departures';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';

/**
 * R1 + R2 (mockup `mobile-review-screens` mục 1) — viết đánh giá cho chuyến đã đi,
 * kèm ảnh. Ảnh đi đường: ký `media.signUpload` (REVIEW_PHOTO) → tải thẳng lên
 * Cloudinary → giữ publicId → gửi kèm `reviews.create`. App KHÔNG đẩy ảnh qua API.
 */
export default function ReviewRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const bookingCode = code ?? '';
  const copy = messages.reviews;
  const queryClient = useQueryClient();

  const [rating, setRating] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [phase, setPhase] = useState<ReviewPhase>('form');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const photoState = useReviewPhotos(bookingCode, copy.photos);

  const detailQuery = useQuery(
    orpc.bookings.byCode.queryOptions({
      input: { code: bookingCode },
      context: withMobileAuth(),
    }),
  );

  const createMutation = useMutation(
    orpc.reviews.create.mutationOptions({ context: withMobileAuth() }),
  );

  const booking = detailQuery.data;
  if (booking === undefined) {
    return (
      <ReviewLoadState
        state={detailQuery.isError ? 'error' : 'loading'}
        errorText={messages.mobile.booking.detailError}
        retryLabel={messages.mobile.booking.retry}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const draft = { rating, title, body };
  const { photoIds } = photoState;
  const canSubmit = canSubmitReview(draft) && photoIds !== null;

  function submit() {
    if (!canSubmit || photoIds === null) return;
    setErrorMessage(null);
    const input = buildReviewInput(bookingCode, draft);
    createMutation.mutate(photoIds.length > 0 ? { ...input, photos: photoIds } : input, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.bookings.byCode.key() });
        void queryClient.invalidateQueries({ queryKey: orpc.bookings.mine.key() });
        setPhase('submitted');
      },
      onError: (error) => {
        if (error instanceof ORPCError && error.code === 'REVIEW_TRIP_NOT_COMPLETED') {
          setPhase('tooEarly');
        } else if (error instanceof ORPCError && error.code === 'REVIEW_ALREADY_EXISTS') {
          setPhase('alreadyReviewed');
        } else {
          setErrorMessage(reviewSubmitErrorMessage(error));
        }
      },
    });
  }

  return (
    <WriteReviewScreen
      copy={copy}
      phase={phase}
      bookingCode={bookingCode}
      tourTitle={booking.tourTitle}
      imageUrl={booking.tourImage?.url ?? null}
      transformUrl={cloudinaryUrl}
      dateRangeLabel={formatDepartureRange(booking.departureStartDate, booking.departureEndDate)}
      rating={rating}
      onRatingChange={setRating}
      title={title}
      onTitleChange={setTitle}
      body={body}
      onBodyChange={setBody}
      canSubmit={canSubmit}
      submitting={createMutation.isPending}
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
    />
  );
}
