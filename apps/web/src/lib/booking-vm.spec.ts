import type { Booking } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { bookingView, type CancellationView } from './booking-vm';

/** Factory booking hợp lệ theo shape `Booking` — chỉ field spec cần cho
 *  `bookingView` (status) thật sự biến thiên trong test, còn lại giữ cố định
 *  để mỗi test case đọc gọn. */
function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'b0000000-0000-4000-8000-000000000000',
    code: 'BK-TESTAAAA',
    status: 'PENDING',
    tourTitle: 'Test Tour',
    departureStartDate: '2026-09-01',
    departureEndDate: '2026-09-02',
    unitPrice: '10.00',
    totalAmount: '10.00',
    currency: 'USD',
    numAdults: 1,
    numChildren: 0,
    contactName: 'Test Traveller',
    contactEmail: 'test@example.com',
    contactPhone: null,
    specialRequests: null,
    paymentProvider: 'STRIPE',
    checkoutUrl: null,
    paidAt: null,
    cancelledAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    // Task 6a (A2): field mới trên BookingSchema — mặc định chưa-có (null);
    // test cancellation view dùng tham số `cancellation` rời (xem trên), không
    // qua field này.
    cancellationStatus: null,
    ...overrides,
  };
}

describe('bookingView', () => {
  it('PENDING → warning + [payNow, cancelPending]', () => {
    const view = bookingView(makeBooking({ status: 'PENDING' }));
    expect(view).toEqual({
      tone: 'warning',
      statusKey: 'PENDING',
      actions: ['payNow', 'cancelPending'],
    });
  });

  it('PAID chưa có cancellation → success + [requestCancellation]', () => {
    const view = bookingView(makeBooking({ status: 'PAID' }));
    expect(view).toEqual({
      tone: 'success',
      statusKey: 'PAID',
      actions: ['requestCancellation'],
    });
  });

  it('PAID + cancellation REQUESTED → success + [viewCancellationPending]', () => {
    const cancellation: CancellationView = { status: 'REQUESTED', decisionNote: null };
    const view = bookingView(makeBooking({ status: 'PAID' }), cancellation);
    expect(view).toEqual({
      tone: 'success',
      statusKey: 'PAID',
      actions: ['viewCancellationPending'],
    });
  });

  it('PAID + cancellation DENIED → success + [resubmitCancellation]', () => {
    const cancellation: CancellationView = {
      status: 'DENIED',
      decisionNote: 'Departure too close.',
    };
    const view = bookingView(makeBooking({ status: 'PAID' }), cancellation);
    expect(view).toEqual({
      tone: 'success',
      statusKey: 'PAID',
      actions: ['resubmitCancellation'],
    });
  });

  it('CANCELLED → muted + []', () => {
    const view = bookingView(makeBooking({ status: 'CANCELLED' }));
    expect(view).toEqual({ tone: 'muted', statusKey: 'CANCELLED', actions: [] });
  });

  it('REFUNDED → destructive + []', () => {
    const view = bookingView(makeBooking({ status: 'REFUNDED' }));
    expect(view).toEqual({ tone: 'destructive', statusKey: 'REFUNDED', actions: [] });
  });

  it('PARTIALLY_REFUNDED → destructive + []', () => {
    const view = bookingView(makeBooking({ status: 'PARTIALLY_REFUNDED' }));
    expect(view).toEqual({ tone: 'destructive', statusKey: 'PARTIALLY_REFUNDED', actions: [] });
  });

  it('cancellation bị bỏ qua ở status không phải PAID (máy trạng thái không cho tồn tại)', () => {
    const cancellation: CancellationView = { status: 'REQUESTED', decisionNote: null };
    const view = bookingView(makeBooking({ status: 'CANCELLED' }), cancellation);
    expect(view).toEqual({ tone: 'muted', statusKey: 'CANCELLED', actions: [] });
  });
});
