import { describe, expect, it } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { bookingView, type CancellationView, toCancellationView } from './booking-vm';

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

/**
 * `toCancellationView` — map `Booking['cancellationStatus']` (Task 6a, đọc
 * thẳng từ `bookings.byCode` thật) sang `CancellationView` để truyền cho
 * `bookingView`. Task 6: dùng cái này ở trang chi tiết THẬT thay vì tra
 * `MOCK_CANCELLATIONS` theo `bookingCode` (mock đã khai tử).
 */
describe('toCancellationView', () => {
  it('null (chưa từng xin) → undefined', () => {
    expect(toCancellationView(null)).toBeUndefined();
  });

  it('REQUESTED → { status: REQUESTED, decisionNote: null }', () => {
    expect(toCancellationView('REQUESTED')).toEqual({ status: 'REQUESTED', decisionNote: null });
  });

  it('DENIED → { status: DENIED, decisionNote: null }', () => {
    expect(toCancellationView('DENIED')).toEqual({ status: 'DENIED', decisionNote: null });
  });

  it('REFUNDED (không thể xảy ra trên PAID theo booking-states.md, phòng thủ) → undefined', () => {
    expect(toCancellationView('REFUNDED')).toBeUndefined();
  });
});
