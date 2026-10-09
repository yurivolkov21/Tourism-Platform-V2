import { describe, expect, it } from 'vitest';
import { makeBooking, makeCancellation } from '@/test/fixtures/booking';
import { type JourneyView, journeyMilestones } from './booking-journey';

/**
 * Thanh hành trình (spec P7 §2.2). Ngày lấy từ bản vẽ `booking-detail.src.html`: đơn sắp đi
 * "Hanoi Heritage in a Day" đi 03/11, hôm nay 05/10 (còn 29 ngày, nhãn TODAY ở `left:43%`
 * của khung, vạch tô `width:33%`); đơn đã đi "Bà Nà Hills" đi 11/02. Ngày đặt và ngày trả
 * CỐ Ý khác nhau để bắt cách cài lấy nhầm mốc.
 */
const TODAY = '2026-10-05';

const UPCOMING_TRIP = makeBooking({
  status: 'PAID',
  createdAt: '2026-08-13T10:00:00.000Z',
  paidAt: '2026-08-14T03:05:00.000Z',
  departureStartDate: '2026-11-03',
  departureEndDate: '2026-11-03',
  cancellationDeadline: '2026-11-02',
  totalAmount: '147.00',
});
const UPCOMING = { ...UPCOMING_TRIP, cancellation: makeCancellation(UPCOMING_TRIP) };

/** [khoá, nhãn, dòng phụ, trạng thái] — so cả bốn cùng lúc. */
const rows = (view: JourneyView) =>
  view.milestones.map((milestone) => [
    milestone.key,
    milestone.label,
    milestone.detail,
    milestone.state,
  ]);

describe('journeyMilestones — đơn sắp đi (bản vẽ, hôm nay 05/10)', () => {
  it('năm mốc theo thứ tự; mốc chưa xong đầu tiên là "now"', () => {
    expect(rows(journeyMilestones(UPCOMING, TODAY))).toEqual([
      ['booked', 'Booked', '13 Aug 2026', 'done'],
      ['paid', 'Paid', '14 Aug 2026', 'done'],
      ['freeCancellation', 'Free cancellation', 'Until Mon 2 Nov', 'now'],
      ['departure', 'Departure', 'Tue 3 Nov', 'next'],
      ['tripEnds', 'Trip ends', 'Tue 3 Nov', 'next'],
    ]);
  });

  it('Today theo tỷ lệ ngày giữa Paid (14/08) và hạn huỷ (02/11): 52/80 của đoạn thứ hai', () => {
    const view = journeyMilestones(UPCOMING, TODAY);
    expect(view.variant).toBe('standard');
    // (1 + 52/80) / 4 đoạn = 41.25% vạch; bản vẽ: 10% + 80% × 41.25% = 43% khung.
    expect(view.today).toEqual({ percent: 41.25, before: 2 });
    expect(view.fillPercent).toBe(41.25);
    expect(view.chip).toEqual({ label: 'Departs in 29 days', tone: 'active' });
  });

  it('đúng ngày chót vẫn còn hạn (hết 23:59 giờ VN); chip "tomorrow"; Today kẹp ở 80% đoạn', () => {
    const view = journeyMilestones(UPCOMING, '2026-11-02');
    expect(view.milestones[2]).toEqual({
      key: 'freeCancellation',
      label: 'Free cancellation',
      detail: 'Until Mon 2 Nov',
      state: 'now',
    });
    expect(view.chip).toEqual({ label: 'Departs tomorrow', tone: 'active' });
    // Tỷ lệ 80/80 = 1, kẹp về 0.8 để nhãn không đè icon mốc: (1 + 0.8) / 4.
    expect(view.today).toEqual({ percent: 45, before: 2 });
  });

  it('đã qua hạn huỷ: mốc ghi "Ended", tính là xong, Today nằm giữa hạn huỷ và ngày đi', () => {
    const lateTrip = makeBooking({
      status: 'PAID',
      createdAt: '2026-09-30T02:00:00.000Z',
      paidAt: '2026-10-01T02:10:00.000Z',
      departureStartDate: '2026-11-10',
      departureEndDate: '2026-11-12',
      cancellationDeadline: '2026-11-07',
    });
    const late = {
      ...lateTrip,
      cancellation: makeCancellation(lateTrip, { withinDeadline: false }),
    };
    const view = journeyMilestones(late, '2026-11-08');
    expect(rows(view).slice(2)).toEqual([
      ['freeCancellation', 'Free cancellation', 'Ended 7 Nov', 'done'],
      ['departure', 'Departure', 'Tue 10 Nov', 'now'],
      ['tripEnds', 'Trip ends', 'Thu 12 Nov', 'next'],
    ]);
    // (2 + 1/3) / 4 = 58.33%.
    expect(view.today).toEqual({ percent: 58.33, before: 3 });
    expect(view.chip).toEqual({ label: 'Departs in 2 days', tone: 'active' });
  });

  it('đặt và trả lúc 03:00 giờ VN (20:00Z hôm trước): Booked, Paid và nhãn Today theo ngày VN', () => {
    const view = journeyMilestones(
      { ...UPCOMING, createdAt: '2026-08-12T20:00:00.000Z', paidAt: '2026-08-13T20:05:00.000Z' },
      TODAY,
    );
    expect(rows(view).slice(0, 2)).toEqual([
      ['booked', 'Booked', '13 Aug 2026', 'done'],
      ['paid', 'Paid', '14 Aug 2026', 'done'],
    ]);
    // Cùng ngày trả 14/08 (giờ VN) với đơn mẫu nên cùng tỷ lệ 52/80; lấy ngày UTC 13/08 là 53/81.
    expect(view.today).toEqual({ percent: 41.25, before: 2 });
  });

  it('PARTIALLY_REFUNDED là đơn còn hiệu lực: vẫn thanh thường, vẫn đếm ngày', () => {
    const view = journeyMilestones(
      { ...UPCOMING, status: 'PARTIALLY_REFUNDED', refundedTotal: '20.00' },
      TODAY,
    );
    expect(view.variant).toBe('standard');
    expect(view.chip).toEqual({ label: 'Departs in 29 days', tone: 'active' });
  });

  /**
   * REFUNDED không `cancelledAt` là hoàn thiện chí trọn — khách vẫn đi (ADR-0054 AMEND 1), nhưng
   * server không gửi thông tin huỷ: không còn gì để hoàn, không huỷ online được. So ngày chót với
   * hôm nay là hứa "Until Mon 2 Nov" sai (review P7 B2, B15); in "Ended 2 Nov" cho một ngày chưa
   * tới cũng sai — BỎ hẳn mốc, Today đứng giữa Paid và ngày đi.
   */
  it('hoàn thiện chí trọn còn sắp đi, server không gửi thông tin huỷ: không có mốc Free cancellation', () => {
    const view = journeyMilestones(
      { ...UPCOMING, status: 'REFUNDED', refundedTotal: '147.00', cancellation: null },
      TODAY,
    );
    expect(view.variant).toBe('standard');
    expect(rows(view)).toEqual([
      ['booked', 'Booked', '13 Aug 2026', 'done'],
      ['paid', 'Paid', '14 Aug 2026', 'done'],
      ['departure', 'Departure', 'Tue 3 Nov', 'now'],
      ['tripEnds', 'Trip ends', 'Tue 3 Nov', 'next'],
    ]);
    // Paid 14/08 → ngày đi 03/11 là 81 ngày, hôm nay 05/10 là ngày thứ 52: (1 + 52/81) / 3 đoạn.
    expect(view.today).toEqual({ percent: 54.73, before: 2 });
    expect(view.chip).toEqual({ label: 'Departs in 29 days', tone: 'active' });
  });

  it('hoàn thiện chí trọn, chuyến đã đi: bốn mốc đều xong, không mốc hạn huỷ', () => {
    const view = journeyMilestones(
      { ...UPCOMING, status: 'REFUNDED', refundedTotal: '147.00', cancellation: null },
      '2026-11-10',
    );
    expect(view.milestones.map((milestone) => [milestone.key, milestone.state])).toEqual([
      ['booked', 'done'],
      ['paid', 'done'],
      ['departure', 'done'],
      ['tripEnds', 'done'],
    ]);
    expect(view.chip).toEqual({ label: 'Completed', tone: 'done' });
  });
});

describe('journeyMilestones — đang đi (04–06/10)', () => {
  const ON_TOUR_TRIP = makeBooking({
    status: 'PAID',
    createdAt: '2026-08-31T02:00:00.000Z',
    paidAt: '2026-09-01T02:10:00.000Z',
    departureStartDate: '2026-10-04',
    departureEndDate: '2026-10-06',
    cancellationDeadline: '2026-10-01',
  });
  const ON_TOUR = {
    ...ON_TOUR_TRIP,
    cancellation: makeCancellation(ON_TOUR_TRIP, { withinDeadline: false, canCancel: false }),
  };

  it('giữa chuyến: "Departed" đã xong, "Trip ends" là mốc đang tới, chip ngày thứ mấy', () => {
    const view = journeyMilestones(ON_TOUR, TODAY);
    expect(rows(view).slice(2)).toEqual([
      ['freeCancellation', 'Free cancellation', 'Ended 1 Oct', 'done'],
      ['departure', 'Departed', 'Sun 4 Oct', 'done'],
      ['tripEnds', 'Trip ends', 'Tue 6 Oct', 'now'],
    ]);
    expect(view.today).toEqual({ percent: 87.5, before: 4 });
    expect(view.chip).toEqual({ label: 'Day 2 of 3', tone: 'active' });
  });

  it('ngày về: chuyến CHƯA kết thúc — "Trip ends" vẫn là mốc đang tới', () => {
    const view = journeyMilestones(ON_TOUR, '2026-10-06');
    expect(view.milestones[4]).toEqual({
      key: 'tripEnds',
      label: 'Trip ends',
      detail: 'Tue 6 Oct',
      state: 'now',
    });
    expect(view.chip).toEqual({ label: 'Day 3 of 3', tone: 'active' });
    expect(view.today).toEqual({ percent: 95, before: 4 });
  });

  it('ngày đi: "Departed" ngay từ hôm nay; Today kẹp ở 20% đoạn cuối', () => {
    const view = journeyMilestones(ON_TOUR, '2026-10-04');
    expect(view.milestones[3]?.label).toBe('Departed');
    expect(view.chip).toEqual({ label: 'Day 1 of 3', tone: 'active' });
    expect(view.today).toEqual({ percent: 80, before: 4 });
  });
});

describe('journeyMilestones — đã đi (bản vẽ: Bà Nà Hills 11/02)', () => {
  it('mọi mốc xong, nhãn sang thì quá khứ, không còn Today', () => {
    const travelledTrip = makeBooking({
      status: 'PAID',
      createdAt: '2026-02-09T08:00:00.000Z',
      paidAt: '2026-02-10T01:00:00.000Z',
      departureStartDate: '2026-02-11',
      departureEndDate: '2026-02-11',
      cancellationDeadline: '2026-02-10',
    });
    const travelled = {
      ...travelledTrip,
      cancellation: makeCancellation(travelledTrip, { withinDeadline: false, canCancel: false }),
    };
    const view = journeyMilestones(travelled, TODAY);
    expect(rows(view)).toEqual([
      ['booked', 'Booked', '9 Feb 2026', 'done'],
      ['paid', 'Paid', '10 Feb 2026', 'done'],
      ['freeCancellation', 'Free cancellation', 'Ended 10 Feb', 'done'],
      ['departure', 'Departed', 'Wed 11 Feb', 'done'],
      ['tripEnds', 'Trip ended', 'Wed 11 Feb', 'done'],
    ]);
    expect(view.today).toBeNull();
    expect(view.fillPercent).toBe(100);
    expect(view.chip).toEqual({ label: 'Completed', tone: 'done' });
  });
});

describe('journeyMilestones — chờ trả tiền', () => {
  const PENDING = makeBooking({
    status: 'PENDING',
    paidAt: null,
    createdAt: '2026-10-05T01:00:00.000Z',
    departureStartDate: '2026-10-20',
    departureEndDate: '2026-10-22',
    cancellationDeadline: '2026-10-17',
    cancellation: null,
  });

  it('mốc Paid ghi "Awaiting payment" và là mốc đang tới; Today giữa Booked và Paid', () => {
    const view = journeyMilestones(PENDING, TODAY);
    expect(rows(view)).toEqual([
      ['booked', 'Booked', '5 Oct 2026', 'done'],
      ['paid', 'Paid', 'Awaiting payment', 'now'],
      ['freeCancellation', 'Free cancellation', 'Until Sat 17 Oct', 'next'],
      ['departure', 'Departure', 'Tue 20 Oct', 'next'],
      ['tripEnds', 'Trip ends', 'Thu 22 Oct', 'next'],
    ]);
    // Paid chưa có ngày nên không chia theo tỷ lệ được — nhãn đứng giữa đoạn: 0.5 / 4.
    expect(view.today).toEqual({ percent: 12.5, before: 1 });
    expect(view.chip).toEqual({ label: 'Awaiting payment', tone: 'warning' });
  });

  // Server chỉ gửi cờ huỷ cho đơn đã trả; `awaiting_payment` CHÍNH là "chưa qua hạn chót" theo
  // luật giai đoạn chung, nên mốc vẫn mở mà web không tự so ngày.
  it('chờ trả (server chưa gửi cờ): đúng ngày chót vẫn là "Until"', () => {
    const view = journeyMilestones(PENDING, '2026-10-17');
    expect(view.milestones[2]).toEqual({
      key: 'freeCancellation',
      label: 'Free cancellation',
      detail: 'Until Sat 17 Oct',
      state: 'next',
    });
  });

  /**
   * Qua hạn chót mà chưa trả là `lapsed` (ADR-0054 §1, sửa sau review Phần A 06/10): cổng trả
   * tiền của API đóng cùng mốc, nên không còn thanh hành trình "đang chờ trả" nào để vẽ.
   */
  it('qua ngày chót mà chưa trả: biến thể lapsed, không chip, không Today', () => {
    const view = journeyMilestones(PENDING, '2026-10-18');
    expect(view.variant).toBe('lapsed');
    expect(view.chip).toBeNull();
    expect(view.today).toBeNull();
  });
});

describe('journeyMilestones — đã huỷ', () => {
  const CANCELLED = makeBooking({
    status: 'CANCELLED',
    createdAt: '2026-08-14T03:00:00.000Z',
    paidAt: '2026-08-15T03:05:00.000Z',
    cancelledAt: '2026-09-21T02:00:00.000Z',
    cancellationDecidedAt: '2026-09-20T08:00:00.000Z',
    cancellationRequestedAt: '2026-09-19T08:00:00.000Z',
    refundedTotal: '147.00',
    totalAmount: '147.00',
    // Ngày đi còn ở tương lai: đơn huỷ KHÔNG được thành "sắp đi" (spec P7, mục Đóng).
    departureStartDate: '2026-11-03',
    departureEndDate: '2026-11-03',
    cancellation: null,
  });

  it('bốn mốc Booked → Paid → Cancelled → Refund; ngày huỷ lấy `cancelledAt`', () => {
    const view = journeyMilestones(CANCELLED, TODAY);
    expect(view.variant).toBe('cancelled');
    expect(rows(view)).toEqual([
      ['booked', 'Booked', '14 Aug 2026', 'done'],
      ['paid', 'Paid', '15 Aug 2026', 'done'],
      ['cancelled', 'Cancelled', '21 Sep 2026', 'done'],
      ['refund', 'Refund', '$147.00', 'done'],
    ]);
    expect(view.today).toBeNull();
    expect(view.fillPercent).toBe(100);
    expect(view.chip).toEqual({ label: 'Cancelled', tone: 'muted' });
  });

  // Dữ liệu của luồng duyệt cũ có thể thiếu `cancelledAt`: chỉ yêu cầu huỷ ĐƯỢC DUYỆT mới cho
  // ngày huỷ. Ngày của yêu cầu bị từ chối hay còn treo in cạnh câu "đã bị từ chối" là nói ngược
  // (review P7 B3).
  it.each([
    [
      'thiếu `cancelledAt`, yêu cầu huỷ được duyệt: lấy ngày quyết',
      { cancelledAt: null, cancellationStatus: 'REFUNDED' },
      '20 Sep 2026',
    ],
    [
      'thiếu `cancelledAt`, yêu cầu huỷ bị từ chối: không lấy ngày quyết',
      { cancelledAt: null, cancellationStatus: 'DENIED' },
      null,
    ],
    [
      'thiếu `cancelledAt`, yêu cầu còn treo: ngày gửi không phải ngày huỷ',
      { cancelledAt: null, cancellationStatus: 'REQUESTED', cancellationDecidedAt: null },
      null,
    ],
    [
      'không còn mốc nào thì bỏ ngày',
      { cancelledAt: null, cancellationDecidedAt: null, cancellationRequestedAt: null },
      null,
    ],
  ] as const)('%s', (_, patch, detail) => {
    const view = journeyMilestones({ ...CANCELLED, ...patch }, TODAY);
    expect(view.milestones.find((milestone) => milestone.key === 'cancelled')?.detail).toBe(detail);
  });

  it('huỷ lúc 06:30 giờ VN ngày 01/11 (23:30Z ngày 31/10): mốc Cancelled ghi ngày VN', () => {
    const view = journeyMilestones(
      { ...CANCELLED, cancelledAt: '2026-10-31T23:30:00.000Z' },
      TODAY,
    );
    expect(view.milestones.find((milestone) => milestone.key === 'cancelled')?.detail).toBe(
      '1 Nov 2026',
    );
  });

  it.each([
    ['hoàn một phần: in cả hai số', '73.50', '$73.50 of $147.00'],
    ['huỷ mà không hoàn đồng nào cũng phải nói ra', '0.00', 'No refund due'],
  ])('%s', (_, refundedTotal, detail) => {
    const view = journeyMilestones({ ...CANCELLED, refundedTotal }, TODAY);
    expect(view.milestones.at(-1)).toEqual({
      key: 'refund',
      label: 'Refund',
      detail,
      state: 'done',
    });
  });

  it('đơn chưa từng thu tiền: không mốc Paid, không mốc Refund', () => {
    const view = journeyMilestones({ ...CANCELLED, paidAt: null, refundedTotal: '0.00' }, TODAY);
    expect(view.milestones.map((milestone) => milestone.key)).toEqual(['booked', 'cancelled']);
  });

  it('bị thu rồi hoàn tự động trước khi sang PAID (paidAt null): không mốc Paid, vẫn mốc Refund', () => {
    // Thua đua ghế hay chuyến đóng lúc capture về: không có ngày trả để in, nhưng khoản hoàn là
    // thật — khối Payment cùng trang in "Refunded −$147.00" (review P7 B1).
    const view = journeyMilestones({ ...CANCELLED, paidAt: null }, TODAY);
    expect(view.milestones.map(({ key, detail }) => [key, detail])).toEqual([
      ['booked', '14 Aug 2026'],
      ['cancelled', '21 Sep 2026'],
      ['refund', '$147.00'],
    ]);
  });

  it('REFUNDED còn ngày đi tương lai cũng là biến thể huỷ', () => {
    const view = journeyMilestones({ ...CANCELLED, status: 'REFUNDED' }, TODAY);
    expect(view.variant).toBe('cancelled');
    expect(view.chip).toEqual({ label: 'Cancelled', tone: 'muted' });
  });
});

describe('journeyMilestones — giữ chỗ qua hạn chót mà chưa trả', () => {
  /**
   * Mốc "Payment not completed" là mốc ĐANG ĐỨNG (`now`), không tô như đã xong: claim của API vẫn
   * nhận phiên mở trước hạn, trả xong đơn tự sang PAID (ADR-0054 AMEND 1 §4, review P7 S1).
   */
  it('hai mốc Booked → Payment not completed (mốc đang đứng); không chip, không Today', () => {
    const lapsed = makeBooking({
      status: 'PENDING',
      paidAt: null,
      createdAt: '2026-09-20T01:00:00.000Z',
      departureStartDate: '2026-10-01',
      departureEndDate: '2026-10-03',
      cancellation: null,
    });
    const view = journeyMilestones(lapsed, TODAY);
    expect(view.variant).toBe('lapsed');
    expect(rows(view)).toEqual([
      ['booked', 'Booked', '20 Sep 2026', 'done'],
      ['paymentNotCompleted', 'Payment not completed', null, 'now'],
    ]);
    expect(view.chip).toBeNull();
    expect(view.today).toBeNull();
    expect(view.fillPercent).toBe(100);
  });
});
