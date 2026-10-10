import type { BookingDetail, MediaItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import type { BookingTourData } from '@/lib/get-ready';
import { voucherView } from '@/lib/voucher';
import { makeTourData } from '@/test/fixtures/booking';
import {
  CANCELLED_AFTER_PAYING,
  THREE_DAY_TRIP,
  VOUCHER_NOW,
  voucherBooking,
  voucherNowOn,
} from '@/test/fixtures/voucher';
import { voucherPrintView } from './voucher-print';

const p = messages.printDoc.voucher;

/** Đơn của `voucherBooking` (Hà Nội một ngày 3/11, 3 người lớn × $49, PayPal 18/10) → bản in. */
function printOf(
  overrides: Partial<BookingDetail> = {},
  tour: BookingTourData | null = makeTourData(),
  now: Date = VOUCHER_NOW,
) {
  const booking = voucherBooking(overrides);
  const view = voucherView(booking, now);
  if (view === null) throw new Error('fixture phải là đơn đã trả');
  return voucherPrintView(booking, view, tour, now);
}

const DAY_ONE = makeTourData({
  itinerary: [
    {
      dayNumber: 1,
      title: 'Temples and the Old Quarter',
      description: '08:00 — Hotel pickup\n09:30 — Temple of Literature\nFree time by the lake',
    },
  ],
  included: ['English-speaking guide', 'Entrance tickets'],
  excluded: ['Tips'],
});

describe('voucherPrintView — sắp đi, chuyến một ngày', () => {
  const v = printOf({}, DAY_ONE);

  it('bìa: mốc trả, kicker có thứ ngày năm, tên tour', () => {
    expect(v.issued).toBe(p.issued('18 Oct 2026'));
    expect(v.kicker).toBe('Hà Nội · 1 day · Tue 3 Nov 2026');
    expect(v.title).toBe('Hanoi Heritage in a Day');
    expect(v.longTitle).toBe(false);
    expect(v.photo).toBeNull();
  });

  it('vé: giờ hẹn ở ngày đi, đường nối, mộc teal, cuống có mã vạch', () => {
    expect(v.ticket.tone).toBe('active');
    expect(v.ticket.bandStart).toBe(messages.passportVisa.kicker);
    expect(v.ticket.bandEnd).toBe('BK-B6VCOQNW');
    expect(v.ticket.departs).toEqual({ big: '3 NOV', sub: 'Tue · 2026 · meet 08:00' });
    expect(v.ticket.returns).toEqual({ big: '3 NOV', sub: 'Tue · 2026' });
    expect(v.ticket.routeLine).toBe('1 day · Hà Nội');
    expect(v.ticket.stamp).toEqual({
      label: messages.passportVisa.stampByStatus.PAID,
      tone: 'confirmed',
    });
    expect(v.ticket.cells.at(-1)).toEqual({
      label: messages.bookingDetail.ticket.paidWith,
      value: messages.booking.form.paypal,
    });
    expect(v.ticket.stub).toEqual({
      band: messages.bookingDetail.ticket.admit(3),
      tag: null,
      amountLabel: messages.booking.success.totalLabel,
      amount: '$147',
      note: messages.bookingDetail.ticket.taxesIncluded,
      barcode: 'BK-B6VCOQNW',
      footer: null,
    });
    expect(v.ticket.notice).toBeNull();
    expect(v.tear).toBe(p.tear);
  });

  it('lịch trình ngày 1: tách giờ, dòng không giờ in nguyên văn; Included và Not included', () => {
    expect(v.day).toEqual({
      heading: p.yourDay('Temples and the Old Quarter'),
      stops: [
        { time: '08:00', text: 'Hotel pickup' },
        { time: '09:30', text: 'Temple of Literature' },
        { time: null, text: 'Free time by the lake' },
      ],
      more: null,
    });
    expect(v.included).toEqual({
      items: ['English-speaking guide', 'Entrance tickets'],
      more: null,
    });
    expect(v.excluded).toEqual({ items: ['Tips'], more: null });
  });

  it('dải cuối: Where to meet có giờ, Cancellation, Payment kèm test mode', () => {
    expect(v.band.map((c) => c.heading)).toEqual([
      p.whereToMeet,
      messages.bookingDetail.details.cancellation,
      messages.booking.success.paymentLabel,
    ]);
    expect(v.band[0]).toEqual({
      heading: p.whereToMeet,
      strong: DAY_ONE.meetingPoint,
      text: p.meetGuide('08:00'),
      reference: false,
    });
    expect(v.band[2]?.text).toBe(
      `${p.paymentLine('$147.00', messages.booking.form.paypal, '18 Oct 2026')} ${messages.tourDetail.booking.testMode}`,
    );
  });
});

describe('voucherPrintView — lịch trình dài', () => {
  const days = (n: number, description: string | null = null) =>
    makeTourData({
      itinerary: Array.from({ length: n }, (_, i) => ({
        dayNumber: i + 1,
        title: `Stop ${i + 1}`,
        description,
      })),
    });

  it('chuyến nhiều ngày: một dòng mỗi ngày; kicker vẫn là ngày đi có thứ', () => {
    const v = printOf(THREE_DAY_TRIP, days(3));
    expect(v.kicker).toBe('Hà Nội · 3 days · Tue 3 Nov 2026');
    expect(v.day?.heading).toBe(p.yourTrip('3 days'));
    expect(v.day?.stops).toEqual([
      { time: null, text: p.dayLine(1, 'Stop 1') },
      { time: null, text: p.dayLine(2, 'Stop 2') },
      { time: null, text: p.dayLine(3, 'Stop 3') },
    ]);
  });

  it('8 ngày in đủ 8 dòng; 12 ngày in 7 dòng và "+5 more days"', () => {
    const eight = printOf(
      { departureStartDate: '2026-11-03', departureEndDate: '2026-11-10' },
      days(8),
    );
    expect(eight.day?.stops).toHaveLength(8);
    expect(eight.day?.more).toBeNull();
    const twelve = printOf(
      { departureStartDate: '2026-11-03', departureEndDate: '2026-11-14' },
      days(12),
    );
    expect(twelve.day?.stops).toHaveLength(7);
    expect(twelve.day?.more).toBe(p.moreDays(5, 'hanoi-heritage-day'));
  });

  it('một ngày 12 mục giờ: 9 mục và "…"', () => {
    const description = Array.from(
      { length: 12 },
      (_, i) => `${String(8 + i).padStart(2, '0')}:00 — Stop ${i}`,
    ).join('\n');
    const v = printOf(
      {},
      makeTourData({ itinerary: [{ dayNumber: 1, title: 'Long day', description }] }),
    );
    expect(v.day?.stops).toHaveLength(9);
    expect(v.day?.more).toBe('…');
  });

  it('7 mục gồm: 5 mục và "+2 more"', () => {
    const v = printOf({}, makeTourData({ included: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }));
    expect(v.included).toEqual({ items: ['a', 'b', 'c', 'd', 'e'], more: p.moreItems(2) });
  });

  it('tên tour dài hơn 56 ký tự thì cỡ nhỏ', () => {
    expect(printOf({ tourTitle: 'x'.repeat(56) }).longTitle).toBe(false);
    expect(printOf({ tourTitle: 'x'.repeat(57) }).longTitle).toBe(true);
  });
});

describe('voucherPrintView — theo giai đoạn', () => {
  it('đang đi: lịch trình là ngày đang đi, vẫn có mã vạch', () => {
    const tour = makeTourData({
      itinerary: [1, 2, 3].map((n) => ({
        dayNumber: n,
        title: `Stop ${n}`,
        description: `09:00 — Day ${n}`,
      })),
    });
    const v = printOf(THREE_DAY_TRIP, tour, voucherNowOn('2026-11-04'));
    expect(v.day).toEqual({
      heading: p.yourDay('Stop 2'),
      stops: [{ time: '09:00', text: 'Day 2' }],
      more: null,
    });
    expect(v.ticket.stub.barcode).toBe('BK-B6VCOQNW');
  });

  it('đã đi: không mã vạch, dòng xé, lịch trình, mục gồm; dải Payment và Booking reference', () => {
    const v = printOf({}, DAY_ONE, voucherNowOn('2026-11-10'));
    expect(v.ticket.stub.barcode).toBeNull();
    expect(v.tear).toBeNull();
    expect(v.day).toBeNull();
    expect(v.included).toBeNull();
    expect(v.excluded).toBeNull();
    expect(v.ticket.departs.sub).toBe('Tue · 2026');
    expect(v.band.map((c) => c.heading)).toEqual([
      messages.booking.success.paymentLabel,
      messages.booking.success.refLabel,
    ]);
    expect(v.band[1]).toEqual({
      heading: messages.booking.success.refLabel,
      strong: 'BK-B6VCOQNW',
      text: null,
      reference: true,
    });
  });

  it('đã huỷ: vé tông closed, thân vé là dải hết hiệu lực; dải Refund và Payment', () => {
    const v = printOf(CANCELLED_AFTER_PAYING, DAY_ONE);
    expect(v.ticket.tone).toBe('closed');
    expect(v.ticket.notice).toBe(messages.voucher.cancelledNotice);
    expect(v.ticket.stub.barcode).toBeNull();
    expect(v.tear).toBeNull();
    expect(v.day).toBeNull();
    expect(v.band.map((c) => c.heading)).toEqual([
      messages.voucher.journal.refund,
      messages.booking.success.paymentLabel,
    ]);
    expect(v.band[0]?.text).toBe(messages.accountBookingDetail.refundLine.none);
  });
});

describe('voucherPrintView — thiếu dữ liệu', () => {
  it('không có tour: bỏ lịch trình và mục gồm, Where to meet dùng câu dự phòng sẵn có', () => {
    const v = printOf({}, null);
    expect(v.day).toBeNull();
    expect(v.included).toBeNull();
    expect(v.excluded).toBeNull();
    expect(v.ticket.departs.sub).toBe('Tue · 2026');
    expect(v.band[0]).toEqual({
      heading: p.whereToMeet,
      strong: null,
      text: `${messages.voucher.meetingPointContact} ${messages.voucher.meetingPointFallback}`,
      reference: false,
    });
  });

  it('mục đầu ngày 1 không có giờ: không "meet", Where to meet chỉ có điểm hẹn', () => {
    const v = printOf(
      {},
      makeTourData({
        itinerary: [{ dayNumber: 1, title: 'Free day', description: 'Explore at your pace' }],
      }),
    );
    expect(v.ticket.departs.sub).toBe('Tue · 2026');
    expect(v.band[0]?.strong).toBe(makeTourData().meetingPoint);
    expect(v.band[0]?.text).toBeNull();
  });

  it('có ảnh tour thì bìa có ảnh rộng 1400', () => {
    const image: MediaItem = {
      publicId: 'tourism/catalog/tour/hanoi/hero',
      url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/tourism/catalog/tour/hanoi/hero',
      type: 'IMAGE',
      role: 'hero',
      posterUrl: null,
      width: 1600,
      height: 900,
      alt: 'Temple of Literature',
      sortOrder: 0,
      author: null,
      license: null,
      licenseUrl: null,
      sourceUrl: null,
    };
    expect(printOf({ tourImage: image }).photo).toEqual({
      url: expect.stringContaining('w_1400'),
      alt: 'Temple of Literature',
    });
  });
});
