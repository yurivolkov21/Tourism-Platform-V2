import type { BookingCancellation } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import {
  bookingView,
  cancellationDeadlineText,
  legacyCancellationNote,
  refundSummary,
} from './booking-vm';

/** Cờ huỷ SERVER trả ở `bookings.byCode` — mặc định: còn trong hạn, huỷ được. */
function cancellationOf(overrides: Partial<BookingCancellation> = {}): BookingCancellation {
  return {
    deadline: '2026-10-13',
    withinDeadline: true,
    refundAmount: '1200.00',
    canCancel: true,
    ...overrides,
  };
}

describe('bookingView', () => {
  it('PENDING → warning + [payNow, cancelPending]', () => {
    const view = bookingView(makeBooking({ status: 'PENDING', cancellation: null }));
    expect(view).toEqual({
      tone: 'warning',
      statusKey: 'PENDING',
      actions: ['payNow', 'cancelPending'],
    });
  });

  it('PAID + server cho huỷ → success + [cancelBooking]', () => {
    const view = bookingView(makeBooking({ status: 'PAID' }), cancellationOf());
    expect(view).toEqual({ tone: 'success', statusKey: 'PAID', actions: ['cancelBooking'] });
  });

  it('PAID đã quá hạn chót nhưng chưa khởi hành → vẫn có nút huỷ (huỷ không hoàn)', () => {
    // Quá hạn KHÔNG khoá nút: khách vẫn tự huỷ, chỉ là hoàn 0 (ADR-0041 §4).
    const view = bookingView(
      makeBooking({ status: 'PAID' }),
      cancellationOf({ withinDeadline: false, refundAmount: '0.00' }),
    );
    expect(view.actions).toEqual(['cancelBooking']);
  });

  it('PAID + server báo không huỷ online được (đã tới ngày khởi hành) → success + []', () => {
    const view = bookingView(
      makeBooking({ status: 'PAID' }),
      cancellationOf({ withinDeadline: false, refundAmount: '0.00', canCancel: false }),
    );
    expect(view).toEqual({ tone: 'success', statusKey: 'PAID', actions: [] });
  });

  it('PAID không kèm cờ huỷ (danh sách `mine`, hộ chiếu) → success + [], không tự đoán', () => {
    const view = bookingView(makeBooking({ status: 'PAID' }));
    expect(view).toEqual({ tone: 'success', statusKey: 'PAID', actions: [] });
  });

  it('PARTIALLY_REFUNDED + server cho huỷ → destructive + [cancelBooking]', () => {
    const view = bookingView(makeBooking({ status: 'PARTIALLY_REFUNDED' }), cancellationOf());
    expect(view).toEqual({
      tone: 'destructive',
      statusKey: 'PARTIALLY_REFUNDED',
      actions: ['cancelBooking'],
    });
  });

  it('REFUNDED → destructive + [] kể cả khi cờ nói huỷ được (spec §3.3: liên hệ)', () => {
    const view = bookingView(makeBooking({ status: 'REFUNDED' }), cancellationOf());
    expect(view).toEqual({ tone: 'destructive', statusKey: 'REFUNDED', actions: [] });
  });

  it('CANCELLED → muted + [] kể cả khi cờ nói huỷ được', () => {
    const view = bookingView(makeBooking({ status: 'CANCELLED' }), cancellationOf());
    expect(view).toEqual({ tone: 'muted', statusKey: 'CANCELLED', actions: [] });
  });
});

describe('cancellationDeadlineText', () => {
  it('server không gửi cờ huỷ → không có câu nào', () => {
    expect(cancellationDeadlineText(null)).toBeNull();
  });

  it('còn trong hạn → ngày chót cụ thể, giờ Việt Nam, và nói rõ sau đó không hoàn', () => {
    expect(cancellationDeadlineText(cancellationOf({ deadline: '2026-10-17' }))).toBe(
      'Free cancellation until 17 Oct, 11:59 pm Vietnam time. No refund after that.',
    );
  });

  it('quá hạn → câu hạn đã qua, vẫn in đúng ngày chót', () => {
    expect(
      cancellationDeadlineText(cancellationOf({ deadline: '2026-10-17', withinDeadline: false })),
    ).toBe('The free-cancellation deadline (17 Oct) has passed.');
  });
});

describe('legacyCancellationNote', () => {
  it('chưa từng gửi yêu cầu → null', () => {
    expect(legacyCancellationNote(makeBooking({ cancellationStatus: null }))).toBeNull();
  });

  it('REQUESTED của luồng duyệt cũ → kể lại ngày gửi, không hứa ai xem xét', () => {
    const b = makeBooking({
      cancellationStatus: 'REQUESTED',
      cancellationRequestedAt: '2026-09-03T08:15:00.000Z',
    });
    expect(legacyCancellationNote(b)).toBe('You sent a cancellation request on 3 Sep 2026.');
  });

  it('DENIED của luồng duyệt cũ → kể lại là đã bị từ chối', () => {
    const b = makeBooking({
      cancellationStatus: 'DENIED',
      cancellationRequestedAt: '2026-09-03T08:15:00.000Z',
    });
    expect(legacyCancellationNote(b)).toBe('Your cancellation request of 3 Sep 2026 was declined.');
  });

  it('REFUNDED (kết cục thường của mọi lần huỷ) → null', () => {
    const b = makeBooking({
      status: 'CANCELLED',
      cancellationStatus: 'REFUNDED',
      cancellationRequestedAt: '2026-09-03T08:15:00.000Z',
    });
    expect(legacyCancellationNote(b)).toBeNull();
  });
});

/**
 * Dòng tiền trên trang chi tiết booking của khách. Tới 04/09 trang ấy KHÔNG hề
 * nói số tiền đã hoàn — khách chỉ thấy chữ "Cancelled", còn con số nằm trong
 * hộp mail.
 */
describe('refundSummary', () => {
  it('chưa từng trả tiền → KHÔNG kể gì, kể cả khi đã huỷ', () => {
    // PENDING hết hạn hay khách tự huỷ trước khi trả là "chưa bao giờ có giao
    // dịch", không phải "hoàn 0 đồng".
    expect(refundSummary(makeBooking({ status: 'CANCELLED', paidAt: null }))).toBeNull();
  });

  it('đã trả tiền, chưa hoàn gì, chưa huỷ → KHÔNG kể gì', () => {
    expect(refundSummary(makeBooking({ status: 'PAID', refundedTotal: '0.00' }))).toBeNull();
  });

  it('huỷ mà KHÔNG hoàn đồng nào (huỷ quá hạn chót) → vẫn phải kể', () => {
    // Im lặng thì khách tự đoán rồi ngồi đợi một khoản không bao giờ tới.
    expect(refundSummary(makeBooking({ status: 'CANCELLED', refundedTotal: '0.00' }))).toEqual({
      kind: 'none',
    });
  });

  it('hoàn một phần → mang CẢ số đã hoàn lẫn tổng', () => {
    const summary = refundSummary(
      makeBooking({ status: 'CANCELLED', totalAmount: '29.00', refundedTotal: '10.00' }),
    );
    expect(summary).toEqual({ kind: 'partial', amount: '10.00', total: '29.00' });
  });

  it('hoàn đủ → `full`, không phải `partial`', () => {
    expect(
      refundSummary(
        makeBooking({ status: 'REFUNDED', totalAmount: '29.00', refundedTotal: '29.00' }),
      ),
    ).toEqual({ kind: 'full', amount: '29.00' });
  });

  it("'0' và '0.00' là cùng một số tiền — so bằng số, không bằng chuỗi", () => {
    expect(refundSummary(makeBooking({ status: 'CANCELLED', refundedTotal: '0' }))).toEqual({
      kind: 'none',
    });
  });

  it('lẻ cent vượt tổng vẫn là `full`, không rơi xuống `partial`', () => {
    expect(
      refundSummary(
        makeBooking({ status: 'REFUNDED', totalAmount: '29.00', refundedTotal: '29.01' }),
      ),
    ).toEqual({ kind: 'full', amount: '29.01' });
  });
});
