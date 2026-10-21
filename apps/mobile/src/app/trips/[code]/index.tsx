import { ORPCError } from '@orpc/client';
import { useQuery } from '@tanstack/react-query';
import { bookingPhase } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button, EmptyState, SCREEN_EDGES_UNDER_HEADER, Screen } from '@tourism/mobile-ui';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { AuthGateScreen } from '@/features/auth/auth-gate-screen';
import { setPendingReturn } from '@/features/auth/return-to';
import { bookingEnquiryParams } from '@/features/booking/booking-detail-view';
import { packingListStore, toggleChecked } from '@/features/trip-tracker/packing-list';
import { TripDayScreen } from '@/features/trip-tracker/trip-day-screen';
import { TripEndedScreen } from '@/features/trip-tracker/trip-ended-screen';
import { tripLoadState, tripPhase } from '@/features/trip-tracker/trip-tracker';
import {
  type TripTrackerHandlers,
  tripDayView,
  tripEndedView,
  tripImminentView,
  tripUpcomingView,
} from '@/features/trip-tracker/trip-tracker-view';
import { TripUpcomingScreen } from '@/features/trip-tracker/trip-upcoming-screen';
import { isTravellingPhase } from '@/features/trips/trips-list';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { getAuthClient } from '@/lib/auth-client';
import { useServerClock } from '@/lib/use-server-clock';

/**
 * "Your trip" (P1/P2/P6) + "Day {n} of {total}" (P5) — cụm bám ngày khởi
 * hành (W7/W8, mockup `mobile-booking-screens` mục 4). Chạm thẻ của đơn còn đi theo
 * ngày ở tab Trips (`isTravellingPhase`) route tới đây; đơn chờ trả, đã huỷ hay chuyến
 * bị công ty huỷ vẫn đi thẳng `/bookings/[code]` (luật vào màn, handoff mục 3).
 *
 * Nội dung từng mặt dựng ở `trip-tracker-view.ts` (review M3-14); route giữ state, tải dữ liệu
 * và nối mỗi dòng với việc của nó.
 */
export default function TripTrackerRoute() {
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;

  const { data: session } = getAuthClient().useSession();
  const signedIn = Boolean(session?.user);
  const { trips, booking: bookingCopy } = messages.mobile;
  const { now, today } = useServerClock();

  const [packingChecked, setPackingChecked] = useState<string[]>([]);

  const detailQuery = useQuery(
    orpc.bookings.byCode.queryOptions({
      input: { code: code ?? '' },
      context: withMobileAuth(),
      enabled: signedIn && code !== undefined,
    }),
  );
  const booking = detailQuery.data;

  const tourQuery = useQuery(
    orpc.catalog.tours.bySlug.queryOptions({
      input: { slug: booking?.tourSlug ?? '' },
      enabled: booking !== undefined,
      // Tour đã gỡ khỏi web thì hỏi lại cũng vẫn 404 — đừng bắt khách chờ ba lượt retry.
      retry: (failureCount, error) => !isTourGone(error) && failureCount < 3,
    }),
  );
  const tour = tourQuery.data;
  // Admin gỡ tour (bỏ publish) không bị chặn kể cả khi còn đơn sống, mà `bySlug` chỉ trả
  // tour đang publish — tracker không dựng được nữa thì đưa về hoá đơn, nơi khách vẫn xem
  // được đơn và huỷ được, thay vì kẹt ở nút Retry không bao giờ thành công.
  const tourGone = tourQuery.isError && isTourGone(tourQuery.error);

  useEffect(() => {
    if (code === undefined) return;
    void packingListStore.getChecked(code).then(setPackingChecked);
  }, [code]);

  // Chỉ đơn còn đi theo ngày mới có màn ở đây (luật vào màn, handoff mục 3; cùng
  // `isTravellingPhase` của tab Trips) — vào thẳng bằng URL cũ hoặc trạng thái đổi giữa
  // chừng (vd vừa bị huỷ, chuyến bị công ty huỷ) thì đưa về đúng hoá đơn thay vì vẽ một
  // P1 vô nghĩa.
  const travelling = booking === undefined || isTravellingPhase(bookingPhase(booking, today));
  useEffect(() => {
    if (booking !== undefined && (!travelling || tourGone)) {
      router.replace(`/bookings/${booking.code}`);
    }
  }, [booking, travelling, tourGone]);

  if (code === undefined) return null;

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
          setPendingReturn({ path: `/trips/${code}` });
          router.navigate('/login');
        }}
        onCreateAccount={() => {
          setPendingReturn({ path: `/trips/${code}` });
          router.navigate('/register');
        }}
      />
    );
  }

  const loadState = tripLoadState({
    detailPending: detailQuery.isPending,
    detailError: detailQuery.isError,
    tourPending: tourQuery.isPending,
    tourError: tourQuery.isError,
  });

  if (loadState === 'loading' || tourGone) {
    return <PlaceholderScreen edges={SCREEN_EDGES_UNDER_HEADER} detail={code} />;
  }

  if (loadState === 'error' || booking === undefined || tour === undefined) {
    return (
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
              onPress={() => {
                void detailQuery.refetch();
                // Query tour tắt khi chưa có booking — refetch lúc đó gọi slug rỗng.
                if (booking !== undefined) void tourQuery.refetch();
              }}
              shape="pill"
            />
          </EmptyState>
        </View>
      </Screen>
    );
  }

  if (!travelling) return null;

  const phase = tripPhase(today, booking.departureStartDate, booking.departureEndDate);

  // P3/P4 đọc `catalog.tours.bySlug` công khai — mang sẵn `tourSlug` (và
  // `departureStartDate` cho P4, cần nó để tính ngày lịch từng ngày) qua
  // query param thay vì bắt hai route đó gọi lại `bookings.byCode`.
  const on: TripTrackerHandlers = {
    openBooking: () => router.push(`/bookings/${booking.code}`),
    openEnquiry: () => router.push({ pathname: '/enquiry', params: bookingEnquiryParams(booking) }),
    openNotes: () =>
      router.push({
        pathname: '/trips/[code]/notes',
        params: { code: booking.code, tourSlug: booking.tourSlug },
      }),
    openItinerary: () =>
      router.push({
        pathname: '/trips/[code]/itinerary',
        params: {
          code: booking.code,
          tourSlug: booking.tourSlug,
          departureStartDate: booking.departureStartDate,
        },
      }),
    // Viết đánh giá (R1) ở `/trips/[code]/review`.
    writeReview: () => router.push(`/trips/${booking.code}/review`),
    // `dismissTo`, không `navigate` (cùng khuôn B8): `navigate` đẩy thêm một bộ tab mới chồng
    // lên — từ Explore back về Home rồi back nữa lại ra P6 vừa rời (review M1).
    browse: () => router.dismissTo('/explore'),
  };

  if (phase === 'ended') return <TripEndedScreen {...tripEndedView(booking, tour, on)} />;

  if (phase === 'onTour') {
    const day = tripDayView(booking, tour, { today, now }, on);
    return (
      <>
        <Stack.Screen options={{ title: day.dayOfTotalLabel }} />
        <TripDayScreen {...day} />
      </>
    );
  }

  if (phase === 'imminent') {
    const packing = {
      checked: packingChecked,
      onToggle: (text: string) => {
        const next = toggleChecked(packingChecked, text);
        setPackingChecked(next);
        void packingListStore.setChecked(booking.code, next);
      },
    };
    return <TripUpcomingScreen {...tripImminentView(booking, tour, today, packing, on)} />;
  }

  // upcoming — cùng màn "Your trip" với P2, đổi giọng theo khoảng cách.
  return <TripUpcomingScreen {...tripUpcomingView(booking, tour, today, on)} />;
}

function isTourGone(error: unknown): boolean {
  return error instanceof ORPCError && error.code === 'NOT_FOUND';
}
