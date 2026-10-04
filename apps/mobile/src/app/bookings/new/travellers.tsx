import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { getBookingDraft, updateBookingDraft } from '@/features/booking/booking-draft';
import { partyCap, totalPrice } from '@/features/booking/booking-form';
import { BookingTravellersScreen } from '@/features/booking/booking-travellers-screen';
import { formatDepartureRange } from '@/features/tour-detail/departures';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import { formatMoney } from '@/lib/format-money';

const MAX_PARTY_SANITY = 99;

/** B1/B2 (spec P5b-3) — bước 1: số khách. Draft đã mở sẵn từ `tours/[slug].tsx`. */
export default function BookingTravellersRoute() {
  const draft = getBookingDraft();
  const { booking } = messages.mobile;

  const [numAdults, setNumAdults] = useState(draft?.numAdults ?? 1);
  const [numChildren, setNumChildren] = useState(draft?.numChildren ?? 0);

  useEffect(() => {
    // Deep-link thẳng vào bước giữa chừng mà chưa mở draft (không đi qua
    // "Book now") — không có gì để hiện, lùi về trang trước.
    if (draft === null) router.back();
  }, [draft]);

  if (draft === null) return null;

  const { trip } = draft;
  const cap = partyCap(trip.maxGroupSize, trip.seatsLeft);
  const partySize = numAdults + numChildren;
  const atCap = partySize >= cap.cap;
  const total = totalPrice(trip.unitPrice, partySize);

  function commitAndContinue() {
    updateBookingDraft({ numAdults, numChildren });
    router.push('/bookings/new/contact');
  }

  return (
    <BookingTravellersScreen
      step={1}
      totalSteps={3}
      stepLabel={booking.stepLabel(1, 3)}
      tripHeading={booking.tripHeading}
      trip={{
        imageUrl: trip.tourImageUrl,
        title: trip.tourTitle,
        dateRangeLabel: formatDepartureRange(trip.startDate, trip.endDate),
      }}
      editTripLabel={booking.editTrip}
      onEditTrip={() => router.back()}
      travellersHeading={booking.travellersHeading}
      adultsLabel={messages.booking.box.adults}
      adultPriceLabel={booking.priceEach(formatMoney(trip.unitPrice, trip.currency))}
      numAdults={numAdults}
      onDecreaseAdults={() => setNumAdults((n) => Math.max(1, n - 1))}
      onIncreaseAdults={() =>
        setNumAdults((n) => (partySize < cap.cap ? Math.min(n + 1, MAX_PARTY_SANITY) : n))
      }
      adultsAtMin={numAdults <= 1}
      adultsAtCap={atCap}
      decreaseAdultsLabel={booking.stepperDecrease(messages.booking.box.adults)}
      increaseAdultsLabel={booking.stepperIncrease(messages.booking.box.adults)}
      childrenLabel={messages.booking.box.children}
      childrenPriceNote={booking.sameAsAdultPrice}
      numChildren={numChildren}
      onDecreaseChildren={() => setNumChildren((n) => Math.max(0, n - 1))}
      onIncreaseChildren={() =>
        setNumChildren((n) => (partySize < cap.cap ? Math.min(n + 1, MAX_PARTY_SANITY) : n))
      }
      childrenAtCap={atCap}
      decreaseChildrenLabel={booking.stepperDecrease(messages.booking.box.children)}
      increaseChildrenLabel={booking.stepperIncrease(messages.booking.box.children)}
      capHintNote={
        cap.reason === 'seats' ? booking.seatsLeftOnDate(cap.cap) : booking.groupCapNote(cap.cap)
      }
      capReachedNote={atCap ? booking.groupCapReached(cap.cap) : null}
      totalLabel={booking.travellersTotal(partySize, formatMoney(trip.unitPrice, trip.currency))}
      totalAmount={formatMoney(total, trip.currency)}
      continueLabel={booking.continueCta}
      onContinue={commitAndContinue}
      transformUrl={cloudinaryUrl}
    />
  );
}
