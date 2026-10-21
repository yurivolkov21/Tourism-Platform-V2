import type { BookingDetail, TourDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  formatDepartureDate,
  formatDepartureRange,
  formatFullDate,
} from '@/features/tour-detail/departures';
import { parseItineraryDescription } from '@/features/tour-detail/itinerary';
import { formatMoney } from '@/lib/format-money';
import type { TripDayLineVM, TripDayScreenProps } from './trip-day-screen';
import type { TripEndedScreenProps } from './trip-ended-screen';
import {
  bookingProgressPercent,
  currentTripDay,
  daysBetween,
  itineraryCalendarDate,
  packingChecklistItems,
  timedStopStates,
  vietnamTimeOfDay,
  whatToBringLines,
} from './trip-tracker';
import type { TripMilestone, TripUpcomingScreenProps } from './trip-upcoming-screen';

/**
 * Nội dung bốn mặt của cụm P (P1/P2 "Your trip", P5 "Day n of N", P6 đã về) dựng từ đơn và tour —
 * review M3-14 tách khỏi route `app/trips/[code]/index.tsx` để test từng mặt bằng unit test. Hàm
 * thuần: "hôm nay" và giờ server nhận qua tham số, việc của từng dòng do route truyền vào qua
 * `handlers`. Kiểu lấy từ props của màn, nên màn đổi props (hay tên icon) thì tsc chỉ ra chỗ phải
 * sửa ở đây.
 */

/** Việc route làm khi khách chạm một dòng hay nút của tracker. */
export interface TripTrackerHandlers {
  openBooking: () => void;
  openEnquiry: () => void;
  /** P3 — đồ mang theo, những gì đã gồm. */
  openNotes: () => void;
  /** P4 — lịch trình từng ngày. */
  openItinerary: () => void;
  writeReview: () => void;
  browse: () => void;
}

const t = messages.mobile.trip;
const trips = messages.mobile.trips;

function travellerCount(booking: BookingDetail): number {
  return booking.numAdults + booking.numChildren;
}

function paidMoney(booking: BookingDetail): string {
  return formatMoney(booking.totalAmount, booking.currency);
}

/** P6: chuyến đã về. */
export function tripEndedView(
  booking: BookingDetail,
  tour: TourDetail,
  on: TripTrackerHandlers,
): TripEndedScreenProps {
  const places = booking.tourDestinations.length;
  const travellers = travellerCount(booking);
  return {
    welcomeBackLabel: t.welcomeBack,
    summary: t.finishedSummary(booking.tourTitle, formatFullDate(booking.departureEndDate)),
    stats: [
      { value: tour.durationDays, label: tour.durationDays === 1 ? t.dayUnitOne : t.daysUnit },
      { value: places, label: places === 1 ? t.placeUnitOne : t.placesUnit },
      { value: travellers, label: travellers === 1 ? t.travellerUnitOne : t.travellersUnit },
    ],
    reviewed: booking.reviewedAt !== null,
    howWasItTitle: t.howWasIt,
    howWasItBody: t.reviewHelpsNote,
    writeReviewLabel: t.writeReview,
    // Viết đánh giá (R1) ở `/trips/[code]/review`.
    onWriteReviewPress: on.writeReview,
    reviewedLabel: t.reviewed,
    bookingDetailsRow: {
      label: t.bookingDetailsRow,
      caption: `${booking.code} · ${t.paidAmount(paidMoney(booking))}`,
      onPress: on.openBooking,
    },
    whereToNextRow: {
      label: t.whereToNext,
      caption: t.nearPlaces(booking.tourDestinations.map((d) => d.name)),
      onPress: on.browse,
    },
  };
}

/** P5: đang đi — ngày hiện tại, các mốc trong ngày tô theo giờ Việt Nam của server. */
export function tripDayView(
  booking: BookingDetail,
  tour: TourDetail,
  clock: { today: string; now: Date },
  on: TripTrackerHandlers,
): TripDayScreenProps {
  const dayNumber = currentTripDay(clock.today, booking.departureStartDate, tour.durationDays);
  const day = tour.itinerary.find((d) => d.dayNumber === dayNumber);
  const lines: TripDayLineVM[] = parseItineraryDescription(day?.description ?? null).map((line) =>
    line.kind === 'timed' ? { time: line.time, text: line.text } : { text: line.text },
  );
  const times = lines.filter((l): l is TripDayLineVM & { time: string } => l.time !== undefined);
  const states = timedStopStates(
    times.map((l) => l.time),
    vietnamTimeOfDay(clock.now),
  );
  let timedIndex = 0;
  const linesWithState = lines.map((line) =>
    line.time === undefined ? line : { ...line, state: states[timedIndex++] },
  );
  const hasNextDay = dayNumber < tour.durationDays;

  return {
    onTourNowLabel: t.onTourNow,
    dateLabel: formatDepartureDate(itineraryCalendarDate(booking.departureStartDate, dayNumber)),
    dayTitle: day?.title ?? '',
    progressPercent: Math.round((dayNumber / tour.durationDays) * 100),
    dayOfTotalLabel: t.dayOfTotal(dayNumber, tour.durationDays),
    endsOnLabel: t.endsOn(formatDepartureDate(booking.departureEndDate)),
    todayLabel: t.today,
    lines: linesWithState,
    ...(hasNextDay
      ? {
          nextDayRow: {
            label: t.tomorrowDay(dayNumber + 1),
            caption: tour.itinerary.find((d) => d.dayNumber === dayNumber + 1)?.title ?? '',
            onPress: on.openItinerary,
          },
        }
      : {}),
    tripNotesRow: { label: t.tripNotesRow, caption: t.tripNotesCaption, onPress: on.openNotes },
    bookingDetailsRow: {
      label: t.bookingDetailsRow,
      caption: `${booking.code} · ${trips.travellersCount(travellerCount(booking))}`,
      onPress: on.openBooking,
    },
    contactLabel: messages.mobile.booking.detail.contactLinkLabel,
    onContactPress: on.openEnquiry,
  };
}

/** Đầu màn chung của P1 và P2: khoảng ngày, số khách, tiến độ từ ngày đặt tới ngày đi. */
function countdownHeader(booking: BookingDetail, today: string) {
  return {
    subtitle: `${formatDepartureRange(booking.departureStartDate, booking.departureEndDate)} · ${trips.travellersCount(travellerCount(booking))}`,
    progressPercent: bookingProgressPercent(
      today,
      booking.createdAt.slice(0, 10),
      booking.departureStartDate,
    ),
  };
}

/** Rail mốc của P1: đặt, trả, hạn huỷ (khi server gửi khối huỷ), khởi hành. */
function milestones(booking: BookingDetail, tour: TourDetail): TripMilestone[] {
  const { cancellation } = booking;
  const provider =
    booking.paymentProvider === 'STRIPE'
      ? messages.mobile.booking.providerStripe
      : messages.mobile.booking.providerPayPal;
  return [
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
      caption: `${formatFullDate(booking.paidAt ?? booking.createdAt)} · ${paidMoney(booking)} · ${provider}`,
    },
    ...(cancellation === null
      ? []
      : [
          cancellation.withinDeadline
            ? {
                state: 'now' as const,
                icon: 'shield' as const,
                title: messages.cancellationDeadline.short(
                  formatDepartureDate(cancellation.deadline),
                ),
                caption: messages.mobile.booking.detail.cancelByThenNote(
                  formatMoney(cancellation.refundAmount, booking.currency),
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
}

/** P1: còn hơn ba ngày — rail mốc và ba lối "Get ready". */
export function tripUpcomingView(
  booking: BookingDetail,
  tour: TourDetail,
  today: string,
  on: TripTrackerHandlers,
): TripUpcomingScreenProps {
  const generalPolicy = tour.policies.find((p) => p.kind === 'GENERAL');
  return {
    countdownLabel: t.departingIn,
    countdownValue: t.daysCount(daysBetween(today, booking.departureStartDate)),
    ...countdownHeader(booking, today),
    bottomBarLabel: t.bookingDetailsRow,
    onBottomBarPress: on.openBooking,
    upcoming: {
      bookedLabel: t.bookedOn(formatFullDate(booking.createdAt)),
      departureFooterLabel: t.departureOn(formatFullDate(booking.departureStartDate)),
      milestones: milestones(booking, tour),
      getReadyLabel: t.getReady,
      whatToBringRow: {
        label: t.whatToBring,
        caption: whatToBringLines(generalPolicy?.body)[0] ?? '',
        onPress: on.openNotes,
      },
      itineraryRow: {
        label: t.yourItinerary,
        caption: tour.destinations.map((d) => d.name).join(' → '),
        onPress: on.openItinerary,
      },
      includedRow: {
        label: t.whatsIncluded,
        caption: tour.included.slice(0, 4).join(', '),
        onPress: on.openNotes,
      },
    },
  };
}

/** P2: trong ba ngày — chỗ gặp và checklist đồ (dấu tích chỉ lưu trên máy, route giữ). */
export function tripImminentView(
  booking: BookingDetail,
  tour: TourDetail,
  today: string,
  packing: { checked: readonly string[]; onToggle: (text: string) => void },
  on: TripTrackerHandlers,
): TripUpcomingScreenProps {
  const generalPolicy = tour.policies.find((p) => p.kind === 'GENERAL');
  const daysUntilStart = daysBetween(today, booking.departureStartDate);
  return {
    countdownLabel: t.departing,
    // Spec: "Tomorrow"/"Today" viết chữ, từ 2 ngày trở lên mới in số — `imminent` luôn
    // `daysUntilStart` trong [1,3] (onTour mới chạm 0).
    countdownValue: daysUntilStart === 1 ? t.tomorrow : t.daysCount(daysUntilStart),
    ...countdownHeader(booking, today),
    bottomBarLabel: t.fullTripNotes,
    onBottomBarPress: on.openNotes,
    imminent: {
      meetingNote:
        tour.meetingPoint === null
          ? null
          : { title: tour.meetingPoint, body: t.meetingNoteBody(booking.code) },
      packingChecklistLabel: t.packingChecklist,
      items: packingChecklistItems(generalPolicy?.body, tour.excluded).map((text) => ({
        text,
        checked: packing.checked.includes(text),
      })),
      onToggle: packing.onToggle,
      ticksNoteLabel: t.ticksLocalOnly,
    },
  };
}
