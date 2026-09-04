import { describe, expect, it } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import {
  bookingView,
  type CancellationView,
  refundSummary,
  toCancellationView,
} from './booking-vm';

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

/**
 * Dòng tiền trên trang chi tiết booking của khách. Tới 04/09 trang ấy KHÔNG hề
 * nói số tiền đã hoàn — sau một lần duyệt huỷ hoàn một phần, khách chỉ thấy
 * chữ "Cancelled", còn con số nằm trong hộp mail.
 */
describe('refundSummary', () => {
  it('chưa từng trả tiền → KHÔNG kể gì, kể cả khi đã huỷ', () => {
    // PENDING hết hạn hay khách tự huỷ trước khi trả là "chưa bao giờ có giao
    // dịch", không phải "hoàn 0 đồng" — nói về hoàn tiền ở đây là bịa ra một
    // giao dịch chưa từng có.
    expect(refundSummary(makeBooking({ status: 'CANCELLED', paidAt: null }))).toBeNull();
  });

  it('đã trả tiền, chưa hoàn gì, chưa huỷ → KHÔNG kể gì', () => {
    expect(refundSummary(makeBooking({ status: 'PAID', refundedTotal: '0.00' }))).toBeNull();
  });

  it('huỷ mà KHÔNG hoàn đồng nào → vẫn phải kể (bậc 0% ở ca huỷ sát ngày)', () => {
    // Im lặng thì khách tự đoán rồi ngồi đợi một khoản không bao giờ tới —
    // cùng lý do với câu tương ứng trong mail duyệt huỷ.
    expect(refundSummary(makeBooking({ status: 'CANCELLED', refundedTotal: '0.00' }))).toEqual({
      kind: 'none',
    });
  });

  it('hoàn một phần → mang CẢ số đã hoàn lẫn tổng', () => {
    // Chỉ in số đã hoàn thì khách dễ tưởng đó là toàn bộ.
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
    // Sổ rỗng trả '0', API trả '0.00'; cả hai đều xuất hiện thật.
    expect(refundSummary(makeBooking({ status: 'CANCELLED', refundedTotal: '0' }))).toEqual({
      kind: 'none',
    });
  });

  it('lẻ cent vượt tổng vẫn là `full`, không rơi xuống `partial`', () => {
    // Trần thật do trigger DB canh; một ca làm tròn không được biến "đã hoàn
    // đủ" thành "hoàn một phần" trên mặt khách.
    expect(
      refundSummary(
        makeBooking({ status: 'REFUNDED', totalAmount: '29.00', refundedTotal: '29.01' }),
      ),
    ).toEqual({ kind: 'full', amount: '29.01' });
  });
});
