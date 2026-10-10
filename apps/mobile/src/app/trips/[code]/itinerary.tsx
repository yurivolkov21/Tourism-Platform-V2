import { useQuery } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import { EmptyState, SCREEN_EDGES_UNDER_HEADER, Screen } from '@tourism/mobile-ui';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { formatDepartureDate } from '@/features/tour-detail/departures';
import { parseItineraryDescription } from '@/features/tour-detail/itinerary';
import { TripItineraryScreen } from '@/features/trip-tracker/trip-itinerary-screen';
import { currentTripDay, itineraryCalendarDate } from '@/features/trip-tracker/trip-tracker';
import { orpc } from '@/lib/api/client';
import { useServerToday } from '@/lib/use-server-clock';

/**
 * P4 — "Your itinerary" của CHUYẾN ĐÃ MUA (ngày lịch thật, khác tab
 * Itinerary trần của trang tour). Nhận `tourSlug` + `departureStartDate` qua
 * query param (từ `trips/[code]/index.tsx`) — không cần gọi lại
 * `bookings.byCode`, `catalog.tours.bySlug` công khai đủ cho cả màn.
 */
export default function TripItineraryRoute() {
  const { tourSlug, departureStartDate } = useLocalSearchParams<{
    tourSlug: string;
    departureStartDate: string;
  }>();
  const today = useServerToday();

  const tourQuery = useQuery(
    orpc.catalog.tours.bySlug.queryOptions({
      input: { slug: tourSlug ?? '' },
      enabled: tourSlug !== undefined,
    }),
  );

  if (tourSlug === undefined || departureStartDate === undefined) return null;

  if (tourQuery.isPending) {
    return <PlaceholderScreen edges={SCREEN_EDGES_UNDER_HEADER} detail={tourSlug} />;
  }

  if (tourQuery.isError) {
    return (
      <Screen edges={SCREEN_EDGES_UNDER_HEADER} padded={false}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
          <EmptyState
            icon={null}
            title={messages.mobile.booking.departuresError}
            titleVariant="subtitle"
            titleTone="muted"
            surface={false}
          />
        </View>
      </Screen>
    );
  }

  const tour = tourQuery.data;
  // Chuyến chưa khởi hành thì "sắp tới" là ngày 1; đang đi thì là ngày hiện
  // tại — cùng luật `currentTripDay` dùng ở P5, tự kẹp trong [1, durationDays]
  // nên gọi vô điều kiện vẫn an toàn dù `today < departureStartDate`.
  const initialExpandedDay = currentTripDay(today, departureStartDate, tour.durationDays);

  return (
    <TripItineraryScreen
      summaryLabel={`${messages.mobile.trip.daysCount(tour.durationDays)} · ${tour.destinations
        .map((d) => d.name)
        .join(' → ')}`}
      days={tour.itinerary.map((day) => ({
        dayNumber: day.dayNumber,
        title: day.title,
        dateLabel: formatDepartureDate(itineraryCalendarDate(departureStartDate, day.dayNumber)),
        lines: parseItineraryDescription(day.description),
      }))}
      initialExpandedDay={initialExpandedDay}
    />
  );
}
