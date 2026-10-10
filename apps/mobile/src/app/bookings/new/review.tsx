import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PaymentProviderValue } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { getBookingDraft, updateBookingDraft } from '@/features/booking/booking-draft';
import {
  type BookingCreateErrorAction,
  bookingCreateErrorAction,
  bookingSubmitErrorCopy,
  buildBookingInput,
  totalPrice,
} from '@/features/booking/booking-form';
import { BookingReviewScreen } from '@/features/booking/booking-review-screen';
import { formatDepartureDate, formatDepartureRange } from '@/features/tour-detail/departures';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import { formatMoney } from '@/lib/format-money';

/** B4 (spec P5b-3) — bước 3: xem lại và chọn cổng. Bấm Pay gọi `bookings.create`. */
export default function BookingReviewRoute() {
  const draft = getBookingDraft();
  const { booking } = messages.mobile;
  const [paymentProvider, setPaymentProvider] = useState<PaymentProviderValue>(
    draft?.paymentProvider ?? 'STRIPE',
  );
  const [error, setError] = useState<{ message: string; action: BookingCreateErrorAction } | null>(
    null,
  );

  const queryClient = useQueryClient();
  const createMutation = useMutation(
    orpc.bookings.create.mutationOptions({ context: withMobileAuth() }),
  );
  const checkoutMutation = useMutation(
    orpc.bookings.checkout.mutationOptions({ context: withMobileAuth() }),
  );

  useEffect(() => {
    if (draft === null) router.back();
  }, [draft]);

  if (draft === null) return null;

  const { trip } = draft;
  const partySize = draft.numAdults + draft.numChildren;
  const amount = formatMoney(totalPrice(trip.unitPrice, partySize), trip.currency);

  function pay() {
    if (draft === null) return;
    setError(null);
    // Đọc draft MỚI sau khi ghi cổng thanh toán: đổi cổng xoá `bookingCode` cũ, còn
    // `draft` của lượt render này vẫn là bản trước đó (checkout nhầm booking cũ).
    const current = updateBookingDraft({ paymentProvider }) ?? draft;
    const handlers = {
      onSuccess: (result: { checkoutUrl: string | null; code: string }) => {
        // Booking PENDING mới phải hiện ở Trips ngay, không chờ reload app.
        void queryClient.invalidateQueries({ queryKey: orpc.bookings.mine.key() });
        updateBookingDraft({ checkoutUrl: result.checkoutUrl, bookingCode: result.code });
        router.push('/bookings/new/checkout');
      },
      onError: (submitError: unknown) => {
        setError({
          message: bookingSubmitErrorCopy(submitError),
          action: bookingCreateErrorAction(submitError),
        });
      },
    };

    // Draft đã có booking PENDING (quay lại từ B5/B6) → checkout lại đúng booking
    // đó, KHÔNG tạo booking thứ hai (quy tắc #2 handoff: không trả tiền hai lần).
    if (current.bookingCode !== null) {
      checkoutMutation.mutate({ code: current.bookingCode }, handlers);
      return;
    }
    createMutation.mutate(
      buildBookingInput({
        departureId: trip.departureId,
        numAdults: current.numAdults,
        numChildren: current.numChildren,
        contactName: current.contactName,
        contactEmail: current.contactEmail,
        contactPhone: current.contactPhone,
        specialRequests: current.specialRequests,
        paymentProvider,
      }),
      handlers,
    );
  }

  // B9 — đường đi tiếp cạnh khung lỗi, tuỳ mã lỗi (`bookingCreateErrorAction`).
  const errorAction =
    error === null
      ? undefined
      : error.action === 'goToDates'
        ? {
            label: booking.chooseAnotherDate,
            onPress: () => router.replace(`/tours/${trip.tourSlug}?tab=dates`),
          }
        : error.action === 'goToTravellers'
          ? {
              label: booking.editTravellers,
              onPress: () => router.navigate('/bookings/new/travellers'),
            }
          : undefined;

  return (
    <BookingReviewScreen
      step={3}
      totalSteps={3}
      stepLabel={booking.stepLabel(3, 3)}
      tripHeading={booking.tripHeading}
      trip={{
        imageUrl: trip.tourImageUrl,
        title: trip.tourTitle,
        dateRangeLabel: formatDepartureRange(trip.startDate, trip.endDate),
      }}
      editTripLabel={booking.editTrip}
      onEditTrip={() => router.back()}
      travellersTotalLine={booking.travellersTotal(
        partySize,
        formatMoney(trip.unitPrice, trip.currency),
      )}
      priceTotal={amount}
      totalRowLabel={messages.checkoutSummary.totalLabel}
      cancellationNote={messages.cancellationDeadline.short(
        formatDepartureDate(trip.bookingDeadline),
      )}
      paymentMethodHeading={booking.paymentMethodHeading}
      stripeLabel={booking.providerStripe}
      payPalLabel={booking.providerPayPal}
      paymentProvider={paymentProvider}
      onSelectProvider={setPaymentProvider}
      browserNote={booking.payBrowserNote}
      totalLabel={messages.checkoutSummary.totalLabel}
      // B9 CHECKOUT_FAILED (và mọi lỗi "stay" khác): nút đổi thành "Try again".
      // Booking có thể ĐÃ tạo ở PENDING (gateway lỗi sau khi tạo) nhưng client không
      // nhận được mã — bấm lại tạo booking mới, bản cũ để cron TTL dọn.
      payLabel={
        error !== null && error.action === 'stay'
          ? booking.retry
          : messages.booking.wizard.payCta(amount)
      }
      onPay={pay}
      pending={createMutation.isPending || checkoutMutation.isPending}
      errorMessage={error?.message ?? null}
      errorAction={errorAction}
      transformUrl={cloudinaryUrl}
    />
  );
}
