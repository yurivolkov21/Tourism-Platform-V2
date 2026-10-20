import { ORPCError } from '@orpc/client';
import { type BookingCancellation, type BookingDetail, bookingPhase } from '@tourism/contract';
import {
  bookingDetailActions,
  bookingDetailKind,
  cancelErrorAction,
  cancelErrorCopy,
  cancelPendingErrorAction,
  canWriteReview,
  operatorRefund,
  payErrorAction,
} from './booking-detail';

function makeBooking(overrides: Partial<BookingDetail>): BookingDetail {
  return {
    id: 'b1',
    code: 'BK-TEST0001',
    status: 'PAID',
    tourTitle: 'Test tour',
    tourSlug: 'test-tour',
    tourImage: null,
    tourDestinations: [],
    departureStartDate: '2026-10-17',
    departureEndDate: '2026-10-17',
    cancellationDeadline: '2026-10-16',
    // ADR-0054 AMEND 1: chuyến còn chạy. Test cần chuyến bị công ty huỷ thì đè overrides.
    departureCancelled: false,
    unitPrice: '35.00',
    totalAmount: '35.00',
    currency: 'USD',
    numAdults: 1,
    numChildren: 0,
    contactName: 'A',
    contactEmail: 'a@example.com',
    contactPhone: null,
    specialRequests: null,
    paymentProvider: 'STRIPE',
    checkoutUrl: null,
    paidAt: '2026-10-01T00:00:00.000Z',
    cancelledAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    cancellationStatus: null,
    cancellationRequestedAt: null,
    cancellationDecidedAt: null,
    refundedTotal: '0.00',
    reviewedAt: null,
    review: null,
    cancellation: null,
    // ADR-0041 AMEND 2: chuyến còn chạy thì không có lý do huỷ nào để in.
    departureCancelReason: null,
    ...overrides,
  };
}

const CANCELLABLE: BookingCancellation = {
  deadline: '2026-10-16',
  withinDeadline: true,
  refundAmount: '35.00',
  canCancel: true,
};

// Ngày hôm nay của test: trước hạn chót 16/10 của chuyến mẫu 17/10.
const TODAY = '2026-10-14';

/** Khung và hành động của một đơn vào `today` — giai đoạn tính bằng `bookingPhase` thật như route. */
const kindOf = (booking: BookingDetail, today = TODAY) =>
  bookingDetailKind(booking, bookingPhase(booking, today));
const actionsOf = (booking: BookingDetail, today = TODAY) =>
  bookingDetailActions(booking, bookingPhase(booking, today));

describe('bookingDetailKind', () => {
  it('PENDING -> pending', () => {
    expect(kindOf(makeBooking({ status: 'PENDING', paidAt: null }))).toBe('pending');
  });

  it('PAID -> paid', () => {
    expect(kindOf(makeBooking({ status: 'PAID' }))).toBe('paid');
  });

  it('CANCELLED -> cancelled (chưa từng trả tiền)', () => {
    expect(kindOf(makeBooking({ status: 'CANCELLED', paidAt: null }))).toBe('cancelled');
  });

  it('REFUNDED -> refunded', () => {
    expect(kindOf(makeBooking({ status: 'REFUNDED' }))).toBe('refunded');
  });

  it('PARTIALLY_REFUNDED -> refunded', () => {
    expect(kindOf(makeBooking({ status: 'PARTIALLY_REFUNDED' }))).toBe('refunded');
  });

  // Khách tự huỷ đơn đã trả thì API đặt CANCELLED (ADR-0041 §4), không phải REFUNDED — khung
  // `cancelled` không kể chuyện tiền nên khách không thấy khoản hoàn của chính mình.
  it('CANCELLED đã thu tiền và đã hoàn (khách tự huỷ trong hạn) -> refunded', () => {
    expect(
      kindOf(
        makeBooking({
          status: 'CANCELLED',
          refundedTotal: '35.00',
          cancelledAt: '2026-10-05T00:00:00.000Z',
        }),
      ),
    ).toBe('refunded');
  });

  it('CANCELLED đã thu mà không hoàn đồng nào (huỷ quá hạn) -> refunded: khung T8 nói không hoàn', () => {
    expect(
      kindOf(
        makeBooking({
          status: 'CANCELLED',
          refundedTotal: '0.00',
          cancelledAt: '2026-10-05T00:00:00.000Z',
        }),
      ),
    ).toBe('refunded');
  });

  it('CANCELLED chưa có paidAt mà sổ đã có khoản hoàn (thu rồi hoàn trước khi kịp PAID) -> refunded', () => {
    expect(kindOf(makeBooking({ status: 'CANCELLED', paidAt: null, refundedTotal: '35.00' }))).toBe(
      'refunded',
    );
  });
});

// G54: đơn chờ trả qua hạn chót — API không mở phiên trả nào nữa, hoá đơn T5 mời trả là mời bấm
// một nút chắc chắn hỏng.
describe('bookingDetailKind — đơn chờ trả quá hạn chót (`lapsed`)', () => {
  const pending = makeBooking({ status: 'PENDING', paidAt: null });

  it('đúng ngày hạn chót vẫn là pending (biên đóng)', () => {
    expect(kindOf(pending, '2026-10-16')).toBe('pending');
  });

  it('qua hạn chót -> lapsed', () => {
    expect(kindOf(pending, '2026-10-17')).toBe('lapsed');
  });

  it('qua hạn chót trên chuyến công ty huỷ -> departureCancelled (cờ chuyến thắng)', () => {
    const b = makeBooking({ status: 'CANCELLED', paidAt: null, departureCancelled: true });
    expect(kindOf(b, '2026-10-17')).toBe('departureCancelled');
  });
});

describe('bookingDetailKind — chuyến bị công ty huỷ (ADR-0041 AMEND 1)', () => {
  it.each(['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] as const)(
    '%s trên chuyến công ty huỷ -> departureCancelled (job hoàn tiền có thể chưa chạy)',
    (status) => {
      expect(kindOf(makeBooking({ status, departureCancelled: true }))).toBe('departureCancelled');
    },
  );

  it('CANCELLED đã hoàn trọn (job hoàn tiền đã chạy) -> departureCancelled', () => {
    expect(
      kindOf(
        makeBooking({
          status: 'CANCELLED',
          departureCancelled: true,
          refundedTotal: '35.00',
          cancelledAt: '2026-10-05T00:00:00.000Z',
        }),
      ),
    ).toBe('departureCancelled');
  });

  it('CANCELLED chưa từng thu tiền (đơn chờ trả bị huỷ cùng chuyến) -> departureCancelled', () => {
    expect(
      kindOf(makeBooking({ status: 'CANCELLED', departureCancelled: true, paidAt: null })),
    ).toBe('departureCancelled');
  });

  it('khách tự huỷ quá hạn TRƯỚC khi chuyến bị huỷ (đã thu, không hoàn) -> refunded: chuyện vẫn là của khách', () => {
    expect(
      kindOf(
        makeBooking({
          status: 'CANCELLED',
          departureCancelled: true,
          refundedTotal: '0.00',
          cancelledAt: '2026-10-05T00:00:00.000Z',
        }),
      ),
    ).toBe('refunded');
  });
});

describe('bookingDetailActions', () => {
  it('PENDING -> payNow + cancelPending', () => {
    expect(actionsOf(makeBooking({ status: 'PENDING', paidAt: null }))).toEqual([
      'payNow',
      'cancelPending',
    ]);
  });

  it('PENDING qua hạn chót -> rỗng: không mời trả, cũng không mời huỷ giữ chỗ (như cột phải của web)', () => {
    expect(actionsOf(makeBooking({ status: 'PENDING', paidAt: null }), '2026-10-17')).toEqual([]);
  });

  it('PAID với canCancel true -> cancelBooking', () => {
    expect(actionsOf(makeBooking({ status: 'PAID', cancellation: CANCELLABLE }))).toEqual([
      'cancelBooking',
    ]);
  });

  it('PAID với cancellation null (server không gửi) -> rỗng', () => {
    expect(actionsOf(makeBooking({ status: 'PAID', cancellation: null }))).toEqual([]);
  });

  it('PAID quá hạn (canCancel false — đã khởi hành) -> rỗng', () => {
    expect(
      actionsOf(
        makeBooking({
          status: 'PAID',
          cancellation: { ...CANCELLABLE, withinDeadline: false, canCancel: false },
        }),
      ),
    ).toEqual([]);
  });

  it('PAID quá hạn huỷ miễn phí nhưng canCancel true (vẫn huỷ được, hoàn 0) -> cancelBooking', () => {
    expect(
      actionsOf(
        makeBooking({
          status: 'PAID',
          cancellation: { ...CANCELLABLE, withinDeadline: false, refundAmount: '0.00' },
        }),
      ),
    ).toEqual(['cancelBooking']);
  });

  it('CANCELLED -> rỗng (terminal)', () => {
    expect(actionsOf(makeBooking({ status: 'CANCELLED', paidAt: null }))).toEqual([]);
  });

  it('REFUNDED -> rỗng (terminal)', () => {
    expect(actionsOf(makeBooking({ status: 'REFUNDED' }))).toEqual([]);
  });

  it('chuyến công ty huỷ -> rỗng, kể cả khi đơn còn PAID và cờ huỷ còn mở', () => {
    expect(
      actionsOf(
        makeBooking({ status: 'PAID', departureCancelled: true, cancellation: CANCELLABLE }),
      ),
    ).toEqual([]);
  });
});

describe('operatorRefund (chuyện tiền của đơn trên chuyến công ty huỷ)', () => {
  it('đơn còn PAID hay hoàn một phần: job hoàn tiền chưa chạy, tiền đang về — đọc TRƯỚC sổ hoàn', () => {
    expect(operatorRefund(makeBooking({ status: 'PAID', departureCancelled: true }))).toEqual({
      kind: 'onItsWay',
    });
    expect(
      operatorRefund(
        makeBooking({
          status: 'PARTIALLY_REFUNDED',
          departureCancelled: true,
          refundedTotal: '10.00',
        }),
      ),
    ).toEqual({ kind: 'onItsWay' });
  });

  it('đã hoàn: số tiền sổ ghi và mốc quyết hoàn, không có thì mốc huỷ', () => {
    expect(
      operatorRefund(
        makeBooking({
          status: 'CANCELLED',
          departureCancelled: true,
          refundedTotal: '35.00',
          cancelledAt: '2026-10-05T00:00:00.000Z',
          cancellationDecidedAt: '2026-10-05T00:01:00.000Z',
        }),
      ),
    ).toEqual({ kind: 'refunded', amount: '35.00', refundedAt: '2026-10-05T00:01:00.000Z' });
    expect(
      operatorRefund(
        makeBooking({
          status: 'CANCELLED',
          departureCancelled: true,
          refundedTotal: '35.00',
          cancelledAt: '2026-10-05T00:00:00.000Z',
        }),
      ),
    ).toEqual({ kind: 'refunded', amount: '35.00', refundedAt: '2026-10-05T00:00:00.000Z' });
  });

  it('chưa từng thu tiền -> null (không có chuyện tiền để kể)', () => {
    expect(
      operatorRefund(makeBooking({ status: 'CANCELLED', departureCancelled: true, paidAt: null })),
    ).toBeNull();
  });
});

describe('cancelErrorCopy / cancelErrorAction', () => {
  it('NOT_CANCELLABLE -> copy notCancellable + refetch', () => {
    const error = new ORPCError('NOT_CANCELLABLE', { status: 422 });
    expect(cancelErrorAction(error)).toBe('refetch');
  });

  it('REFUND_AMOUNT_CHANGED -> refetch', () => {
    const error = new ORPCError('REFUND_AMOUNT_CHANGED', { status: 409 });
    expect(cancelErrorAction(error)).toBe('refetch');
  });

  it('REFUND_FAILED -> stay (booking vẫn PAID, không đổi gì)', () => {
    const error = new ORPCError('REFUND_FAILED', { status: 502 });
    expect(cancelErrorAction(error)).toBe('stay');
    expect(cancelErrorCopy(error)).toContain('refund');
  });

  it('lỗi mạng chung -> stay', () => {
    expect(cancelErrorAction(new Error('network'))).toBe('stay');
  });
});

describe('cancelPendingErrorAction', () => {
  it('NOT_PENDING → refetch (đơn vừa trả trên web hoặc câu quét đã huỷ — màn đọc lại là đúng)', () => {
    expect(cancelPendingErrorAction(new ORPCError('NOT_PENDING', { status: 422 }))).toBe('refetch');
  });

  it('lỗi khác / không phải ORPCError → message', () => {
    expect(cancelPendingErrorAction(new ORPCError('TOO_MANY_REQUESTS', { status: 429 }))).toBe(
      'message',
    );
    expect(cancelPendingErrorAction(new Error('network'))).toBe('message');
  });
});

describe('payErrorAction', () => {
  it('DEPARTURE_NOT_AVAILABLE → departureClosed (chỉ còn nút bỏ booking)', () => {
    expect(payErrorAction(new ORPCError('DEPARTURE_NOT_AVAILABLE', { status: 400 }))).toBe(
      'departureClosed',
    );
  });

  it('NOT_PENDING → refetch (booking đã đổi trạng thái ở nơi khác)', () => {
    expect(payErrorAction(new ORPCError('NOT_PENDING', { status: 422 }))).toBe('refetch');
  });

  it('lỗi khác / không phải ORPCError → message', () => {
    expect(payErrorAction(new ORPCError('CHECKOUT_FAILED', { status: 502 }))).toBe('message');
    expect(payErrorAction(new Error('network'))).toBe('message');
  });
});

describe('canWriteReview — hoá đơn mời viết đánh giá (nợ nhỏ P5b-5 mục 1)', () => {
  // Chuyến mẫu về ngày 17/10. Cổng API so theo ngày UTC: 16/10 17:00 UTC đã là 00:00 ngày 17
  // giờ Việt Nam nhưng API chưa nhận — nút chỉ hiện từ 17/10 00:00 UTC (07:00 giờ VN).
  const ARRIVAL_UTC = new Date('2026-10-17T00:00:00.000Z');
  const VN_MIDNIGHT = new Date('2026-10-16T17:00:00.000Z');

  it('đơn PAID, chuyến đã về, chưa có bài → mời viết', () => {
    expect(canWriteReview(makeBooking({}), ARRIVAL_UTC)).toBe(true);
  });

  it('chuyến chưa về theo ngày UTC → chưa mời, kể cả khi đã sang ngày về theo giờ Việt Nam', () => {
    expect(canWriteReview(makeBooking({}), VN_MIDNIGHT)).toBe(false);
  });

  it('đơn đã có bài (chờ duyệt, bị bác, đã rút…) → không mời lần hai; bài sống ở My reviews', () => {
    const review = { moderationState: 'retracted' } as BookingDetail['review'];
    expect(canWriteReview(makeBooking({ review }), ARRIVAL_UTC)).toBe(false);
  });

  it('chuyến bị công ty huỷ → không mời, kể cả khi đơn còn PAID vì job hoàn tiền chưa chạy', () => {
    expect(canWriteReview(makeBooking({ departureCancelled: true }), ARRIVAL_UTC)).toBe(false);
  });

  // L5-07: hoàn một phần, hay hoàn thiện chí trọn mà không huỷ, thì khách vẫn đi (ADR-0054 AMEND 1)
  // — cổng API nhận như đơn PAID (`bookingKeepsTrip`), nên hoá đơn mời viết như đơn PAID.
  it.each(['PARTIALLY_REFUNDED', 'REFUNDED'] as const)(
    '%s chưa huỷ thật (khách vẫn đi) → mời viết như đơn PAID',
    (status) => {
      expect(canWriteReview(makeBooking({ status }), ARRIVAL_UTC)).toBe(true);
    },
  );

  it.each([
    ['PENDING', 'PENDING', null],
    ['CANCELLED', 'CANCELLED', '2026-10-05T00:00:00.000Z'],
    ['REFUNDED huỷ thật rồi mới hoàn', 'REFUNDED', '2026-10-05T00:00:00.000Z'],
  ] as const)('%s → không mời', (_label, status, cancelledAt) => {
    expect(canWriteReview(makeBooking({ status, cancelledAt }), ARRIVAL_UTC)).toBe(false);
  });
});
