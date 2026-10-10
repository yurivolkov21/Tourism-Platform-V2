import { ORPCError } from '@orpc/client';
import type { BookingCancellation, BookingDetail } from '@tourism/contract';
import {
  bookingDetailActions,
  bookingDetailKind,
  cancelErrorAction,
  cancelErrorCopy,
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
    ...overrides,
  };
}

const CANCELLABLE: BookingCancellation = {
  deadline: '2026-10-16',
  withinDeadline: true,
  refundAmount: '35.00',
  canCancel: true,
};

describe('bookingDetailKind', () => {
  it('PENDING -> pending', () => {
    expect(bookingDetailKind(makeBooking({ status: 'PENDING', paidAt: null }))).toBe('pending');
  });

  it('PAID -> paid', () => {
    expect(bookingDetailKind(makeBooking({ status: 'PAID' }))).toBe('paid');
  });

  it('CANCELLED -> cancelled (chưa từng trả tiền)', () => {
    expect(bookingDetailKind(makeBooking({ status: 'CANCELLED', paidAt: null }))).toBe('cancelled');
  });

  it('REFUNDED -> refunded', () => {
    expect(bookingDetailKind(makeBooking({ status: 'REFUNDED' }))).toBe('refunded');
  });

  it('PARTIALLY_REFUNDED -> refunded', () => {
    expect(bookingDetailKind(makeBooking({ status: 'PARTIALLY_REFUNDED' }))).toBe('refunded');
  });
});

describe('bookingDetailActions', () => {
  it('PENDING -> payNow + cancelPending', () => {
    expect(bookingDetailActions(makeBooking({ status: 'PENDING', paidAt: null }))).toEqual([
      'payNow',
      'cancelPending',
    ]);
  });

  it('PAID với canCancel true -> cancelBooking', () => {
    expect(
      bookingDetailActions(makeBooking({ status: 'PAID', cancellation: CANCELLABLE })),
    ).toEqual(['cancelBooking']);
  });

  it('PAID với cancellation null (server không gửi) -> rỗng', () => {
    expect(bookingDetailActions(makeBooking({ status: 'PAID', cancellation: null }))).toEqual([]);
  });

  it('PAID quá hạn (canCancel false — đã khởi hành) -> rỗng', () => {
    expect(
      bookingDetailActions(
        makeBooking({
          status: 'PAID',
          cancellation: { ...CANCELLABLE, withinDeadline: false, canCancel: false },
        }),
      ),
    ).toEqual([]);
  });

  it('PAID quá hạn huỷ miễn phí nhưng canCancel true (vẫn huỷ được, hoàn 0) -> cancelBooking', () => {
    expect(
      bookingDetailActions(
        makeBooking({
          status: 'PAID',
          cancellation: { ...CANCELLABLE, withinDeadline: false, refundAmount: '0.00' },
        }),
      ),
    ).toEqual(['cancelBooking']);
  });

  it('CANCELLED -> rỗng (terminal)', () => {
    expect(bookingDetailActions(makeBooking({ status: 'CANCELLED', paidAt: null }))).toEqual([]);
  });

  it('REFUNDED -> rỗng (terminal)', () => {
    expect(bookingDetailActions(makeBooking({ status: 'REFUNDED' }))).toEqual([]);
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
