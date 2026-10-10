import { useQuery } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import { router } from 'expo-router';
import { useState } from 'react';
import { AuthGateScreen } from '@/features/auth/auth-gate-screen';
import { setPendingReturn } from '@/features/auth/return-to';
import { formatDepartureRange } from '@/features/tour-detail/departures';
import { filterTripsByWindow, type TripWindow, tripPillTone } from '@/features/trips/trips-list';
import { type TripListItemVM, TripsScreen, type TripsStatus } from '@/features/trips/trips-screen';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { getAuthClient } from '@/lib/auth-client';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import { formatMoney } from '@/lib/format-money';
import { useServerToday } from '@/lib/use-server-clock';

/**
 * Route Trips (T1-T3, mục 3 spec P5b-3). Chưa đăng nhập → `AuthGateScreen`
 * (T3), cùng khuôn Saved/Account — KHÔNG gọi `bookings.mine` (query tắt qua
 * `enabled`). Chip Upcoming/Past lọc Ở MÁY (API chưa có tham số đó).
 *
 * Chạm thẻ (luật vào màn, handoff mục 3): `PAID` → cụm P bám ngày khởi hành
 * (`/trips/[code]`, W7/W8); còn lại (PENDING/CANCELLED/REFUNDED) → thẳng
 * hoá đơn `/bookings/[code]` như cũ — T5/T8 đã tự xử đủ trong đó.
 */
export default function TripsRoute() {
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

  const allItems: TripListItemVM[] = (listQuery.data?.items ?? []).map((booking) => ({
    code: booking.code,
    status: booking.status,
    pillTone: tripPillTone(booking.status),
    pillLabel:
      booking.status === 'PAID' &&
      booking.departureStartDate <= today &&
      booking.departureEndDate >= today
        ? messages.mobile.trip.onTourNow
        : undefined,
    imageUrl: booking.tourImage?.url ?? null,
    title: booking.tourTitle,
    dateRangeLabel: formatDepartureRange(booking.departureStartDate, booking.departureEndDate),
    departureStartDate: booking.departureStartDate,
    departureEndDate: booking.departureEndDate,
    travellersLabel: trips.travellersCount(booking.numAdults + booking.numChildren),
    amountLabel: formatMoney(booking.totalAmount, booking.currency),
  }));

  const items = filterTripsByWindow(allItems, window, today);

  return (
    <TripsScreen
      status={status}
      title={trips.title}
      hasAnyTrips={allItems.length > 0}
      window={window}
      onChangeWindow={setWindow}
      chipAllLabel={trips.chipAll}
      chipUpcomingLabel={trips.chipUpcoming}
      chipPastLabel={trips.chipPast}
      items={items}
      statusLabel={(bookingStatus) => trips.status[bookingStatus] ?? bookingStatus}
      onTripPress={(code) => {
        const item = items.find((i) => i.code === code);
        router.push(item?.status === 'PAID' ? `/trips/${code}` : `/bookings/${code}`);
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
