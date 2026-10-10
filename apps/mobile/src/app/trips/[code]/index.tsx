import { useQuery } from '@tanstack/react-query';
import { messages } from '@tourism/i18n';
import { Button, EmptyState, SCREEN_EDGES_UNDER_HEADER, Screen } from '@tourism/mobile-ui';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { AuthGateScreen } from '@/features/auth/auth-gate-screen';
import { setPendingReturn } from '@/features/auth/return-to';
import {
  formatDepartureDate,
  formatDepartureRange,
  formatFullDate,
} from '@/features/tour-detail/departures';
import { parseItineraryDescription } from '@/features/tour-detail/itinerary';
import { packingListStore, toggleChecked } from '@/features/trip-tracker/packing-list';
import { type TripDayLineVM, TripDayScreen } from '@/features/trip-tracker/trip-day-screen';
import { TripEndedScreen } from '@/features/trip-tracker/trip-ended-screen';
import {
  bookingProgressPercent,
  currentTripDay,
  daysBetween,
  itineraryCalendarDate,
  packingChecklistItems,
  timedStopStates,
  tripPhase,
  vietnamTimeOfDay,
  whatToBringLines,
} from '@/features/trip-tracker/trip-tracker';
import type { TripMilestone } from '@/features/trip-tracker/trip-upcoming-screen';
import { TripUpcomingScreen } from '@/features/trip-tracker/trip-upcoming-screen';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { getAuthClient } from '@/lib/auth-client';
import { formatMoney } from '@/lib/format-money';
import { useServerClock } from '@/lib/use-server-clock';

/**
 * "Your trip" (P1/P2/P6) + "Day {n} of {total}" (P5) — cụm bám ngày khởi
 * hành (W7/W8, mockup `mobile-booking-screens` mục 4). Chạm thẻ PAID ở tab
 * Trips route tới đây; PENDING/CANCELLED/REFUNDED vẫn đi thẳng
 * `/bookings/[code]` (luật vào màn, handoff mục 3).
 */
export default function TripTrackerRoute() {
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;

  const { data: session } = getAuthClient().useSession();
  const signedIn = Boolean(session?.user);
  const { trip: t, trips, booking: bookingCopy } = messages.mobile;
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
    }),
  );
  const tour = tourQuery.data;

  useEffect(() => {
    if (code === undefined) return;
    void packingListStore.getChecked(code).then(setPackingChecked);
  }, [code]);

  // Chỉ booking PAID mới có màn ở đây (luật vào màn, handoff mục 3) — vào
  // thẳng bằng URL cũ hoặc trạng thái đổi giữa chừng (vd vừa bị huỷ) thì đưa
  // về đúng hoá đơn thay vì vẽ một P1 vô nghĩa.
  useEffect(() => {
    if (booking !== undefined && booking.status !== 'PAID') {
      router.replace(`/bookings/${booking.code}`);
    }
  }, [booking]);

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

  if (detailQuery.isPending || tourQuery.isPending) {
    return <PlaceholderScreen edges={SCREEN_EDGES_UNDER_HEADER} detail={code} />;
  }

  if (detailQuery.isError || tourQuery.isError || booking === undefined || tour === undefined) {
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
                void tourQuery.refetch();
              }}
              shape="pill"
            />
          </EmptyState>
        </View>
      </Screen>
    );
  }

  if (booking.status !== 'PAID') return null;

  const phase = tripPhase(today, booking.departureStartDate, booking.departureEndDate);
  const generalPolicy = tour.policies.find((p) => p.kind === 'GENERAL');
  const travellersLabel = trips.travellersCount(booking.numAdults + booking.numChildren);

  // Ba hàm điều hướng khai dạng ARROW CONST (không phải `function` — khai báo
  // hàm bị hoist lên đầu scope, nên TS kiểm thân hàm với kiểu CHƯA được hẹp
  // của `booking`/`tour` ở các guard phía trên, báo sai "possibly undefined").
  // Arrow const không hoist, giữ đúng kiểu đã hẹp tại điểm khai.
  const openEnquiry = () => {
    router.push({
      pathname: '/enquiry',
      params: {
        tourSlug: booking.tourSlug,
        tripTitle: booking.tourTitle,
        tripSubtitle: formatDepartureRange(booking.departureStartDate, booking.departureEndDate),
        ...(booking.tourImage ? { tripImageUrl: booking.tourImage.url } : {}),
      },
    });
  };

  // P3/P4 đọc `catalog.tours.bySlug` công khai — mang sẵn `tourSlug` (và
  // `departureStartDate` cho P4, cần nó để tính ngày lịch từng ngày) qua
  // query param thay vì bắt hai route đó gọi lại `bookings.byCode`.
  const openNotes = () => {
    router.push({
      pathname: '/trips/[code]/notes',
      params: { code: booking.code, tourSlug: booking.tourSlug },
    });
  };
  const openItinerary = () => {
    router.push({
      pathname: '/trips/[code]/itinerary',
      params: {
        code: booking.code,
        tourSlug: booking.tourSlug,
        departureStartDate: booking.departureStartDate,
      },
    });
  };

  if (phase === 'ended') {
    return (
      <TripEndedScreen
        welcomeBackLabel={t.welcomeBack}
        summary={t.finishedSummary(booking.tourTitle, formatFullDate(booking.departureEndDate))}
        stats={[
          {
            value: tour.durationDays,
            label: tour.durationDays === 1 ? t.dayUnitOne : t.daysUnit,
          },
          {
            value: booking.tourDestinations.length,
            label: booking.tourDestinations.length === 1 ? t.placeUnitOne : t.placesUnit,
          },
          {
            value: booking.numAdults + booking.numChildren,
            label:
              booking.numAdults + booking.numChildren === 1 ? t.travellerUnitOne : t.travellersUnit,
          },
        ]}
        reviewed={booking.reviewedAt !== null}
        howWasItTitle={t.howWasIt}
        howWasItBody={t.reviewHelpsNote}
        writeReviewLabel={t.writeReview}
        // Viết đánh giá (R1) ở `/trips/[code]/review`.
        onWriteReviewPress={() => router.push(`/trips/${booking.code}/review`)}
        reviewedLabel={t.reviewed}
        bookingDetailsRow={{
          label: t.bookingDetailsRow,
          caption: `${booking.code} · ${formatMoney(booking.totalAmount, booking.currency)} paid`,
          onPress: () => router.push(`/bookings/${booking.code}`),
        }}
        whereToNextRow={{
          label: t.whereToNext,
          caption: t.nearPlaces(booking.tourDestinations.map((d) => d.name).join(' and ')),
          onPress: () => router.navigate('/explore'),
        }}
      />
    );
  }

  if (phase === 'onTour') {
    const dayNumber = currentTripDay(today, booking.departureStartDate, tour.durationDays);
    const day = tour.itinerary.find((d) => d.dayNumber === dayNumber);
    const lines: TripDayLineVM[] = parseItineraryDescription(day?.description ?? null).map(
      (line) =>
        line.kind === 'timed' ? { time: line.time, text: line.text } : { text: line.text },
    );
    const times = lines.filter((l): l is TripDayLineVM & { time: string } => l.time !== undefined);
    const states = timedStopStates(
      times.map((l) => l.time),
      vietnamTimeOfDay(now),
    );
    let timedIndex = 0;
    const linesWithState = lines.map((line) =>
      line.time === undefined ? line : { ...line, state: states[timedIndex++] },
    );
    const hasNextDay = dayNumber < tour.durationDays;

    return (
      <>
        <Stack.Screen options={{ title: t.dayOfTotal(dayNumber, tour.durationDays) }} />
        <TripDayScreen
          onTourNowLabel={t.onTourNow}
          dateLabel={formatDepartureDate(
            itineraryCalendarDate(booking.departureStartDate, dayNumber),
          )}
          dayTitle={day?.title ?? ''}
          progressPercent={Math.round((dayNumber / tour.durationDays) * 100)}
          dayOfTotalLabel={t.dayOfTotal(dayNumber, tour.durationDays)}
          endsOnLabel={t.endsOn(formatDepartureDate(booking.departureEndDate))}
          todayLabel={t.today}
          lines={linesWithState}
          nextDayRow={
            hasNextDay
              ? {
                  label: t.tomorrowDay(dayNumber + 1),
                  caption: tour.itinerary.find((d) => d.dayNumber === dayNumber + 1)?.title ?? '',
                  onPress: openItinerary,
                }
              : undefined
          }
          tripNotesRow={{
            label: t.tripNotesRow,
            caption: t.tripNotesCaption,
            onPress: openNotes,
          }}
          bookingDetailsRow={{
            label: t.bookingDetailsRow,
            caption: `${booking.code} · ${travellersLabel}`,
            onPress: () => router.push(`/bookings/${booking.code}`),
          }}
          contactLabel={messages.mobile.booking.detail.contactLinkLabel}
          onContactPress={openEnquiry}
        />
      </>
    );
  }

  // upcoming | imminent — cùng màn "Your trip", đổi giọng theo khoảng cách.
  const milestones: TripMilestone[] = [
    {
      state: 'done',
      icon: 'check',
      title: t.milestoneBookingConfirmed,
      caption: `${formatFullDate(booking.createdAt)} · ${booking.code}`,
    },
    {
      state: 'done',
      icon: 'check',
      title: t.milestonePaidInFull,
      caption: `${formatFullDate(booking.paidAt ?? booking.createdAt)} · ${formatMoney(booking.totalAmount, booking.currency)} · ${booking.paymentProvider === 'STRIPE' ? messages.mobile.booking.providerStripe : messages.mobile.booking.providerPayPal}`,
    },
    ...(booking.cancellation === null
      ? []
      : [
          booking.cancellation.withinDeadline
            ? {
                state: 'now' as const,
                icon: 'shield' as const,
                title: messages.cancellationDeadline.short(
                  formatDepartureDate(booking.cancellation.deadline),
                ),
                caption: bookingCopy.detail.cancelByThenNote(
                  formatMoney(booking.cancellation.refundAmount, booking.currency),
                ),
              }
            : {
                state: 'upcoming' as const,
                icon: 'shield' as const,
                title: t.freeCancellationEnded,
                caption: '',
              },
        ]),
    {
      state: 'upcoming',
      icon: 'flag',
      title: `${t.milestoneDeparture} · ${formatDepartureDate(booking.departureStartDate)}`,
      caption: tour.meetingPoint ?? '',
    },
  ];

  if (phase === 'imminent') {
    const items = packingChecklistItems(generalPolicy?.body, tour.excluded);
    const daysUntilStart = daysBetween(today, booking.departureStartDate);
    return (
      <TripUpcomingScreen
        countdownLabel={t.departing}
        // Spec: "Tomorrow"/"Today" viết chữ, từ 2 ngày trở lên mới in số —
        // `imminent` luôn `daysUntilStart` trong [1,3] (onTour mới chạm 0).
        countdownValue={daysUntilStart === 1 ? t.tomorrow : t.daysCount(daysUntilStart)}
        subtitle={`${formatDepartureRange(booking.departureStartDate, booking.departureEndDate)} · ${travellersLabel}`}
        progressPercent={bookingProgressPercent(
          today,
          booking.createdAt.slice(0, 10),
          booking.departureStartDate,
        )}
        bottomBarLabel={t.fullTripNotes}
        onBottomBarPress={openNotes}
        imminent={{
          meetingNote:
            tour.meetingPoint === null
              ? null
              : { title: tour.meetingPoint, body: t.meetingNoteBody(booking.code) },
          packingChecklistLabel: t.packingChecklist,
          items: items.map((text) => ({ text, checked: packingChecked.includes(text) })),
          onToggle: (text) => {
            const next = toggleChecked(packingChecked, text);
            setPackingChecked(next);
            void packingListStore.setChecked(booking.code, next);
          },
          ticksNoteLabel: t.ticksLocalOnly,
        }}
      />
    );
  }

  return (
    <TripUpcomingScreen
      countdownLabel={t.departingIn}
      countdownValue={t.daysCount(daysBetween(today, booking.departureStartDate))}
      subtitle={`${formatDepartureRange(booking.departureStartDate, booking.departureEndDate)} · ${travellersLabel}`}
      progressPercent={bookingProgressPercent(
        today,
        booking.createdAt.slice(0, 10),
        booking.departureStartDate,
      )}
      bottomBarLabel={t.bookingDetailsRow}
      onBottomBarPress={() => router.push(`/bookings/${booking.code}`)}
      upcoming={{
        bookedLabel: t.bookedOn(formatFullDate(booking.createdAt)),
        departureFooterLabel: t.departureOn(formatFullDate(booking.departureStartDate)),
        milestones,
        getReadyLabel: t.getReady,
        whatToBringRow: {
          label: t.whatToBring,
          caption: whatToBringLines(generalPolicy?.body)[0] ?? '',
          onPress: openNotes,
        },
        itineraryRow: {
          label: t.yourItinerary,
          caption: tour.destinations.map((d) => d.name).join(' → '),
          onPress: openItinerary,
        },
        includedRow: {
          label: t.whatsIncluded,
          caption: tour.included.slice(0, 4).join(', '),
          onPress: openNotes,
        },
      }}
    />
  );
}
