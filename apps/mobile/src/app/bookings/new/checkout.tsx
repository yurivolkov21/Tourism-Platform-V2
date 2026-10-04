import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { getBookingDraft } from '@/features/booking/booking-draft';
import { BookingStatusScreen } from '@/features/booking/booking-status-screen';

/**
 * B5 (spec P5b-3) — rời app sang trình duyệt. `checkoutUrl` đã có từ lúc
 * `bookings.create` (B4) — mở LẠI đúng link đó, không mint link mới (Expo Go
 * không nạp được Stripe PaymentSheet, ADR-0001 AMEND 1).
 */
export default function BookingCheckoutRoute() {
  const draft = getBookingDraft();
  const { booking } = messages.mobile;
  const checkoutUrl = draft?.checkoutUrl ?? null;

  useEffect(() => {
    // Chưa tạo được booking (deep-link thẳng vào đây) — không có link nào để mở.
    if (checkoutUrl === null) router.back();
  }, [checkoutUrl]);

  if (checkoutUrl === null) return null;
  const openUrl: string = checkoutUrl;

  return (
    <BookingStatusScreen
      icon="external-link"
      heading={booking.checkoutHeading}
      body={booking.browserHint}
      primary={{
        label: booking.openCheckout,
        onPress: () => void WebBrowser.openBrowserAsync(openUrl),
      }}
      // B6 (đang xác nhận) — hỏi lại server, KHÔNG tự cho là đã trả.
      secondary={{
        label: booking.finishedPaying,
        onPress: () => router.push('/bookings/new/verify'),
      }}
    />
  );
}
