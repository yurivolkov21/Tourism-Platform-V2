import type { BookingDetail, TourDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  type TripTrackerHandlers,
  tripDayView,
  tripEndedView,
  tripImminentView,
  tripUpcomingView,
} from './trip-tracker-view';

const t = messages.mobile.trip;
const trips = messages.mobile.trips;

/** Đơn PAID của chuyến ba ngày 17–19/10, đặt và trả ngày 1/10. */
function makeBooking(overrides: Partial<BookingDetail> = {}): BookingDetail {
  return {
    code: 'BK-TEST0001',
    status: 'PAID',
    tourTitle: 'Test tour',
    tourSlug: 'test-tour',
    tourImage: null,
    tourDestinations: [{ name: 'Ha Long' }, { name: 'Ninh Binh' }],
    departureStartDate: '2026-10-17',
    departureEndDate: '2026-10-19',
    departureCancelled: false,
    totalAmount: '35.00',
    currency: 'USD',
    numAdults: 2,
    numChildren: 0,
    paymentProvider: 'STRIPE',
    paidAt: '2026-10-01T03:00:00.000Z',
    createdAt: '2026-10-01T03:00:00.000Z',
    reviewedAt: null,
    cancellation: null,
    ...overrides,
  } as Partial<BookingDetail> as BookingDetail;
}

function makeTour(overrides: Partial<TourDetail> = {}): TourDetail {
  return {
    durationDays: 3,
    destinations: [{ name: 'Ha Long' }, { name: 'Ninh Binh' }],
    meetingPoint: 'Hanoi Opera House',
    included: ['Hotel', 'Breakfast', 'Boat', 'Guide', 'Insurance'],
    excluded: ['Flights', 'Visa', 'Tips'],
    policies: [{ kind: 'GENERAL', title: 'Good to know', body: 'Passport\n\nSunscreen' }],
    itinerary: [
      { dayNumber: 1, title: 'Arrive', description: null },
      {
        dayNumber: 2,
        title: 'Bay cruise',
        description: '08:00 — Breakfast\n09:00 — Boat\n12:00 — Lunch\nFree evening',
      },
      { dayNumber: 3, title: 'Fly home', description: null },
    ],
    ...overrides,
  } as Partial<TourDetail> as TourDetail;
}

function makeHandlers(): jest.Mocked<TripTrackerHandlers> {
  return {
    openBooking: jest.fn(),
    openEnquiry: jest.fn(),
    openNotes: jest.fn(),
    openItinerary: jest.fn(),
    writeReview: jest.fn(),
    browse: jest.fn(),
  };
}

describe('tripEndedView — P6 chuyến đã về', () => {
  it('tóm tắt, ba số đếm số nhiều, mời viết đánh giá, hai dòng điều hướng', () => {
    const on = makeHandlers();
    const view = tripEndedView(makeBooking(), makeTour(), on);

    expect(view.summary).toBe(t.finishedSummary('Test tour', '19 Oct 2026'));
    expect(view.stats).toEqual([
      { value: 3, label: t.daysUnit },
      { value: 2, label: t.placesUnit },
      { value: 2, label: t.travellersUnit },
    ]);
    expect(view.reviewed).toBe(false);
    view.onWriteReviewPress();
    expect(on.writeReview).toHaveBeenCalledTimes(1);
    expect(view.bookingDetailsRow).toMatchObject({
      label: t.bookingDetailsRow,
      caption: `BK-TEST0001 · ${t.paidAmount('$35')}`,
    });
    view.bookingDetailsRow.onPress();
    expect(on.openBooking).toHaveBeenCalledTimes(1);
    expect(view.whereToNextRow.caption).toBe(t.nearPlaces(['Ha Long', 'Ninh Binh']));
    view.whereToNextRow.onPress();
    expect(on.browse).toHaveBeenCalledTimes(1);
  });

  it('một ngày, một nơi, một khách: nhãn số ít; đã viết bài thì không mời nữa', () => {
    const view = tripEndedView(
      makeBooking({
        tourDestinations: [{ name: 'Hue' }] as BookingDetail['tourDestinations'],
        numAdults: 1,
        reviewedAt: '2026-10-20T03:00:00.000Z',
      }),
      makeTour({ durationDays: 1 }),
      makeHandlers(),
    );
    expect(view.stats.map((s) => s.label)).toEqual([
      t.dayUnitOne,
      t.placeUnitOne,
      t.travellerUnitOne,
    ]);
    expect(view.reviewed).toBe(true);
  });
});

describe('tripDayView — P5 đang đi', () => {
  // 09:30 giờ Việt Nam ngày 18/10, tức ngày 2 của chuyến.
  const clock = { today: '2026-10-18', now: new Date('2026-10-18T02:30:00Z') };

  it('ngày hiện tại, tiến độ, mốc có giờ tô theo giờ Việt Nam, dòng không giờ in nguyên', () => {
    const view = tripDayView(makeBooking(), makeTour(), clock, makeHandlers());

    expect(view.dayOfTotalLabel).toBe(t.dayOfTotal(2, 3));
    expect(view.dateLabel).toBe('Sun 18 Oct');
    expect(view.dayTitle).toBe('Bay cruise');
    expect(view.progressPercent).toBe(67);
    expect(view.endsOnLabel).toBe(t.endsOn('Mon 19 Oct'));
    expect(view.lines).toEqual([
      { time: '08:00', text: 'Breakfast', state: 'done' },
      { time: '09:00', text: 'Boat', state: 'active' },
      { time: '12:00', text: 'Lunch', state: 'upcoming' },
      { text: 'Free evening' },
    ]);
  });

  it('còn ngày mai: dòng ngày mai mở lịch trình; các dòng còn lại gọi đúng việc', () => {
    const on = makeHandlers();
    const view = tripDayView(makeBooking(), makeTour(), clock, on);

    expect(view.nextDayRow).toMatchObject({ label: t.tomorrowDay(3), caption: 'Fly home' });
    view.nextDayRow?.onPress();
    expect(on.openItinerary).toHaveBeenCalledTimes(1);
    view.tripNotesRow.onPress();
    expect(on.openNotes).toHaveBeenCalledTimes(1);
    expect(view.bookingDetailsRow.caption).toBe(`BK-TEST0001 · ${trips.travellersCount(2)}`);
    view.bookingDetailsRow.onPress();
    expect(on.openBooking).toHaveBeenCalledTimes(1);
    expect(view.contactLabel).toBe(messages.mobile.booking.detail.contactLinkLabel);
    view.onContactPress();
    expect(on.openEnquiry).toHaveBeenCalledTimes(1);
  });

  it('ngày cuối: không có dòng ngày mai; ngày thiếu trong lịch trình thì tiêu đề rỗng, không dòng nào', () => {
    const view = tripDayView(
      makeBooking(),
      makeTour(),
      { today: '2026-10-19', now: new Date('2026-10-19T02:30:00Z') },
      makeHandlers(),
    );
    expect(view.nextDayRow).toBeUndefined();
    expect(view.progressPercent).toBe(100);

    const gap = tripDayView(makeBooking(), makeTour({ itinerary: [] }), clock, makeHandlers());
    expect(gap.dayTitle).toBe('');
    expect(gap.lines).toEqual([]);
  });
});

describe('tripUpcomingView — P1 còn hơn ba ngày', () => {
  const today = '2026-10-10';

  it('đếm ngược, dòng phụ, thanh dưới mở hoá đơn, ba lối Get ready', () => {
    const on = makeHandlers();
    const view = tripUpcomingView(makeBooking(), makeTour(), today, on);

    expect(view.countdownLabel).toBe(t.departingIn);
    expect(view.countdownValue).toBe(t.daysCount(7));
    expect(view.subtitle).toBe(`Sat 17 – Mon 19 Oct · ${trips.travellersCount(2)}`);
    expect(view.progressPercent).toBe(56);
    expect(view.bottomBarLabel).toBe(t.bookingDetailsRow);
    view.onBottomBarPress();
    expect(on.openBooking).toHaveBeenCalledTimes(1);
    expect(view.imminent).toBeUndefined();
    expect(view.upcoming).toMatchObject({
      bookedLabel: t.bookedOn('1 Oct 2026'),
      departureFooterLabel: t.departureOn('17 Oct 2026'),
      getReadyLabel: t.getReady,
    });
    expect(view.upcoming?.whatToBringRow.caption).toBe('Passport');
    view.upcoming?.whatToBringRow.onPress();
    expect(view.upcoming?.itineraryRow.caption).toBe('Ha Long → Ninh Binh');
    view.upcoming?.itineraryRow.onPress();
    expect(on.openItinerary).toHaveBeenCalledTimes(1);
    expect(view.upcoming?.includedRow.caption).toBe('Hotel, Breakfast, Boat, Guide');
    view.upcoming?.includedRow.onPress();
    expect(on.openNotes).toHaveBeenCalledTimes(2);
  });

  it('mốc: đặt, trả (ngày trả, số tiền, cổng), hạn huỷ còn hiệu lực, khởi hành ở chỗ gặp', () => {
    const view = tripUpcomingView(
      makeBooking({
        cancellation: {
          deadline: '2026-10-16',
          withinDeadline: true,
          refundAmount: '35.00',
          canCancel: true,
        },
      }),
      makeTour(),
      today,
      makeHandlers(),
    );
    expect(view.upcoming?.milestones).toEqual([
      {
        state: 'done',
        icon: 'check',
        title: t.milestoneBookingConfirmed,
        caption: '1 Oct 2026 · BK-TEST0001',
      },
      {
        state: 'done',
        icon: 'check',
        title: t.milestonePaidInFull,
        caption: `1 Oct 2026 · $35 · ${messages.mobile.booking.providerStripe}`,
      },
      {
        state: 'now',
        icon: 'shield',
        title: messages.cancellationDeadline.short('Fri 16 Oct'),
        caption: messages.mobile.booking.detail.cancelByThenNote('$35'),
      },
      {
        state: 'upcoming',
        icon: 'flag',
        title: `${t.milestoneDeparture} · Sat 17 Oct`,
        caption: 'Hanoi Opera House',
      },
    ]);
  });

  it('quá hạn huỷ miễn phí: mốc hạn huỷ là mốc sắp tới không chú thích; PayPal, chưa có ngày trả, không chỗ gặp', () => {
    const view = tripUpcomingView(
      makeBooking({
        paymentProvider: 'PAYPAL',
        paidAt: null,
        cancellation: {
          deadline: '2026-10-16',
          withinDeadline: false,
          refundAmount: '0.00',
          canCancel: false,
        },
      }),
      makeTour({ meetingPoint: null }),
      today,
      makeHandlers(),
    );
    const milestones = view.upcoming?.milestones ?? [];
    expect(milestones[1]?.caption).toBe(
      `1 Oct 2026 · $35 · ${messages.mobile.booking.providerPayPal}`,
    );
    expect(milestones[2]).toEqual({
      state: 'upcoming',
      icon: 'shield',
      title: t.freeCancellationEnded,
      caption: '',
    });
    expect(milestones[3]?.caption).toBe('');
  });

  it('server không gửi khối huỷ: chỉ ba mốc', () => {
    const view = tripUpcomingView(makeBooking(), makeTour(), today, makeHandlers());
    expect(view.upcoming?.milestones.map((m) => m.title)).toEqual([
      t.milestoneBookingConfirmed,
      t.milestonePaidInFull,
      `${t.milestoneDeparture} · Sat 17 Oct`,
    ]);
  });
});

describe('tripImminentView — P2 trong ba ngày', () => {
  it('còn một ngày: "Tomorrow" viết chữ, chỗ gặp, checklist theo dấu đã tích, thanh dưới mở ghi chú', () => {
    const on = makeHandlers();
    const onToggle = jest.fn();
    const view = tripImminentView(
      makeBooking(),
      makeTour(),
      '2026-10-16',
      { checked: ['Sunscreen'], onToggle },
      on,
    );

    expect(view.countdownLabel).toBe(t.departing);
    expect(view.countdownValue).toBe(t.tomorrow);
    expect(view.upcoming).toBeUndefined();
    expect(view.imminent).toMatchObject({
      meetingNote: { title: 'Hanoi Opera House', body: t.meetingNoteBody('BK-TEST0001') },
      packingChecklistLabel: t.packingChecklist,
      ticksNoteLabel: t.ticksLocalOnly,
    });
    expect(view.imminent?.items).toEqual([
      { text: 'Passport', checked: false },
      { text: 'Sunscreen', checked: true },
      { text: 'Flights', checked: false },
      { text: 'Visa', checked: false },
    ]);
    view.imminent?.onToggle('Passport');
    expect(onToggle).toHaveBeenCalledWith('Passport');
    expect(view.bottomBarLabel).toBe(t.fullTripNotes);
    view.onBottomBarPress();
    expect(on.openNotes).toHaveBeenCalledTimes(1);
  });

  it('còn ba ngày: in số; không có chỗ gặp thì không khối chỗ gặp', () => {
    const view = tripImminentView(
      makeBooking(),
      makeTour({ meetingPoint: null }),
      '2026-10-14',
      { checked: [], onToggle: jest.fn() },
      makeHandlers(),
    );
    expect(view.countdownValue).toBe(t.daysCount(3));
    expect(view.imminent?.meetingNote).toBeNull();
  });
});
