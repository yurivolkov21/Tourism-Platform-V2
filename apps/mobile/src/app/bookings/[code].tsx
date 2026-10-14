import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingPhase } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  Button,
  EmptyState,
  SCREEN_EDGES_UNDER_HEADER,
  Screen,
  useTheme,
} from '@tourism/mobile-ui';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { AuthGateScreen } from '@/features/auth/auth-gate-screen';
import { setPendingReturn } from '@/features/auth/return-to';
import {
  bookingDetailActions,
  bookingDetailKind,
  cancelErrorAction,
  cancelErrorCopy,
  operatorRefund,
  payErrorAction,
} from '@/features/booking/booking-detail';
import {
  type BookingDetailPill,
  type BookingDetailRow,
  BookingDetailScreen,
} from '@/features/booking/booking-detail-screen';
import { CancelBookingSheet } from '@/features/booking/cancel-sheet';
import { openCheckout } from '@/features/booking/open-checkout';
import {
  formatDepartureDate,
  formatDepartureRange,
  formatFullDate,
} from '@/features/tour-detail/departures';
import { bookingStatusPill } from '@/features/trips/trips-list';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { getAuthClient } from '@/lib/auth-client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import { formatMoney } from '@/lib/format-money';
import { useServerToday } from '@/lib/use-server-clock';

/**
 * Chi tiết booking (T4/T5/T8, W4) + huỷ (T6/T7, W5) — mockup
 * `mobile-booking-screens.src.html`, spec `docs/handoff/mobile-booking-handoff.md`.
 *
 * Reachable qua deep link (`nexora://bookings/<mã>`, namespace không độc
 * quyền — xem comment cũ của file này) nên PHẢI gác đăng nhập Ở ĐÂY, không
 * nhờ cậy việc chỉ tới từ tab Trips đã gác.
 */
export default function BookingDetailRoute() {
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  // `useLocalSearchParams` trả `string | string[] | undefined` ở runtime —
  // kẹp về một chuỗi trước khi đưa vào bất kỳ lời gọi API nào.
  const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;
  const theme = useTheme();
  // Ngày theo đồng hồ server — giai đoạn của đơn (`bookingPhase`) cùng luật với tab Trips.
  const today = useServerToday();

  const { data: session } = getAuthClient().useSession();
  const signedIn = Boolean(session?.user);
  const { booking: bookingCopy } = messages.mobile;
  const { detail: t } = bookingCopy;
  const queryClient = useQueryClient();

  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
  const [cancelPendingSheetOpen, setCancelPendingSheetOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  // Lỗi bấm Pay hiện NGAY trên màn (T5) — tách khỏi `actionError` chỉ nằm trong tấm huỷ đang ẩn.
  const [payError, setPayError] = useState<
    { kind: 'closed' } | { kind: 'message'; text: string } | null
  >(null);

  const detailQuery = useQuery(
    orpc.bookings.byCode.queryOptions({
      input: { code: code ?? '' },
      context: withMobileAuth(),
      enabled: signedIn && code !== undefined,
    }),
  );

  const checkoutMutation = useMutation(
    orpc.bookings.checkout.mutationOptions({ context: withMobileAuth() }),
  );
  const cancelPendingMutation = useMutation(
    orpc.bookings.cancelPending.mutationOptions({ context: withMobileAuth() }),
  );
  const cancelMutation = useMutation(
    orpc.bookings.cancel.mutationOptions({ context: withMobileAuth() }),
  );

  if (code === undefined) return null;

  // Mockup T4/T5/T8: tiêu đề header là MÃ BOOKING, không phải một nhãn chung
  // chung ("Booking detail" tĩnh ở root layout chỉ là fallback khi chưa đọc
  // được tham số URL). Cỡ chữ/canh trái đè riêng cho màn này (không đụng
  // `screenOptions` gốc) — mặc định Native Stack cho mã đặt chỗ to và đậm hơn
  // hẳn mockup (phản hồi 01/10, soi ảnh thật).
  const titleScreen = (
    <Stack.Screen
      options={{
        title: code,
        headerTitleAlign: 'left',
        headerTitleStyle: { fontSize: theme.type.sm.fontSize, fontFamily: theme.fonts.semibold },
      }}
    />
  );

  if (!signedIn) {
    return (
      <>
        {titleScreen}
        <AuthGateScreen
          pageTitle={messages.mobile.trips.title}
          icon="briefcase"
          title={messages.mobile.authPrompts.tripsGateTitle}
          body={messages.mobile.authPrompts.tripsGateBody}
          signInLabel={messages.mobile.authPrompts.signIn}
          createAccountLabel={messages.mobile.authPrompts.createAccount}
          onSignIn={() => {
            setPendingReturn({ path: `/bookings/${code}` });
            router.navigate('/login');
          }}
          onCreateAccount={() => {
            setPendingReturn({ path: `/bookings/${code}` });
            router.navigate('/register');
          }}
        />
      </>
    );
  }

  if (detailQuery.isPending) {
    return (
      <>
        {titleScreen}
        <PlaceholderScreen edges={SCREEN_EDGES_UNDER_HEADER} detail={code} />
      </>
    );
  }

  if (detailQuery.isError) {
    return (
      <>
        {titleScreen}
        <Screen edges={SCREEN_EDGES_UNDER_HEADER} padded={false}>
          <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
            <EmptyState
              icon={null}
              title={bookingCopy.detailError}
              titleVariant="subtitle"
              titleTone="muted"
              surface={false}
            >
              <Button
                label={bookingCopy.retry}
                onPress={() => void detailQuery.refetch()}
                shape="pill"
              />
            </EmptyState>
          </View>
        </Screen>
      </>
    );
  }

  const booking = detailQuery.data;
  const phase = bookingPhase(booking, today);
  const kind = bookingDetailKind(booking, phase);
  const actions = bookingDetailActions(booking, phase);
  const amount = formatMoney(booking.totalAmount, booking.currency);
  const refundAmount = booking.cancellation
    ? formatMoney(booking.cancellation.refundAmount, booking.currency)
    : null;

  // Đọc lại cả chi tiết LẪN danh sách — tab Trips cầm `bookings.mine` riêng, không
  // làm mới thì còn hiện trạng thái cũ sau khi huỷ/trả tiền.
  function refetch() {
    void queryClient.invalidateQueries({
      queryKey: orpc.bookings.byCode.queryOptions({ input: { code: code ?? '' } }).queryKey,
    });
    void queryClient.invalidateQueries({ queryKey: orpc.bookings.mine.key() });
  }

  function payNow() {
    setPayError(null);
    checkoutMutation.mutate(
      { code: code ?? '' },
      {
        onSuccess: async (result) => {
          if (!result.checkoutUrl) return;
          const opened = await openCheckout(result.checkoutUrl);
          if (!opened) {
            setPayError({ kind: 'message', text: bookingCopy.openBrowserFailed });
            return;
          }
          // Trình duyệt đóng → hỏi lại trạng thái (webhook có thể đã tới).
          refetch();
        },
        onError: (error) => {
          const action = payErrorAction(error);
          if (action === 'departureClosed') setPayError({ kind: 'closed' });
          else if (action === 'refetch') refetch();
          else setPayError({ kind: 'message', text: cancelErrorCopy(error) });
        },
      },
    );
  }

  function confirmCancelPending() {
    setActionError(null);
    cancelPendingMutation.mutate(
      { code: code ?? '' },
      {
        onSuccess: () => {
          setCancelPendingSheetOpen(false);
          refetch();
        },
        onError: (error) => setActionError(cancelErrorCopy(error)),
      },
    );
  }

  function confirmCancel() {
    if (booking.cancellation === null) return;
    setActionError(null);
    cancelMutation.mutate(
      {
        code: code ?? '',
        expectedRefundAmount: booking.cancellation.refundAmount,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      },
      {
        onSuccess: () => {
          setCancelSheetOpen(false);
          setReason('');
          refetch();
        },
        onError: (error) => {
          setActionError(cancelErrorCopy(error));
          if (cancelErrorAction(error) === 'refetch') refetch();
        },
      },
    );
  }

  const trip = {
    imageUrl: booking.tourImage?.url ?? null,
    title: booking.tourTitle,
    dateRangeLabel: formatDepartureRange(booking.departureStartDate, booking.departureEndDate),
  };
  // Cùng luật pill với thẻ Trips: chuyến công ty huỷ không mang "Paid" xanh dù đơn còn PAID, đơn
  // chờ trả quá hạn chót không mang "Payment due" cam (G54).
  const pill = bookingStatusPill(booking, phase, {
    status: messages.mobile.trips.status,
    lapsed: messages.accountBookings.lapsedBadge,
  });
  const pillLabel = pill.label;
  const pillTone: BookingDetailPill = pill.tone;

  let note: Parameters<typeof BookingDetailScreen>[0]['note'] = null;
  let rows: BookingDetailRow[] = [{ label: bookingCopy.bookingCodeLabel, value: booking.code }];
  let primaryAction: Parameters<typeof BookingDetailScreen>[0]['primaryAction'] = null;
  let secondaryAction: Parameters<typeof BookingDetailScreen>[0]['secondaryAction'] = null;
  let contactLine: Parameters<typeof BookingDetailScreen>[0]['contactLine'];

  if (kind === 'pending') {
    const closed = payError?.kind === 'closed';
    note =
      payError === null
        ? {
            tone: 'warning',
            icon: 'alert-circle',
            title: t.paymentNotFinishedTitle,
            body: t.paymentNotFinishedBody,
          }
        : payError.kind === 'closed'
          ? {
              tone: 'warning',
              icon: 'alert-circle',
              title: t.departureClosedTitle,
              body: t.departureClosedBody,
            }
          : { tone: 'warning', icon: 'alert-circle', title: payError.text };
    rows = [
      { label: bookingCopy.bookingCodeLabel, value: booking.code },
      {
        label: t.travellersLabel,
        value: messages.mobile.trips.travellersCount(booking.numAdults + booking.numChildren),
      },
      { label: t.totalDueLabel, value: amount, emphasis: true },
    ];
    // Đợt đã đóng thì không còn gì để trả — chỉ để lại nút bỏ booking.
    primaryAction = closed
      ? null
      : {
          label: messages.booking.wizard.payCta(amount),
          onPress: payNow,
          disabled: checkoutMutation.isPending,
        };
    if (actions.includes('cancelPending')) {
      secondaryAction = {
        label: t.cancelThisBooking,
        onPress: () => setCancelPendingSheetOpen(true),
      };
    }
  } else if (kind === 'lapsed') {
    // G54: quá hạn chót mà chưa trả — cùng câu với khung đã đóng của web (`closedNarrative`): câu
    // sự việc rồi câu điều kiện. Không mời trả (API không mở phiên nào nữa) mà cũng không khẳng
    // định "đã lỡ": claim của webhook còn nhận phiên mở trước hạn (ADR-0054 AMEND 1 §4).
    note = {
      tone: 'warning',
      icon: 'clock',
      title: messages.bookingDetail.closed.notPaidByDeadline,
      body: messages.bookingDetail.closed.finishOpenPayment,
    };
    rows = [
      { label: bookingCopy.bookingCodeLabel, value: booking.code },
      {
        label: t.travellersLabel,
        value: messages.mobile.trips.travellersCount(booking.numAdults + booking.numChildren),
      },
      // Chưa trả thì không "Total due" (mời trả) cũng không "Total paid" — cùng `bookingTotalLabel` của web.
      { label: messages.checkoutSummary.totalLabel, value: amount, emphasis: true },
    ];
    primaryAction = {
      label: messages.mobile.trips.browse,
      onPress: () => router.navigate('/explore'),
    };
  } else if (kind === 'paid') {
    if (booking.cancellation) {
      note = booking.cancellation.withinDeadline
        ? {
            tone: 'success',
            icon: 'shield',
            title: messages.cancellationDeadline.short(
              formatDepartureDate(booking.cancellation.deadline),
            ),
            body: t.cancelByThenNote(refundAmount ?? amount),
          }
        : // Quá hạn: không được hứa hoàn tiền (quy tắc #5 — chỉ tin `withinDeadline` của server).
          {
            tone: 'warning',
            icon: 'alert-circle',
            title: messages.mobile.trip.freeCancellationEnded,
            body: t.cancelAfterBody(formatDepartureDate(booking.cancellation.deadline)),
          };
    }
    rows = [
      { label: bookingCopy.bookingCodeLabel, value: booking.code },
      {
        label: t.travellersLabel,
        value: messages.mobile.trips.travellersCount(booking.numAdults + booking.numChildren),
      },
      { label: t.contactLabel, value: booking.contactEmail },
      ...(booking.paidAt ? [{ label: t.paidOnLabel, value: formatFullDate(booking.paidAt) }] : []),
      { label: t.totalPaidLabel, value: amount, emphasis: true },
    ];
    if (actions.includes('cancelBooking')) {
      secondaryAction = {
        label: messages.accountBookingDetail.actions.cancel,
        onPress: () => setCancelSheetOpen(true),
      };
      contactLine = {
        prompt: t.questionsAboutTrip,
        actionLabel: t.contactLinkLabel,
        onPress: () => router.push(`/tours/${booking.tourSlug}`),
      };
    }
  } else if (kind === 'departureCancelled') {
    // Công ty huỷ chuyến (ADR-0041 AMEND 1): cùng câu với trang chi tiết đơn của web, rồi chuyện
    // tiền — đang về khi job hoàn tiền chưa chạy, hay khoản sổ đã ghi.
    const refund = operatorRefund(booking);
    const refundBody =
      refund === null
        ? null
        : refund.kind === 'onItsWay'
          ? messages.bookingDetail.closed.refundOnItsWay
          : refund.refundedAt === null
            ? t.refundedNoDate(formatMoney(refund.amount, booking.currency))
            : t.refundedNote(
                formatMoney(refund.amount, booking.currency),
                formatFullDate(refund.refundedAt),
              );
    note = {
      tone: 'warning',
      icon: 'x-circle',
      title: messages.bookingDetail.closed.weCancelled,
      ...(refundBody === null ? {} : { body: refundBody }),
    };
    rows = [
      { label: bookingCopy.bookingCodeLabel, value: booking.code },
      ...(booking.cancelledAt
        ? [{ label: t.cancelledOnLabel, value: formatFullDate(booking.cancelledAt) }]
        : []),
      // Đơn chưa từng thu tiền thì không có dòng tiền nào để in.
      ...(refund === null ? [] : [{ label: t.paidLabel, value: amount }]),
    ];
    primaryAction = {
      label: messages.mobile.trips.browse,
      onPress: () => router.navigate('/explore'),
    };
  } else if (kind === 'cancelled') {
    note = {
      tone: 'warning',
      icon: 'x-circle',
      title: messages.accountBookingDetail.terminalNote.CANCELLED ?? '',
    };
    primaryAction = {
      label: messages.mobile.trips.browse,
      onPress: () => router.navigate('/explore'),
    };
  } else {
    const refunded = Number(booking.refundedTotal) > 0;
    // Không có mốc hoàn thật (hoàn do admin không qua đơn xin huỷ) thì KHÔNG in ngày —
    // trước đây rơi về ngày đặt chỗ, sai sự thật.
    const refundedAt = booking.cancellationDecidedAt ?? booking.cancelledAt;
    const refundedMoney = formatMoney(booking.refundedTotal, booking.currency);
    note = refunded
      ? {
          tone: 'success',
          icon: 'refresh-cw',
          title:
            refundedAt === null
              ? t.refundedNoDate(refundedMoney)
              : t.refundedNote(refundedMoney, formatFullDate(refundedAt)),
          body: t.refundedTiming,
        }
      : {
          tone: 'warning',
          icon: 'x-circle',
          title: messages.accountBookingDetail.refundLine.none,
        };
    rows = [
      { label: bookingCopy.bookingCodeLabel, value: booking.code },
      ...(booking.cancelledAt
        ? [{ label: t.cancelledOnLabel, value: formatFullDate(booking.cancelledAt) }]
        : []),
      { label: t.paidLabel, value: amount },
    ];
    primaryAction = {
      label: messages.mobile.trips.browse,
      onPress: () => router.navigate('/explore'),
    };
    // PARTIALLY_REFUNDED không phải trạng thái cuối (booking-states.md, ADR-0041):
    // khách vẫn đi tour và còn huỷ được khi server cho phép.
    if (actions.includes('cancelBooking')) {
      secondaryAction = {
        label: messages.accountBookingDetail.actions.cancel,
        onPress: () => setCancelSheetOpen(true),
      };
    }
  }

  return (
    <>
      {titleScreen}
      <BookingDetailScreen
        trip={trip}
        pillLabel={pillLabel}
        pillTone={pillTone}
        note={note}
        rows={rows}
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
        contactLine={contactLine}
        transformUrl={cloudinaryUrl}
      />
      <CancelBookingSheet
        visible={cancelPendingSheetOpen}
        onClose={() => setCancelPendingSheetOpen(false)}
        title={messages.accountBookingDetail.actions.cancelConfirmTitle}
        body={messages.accountBookingDetail.actions.cancelConfirmBody}
        confirmLabel={messages.accountBookingDetail.actions.cancelConfirmCta}
        dismissLabel={messages.accountBookingDetail.actions.cancelDismiss}
        pending={cancelPendingMutation.isPending}
        error={actionError}
        onConfirm={confirmCancelPending}
      />
      {booking.cancellation === null ? null : (
        <CancelBookingSheet
          visible={cancelSheetOpen}
          onClose={() => setCancelSheetOpen(false)}
          title={
            booking.cancellation.withinDeadline
              ? messages.accountBookingDetail.actions.cancelConfirmTitle
              : t.cancelAfterTitle
          }
          body={
            booking.cancellation.withinDeadline
              ? t.cancelWithinBody
              : t.cancelAfterBody(formatDepartureDate(booking.cancellation.deadline))
          }
          refundLabel={t.refundLabel}
          refundAmount={refundAmount ?? ''}
          refundTone={booking.cancellation.withinDeadline ? 'good' : 'info'}
          // Mockup T7 (quá hạn) KHÔNG có ô lý do — chỉ T6 còn hạn mới hỏi.
          reasonLabel={booking.cancellation.withinDeadline ? t.cancelReasonLabel : undefined}
          reasonPlaceholder={
            booking.cancellation.withinDeadline ? t.cancelReasonPlaceholder : undefined
          }
          reason={reason}
          onChangeReason={booking.cancellation.withinDeadline ? setReason : undefined}
          contactLine={
            booking.cancellation.withinDeadline
              ? undefined
              : {
                  prompt: messages.accountBookingDetail.cancelDialog.afterContact,
                  onPress: () => {
                    // Đóng tấm trước khi đẩy màn mới — trên iOS Modal còn mở sẽ đè lên form.
                    setCancelSheetOpen(false);
                    router.push({
                      pathname: '/enquiry',
                      params: {
                        tourSlug: booking.tourSlug,
                        tripTitle: booking.tourTitle,
                        tripSubtitle: trip.dateRangeLabel,
                        ...(trip.imageUrl ? { tripImageUrl: trip.imageUrl } : {}),
                      },
                    });
                  },
                }
          }
          confirmLabel={
            booking.cancellation.withinDeadline
              ? messages.accountBookingDetail.cancelDialog.withinCta(refundAmount ?? '')
              : messages.accountBookingDetail.cancelDialog.afterCta
          }
          dismissLabel={messages.accountBookingDetail.actions.cancelDismiss}
          pending={cancelMutation.isPending}
          error={actionError}
          onConfirm={confirmCancel}
        />
      )}
    </>
  );
}
