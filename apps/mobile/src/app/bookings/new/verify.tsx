import { useQueryClient } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getBookingDraft } from '@/features/booking/booking-draft';
import { VERIFY_BACKOFF_MS } from '@/features/booking/booking-form';
import { BookingStatusScreen } from '@/features/booking/booking-status-screen';
import { orpc, withMobileAuth } from '@/lib/api/client';

type VerifyPhase = 'checking' | 'stillPending';

/**
 * B6 (đang xác nhận) + B7 (chưa nhận được xác nhận), mockup P5b-3 — CÙNG một
 * route vì hai màn chỉ khác nội dung của khuôn `BookingStatusScreen`, không
 * phải hai bước điều hướng riêng. App hỏi lại `bookings.byCode` (KHÔNG tin
 * trình duyệt vừa đóng đã là đã trả — webhook cổng có thể tới sau vài giây),
 * cách nhau 2s/4s/8s rồi dừng (`VERIFY_BACKOFF_MS`) — không quay vòng vô hạn.
 */
export default function BookingVerifyRoute() {
  const draft = getBookingDraft();
  const { booking } = messages.mobile;
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<VerifyPhase>('checking');
  const attemptRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bookingCode = draft?.bookingCode ?? null;

  const checkOnce = useCallback(async () => {
    if (bookingCode === null) return;
    try {
      const result = await queryClient.fetchQuery(
        orpc.bookings.byCode.queryOptions({
          input: { code: bookingCode },
          context: withMobileAuth(),
        }),
      );
      if (result.status === 'PAID') {
        router.replace('/bookings/new/success');
        return;
      }
    } catch {
      // Lỗi mạng/API giữa chừng — coi như "chưa xác nhận được", cùng nhánh
      // với PENDING thật (booking.resultError đã có sẵn cho ca này).
    }

    if (attemptRef.current < VERIFY_BACKOFF_MS.length - 1) {
      attemptRef.current += 1;
      timeoutRef.current = setTimeout(
        () => void checkOnce(),
        VERIFY_BACKOFF_MS[attemptRef.current],
      );
    } else {
      setPhase('stillPending');
    }
  }, [bookingCode, queryClient]);

  useEffect(() => {
    if (bookingCode === null) {
      router.back();
      return;
    }
    timeoutRef.current = setTimeout(() => void checkOnce(), VERIFY_BACKOFF_MS[0]);
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, [bookingCode, checkOnce]);

  if (bookingCode === null) return null;

  function verifyAgain() {
    setPhase('checking');
    void checkOnce();
  }

  function reopenCheckout() {
    if (draft?.checkoutUrl !== null && draft?.checkoutUrl !== undefined) {
      void WebBrowser.openBrowserAsync(draft.checkoutUrl);
    }
  }

  if (phase === 'checking') {
    return (
      <BookingStatusScreen
        icon="loader"
        heading={booking.verifying}
        body={booking.confirmingBody}
      />
    );
  }

  return (
    <BookingStatusScreen
      icon="clock"
      heading={booking.stillPendingTitle}
      body={booking.stillPendingBody}
      primary={{ label: booking.verifyAgain, onPress: verifyAgain }}
      secondary={{ label: booking.openCheckout, onPress: reopenCheckout }}
    />
  );
}
