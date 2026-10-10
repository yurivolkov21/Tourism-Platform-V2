import { useQueryClient } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearBookingDraft,
  completeBookingDraft,
  getBookingDraft,
} from '@/features/booking/booking-draft';
import { VERIFY_BACKOFF_MS, verifyOutcome } from '@/features/booking/booking-form';
import { BookingStatusScreen } from '@/features/booking/booking-status-screen';
import { openCheckout } from '@/features/booking/open-checkout';
import { orpc, withMobileAuth } from '@/lib/api/client';

type VerifyPhase = 'checking' | 'stillPending' | 'ended';

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
  // Rời màn là dừng hẳn: lượt hỏi đang bay dở không được hẹn thêm lượt nữa.
  const aliveRef = useRef(true);
  // `ended` xoá draft nên giữ lại mã để còn link tới hoá đơn.
  const endedCodeRef = useRef<string | null>(null);
  const [openFailed, setOpenFailed] = useState(false);

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
      if (!aliveRef.current) return;
      const outcome = verifyOutcome(result.status);
      if (outcome === 'paid') {
        // Xoá draft NGAY — các màn B1–B5 còn trong stack không tạo lại được booking.
        completeBookingDraft(result.totalAmount);
        router.replace('/bookings/new/success');
        return;
      }
      if (outcome === 'ended') {
        // Booking đã chết (huỷ/hoàn): dừng hỏi, không mời trả lại.
        endedCodeRef.current = bookingCode;
        clearBookingDraft();
        setPhase('ended');
        return;
      }
    } catch {
      // Lỗi mạng/API giữa chừng — coi như "chưa xác nhận được", cùng nhánh
      // với PENDING thật (booking.resultError đã có sẵn cho ca này).
    }

    if (!aliveRef.current) return;
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
    aliveRef.current = true;
    // `ended` đã xoá draft (bookingCode về null) — đó là chủ ý, không phải deep-link lạc.
    if (bookingCode === null) {
      if (endedCodeRef.current === null) router.back();
      return;
    }
    timeoutRef.current = setTimeout(() => void checkOnce(), VERIFY_BACKOFF_MS[0]);
    return () => {
      aliveRef.current = false;
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, [bookingCode, checkOnce]);

  if (bookingCode === null && endedCodeRef.current === null) return null;

  function verifyAgain() {
    setPhase('checking');
    void checkOnce();
  }

  function reopenCheckout() {
    if (draft?.checkoutUrl !== null && draft?.checkoutUrl !== undefined) {
      void openCheckout(draft.checkoutUrl).then((opened) => setOpenFailed(!opened));
    }
  }

  if (phase === 'ended') {
    return (
      <BookingStatusScreen
        icon="x-circle"
        heading={booking.verifyEndedTitle}
        body={messages.accountBookingDetail.terminalNote.CANCELLED ?? ''}
        primary={{
          label: booking.viewBooking,
          onPress: () => router.replace(`/bookings/${endedCodeRef.current}`),
        }}
      />
    );
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
      body={openFailed ? booking.openBrowserFailed : booking.stillPendingBody}
      primary={{ label: booking.verifyAgain, onPress: verifyAgain }}
      secondary={{ label: booking.openCheckout, onPress: reopenCheckout }}
    />
  );
}
