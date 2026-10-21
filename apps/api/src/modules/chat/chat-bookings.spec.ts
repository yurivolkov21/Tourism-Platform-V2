import type { Booking, BookingDetail, BookingsListResult } from '@tourism/contract';
import {
  bookingStatusText,
  MY_BOOKINGS_LIMIT,
  normalizeBookingCode,
  paymentText,
  toBookingSummary,
  toMyBookingDetails,
  toMyBookingsQuery,
  toMyBookingsResult,
} from './chat-bookings.js';

// 10:00 sáng 15/10 giờ Việt Nam = 03:00 UTC cùng ngày.
const now = new Date('2026-10-15T03:00:00Z');
const today = '2026-10-15';

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    code: 'BK-AB12CD34',
    status: 'PAID',
    tourTitle: 'Ha Long Bay 2D1N',
    tourSlug: 'ha-long-2d1n',
    tourImage: null,
    tourDestinations: [{ slug: 'ha-long', name: 'Ha Long Bay', isPrimary: true }],
    departureStartDate: '2026-11-02',
    departureEndDate: '2026-11-03',
    cancellationDeadline: '2026-10-31',
    departureCancelled: false,
    unitPrice: '189.00',
    totalAmount: '378.00',
    currency: 'USD',
    numAdults: 2,
    numChildren: 1,
    contactName: 'An Nguyen',
    contactEmail: 'an@example.com',
    contactPhone: '+84 90 000 0000',
    specialRequests: 'Vegetarian meals, please',
    paymentProvider: 'STRIPE',
    checkoutUrl: 'https://checkout.stripe.com/c/pay/secret',
    paidAt: '2026-10-01T17:30:00.000Z',
    cancelledAt: null,
    createdAt: '2026-10-01T17:00:00.000Z',
    cancellationStatus: null,
    cancellationRequestedAt: null,
    cancellationDecidedAt: null,
    refundedTotal: '0.00',
    reviewedAt: null,
    ...overrides,
  };
}

function detail(overrides: Partial<BookingDetail> = {}): BookingDetail {
  return {
    ...booking(),
    review: null,
    cancellation: {
      deadline: '2026-10-31',
      withinDeadline: true,
      refundAmount: '378.00',
      canCancel: true,
    },
    departureCancelReason: null,
    ...overrides,
  };
}

const NEXORA_CANCELLED = 'Cancelled by Nexora; anything paid is refunded in full';

const review = (moderationState: string) =>
  ({ moderationState }) as unknown as NonNullable<BookingDetail['review']>;

describe('toMyBookingsQuery', () => {
  it('tối đa 10 đơn, thứ tự hành trình như trang My bookings', () => {
    expect(toMyBookingsQuery(undefined)).toMatchObject({
      page: 1,
      limit: MY_BOOKINGS_LIMIT,
      order: 'journey',
    });
    expect(MY_BOOKINGS_LIMIT).toBe(10);
  });

  it('upcoming gồm cả chuyến đang đi; past là nhóm đã qua; all không lọc', () => {
    expect(toMyBookingsQuery('upcoming').when).toEqual(['ON_TOUR', 'UPCOMING']);
    expect(toMyBookingsQuery('past').when).toEqual(['PAST']);
    expect(toMyBookingsQuery('all').when).toBeUndefined();
  });
});

describe('bookingStatusText', () => {
  it.each([
    [{ status: 'PENDING' }, 'Awaiting payment'],
    [{ status: 'PAID' }, 'Confirmed, trip upcoming'],
    [{ status: 'PAID', departureStartDate: today }, 'Confirmed, trip in progress'],
    [
      { status: 'PAID', departureStartDate: '2026-10-01', departureEndDate: '2026-10-02' },
      'Trip completed',
    ],
    [{ status: 'CANCELLED' }, 'Cancelled'],
    [{ status: 'REFUNDED', cancelledAt: '2026-10-05T00:00:00.000Z' }, 'Cancelled'],
    // Hoàn thiện chí trọn mà không huỷ: khách vẫn đi (ADR-0054 AMEND 1).
    [{ status: 'REFUNDED' }, 'Confirmed, trip upcoming'],
    [
      { status: 'PAID', departureCancelled: true },
      'Cancelled by Nexora; anything paid is refunded in full',
    ],
    [
      {
        status: 'PENDING',
        departureStartDate: '2026-10-16',
        departureEndDate: '2026-10-17',
        cancellationDeadline: '2026-10-14',
      },
      'Not confirmed: the payment deadline has passed',
    ],
  ] as const)('%j → %s', (overrides, text) => {
    expect(bookingStatusText(booking(overrides), today, null)).toBe(text);
  });

  // L4-20 (review 20/10): đơn khách tự huỷ TRƯỚC khi công ty huỷ chuyến vẫn mang cờ chuyến huỷ.
  // Công ty huỷ thì hoàn trọn, nên đơn đã thu mà không hoàn đồng nào là khách huỷ quá hạn: câu
  // chuyện của khách, như `cancelledByOperator` của web. Bản cũ hứa "refunded in full" cả cho ca ấy.
  it.each([
    ['đơn còn PAID chờ job hoàn', { status: 'PAID' }, '0.00', NEXORA_CANCELLED],
    ['công ty huỷ, sổ đã hoàn trọn', { status: 'CANCELLED' }, '378.00', NEXORA_CANCELLED],
    ['khách huỷ quá hạn rồi chuyến mới bị huỷ', { status: 'CANCELLED' }, '0.00', 'Cancelled'],
    [
      'đơn chưa trả bị huỷ cùng chuyến',
      { status: 'CANCELLED', paidAt: null },
      '0.00',
      NEXORA_CANCELLED,
    ],
    // Danh sách không biết sổ hoàn: chỉ nói điều chắc chắn.
    [
      'danh sách, đơn đã thu',
      { status: 'CANCELLED' },
      null,
      'Cancelled; Nexora cancelled this departure',
    ],
    ['danh sách, đơn chưa trả', { status: 'CANCELLED', paidAt: null }, null, NEXORA_CANCELLED],
  ] as const)('chuyến bị huỷ — %s', (_case, overrides, refunded, text) => {
    expect(
      bookingStatusText(booking({ departureCancelled: true, ...overrides }), today, refunded),
    ).toBe(text);
  });
});

describe('paymentText', () => {
  it.each([
    ['PENDING', 'Not paid'],
    ['PAID', 'Paid'],
    ['PARTIALLY_REFUNDED', 'Paid, partly refunded'],
    ['REFUNDED', 'Refunded in full'],
  ] as const)('%s → %s', (status, text) => {
    expect(paymentText(booking({ status }), null)).toBe(text);
  });

  // L4-20 (review 20/10): CANCELLED kể chuyện ghế, không kể chuyện tiền — đơn đã trả rồi huỷ
  // (khách tự huỷ, công ty huỷ chuyến) vẫn CANCELLED. Bản cũ ghi mọi đơn huỷ là "Not paid".
  it.each([
    ['chưa trả bao giờ', { paidAt: null }, '0.00', 'Not paid'],
    ['đã trả, hoàn trọn', {}, '378.00', 'Paid, refunded in full'],
    ['đã trả, hoàn một phần', {}, '100.00', 'Paid, partly refunded'],
    ['đã trả, huỷ quá hạn nên không hoàn', {}, '0.00', 'Paid, not refunded'],
    [
      'bị thu rồi hoàn tự động trước khi sang PAID',
      { paidAt: null },
      '378.00',
      'Paid, refunded in full',
    ],
    [
      'danh sách, đã trả: không biết sổ hoàn',
      {},
      null,
      'Paid; refund details are on the booking page',
    ],
    ['danh sách, chưa trả', { paidAt: null }, null, 'Not paid'],
  ] as const)('đơn đã huỷ — %s', (_case, overrides, refunded, text) => {
    expect(paymentText(booking({ status: 'CANCELLED', ...overrides }), refunded)).toBe(text);
  });
});

describe('toBookingSummary', () => {
  it('chỉ giữ trường được phép, kèm link trang đơn và link tour', () => {
    expect(toBookingSummary(booking(), today, null)).toEqual({
      code: 'BK-AB12CD34',
      url: '/account/bookings/BK-AB12CD34',
      tour: 'Ha Long Bay 2D1N',
      tourUrl: '/tours/ha-long-2d1n',
      startDate: '2026-11-02',
      endDate: '2026-11-03',
      adults: 2,
      children: 1,
      status: 'Confirmed, trip upcoming',
      payment: 'Paid',
      total: '378.00',
      currency: 'USD',
    });
  });

  it('đơn chờ trả có hạn trả tiền là hạn chót của chuyến', () => {
    expect(toBookingSummary(booking({ status: 'PENDING' }), today, null)).toMatchObject({
      status: 'Awaiting payment',
      payBy: '2026-10-31',
    });
  });

  it('không để lọt email, điện thoại, tên liên hệ, ghi chú, link thanh toán, id', () => {
    const json = JSON.stringify(toBookingSummary(booking(), today, null));
    for (const secret of [
      'an@example.com',
      '+84 90',
      'An Nguyen',
      'Vegetarian',
      'checkout.stripe.com',
      '00000000-0000-4000-8000-000000000001',
    ]) {
      expect(json).not.toContain(secret);
    }
  });
});

describe('toMyBookingsResult', () => {
  it('kèm ngày hôm nay của server, tổng khớp bộ lọc và số đơn đang hiện', () => {
    const result: BookingsListResult = {
      items: [booking(), booking({ code: 'BK-ZZ99ZZ99', status: 'PENDING' })],
      page: 1,
      limit: 10,
      total: 14,
      totalPages: 2,
      facets: {
        when: { ON_TOUR: 0, UPCOMING: 2, PAST: 12 },
        status: { PENDING: 1, PAID: 13, CANCELLED: 0, REFUNDED: 0, PARTIALLY_REFUNDED: 0 },
      },
      overallTotal: 14,
      today,
    };
    const out = toMyBookingsResult(result);
    expect(out).toMatchObject({
      today,
      total: 14,
      shown: 2,
      allBookingsUrl: '/account/bookings',
    });
    expect(out.bookings.map((b) => b.code)).toEqual(['BK-AB12CD34', 'BK-ZZ99ZZ99']);
  });

  it('đơn đã trả rồi huỷ: `mine` không đọc sổ hoàn nên không đoán số hoàn', () => {
    const cancelled = booking({ status: 'CANCELLED', cancelledAt: '2026-10-05T00:00:00.000Z' });
    const result: BookingsListResult = {
      items: [cancelled],
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
      facets: {
        when: { ON_TOUR: 0, UPCOMING: 0, PAST: 1 },
        status: { PENDING: 0, PAID: 0, CANCELLED: 1, REFUNDED: 0, PARTIALLY_REFUNDED: 0 },
      },
      overallTotal: 1,
      today,
    };
    expect(toMyBookingsResult(result).bookings[0]).toMatchObject({
      status: 'Cancelled',
      payment: 'Paid; refund details are on the booking page',
    });
  });
});

describe('toMyBookingDetails', () => {
  it('đơn đã trả: thêm cổng, ngày trả theo giờ Việt Nam, hạn huỷ và số hoàn nếu huỷ ngay', () => {
    expect(toMyBookingDetails(detail(), now)).toMatchObject({
      found: true,
      code: 'BK-AB12CD34',
      status: 'Confirmed, trip upcoming',
      paymentMethod: 'Card',
      // 17:30 UTC ngày 01/10 là 00:30 ngày 02/10 ở Việt Nam.
      paidOn: '2026-10-02',
      refunded: '0.00',
      cancellation: {
        freeCancellationUntil: '2026-10-31',
        refundIfCancelledNow: '378.00',
        canCancelOnline: true,
      },
      cancellationRequest: null,
      review: 'Can be written after the trip ends',
    });
  });

  it('không để lọt trường riêng tư, kể cả lý do bác review', () => {
    const json = JSON.stringify(
      toMyBookingDetails(
        detail({
          review: {
            ...review('rejected'),
            moderationNote: 'Contains a phone number',
            body: 'Lovely trip',
          } as NonNullable<BookingDetail['review']>,
        }),
        now,
      ),
    );
    for (const secret of [
      'an@example.com',
      '+84 90',
      'An Nguyen',
      'Vegetarian',
      'checkout.stripe.com',
      'Contains a phone number',
      'Lovely trip',
    ]) {
      expect(json).not.toContain(secret);
    }
  });

  it('yêu cầu huỷ: trạng thái bằng chữ và hai ngày theo giờ Việt Nam', () => {
    const out = toMyBookingDetails(
      detail({
        cancellationStatus: 'DENIED',
        cancellationRequestedAt: '2026-10-05T18:00:00.000Z',
        cancellationDecidedAt: '2026-10-06T02:00:00.000Z',
      }),
      now,
    );
    expect(out.cancellationRequest).toEqual({
      status: 'Declined',
      requestedOn: '2026-10-06',
      decidedOn: '2026-10-06',
    });
    expect(
      toMyBookingDetails(
        detail({ cancellationStatus: 'REQUESTED', cancellationRequestedAt: now.toISOString() }),
        now,
      ).cancellationRequest,
    ).toEqual({ status: 'Waiting for review', requestedOn: today, decidedOn: null });
  });

  it('chuyến bị Nexora huỷ: lý do admin ghi, không mời viết review', () => {
    const out = toMyBookingDetails(
      detail({
        departureCancelled: true,
        departureCancelReason: 'Typhoon warning',
        departureEndDate: '2026-10-02',
        cancellation: null,
      }),
      now,
    );
    expect(out).toMatchObject({
      status: 'Cancelled by Nexora; anything paid is refunded in full',
      nexoraCancellationReason: 'Typhoon warning',
      cancellation: null,
      review: null,
    });
  });

  it('đơn đã huỷ có ngày huỷ; đơn còn chạy thì không có hai trường huỷ', () => {
    expect(
      toMyBookingDetails(
        detail({
          status: 'REFUNDED',
          cancelledAt: '2026-10-08T03:00:00.000Z',
          refundedTotal: '378.00',
          cancellation: null,
        }),
        now,
      ),
    ).toMatchObject({ status: 'Cancelled', cancelledOn: '2026-10-08', refunded: '378.00' });
    expect(
      toMyBookingDetails(
        detail({
          status: 'CANCELLED',
          cancelledAt: '2026-10-08T03:00:00.000Z',
          refundedTotal: '378.00',
          cancellation: null,
        }),
        now,
      ),
    ).toMatchObject({ status: 'Cancelled', payment: 'Paid, refunded in full' });
    const active = toMyBookingDetails(detail(), now);
    expect(active).not.toHaveProperty('cancelledOn');
    expect(active).not.toHaveProperty('nexoraCancellationReason');
  });

  it.each([
    [{ review: review('pending') }, 'Submitted, waiting for moderation'],
    [{ review: review('approved') }, 'Published'],
    [{ review: review('rejected') }, 'Not approved; see the booking page'],
    [{ review: review('retracted') }, 'Withdrawn'],
    [{ departureEndDate: '2026-10-15' }, 'Not written yet; can be written on the booking page'],
    [{ status: 'PENDING' as const }, null],
    // L5-20 (review 20/10): cùng cổng `bookingKeepsTrip` với API và trang đơn (L5-07) — đơn hoàn
    // một phần, hay hoàn thiện chí trọn mà không huỷ, vẫn đi tour nên viết review được.
    [
      { status: 'PARTIALLY_REFUNDED' as const, departureEndDate: '2026-10-15' },
      'Not written yet; can be written on the booking page',
    ],
    [
      { status: 'REFUNDED' as const, departureEndDate: '2026-10-15' },
      'Not written yet; can be written on the booking page',
    ],
    [{ status: 'PARTIALLY_REFUNDED' as const }, 'Can be written after the trip ends'],
    [
      {
        status: 'REFUNDED' as const,
        cancelledAt: '2026-10-08T03:00:00.000Z',
        departureEndDate: '2026-10-15',
      },
      null,
    ],
    [
      {
        status: 'CANCELLED' as const,
        cancelledAt: '2026-10-08T03:00:00.000Z',
        departureEndDate: '2026-10-15',
      },
      null,
    ],
  ])('review %j → %s', (overrides, text) => {
    expect(toMyBookingDetails(detail(overrides), now).review).toBe(text);
  });

  it('PayPal ghi đúng tên; chưa trả thì không có ngày trả', () => {
    expect(
      toMyBookingDetails(detail({ paymentProvider: 'PAYPAL', paidAt: null }), now),
    ).toMatchObject({ paymentMethod: 'PayPal', paidOn: null });
  });
});

describe('normalizeBookingCode', () => {
  it.each([
    ['BK-AB12CD34', 'BK-AB12CD34'],
    [' bk-ab12cd34 ', 'BK-AB12CD34'],
    ['ab12cd34', 'BK-AB12CD34'],
    ['BK-AB12', null],
    ['not a code', null],
    ['BK-AB12CD34; drop table', null],
  ])('%j → %j', (raw, code) => {
    expect(normalizeBookingCode(raw)).toBe(code);
  });
});
