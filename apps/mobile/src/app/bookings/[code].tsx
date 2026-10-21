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
import { useState } from 'react';
import { View } from 'react-native';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { AuthGateScreen } from '@/features/auth/auth-gate-screen';
import { setPendingReturn } from '@/features/auth/return-to';
import {
  cancelErrorAction,
  cancelErrorCopy,
  cancelPendingErrorAction,
  payErrorAction,
} from '@/features/booking/booking-detail';
import { BookingDetailScreen } from '@/features/booking/booking-detail-screen';
import {
  bookingDetailView,
  bookingEnquiryParams,
  cancelSheetView,
  type PayError,
} from '@/features/booking/booking-detail-view';
import { CancelBookingSheet } from '@/features/booking/cancel-sheet';
import { openCheckout } from '@/features/booking/open-checkout';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { getAuthClient } from '@/lib/auth-client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import { useServerClock } from '@/lib/use-server-clock';

/**
 * Chi tiết booking (T4/T5/T8, W4) + huỷ (T6/T7, W5) — mockup
 * `mobile-booking-screens.src.html`, spec `docs/handoff/mobile-booking-handoff.md`.
 *
 * Reachable qua deep link (`nexora://bookings/<mã>`, namespace không độc
 * quyền — xem comment cũ của file này) nên PHẢI gác đăng nhập Ở ĐÂY, không
 * nhờ cậy việc chỉ tới từ tab Trips đã gác.
 *
 * Nội dung từng khung (khối nổi bật, các hàng, hai nút, tấm huỷ) dựng ở `booking-detail-view.ts`
 * (review M3-14); route giữ state, gọi mutation và nối mỗi nút với việc của nó.
 *
 * "Browse tours" của các khung đã đóng mở Explore bằng `dismissTo` (cùng khuôn
 * B8): màn này nằm ở stack gốc, `navigate('/explore')` đẩy thêm một bộ tab mới
 * chồng lên — từ Explore back về Home rồi back nữa lại ra hoá đơn vừa rời
 * (review M1). `dismissTo` lùi về bộ tab đang có rồi mở Explore.
 */
export default function BookingDetailRoute() {
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  // `useLocalSearchParams` trả `string | string[] | undefined` ở runtime —
  // kẹp về một chuỗi trước khi đưa vào bất kỳ lời gọi API nào.
  const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;
  const theme = useTheme();
  // Đồng hồ server — giai đoạn của đơn (`bookingPhase`, ngày VN) cùng luật với tab Trips; lời mời
  // viết đánh giá đọc `now` vì cổng review của API so ngày UTC.
  const { now, today } = useServerClock();

  const { data: session } = getAuthClient().useSession();
  const signedIn = Boolean(session?.user);
  const { booking: bookingCopy } = messages.mobile;
  const queryClient = useQueryClient();

  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
  const [cancelPendingSheetOpen, setCancelPendingSheetOpen] = useState(false);
  const [reason, setReason] = useState('');
  // Câu lỗi của lượt huỷ vừa hỏng — chung cho hai tấm (mỗi trạng thái đơn chỉ mở được một), xoá
  // khi tấm đóng để lần mở sau không còn câu cũ.
  const [actionError, setActionError] = useState<string | null>(null);
  // Lỗi bấm Pay hiện NGAY trên màn (T5) — tách khỏi `actionError` chỉ nằm trong tấm huỷ đang ẩn.
  const [payError, setPayError] = useState<PayError | null>(null);

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
        onError: (error) => {
          if (cancelPendingErrorAction(error) === 'refetch') {
            setCancelPendingSheetOpen(false);
            refetch();
          } else {
            setActionError(cancelErrorCopy(error));
          }
        },
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

  // Form hỏi gắn sẵn chuyến này — đích chung của mọi "Contact us" trên hoá đơn, như tracker.
  const openEnquiry = () => {
    router.push({ pathname: '/enquiry', params: bookingEnquiryParams(booking) });
  };

  const view = bookingDetailView(
    booking,
    { today, now, payError, paying: checkoutMutation.isPending },
    {
      pay: payNow,
      openCancelPending: () => setCancelPendingSheetOpen(true),
      openCancel: () => setCancelSheetOpen(true),
      writeReview: () => router.push(`/trips/${booking.code}/review`),
      browse: () => router.dismissTo('/explore'),
      contact: openEnquiry,
    },
  );

  return (
    <>
      {titleScreen}
      <BookingDetailScreen {...view} transformUrl={cloudinaryUrl} />
      <CancelBookingSheet
        visible={cancelPendingSheetOpen}
        onClose={() => {
          setCancelPendingSheetOpen(false);
          setActionError(null);
        }}
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
          {...cancelSheetView(booking.cancellation, booking.currency, {
            changeReason: setReason,
            contact: () => {
              // Đóng tấm trước khi đẩy màn mới — trên iOS Modal còn mở sẽ đè lên form.
              setCancelSheetOpen(false);
              openEnquiry();
            },
          })}
          visible={cancelSheetOpen}
          onClose={() => {
            setCancelSheetOpen(false);
            setActionError(null);
          }}
          reason={reason}
          pending={cancelMutation.isPending}
          error={actionError}
          onConfirm={confirmCancel}
        />
      )}
    </>
  );
}
