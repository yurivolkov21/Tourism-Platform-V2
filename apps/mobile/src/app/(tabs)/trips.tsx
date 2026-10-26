import { useQuery } from '@tanstack/react-query';
import { bookingPhase } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AuthGateScreen } from '@/features/auth/auth-gate-screen';
import { setPendingReturn } from '@/features/auth/return-to';
import { formatDepartureRange } from '@/features/tour-detail/departures';
import { currentTripDay, daysBetween } from '@/features/trip-tracker/trip-tracker';
import type { NextTripVM } from '@/features/trips/next-trip-card';
import {
  filterTripsByWindow,
  isTravellingPhase,
  pickNextTrip,
  type TripWindow,
  tripCardPill,
} from '@/features/trips/trips-list';
import { type TripListItemVM, TripsScreen, type TripsStatus } from '@/features/trips/trips-screen';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { getAuthClient } from '@/lib/auth-client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import { formatMoney } from '@/lib/format-money';
import { withReplayOnFocus } from '@/lib/replay-on-focus';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';
import { useServerToday } from '@/lib/use-server-clock';

/**
 * Route Trips (T1-T3, mục 3 spec P5b-3). Chưa đăng nhập → `AuthGateScreen`
 * (T3), cùng khuôn Saved/Account — KHÔNG gọi `bookings.mine` (query tắt qua
 * `enabled`). Chip Upcoming/Past lọc Ở MÁY (API chưa có tham số đó).
 *
 * Chạm thẻ (luật vào màn, handoff mục 3): đơn còn đi theo ngày (`isTravellingPhase` —
 * PAID, PARTIALLY_REFUNDED, REFUNDED hoàn thiện chí) → cụm P bám ngày khởi hành
 * (`/trips/[code]`, W7/W8); còn lại (chờ trả, đã huỷ, chuyến bị công ty huỷ) → thẳng
 * hoá đơn `/bookings/[code]` — T5/T8 đã tự xử đủ trong đó.
 */
function TripsRoute() {
  const [window, setWindow] = useState<TripWindow>('all');
  const { data: session } = getAuthClient().useSession();
  const signedIn = Boolean(session?.user);
  const { trips } = messages.mobile;
  const today = useServerToday();

  const listQuery = useQuery(
    orpc.bookings.mine.queryOptions({
      input: { page: 1, limit: 50 },
      context: withMobileAuth(),
      enabled: signedIn,
    }),
  );
  const refresh = usePullToRefresh([listQuery.refetch]);
  // Tab giữ màn mount sẵn: quay lại tab (vd sau khi trả tiền xong) thì hỏi lại danh sách đơn,
  // không bắt khách thoát app hay đăng nhập lại mới thấy trạng thái mới.
  const { refetch: refetchList } = listQuery;
  useFocusEffect(
    useCallback(() => {
      if (signedIn) void refetchList();
    }, [signedIn, refetchList]),
  );

  if (!signedIn) {
    return (
      <AuthGateScreen
        pageTitle={trips.title}
        icon="briefcase"
        title={messages.mobile.authPrompts.tripsGateTitle}
        body={messages.mobile.authPrompts.tripsGateBody}
        signInLabel={messages.mobile.authPrompts.signIn}
        createAccountLabel={messages.mobile.authPrompts.createAccount}
        onSignIn={() => {
          setPendingReturn({ path: '/(tabs)/trips' });
          router.navigate('/login');
        }}
        onCreateAccount={() => {
          setPendingReturn({ path: '/(tabs)/trips' });
          router.navigate('/register');
        }}
      />
    );
  }

  const status: TripsStatus = listQuery.isPending
    ? 'loading'
    : listQuery.isError
      ? 'error'
      : 'content';

  const allItems: TripListItemVM[] = (listQuery.data?.items ?? []).map((booking) => {
    const phase = bookingPhase(booking, today);
    // Đang đi → "On tour now" xanh; chuyến công ty huỷ → "Cancelled" xám dù đơn còn PAID; chờ trả
    // quá hạn chót → chữ trung tính xám của web (G54).
    const pill = tripCardPill(booking, phase, {
      status: trips.status,
      lapsed: messages.accountBookings.lapsedBadge,
      onTourNow: messages.mobile.trip.onTourNow,
    });
    return {
      code: booking.code,
      status: booking.status,
      phase,
      pillTone: pill.tone,
      pillLabel: pill.label,
      imageUrl: booking.tourImage?.url ?? null,
      title: booking.tourTitle,
      dateRangeLabel: formatDepartureRange(booking.departureStartDate, booking.departureEndDate),
      travellersLabel: trips.travellersCount(booking.numAdults + booking.numChildren),
      amountLabel: formatMoney(booking.totalAmount, booking.currency),
    };
  });

  // B5 — thẻ lớn: đơn upcoming/on_tour có ngày đi sớm nhất; danh sách bên dưới bỏ đơn đó.
  const bookings = listQuery.data?.items ?? [];
  const nextBooking = pickNextTrip(
    bookings.map((booking) => ({
      booking,
      phase: bookingPhase(booking, today),
      startDate: booking.departureStartDate,
    })),
  );
  const nextTrip: NextTripVM | null =
    nextBooking === null
      ? null
      : {
          code: nextBooking.booking.code,
          imageUrl: nextBooking.booking.tourImage?.url ?? null,
          title: nextBooking.booking.tourTitle,
          kicker:
            nextBooking.phase === 'on_tour'
              ? messages.mobile.trip.onTourNow
              : messages.mobile.trip.departingIn,
          headline:
            nextBooking.phase === 'on_tour'
              ? messages.mobile.trip.dayOfTotal(
                  currentTripDay(
                    today,
                    nextBooking.startDate,
                    daysBetween(nextBooking.startDate, nextBooking.booking.departureEndDate) + 1,
                  ),
                  daysBetween(nextBooking.startDate, nextBooking.booking.departureEndDate) + 1,
                )
              : messages.mobile.trip.daysCount(
                  Math.max(0, daysBetween(today, nextBooking.startDate)),
                ),
          subLabel: `${formatDepartureRange(
            nextBooking.booking.departureStartDate,
            nextBooking.booking.departureEndDate,
          )} · ${trips.travellersCount(
            nextBooking.booking.numAdults + nextBooking.booking.numChildren,
          )}`,
          ctaLabel: trips.viewTrip,
        };

  const items = filterTripsByWindow(allItems, window).filter(
    (item) => item.code !== nextTrip?.code,
  );

  return (
    <TripsScreen
      refresh={refresh}
      status={status}
      title={trips.title}
      hasAnyTrips={allItems.length > 0}
      window={window}
      onChangeWindow={setWindow}
      chipAllLabel={trips.chipAll}
      chipUpcomingLabel={trips.chipUpcoming}
      chipPastLabel={trips.chipPast}
      items={items}
      nextTrip={nextTrip}
      nextTripLabel={trips.nextTrip}
      statusLabel={(bookingStatus) => trips.status[bookingStatus] ?? bookingStatus}
      onTripPress={(code) => {
        const item = allItems.find((i) => i.code === code);
        router.push(
          item !== undefined && isTravellingPhase(item.phase)
            ? `/trips/${code}`
            : `/bookings/${code}`,
        );
      }}
      finishPaymentLabel={trips.finishPayment}
      errorTitle={messages.mobile.booking.listError}
      retryLabel={messages.mobile.booking.retry}
      onRetry={() => void listQuery.refetch()}
      emptyTitle={trips.emptyTitle}
      browseLabel={trips.browse}
      onBrowse={() => router.navigate('/explore')}
      transformUrl={cloudinaryUrl}
    />
  );
}

export default withReplayOnFocus(TripsRoute);
