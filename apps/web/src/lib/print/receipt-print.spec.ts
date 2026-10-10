import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { receiptPrintView } from './receipt-print';

const r = messages.printDoc.receipt;

/** Đơn của bản thảo B1: đặt 17:59 giờ Việt Nam 9/10, Hội An một ngày 29/10, 1 người lớn × $39. */
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

describe('receiptPrintView — đơn đang chờ trả', () => {
  const v = receiptPrintView(pending(), AT);

  it('bìa và vé chờ', () => {
    expect(v.booked).toBe(r.booked('9 Oct 2026, 17:59'));
    expect(v.kicker).toBe('Hội An · 1 day · Thu 29 Oct 2026');
    expect(v.ticket.tone).toBe('pending');
    expect(v.ticket.bandStart).toBe(r.pendingBand);
    expect(v.ticket.stamp).toEqual({ label: r.stampPending, tone: 'pending' });
    expect(v.ticket.cells.at(-1)).toEqual({
      label: messages.booking.success.paymentLabel,
      value: messages.booking.form.stripe,
    });
  });

  it('cuống: chưa là voucher, không mã vạch, hạn trả cụ thể', () => {
    expect(v.ticket.stub).toEqual({
      band: r.unpaid,
      tag: r.notYetVoucher,
      amountLabel: null,
      amount: '$39',
      note: r.totalNote,
      barcode: null,
      footer: { label: r.payBy, value: '19:04 · 9 Oct' },
    });
    expect(v.tear).toBe(messages.booking.success.stubNotYetVoucher);
  });

  it('bảng tiền một dòng và tổng', () => {
    expect(v.line).toEqual({
      item: 'Hội An Old Town & Lantern Evening',
      sub: 'Thu 29 Oct 2026 · 1 day · Hội An',
      travellers: messages.accountBookings.travellers(1, 0),
      price: '$39',
      priceNote: messages.booking.success.perTraveller,
      amount: '$39',
    });
    expect(v.total).toEqual({
      label: messages.checkoutSummary.totalLabel,
      amount: '$39',
      note: messages.checkoutSummary.taxesNote,
    });
  });

  it('dải: How to pay kèm test mode, giờ nhả (giờ trước, ngày sau), mã và người đặt', () => {
    expect(v.band).toEqual([
      {
        heading: r.howToPay,
        strong: null,
        text: `${r.howToPayBody} ${messages.tourDetail.booking.testMode}`,
        reference: false,
      },
      {
        heading: r.ifUnpaid,
        strong: null,
        text: r.releasedAt('19:04, 9 Oct 2026'),
        reference: false,
      },
      {
        heading: messages.booking.success.refLabel,
        strong: 'BK-EET0JBTH',
        text: r.bookedBy('nora.dahl@example.com'),
        reference: true,
      },
    ]);
  });

  it('quá 65 phút mà cron chưa quét: vẫn đang chờ (API còn nhận trả — quyết định 18)', () => {
    const late = receiptPrintView(pending(), new Date('2026-10-09T15:00:00.000Z'));
    expect(late.ticket.tone).toBe('pending');
    expect(late.ticket.stub.footer).toEqual({ label: r.payBy, value: '19:04 · 9 Oct' });
  });
});

describe('receiptPrintView — đơn chưa trả đã đóng (G37)', () => {
  it('huỷ khi chưa trả: vé đóng, không hứa thành voucher, câu cancelled sẵn có', () => {
    const v = receiptPrintView(
      pending({ status: 'CANCELLED', cancelledAt: '2026-10-09T12:05:00.000Z' }),
      AT,
    );
    expect(v.ticket.tone).toBe('closed');
    expect(v.ticket.bandStart).toBe(r.closedBand);
    expect(v.ticket.stamp).toEqual({ label: r.stampClosed, tone: 'muted' });
    expect(v.ticket.stub.tag).toBeNull();
    expect(v.ticket.stub.footer).toEqual({ label: r.noPayment, value: null });
    expect(v.tear).toBe(messages.booking.success.stubClosed);
    expect(v.band.map((c) => c.heading)).toEqual([
      r.whatHappened,
      r.bookAgain,
      messages.booking.success.refLabel,
    ]);
    expect(v.band[0]?.text).toBe(messages.accountBookingDetail.terminalNote.CANCELLED);
    expect(v.band[1]?.text).toBe(r.bookAgainBody('hoi-an-lantern-evening'));
  });

  it('PENDING qua hạn chót đặt chỗ (lapsed): đóng, câu "not paid by the deadline"', () => {
    const v = receiptPrintView(pending(), new Date('2026-10-29T03:00:00.000Z'));
    expect(v.ticket.tone).toBe('closed');
    expect(v.band[0]?.text).toBe(messages.bookingDetail.closed.notPaidByDeadline);
  });

  it('bị thu rồi hoàn tự động (paidAt null): kể thêm khoản hoàn', () => {
    const v = receiptPrintView(
      pending({
        status: 'REFUNDED',
        refundedTotal: '39.00',
        cancelledAt: '2026-10-09T11:30:00.000Z',
      }),
      AT,
    );
    expect(v.ticket.tone).toBe('closed');
    expect(v.band[0]?.text).toBe(
      `${messages.accountBookingDetail.terminalNote.REFUNDED} ${messages.accountBookingDetail.refundLine.full('$39.00')}`,
    );
  });
});
