import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import {
  Button,
  EmptyState,
  SCREEN_EDGES_UNDER_HEADER,
  Screen,
  useTheme,
} from '@tourism/mobile-ui';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
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
} from '@/features/booking/booking-detail';
import {
  type BookingDetailPill,
  type BookingDetailRow,
  BookingDetailScreen,
} from '@/features/booking/booking-detail-screen';
import { CancelBookingSheet } from '@/features/booking/cancel-sheet';
import {
  formatDepartureDate,
  formatDepartureRange,
  formatFullDate,
} from '@/features/tour-detail/departures';
import { tripPillTone } from '@/features/trips/trips-list';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { getAuthClient } from '@/lib/auth-client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import { formatMoney } from '@/lib/format-money';

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

  const { data: session } = getAuthClient().useSession();
  const signedIn = Boolean(session?.user);
  const { booking: bookingCopy } = messages.mobile;
  const { detail: t } = bookingCopy;
  const queryClient = useQueryClient();

  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
  const [cancelPendingSheetOpen, setCancelPendingSheetOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

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
  const kind = bookingDetailKind(booking);
  const actions = bookingDetailActions(booking);
  const amount = formatMoney(booking.totalAmount, booking.currency);
  const refundAmount = booking.cancellation
    ? formatMoney(booking.cancellation.refundAmount, booking.currency)
    : null;

  function refetch() {
    void queryClient.invalidateQueries({
      queryKey: orpc.bookings.byCode.queryOptions({ input: { code: code ?? '' } }).queryKey,
    });
  }

  function payNow() {
    setActionError(null);
    checkoutMutation.mutate(
      { code: code ?? '' },
      {
        onSuccess: (result) => {
          if (result.checkoutUrl) void WebBrowser.openBrowserAsync(result.checkoutUrl);
        },
        onError: (error) => setActionError(cancelErrorCopy(error)),
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
  const pillLabel = messages.mobile.trips.status[booking.status] ?? booking.status;
  const pillTone: BookingDetailPill = tripPillTone(booking.status);

  let note: Parameters<typeof BookingDetailScreen>[0]['note'] = null;
  let rows: BookingDetailRow[] = [{ label: bookingCopy.bookingCodeLabel, value: booking.code }];
  let primaryAction: Parameters<typeof BookingDetailScreen>[0]['primaryAction'] = null;
  let secondaryAction: Parameters<typeof BookingDetailScreen>[0]['secondaryAction'] = null;
  let contactLine: Parameters<typeof BookingDetailScreen>[0]['contactLine'];

  if (kind === 'pending') {
    note = {
      tone: 'warning',
      icon: 'alert-circle',
      title: t.paymentNotFinishedTitle,
      body: t.paymentNotFinishedBody,
    };
    rows = [
      { label: bookingCopy.bookingCodeLabel, value: booking.code },
      {
        label: t.travellersLabel,
        value: messages.mobile.trips.travellersCount(booking.numAdults + booking.numChildren),
      },
      { label: t.totalDueLabel, value: amount, emphasis: true },
    ];
    primaryAction = {
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
  } else if (kind === 'paid') {
    if (booking.cancellation) {
      note = {
        tone: 'success',
        icon: 'shield',
        title: messages.cancellationDeadline.short(
          formatDepartureDate(booking.cancellation.deadline),
        ),
        body: t.cancelByThenNote(refundAmount ?? amount),
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
    note = refunded
      ? {
          tone: 'success',
          icon: 'refresh-cw',
          title: t.refundedNote(
            formatMoney(booking.refundedTotal, booking.currency),
            formatFullDate(booking.cancelledAt ?? booking.createdAt),
          ),
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
                  onPress: () =>
                    router.push({
                      pathname: '/enquiry',
                      params: {
                        tourSlug: booking.tourSlug,
                        tripTitle: booking.tourTitle,
                        tripSubtitle: trip.dateRangeLabel,
                        ...(trip.imageUrl ? { tripImageUrl: trip.imageUrl } : {}),
                      },
                    }),
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
