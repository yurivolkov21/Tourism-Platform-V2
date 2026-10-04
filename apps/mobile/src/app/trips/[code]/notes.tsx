import { useQuery } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import { EmptyState, SCREEN_EDGES_UNDER_HEADER, Screen } from '@tourism/mobile-ui';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { TripNotesScreen } from '@/features/trip-tracker/trip-notes-screen';
import { whatToBringLines } from '@/features/trip-tracker/trip-tracker';
import { orpc } from '@/lib/api/client';

/**
 * P3 — "Before you go", bản đầy đủ. Nhận `tourSlug` qua query param (route
 * trước truyền sẵn — xem `trips/[code]/index.tsx`) để đọc `catalog.tours.bySlug`
 * (công khai, không cần `code` để gọi `bookings.byCode` lần hai).
 */
export default function TripNotesRoute() {
  const { tourSlug } = useLocalSearchParams<{ tourSlug: string }>();
  const { trip: t } = messages.mobile;

  const tourQuery = useQuery(
    orpc.catalog.tours.bySlug.queryOptions({
      input: { slug: tourSlug ?? '' },
      enabled: tourSlug !== undefined,
    }),
  );

  if (tourSlug === undefined) return null;

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
  const generalPolicy = tour.policies.find((p) => p.kind === 'GENERAL');

  return (
    <TripNotesScreen
      whatToBringLabel={t.whatToBring}
      whatToBringLines={whatToBringLines(generalPolicy?.body)}
      includedInYourFareLabel={t.includedInYourFare}
      included={tour.included}
      showAllLabel={t.showAll}
      notIncludedLabel={t.notIncludedTitle}
      excluded={tour.excluded}
      goodToKnowLabel={t.goodToKnow}
      goodToKnowCaption={t.goodToKnowCaption(tour.faqs.length)}
      faqs={tour.faqs}
    />
  );
}
