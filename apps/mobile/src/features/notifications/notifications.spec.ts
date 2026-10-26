import {
  type AppNotification,
  buildNotifications,
  countUnread,
  type NotificationBookingInput,
  type NotificationReviewInput,
  notificationTarget,
} from './notifications';

const TODAY = '2026-10-25';
const NOW = new Date('2026-10-25T05:00:00Z');

function booking(overrides: Partial<NotificationBookingInput> = {}): NotificationBookingInput {
  return {
    code: 'BK-AAAA1111',
    status: 'PAID',
    tourTitle: 'Ha Giang Loop',
    tourImage: null,
    departureStartDate: '2026-11-10',
    departureEndDate: '2026-11-13',
    departureCancelled: false,
    cancelledAt: null,
    ...overrides,
  };
}

function review(overrides: Partial<NotificationReviewInput> = {}): NotificationReviewInput {
  return {
    id: 'rev-1',
    moderationState: 'approved',
    tourTitle: 'Ha Giang Loop',
    tourImage: null,
    bookingCode: 'BK-AAAA1111',
    createdAt: '2026-10-20T08:00:00.000Z',
    ...overrides,
  };
}

const kinds = (list: ReturnType<typeof buildNotifications>) => list.map((n) => n.kind);

function build(bookings: NotificationBookingInput[], reviews: NotificationReviewInput[] = []) {
  return buildNotifications({ bookings, reviews, today: TODAY, now: NOW });
}

describe('buildNotifications — đơn', () => {
  it('không có gì thì danh sách rỗng', () => {
    expect(build([])).toEqual([]);
  });

  it('đơn chờ thanh toán (còn hạn) → payment_due', () => {
    const [n] = build([booking({ status: 'PENDING' })]);
    expect(n).toMatchObject({
      kind: 'payment_due',
      code: 'BK-AAAA1111',
      id: 'payment_due:BK-AAAA1111',
    });
  });

  it('đơn chờ thanh toán đã quá hạn chót (lapsed) → không có thông báo', () => {
    // Hạn chót = ngày đi − N; ngày đi 3 ngày nữa chắc chắn đã quá.
    const lapsed = booking({
      status: 'PENDING',
      departureStartDate: '2026-10-27',
      departureEndDate: '2026-10-29',
    });
    expect(build([lapsed])).toEqual([]);
  });

  it('sắp đi trong ≤ 30 ngày → departing kèm số ngày; xa hơn thì bỏ', () => {
    const near = booking({
      code: 'BK-NEAR0001',
      departureStartDate: '2026-10-30',
      departureEndDate: '2026-11-02',
    });
    const far = booking({
      code: 'BK-FAR00001',
      departureStartDate: '2026-12-30',
      departureEndDate: '2027-01-02',
    });
    const list = build([near, far]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: 'departing', code: 'BK-NEAR0001', daysUntil: 5 });
  });

  it('đang đi → on_tour kèm ngày thứ mấy / tổng', () => {
    const [n] = build([
      booking({ departureStartDate: '2026-10-24', departureEndDate: '2026-10-27' }),
    ]);
    expect(n).toMatchObject({ kind: 'on_tour', dayOfTrip: 2, totalDays: 4 });
  });

  it('chuyến bị công ty huỷ → trip_cancelled (kể cả khi đơn còn PAID)', () => {
    const [n] = build([booking({ departureCancelled: true })]);
    expect(n?.kind).toBe('trip_cancelled');
  });

  it('REFUNDED có mốc huỷ → refunded; đơn khách tự huỷ (CANCELLED) → không thông báo', () => {
    const refunded = booking({
      code: 'BK-REF00001',
      status: 'REFUNDED',
      cancelledAt: '2026-10-20T00:00:00.000Z',
    });
    const cancelled = booking({
      code: 'BK-CAN00001',
      status: 'CANCELLED',
      cancelledAt: '2026-10-20T00:00:00.000Z',
    });
    expect(kinds(build([refunded, cancelled]))).toEqual(['refunded']);
  });

  it('đã về trong ≤ 60 ngày và chưa có review → review_prompt; quá 60 ngày thì bỏ', () => {
    const recent = booking({
      code: 'BK-REC00001',
      departureStartDate: '2026-10-10',
      departureEndDate: '2026-10-12',
    });
    const old = booking({
      code: 'BK-OLD00001',
      departureStartDate: '2026-06-10',
      departureEndDate: '2026-06-12',
    });
    const list = build([recent, old]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: 'review_prompt', code: 'BK-REC00001' });
  });

  it('chuyến đã về nhưng đã có review (bất kể trạng thái) → không mời viết lại', () => {
    const done = booking({ departureStartDate: '2026-10-10', departureEndDate: '2026-10-12' });
    const list = build(
      [done],
      [review({ moderationState: 'pending', bookingCode: 'BK-AAAA1111' })],
    );
    expect(kinds(list)).not.toContain('review_prompt');
  });
});

describe('buildNotifications — huỷ và hoàn tiền', () => {
  it('chuyến bị công ty huỷ từ lâu (quá 30 ngày sau ngày về) → không còn thông báo', () => {
    const old = booking({
      departureCancelled: true,
      departureStartDate: '2026-08-01',
      departureEndDate: '2026-08-03',
    });
    expect(build([old])).toEqual([]);
  });

  it('chuyến bị công ty huỷ chưa tới ngày về hoặc mới qua → vẫn có thông báo', () => {
    const upcoming = booking({ code: 'BK-UP', departureCancelled: true });
    const recent = booking({
      code: 'BK-RECENT',
      departureCancelled: true,
      departureStartDate: '2026-10-10',
      departureEndDate: '2026-10-12',
    });
    expect(
      build([upcoming, recent])
        .map((n) => n.id)
        .sort(),
    ).toEqual(['trip_cancelled:BK-RECENT', 'trip_cancelled:BK-UP']);
  });

  it('đơn đã hoàn tiền sau huỷ quá 30 ngày → không còn thông báo', () => {
    const old = booking({
      status: 'REFUNDED',
      cancelledAt: '2026-06-01T00:00:00.000Z',
      departureStartDate: '2026-08-01',
      departureEndDate: '2026-08-03',
    });
    expect(build([old])).toEqual([]);
  });

  it('đơn REFUNDED không có mốc huỷ, chuyến chưa đi → không báo "sắp đi"', () => {
    const refunded = booking({ status: 'REFUNDED', cancelledAt: null });
    expect(build([refunded])).toEqual([]);
  });

  it('đơn REFUNDED không có mốc huỷ, chuyến đang đi → không báo "đang đi"', () => {
    const refunded = booking({
      status: 'REFUNDED',
      cancelledAt: null,
      departureStartDate: '2026-10-24',
      departureEndDate: '2026-10-27',
    });
    expect(build([refunded])).toEqual([]);
  });
});

describe('buildNotifications — review', () => {
  it('bị bác → review_rejected; được duyệt gần đây → review_approved', () => {
    const rejected = review({ id: 'rev-r', moderationState: 'rejected' });
    const approved = review({ id: 'rev-a', moderationState: 'approved' });
    const list = build([], [approved, rejected]);
    expect(kinds(list)).toEqual(['review_rejected', 'review_approved']);
    expect(list[0]).toMatchObject({ reviewId: 'rev-r', id: 'review_rejected:rev-r' });
  });

  it('được duyệt từ hơn 14 ngày trước, đang chờ duyệt hay đã rút → không thông báo', () => {
    const stale = review({ id: 'rev-s', createdAt: '2026-09-01T00:00:00.000Z' });
    const pending = review({ id: 'rev-p', moderationState: 'pending' });
    const retracted = review({ id: 'rev-x', moderationState: 'retracted' });
    expect(build([], [stale, pending, retracted])).toEqual([]);
  });
});

describe('buildNotifications — thứ tự', () => {
  it('payment_due, on_tour, departing (gần trước), cancelled/refunded, review_prompt, rejected, approved', () => {
    const list = build(
      [
        booking({
          code: 'BK-DEP2',
          departureStartDate: '2026-11-05',
          departureEndDate: '2026-11-07',
        }),
        booking({
          code: 'BK-DEP1',
          departureStartDate: '2026-10-28',
          departureEndDate: '2026-10-30',
        }),
        booking({
          code: 'BK-PRM1',
          departureStartDate: '2026-10-10',
          departureEndDate: '2026-10-12',
        }),
        booking({ code: 'BK-CAN1', departureCancelled: true }),
        booking({
          code: 'BK-TOUR',
          departureStartDate: '2026-10-24',
          departureEndDate: '2026-10-26',
        }),
        booking({ code: 'BK-PAY1', status: 'PENDING' }),
      ],
      [
        review({ id: 'rev-a', moderationState: 'approved', bookingCode: 'BK-OTHER' }),
        review({ id: 'rev-r', moderationState: 'rejected', bookingCode: 'BK-OTHER2' }),
      ],
    );
    expect(list.map((n) => n.id)).toEqual([
      'payment_due:BK-PAY1',
      'on_tour:BK-TOUR',
      'departing:BK-DEP1',
      'departing:BK-DEP2',
      'trip_cancelled:BK-CAN1',
      'review_prompt:BK-PRM1',
      'review_rejected:rev-r',
      'review_approved:rev-a',
    ]);
  });
});

describe('countUnread', () => {
  it('đếm thông báo có id không nằm trong tập đã đọc', () => {
    const list = build([
      booking({ status: 'PENDING' }),
      booking({ code: 'BK-TWO', departureStartDate: '2026-10-28', departureEndDate: '2026-10-30' }),
    ]);
    expect(countUnread(list, new Set())).toBe(2);
    expect(countUnread(list, new Set(['payment_due:BK-AAAA1111']))).toBe(1);
    expect(countUnread([], new Set(['x']))).toBe(0);
  });
});

describe('notificationTarget', () => {
  const base: AppNotification = {
    id: 'x',
    kind: 'payment_due',
    tourTitle: null,
    imageUrl: null,
    code: 'BK-AAAA1111',
    reviewId: null,
  };

  it('thanh toán, huỷ, hoàn tiền → hoá đơn', () => {
    for (const kind of ['payment_due', 'trip_cancelled', 'refunded'] as const) {
      expect(notificationTarget({ ...base, kind })).toBe('/bookings/BK-AAAA1111');
    }
  });

  it('sắp đi, đang đi → cụm theo dõi chuyến', () => {
    expect(notificationTarget({ ...base, kind: 'departing' })).toBe('/trips/BK-AAAA1111');
    expect(notificationTarget({ ...base, kind: 'on_tour' })).toBe('/trips/BK-AAAA1111');
  });

  it('mời viết review → màn viết review của chuyến', () => {
    expect(notificationTarget({ ...base, kind: 'review_prompt' })).toBe(
      '/trips/BK-AAAA1111/review',
    );
  });

  it('review bị bác hoặc được duyệt → chi tiết review', () => {
    const review = { ...base, code: null, reviewId: 'rev-9' };
    expect(notificationTarget({ ...review, kind: 'review_rejected' })).toBe('/reviews/rev-9');
    expect(notificationTarget({ ...review, kind: 'review_approved' })).toBe('/reviews/rev-9');
  });
});
