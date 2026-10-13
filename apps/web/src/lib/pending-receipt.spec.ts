import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { type PendingView, pendingView } from './pending-receipt';

const p = messages.pendingReceipt;
const r = messages.printDoc.receipt;
const j = messages.voucher.journal;
const s = messages.booking.success;

/** Đơn của bản thảo B1 (cùng đơn mẫu của `receipt-print.spec.ts`): đặt 17:59 giờ VN 9/10, Hội An 29/10. */
const pending = (overrides: Partial<BookingDetail> = {}) =>
  makeBooking({
    code: 'BK-EET0JBTH',
    status: 'PENDING',
    paidAt: null,
    createdAt: '2026-10-09T10:59:36.812Z',
    tourTitle: 'Hội An Old Town & Lantern Evening',
    tourSlug: 'hoi-an-lantern-evening',
    tourDestinations: [{ slug: 'hoi-an', name: 'Hội An', isPrimary: true }],
    departureStartDate: '2026-10-29',
    departureEndDate: '2026-10-29',
    unitPrice: '39.00',
    totalAmount: '39.00',
    numAdults: 1,
    numChildren: 0,
    contactName: 'Nora Dahl',
    contactEmail: 'nora.dahl@example.com',
    paymentProvider: 'STRIPE',
    ...overrides,
  });

const AT = new Date('2026-10-09T11:02:00.000Z'); // 18:02 giờ VN, ba phút sau khi đặt
const LATE = new Date('2026-10-09T15:00:00.000Z'); // 22:00 giờ VN: qua mốc 60 phút, cron chưa quét
const LAPSED = new Date('2026-10-29T03:00:00.000Z'); // ngày đi: đã qua hạn chót

const booked = { label: j.booked, detail: '9 Oct 2026, 17:59', done: true };
const pickup = { label: j.pickupDay, detail: '29 Oct 2026 · Hội An', done: false };

describe('pendingView — trang huỷ, đơn còn trả được (payable)', () => {
  const v = pendingView(pending(), AT, 'cancel');

  it('mộc chờ trả, tiêu đề "Payment cancelled", câu phụ có giờ nhả cụ thể', () => {
    expect(v.state).toBe('payable');
    expect(v.stamp).toEqual({
      label: messages.passportVisa.stampByStatus.PENDING,
      tone: 'warning',
    });
    expect(v.title).toBe(messages.booking.cancel.title);
    expect(v.subtitle).toBe(p.heldNote({ time: '18:59', day: 'Fri 9 Oct' }));
  });

  it('ảnh bìa: nơi, số ngày, ngày đi; ảnh không xám', () => {
    expect(v.place).toBe('Hội An');
    expect(v.tripDays).toBe(1);
    expect(v.departure).toBe('29 Oct 2026');
    expect(v.dimmed).toBe(false);
  });

  it('ô mốc là hạn trả, tông cảnh báo; ô cổng là nhãn cổng', () => {
    expect(v.timeCell).toEqual({
      title: `${r.payBy} 18:59 · Fri 9 Oct`,
      body: p.payByNote,
      warn: true,
    });
    expect(v.provider).toBe(messages.booking.form.stripe);
  });

  it('ô mã: chưa là voucher, có dòng ngày và số khách, hai câu điều kiện, dải Unpaid', () => {
    expect(v.codeLabel).toBe(p.codeLabel);
    expect(v.showMeta).toBe(true);
    expect(v.conditions).toEqual([s.stubNotYetVoucher, p.seatsNotHeld]);
    expect(v.band).toBe(r.unpaid);
  });

  it('tiền: dòng người lớn, "Total due", câu thuế, không dòng sau tổng', () => {
    expect(v.priceLines).toEqual([{ label: '1 adult', amount: '$39' }]);
    expect(v.total).toEqual({ label: p.totalDue, amount: '$39' });
    expect(v.settlement).toBeNull();
    expect(v.showTaxes).toBe(true);
  });

  it('nhật ký: Booked ✓ → Awaiting payment (Pay by) → Pickup day', () => {
    expect(v.journal).toEqual([
      booked,
      {
        label: messages.bookingDetail.journey.awaitingPayment,
        detail: `${r.payBy} 18:59 · Fri 9 Oct`,
        done: false,
      },
      pickup,
    ]);
  });

  it('hành động chính là Pay now', () => {
    expect(v.action).toEqual({ kind: 'payNow' });
  });
});

describe('pendingView — trang huỷ, qua mốc 60 phút mà cron chưa quét', () => {
  const v = pendingView(pending(), LATE, 'cancel');

  // API còn nhận trả (`reCheckout` chỉ cần PENDING và chuyến còn nhận đặt), nên vẫn có Pay now —
  // nhưng không còn giờ nào để hứa: không "stays open until 18:59" khi đã 22:00.
  it('vẫn payable, câu phụ không giờ, ô mốc là giờ đặt, nhật ký không hạn trả', () => {
    expect(v.state).toBe('payable');
    expect(v.subtitle).toBe(p.heldNote(null));
    expect(v.timeCell).toEqual({ title: j.booked, body: '9 Oct 2026, 17:59', warn: false });
    expect(v.journal[1]).toEqual({
      label: messages.bookingDetail.journey.awaitingPayment,
      detail: null,
      done: false,
    });
    expect(v.action).toEqual({ kind: 'payNow' });
  });
});

describe('pendingView — hạn trả kẹp ở hết ngày hạn chót', () => {
  // Đặt 23:30 giờ VN 28/10, ngày cuối nhận đặt của chuyến 29/10: sau 00:00 API thôi mở phiên mới.
  it('Pay by 23:59 ngày hạn chót, không phải 00:30 hôm sau', () => {
    const v = pendingView(
      pending({ createdAt: '2026-10-28T16:30:00.000Z' }),
      new Date('2026-10-28T16:40:00.000Z'),
      'cancel',
    );
    expect(v.timeCell.title).toBe(`${r.payBy} 23:59 · Wed 28 Oct`);
    expect(v.subtitle).toBe(p.heldNote({ time: '23:59', day: 'Wed 28 Oct' }));
  });
});

describe('pendingView — trang success, khách về trước webhook (confirming)', () => {
  const v = pendingView(pending(), AT, 'success');

  it('tiêu đề và câu phụ chờ xác nhận, dải Confirming, một câu điều kiện', () => {
    expect(v.state).toBe('confirming');
    expect(v.title).toBe(s.pendingTitle);
    expect(v.subtitle).toBe(s.pendingBody);
    expect(v.band).toBe(s.statusConfirming);
    expect(v.conditions).toEqual([s.stubNotYetVoucher]);
    expect(v.codeLabel).toBe(p.codeLabel);
    expect(v.total.label).toBe(p.totalDue);
  });

  it('ô mốc là giờ đặt; nhật ký: Booked ✓ → Confirming (cổng) → Pickup day', () => {
    expect(v.timeCell).toEqual({ title: j.booked, body: '9 Oct 2026, 17:59', warn: false });
    expect(v.journal).toEqual([
      booked,
      { label: s.statusConfirming, detail: messages.booking.form.stripe, done: false },
      pickup,
    ]);
  });

  it('hành động: dòng "Checking with …" theo cổng, kèm Refresh', () => {
    expect(v.action).toEqual({ kind: 'refresh', checking: p.checkingWith.STRIPE });
    const paypal = pendingView(pending({ paymentProvider: 'PAYPAL' }), AT, 'success');
    expect(paypal.action).toEqual({ kind: 'refresh', checking: p.checkingWith.PAYPAL });
  });

  // Phiên mở trước hạn chót vẫn được claim nhận (ADR-0054 AMEND 1 §4): khách vừa trả xong mà thấy
  // mộc NOT PAID cạnh "Confirming your payment…" là hai câu ngược nhau trên một màn.
  it('qua hạn chót vẫn confirming, mộc vẫn AWAITING PAYMENT', () => {
    const late = pendingView(pending(), LAPSED, 'success');
    expect(late.state).toBe('confirming');
    expect(late.stamp).toEqual({
      label: messages.passportVisa.stampByStatus.PENDING,
      tone: 'warning',
    });
  });
});

describe('pendingView — trang huỷ, đơn quá hạn chót (notPaid)', () => {
  const v = pendingView(pending(), LAPSED, 'cancel');

  it('mộc NOT PAID, câu kể như trang chi tiết đơn, ảnh xám', () => {
    expect(v.state).toBe('notPaid');
    expect(v.stamp).toEqual({ label: messages.passportVisa.stampLapsed, tone: 'muted' });
    expect(v.title).toBe(messages.bookingDetail.journey.paymentNotCompleted);
    expect(v.subtitle).toBe(
      `${messages.bookingDetail.closed.notPaidByDeadline} ${messages.bookingDetail.closed.finishOpenPayment}`,
    );
    expect(v.dimmed).toBe(true);
  });

  // Chưa phải kết cục (claim còn nhận phiên mở trước hạn): không hứa thành voucher, cũng không
  // khẳng định "no payment was taken" — cùng luật dòng xé của bản in.
  it('ô mã không câu điều kiện, không dòng ngày; dải Not paid; tổng là "Total"', () => {
    expect(v.codeLabel).toBe(messages.voucher.codeLabel);
    expect(v.showMeta).toBe(false);
    expect(v.conditions).toEqual([]);
    expect(v.band).toBe(messages.bookingDetail.ticket.notPaid);
    expect(v.total).toEqual({ label: messages.checkoutSummary.totalLabel, amount: '$39' });
    expect(v.settlement).toBeNull();
    expect(v.showTaxes).toBe(false);
  });

  it('nhật ký: Booked ✓ → Payment not completed (chưa tích); nút Book again', () => {
    expect(v.journal).toEqual([
      booked,
      { label: messages.bookingDetail.journey.paymentNotCompleted, detail: null, done: false },
    ]);
    expect(v.action).toEqual({ kind: 'bookAgain', href: '/tours/hoi-an-lantern-evening' });
  });
});

describe('pendingView — đơn chưa trả đã đóng (closed)', () => {
  const cancelled = pending({ status: 'CANCELLED', cancelledAt: '2026-10-09T12:05:00.000Z' });

  it('hai trang cùng một thẻ: mộc CANCELLED, tiêu đề đóng, câu settled', () => {
    for (const page of ['cancel', 'success'] as const) {
      const v = pendingView(cancelled, AT, page);
      expect(v.state).toBe('closed');
      expect(v.stamp).toEqual({
        label: messages.passportVisa.stampByStatus.CANCELLED,
        tone: 'muted',
      });
      expect(v.title).toBe(p.closedTitle);
      expect(v.subtitle).toBe(s.settledBody);
      expect(v.dimmed).toBe(true);
    }
  });

  it('ô mã nói thẳng đã đóng; dải Closed; tiền: "Total" rồi "Charged · $0"', () => {
    const v = pendingView(cancelled, AT, 'cancel');
    expect(v.codeLabel).toBe(messages.voucher.codeLabel);
    expect(v.showMeta).toBe(false);
    expect(v.conditions).toEqual([s.stubClosed]);
    expect(v.band).toBe(r.stampClosed);
    expect(v.total).toEqual({ label: messages.checkoutSummary.totalLabel, amount: '$39' });
    expect(v.settlement).toEqual({ label: p.charged, amount: '$0' });
    expect(v.showTaxes).toBe(false);
  });

  it('nhật ký: Booked ✓ → Cancelled ✓ (ngày huỷ giờ VN), không mốc Refund; nút Book again', () => {
    const v = pendingView(cancelled, AT, 'cancel');
    expect(v.timeCell).toEqual({ title: j.booked, body: '9 Oct 2026, 17:59', warn: false });
    expect(v.journal).toEqual([
      booked,
      { label: messages.bookingDetail.journey.cancelled, detail: '9 Oct 2026', done: true },
    ]);
    expect(v.action).toEqual({ kind: 'bookAgain', href: '/tours/hoi-an-lantern-evening' });
  });

  it('công ty huỷ chuyến: mốc kết cục nói "Departure cancelled" như trang chi tiết đơn', () => {
    const v = pendingView(
      pending({
        status: 'CANCELLED',
        departureCancelled: true,
        cancelledAt: '2026-10-09T12:05:00.000Z',
      }),
      AT,
      'cancel',
    );
    expect(v.journal[1]?.label).toBe(messages.bookingDetail.closed.departureCancelled);
  });

  // Thua đua ghế hay chuyến đóng lúc capture về: `paidAt` null mà sổ có khoản hoàn. "No payment
  // was taken" hay "Charged · $0" cạnh khoản vừa kể là đã hoàn là nói ngược (review P7 B1).
  it('bị thu rồi hoàn tự động: kể khoản hoàn, không "no payment", tiền đủ hai số lẻ', () => {
    const v = pendingView(
      pending({
        status: 'REFUNDED',
        refundedTotal: '39.00',
        cancelledAt: '2026-10-09T11:30:00.000Z',
      }),
      AT,
      'success',
    );
    expect(v.state).toBe('closed');
    expect(v.stamp.label).toBe(messages.passportVisa.stampByStatus.REFUNDED);
    expect(v.band).toBe(messages.booking.list.status.REFUNDED);
    expect(v.conditions).toEqual([messages.accountBookingDetail.terminalNote.REFUNDED]);
    expect(v.subtitle).toBe(
      `${messages.accountBookingDetail.refundLine.full('$39.00')} ${messages.accountBookingDetail.refundLine.timing}`,
    );
    expect(v.priceLines).toEqual([{ label: '1 adult', amount: '$39.00' }]);
    expect(v.total.amount).toBe('$39.00');
    expect(v.settlement).toEqual({
      label: messages.voucher.refunded,
      amount: messages.voucher.refundedAmount('$39.00'),
    });
    expect(v.journal.at(-1)).toEqual({
      label: j.refund,
      detail: messages.accountBookingDetail.refundLine.full('$39.00'),
      done: true,
    });
  });

  // Công ty huỷ chuyến ngay lúc khách đang ở cổng: đơn còn PENDING một nhịp trước khi lõi huỷ đóng
  // nó. Pay now lúc này chắc chắn bị từ chối (`DEPARTURE_NOT_AVAILABLE`), nên không mời bấm.
  it('đơn còn PENDING trên chuyến đã bị huỷ: trang huỷ dựng thẻ đóng, không Pay now', () => {
    const v = pendingView(pending({ departureCancelled: true }), AT, 'cancel');
    expect(v.state).toBe('closed');
    expect(v.action.kind).toBe('bookAgain');
  });
});

describe('pendingView — chữ không hứa giữ chỗ (invariant #1 của API)', () => {
  const views: PendingView[] = [
    pendingView(pending(), AT, 'cancel'),
    pendingView(pending(), LATE, 'cancel'),
    pendingView(pending(), AT, 'success'),
    pendingView(pending(), LAPSED, 'cancel'),
    pendingView(pending({ status: 'CANCELLED' }), AT, 'cancel'),
  ];
  /** Mọi chuỗi khách đọc được trong một view. */
  const strings = (v: PendingView): string[] =>
    JSON.stringify(v)
      .match(/"(?:[^"\\]|\\.)*"/g)
      ?.map((q) => JSON.parse(q) as string) ?? [];

  it('"held" chỉ xuất hiện trong "aren’t held"; không chữ "reserved"', () => {
    for (const v of views) {
      for (const text of strings(v)) {
        expect(text.replaceAll('aren’t held', '')).not.toMatch(/\bheld\b/i);
        expect(text).not.toMatch(/\breserv/i);
      }
    }
  });
});
