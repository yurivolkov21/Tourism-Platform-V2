import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { BookingContactScreen } from '@/features/booking/booking-contact-screen';
import { getBookingDraft, updateBookingDraft } from '@/features/booking/booking-draft';
import {
  type ContactFormErrors,
  type ContactFormState,
  totalPrice,
  validateContactForm,
} from '@/features/booking/booking-form';
import { formatMoney } from '@/lib/format-money';

/** B3 (spec P5b-3) — bước 2: liên hệ. */
export default function BookingContactRoute() {
  const draft = getBookingDraft();
  const { booking } = messages.mobile;

  const [values, setValues] = useState<ContactFormState>({
    contactName: draft?.contactName ?? '',
    contactEmail: draft?.contactEmail ?? '',
    contactPhone: draft?.contactPhone ?? '',
    specialRequests: draft?.specialRequests ?? '',
  });
  const [errors, setErrors] = useState<ContactFormErrors>({});

  useEffect(() => {
    if (draft === null) router.back();
  }, [draft]);

  if (draft === null) return null;

  const { trip } = draft;
  const partySize = draft.numAdults + draft.numChildren;
  const totalLabel = booking.travellersTotal(partySize, formatMoney(trip.unitPrice, trip.currency));
  const totalAmount = formatMoney(totalPrice(trip.unitPrice, partySize), trip.currency);

  function handleChange<K extends keyof ContactFormState>(field: K, value: ContactFormState[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) =>
      current[field] === undefined ? current : { ...current, [field]: undefined },
    );
  }

  function commitAndContinue() {
    const nextErrors = validateContactForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    updateBookingDraft(values);
    router.push('/bookings/new/review');
  }

  return (
    <BookingContactScreen
      step={2}
      totalSteps={3}
      stepLabel={booking.stepLabel(2, 3)}
      heading={booking.contactHeading}
      subtitle={booking.contactSubtitle}
      nameLabel={booking.nameLabel}
      emailLabel={booking.emailLabel}
      phoneLabel={booking.phoneLabel}
      notesLabel={booking.notesLabel}
      values={values}
      errors={errors}
      onChange={handleChange}
      totalLabel={totalLabel}
      totalAmount={totalAmount}
      continueLabel={booking.continueCta}
      onContinue={commitAndContinue}
    />
  );
}
