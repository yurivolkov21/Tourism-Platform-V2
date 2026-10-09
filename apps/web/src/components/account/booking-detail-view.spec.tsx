import { render, screen } from '@testing-library/react';
import type { BookingDetail } from '@tourism/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JourneyView } from '@/lib/booking-journey';
import type { GetReadyView } from '@/lib/get-ready';
import { makeBooking, makeCancellation, makeReview, makeTourData } from '@/test/fixtures/booking';
import { BookingDetailView } from './booking-detail-view';

// Mọi khối con đã có spec riêng — ở đây chỉ soi khung: thứ tự, khối nào theo giai đoạn nào.
vi.mock('@/components/account/booking-ticket', () => ({
  BookingTicket: () => <div data-testid="ticket" />,
}));
vi.mock('@/components/account/trip-journey', () => ({
  TripJourney: ({ journey }: { journey: JourneyView }) => (
    <div data-testid="journey">{journey.variant}</div>
  ),
}));
vi.mock('@/components/account/booking-details-panel', () => ({
  BookingDetailsPanel: ({
    phase,
    meetingPoint,
  }: {
    phase: string;
    meetingPoint: string | null;
  }) => (
    <div data-testid="details">
      {phase}|{meetingPoint ?? 'none'}
    </div>
  ),
}));
vi.mock('@/components/account/get-ready-panel', () => ({
  GetReadyPanel: ({ view, bookingCode }: { view: GetReadyView; bookingCode: string }) => (
    <div data-testid="panel">
      get-ready|{bookingCode}|{view.steps.length}
    </div>
  ),
}));
vi.mock('@/components/account/on-tour-panel', () => ({
  OnTourPanel: ({ today }: { today: string }) => <div data-testid="panel">on-tour|{today}</div>,
}));
// Khu review in ra slot nó NHẬN — để thấy trang tính `reviewSlot` một lần rồi đưa xuống.
vi.mock('@/components/account/review-panel', () => ({
  ReviewPanel: ({ slot }: { slot: string }) => <div data-testid="review">review|{slot}</div>,
  TripThanksPanel: () => <div data-testid="panel">thanks</div>,
}));
vi.mock('@/components/account/trip-closed-panel', () => ({
  TripClosedPanel: ({ kind }: { kind: string }) => <div data-testid="panel">closed|{kind}</div>,
}));
vi.mock('@/components/account/awaiting-payment-panel', () => ({
  AwaitingPaymentPanel: () => <div data-testid="panel">awaiting-payment</div>,
}));

const TODAY = '2026-10-05';

// Cổng review (`reviewSlot`) đọc ĐỒNG HỒ theo ngày UTC (cố ý — chép cổng của API), còn giai đoạn
// đọc `today` server truyền vào. Giả `Date` cho hai mốc khớp nhau như trong một request thật:
// 10:00 giờ VN ngày 05/10.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T03:00:00.000Z`));
});
afterEach(() => {
  vi.useRealTimers();
});

const TOUR = makeTourData({ meetingPoint: 'Hotel pickup' });
const at = (patch: Partial<BookingDetail>) => makeBooking({ code: 'BK-B6VCOQNW', ...patch });
/** Đơn sắp đi 03/11 (hạn chót 02/11) kèm cờ huỷ server còn trong hạn. */
const UPCOMING_TRIP = at({
  departureStartDate: '2026-11-03',
  departureEndDate: '2026-11-03',
  cancellationDeadline: '2026-11-02',
});
const UPCOMING = { ...UPCOMING_TRIP, cancellation: makeCancellation(UPCOMING_TRIP) };
/** Chuyến một ngày 11/02 — đã đi từ lâu theo cả ngày VN lẫn ngày UTC. */
const FEB_TRIP = { departureStartDate: '2026-02-11', departureEndDate: '2026-02-11' };

/** Cột phải theo thứ tự trên trang: khối của giai đoạn, rồi khu review nếu có. */
function column(container: HTMLElement): (string | null)[] {
  const wrapper = container.querySelector('[data-slot="phase-panel"]');
  return [...(wrapper?.children ?? [])].map((el) => el.textContent);
}

describe('BookingDetailView — khối cột phải theo giai đoạn (spec §2.5)', () => {
  it.each([
    [
      'awaiting_payment',
      at({
        status: 'PENDING',
        paidAt: null,
        departureStartDate: '2026-10-20',
        departureEndDate: '2026-10-22',
      }),
      ['awaiting-payment'],
    ],
    ['upcoming', UPCOMING, ['get-ready|BK-B6VCOQNW|4']],
    [
      'on_tour',
      at({ departureStartDate: '2026-10-04', departureEndDate: '2026-10-06' }),
      ['on-tour|2026-10-05'],
    ],
    ['travelled', at(FEB_TRIP), ['review|form']],
    [
      'cancelled',
      at({ status: 'CANCELLED', departureStartDate: '2026-11-03' }),
      ['closed|cancelled'],
    ],
    [
      'lapsed',
      at({
        status: 'PENDING',
        paidAt: null,
        departureStartDate: '2026-10-01',
        departureEndDate: '2026-10-03',
      }),
      ['closed|lapsed'],
    ],
  ])('%s', (_, booking, expected) => {
    const { container } = render(<BookingDetailView booking={booking} tour={TOUR} today={TODAY} />);
    expect(column(container)).toEqual(expected);
  });

  it('tour đã gỡ: Get ready chỉ còn một bước, cột trái không có điểm hẹn', () => {
    render(<BookingDetailView booking={UPCOMING} tour={null} today={TODAY} />);
    expect(screen.getByTestId('panel')).toHaveTextContent('get-ready|BK-B6VCOQNW|1');
    expect(screen.getByTestId('details')).toHaveTextContent('upcoming|none');
  });

  it('đang đi: cột trái có điểm hẹn của tour', () => {
    const booking = at({ departureStartDate: '2026-10-04', departureEndDate: '2026-10-06' });
    render(<BookingDetailView booking={booking} tour={TOUR} today={TODAY} />);
    expect(screen.getByTestId('details')).toHaveTextContent('on_tour|Hotel pickup');
  });

  // Dòng Meeting point chỉ ở hai giai đoạn đọc dữ liệu tour (`needsTourData`, review P7 B16).
  it.each([
    ['travelled', at(FEB_TRIP)],
    ['cancelled', at({ status: 'CANCELLED', departureStartDate: '2026-11-03' })],
    [
      'awaiting_payment',
      at({
        status: 'PENDING',
        paidAt: null,
        departureStartDate: '2026-10-20',
        departureEndDate: '2026-10-22',
      }),
    ],
  ])('%s: cột trái không có điểm hẹn dù có dữ liệu tour', (phase, booking) => {
    render(<BookingDetailView booking={booking} tour={TOUR} today={TODAY} />);
    expect(screen.getByTestId('details')).toHaveTextContent(`${phase}|none`);
  });
});

/**
 * Khu review theo CỔNG của API (`reviewSlot`), không theo giai đoạn (ADR-0054 AMEND 1 §5): cổng
 * nhận review từ 07:00 giờ VN của chính ngày về, và vẫn cho sửa, rút review của đơn đã bị hoàn
 * hay huỷ. Trước đó khu review chỉ dựng ở `travelled` (review P7 B6, B2).
 */
describe('BookingDetailView — khu review theo cổng `reviewSlot`, ở mọi giai đoạn', () => {
  const RETURN_DAY_TRIP = at({ departureStartDate: '2026-11-03', departureEndDate: '2026-11-05' });

  it('ngày về, 20:00 giờ VN: cổng đã mở từ 07:00 — Today’s plan rồi khu review bên dưới', () => {
    vi.setSystemTime(new Date('2026-11-05T13:00:00.000Z'));
    const { container } = render(
      <BookingDetailView booking={RETURN_DAY_TRIP} tour={TOUR} today="2026-11-05" />,
    );
    expect(column(container)).toEqual(['on-tour|2026-11-05', 'review|form']);
  });

  it('ngày về, 06:30 giờ VN (ngày UTC còn là hôm trước): cổng chưa mở — chưa có khu review', () => {
    vi.setSystemTime(new Date('2026-11-04T23:30:00.000Z'));
    const { container } = render(
      <BookingDetailView booking={RETURN_DAY_TRIP} tour={TOUR} today="2026-11-05" />,
    );
    expect(column(container)).toEqual(['on-tour|2026-11-05']);
  });

  it('đơn đã có review rồi bị huỷ có hoàn: khối đóng, khu review bên dưới — còn sửa, rút được', () => {
    const review = makeReview({ isApproved: true, moderationState: 'approved' });
    const booking = at({
      ...FEB_TRIP,
      status: 'REFUNDED',
      cancelledAt: '2026-02-20T02:00:00.000Z',
      refundedTotal: '10.00',
      review,
      reviewedAt: review.createdAt,
    });
    const { container } = render(<BookingDetailView booking={booking} tour={TOUR} today={TODAY} />);
    expect(column(container)).toEqual(['closed|cancelled', 'review|approved']);
  });

  it('hoàn thiện chí trọn sau chuyến (REFUNDED, không cancelledAt) có review: khu review, không lời cảm ơn', () => {
    const review = makeReview({ isApproved: true, moderationState: 'approved' });
    const booking = at({
      ...FEB_TRIP,
      status: 'REFUNDED',
      refundedTotal: '10.00',
      review,
      reviewedAt: review.createdAt,
    });
    const { container } = render(<BookingDetailView booking={booking} tour={TOUR} today={TODAY} />);
    expect(column(container)).toEqual(['review|approved']);
  });

  it('đã đi mà không viết review được (hoàn một phần, chưa review): lời cảm ơn thay cột trống', () => {
    const booking = at({ ...FEB_TRIP, status: 'PARTIALLY_REFUNDED', refundedTotal: '2.00' });
    const { container } = render(<BookingDetailView booking={booking} tour={TOUR} today={TODAY} />);
    expect(column(container)).toEqual(['thanks']);
  });

  it('đơn sắp đi đã trả (slot `tooEarly`): không khu review — chân Get ready nói ngày mở', () => {
    render(<BookingDetailView booking={UPCOMING} tour={TOUR} today={TODAY} />);
    expect(screen.queryByTestId('review')).toBeNull();
  });
});

describe('BookingDetailView — khung (spec §5.1)', () => {
  it('vé → hành trình → hai cột; cột trái nhận giai đoạn và điểm hẹn của tour', () => {
    render(<BookingDetailView booking={UPCOMING} tour={TOUR} today={TODAY} />);
    const ticket = screen.getByTestId('ticket');
    const journey = screen.getByTestId('journey');
    const details = screen.getByTestId('details');
    expect(ticket.compareDocumentPosition(journey) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      journey.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(journey).toHaveTextContent('standard');
    expect(details).toHaveTextContent('upcoming|Hotel pickup');
  });

  it('DOM: thông tin đơn trước khối giai đoạn; CSS đưa khối giai đoạn lên trước ở điện thoại', () => {
    render(<BookingDetailView booking={UPCOMING} tour={TOUR} today={TODAY} />);
    const details = screen.getByTestId('details');
    const wrapper = screen.getByTestId('panel').closest('[data-slot="phase-panel"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveClass('order-first', 'lg:order-none');
    expect(
      details.compareDocumentPosition(wrapper as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  // "Không có h1 — hero giữ h1 duy nhất" kiểm trên render THẬT ở
  // `booking-detail-view-headings.spec.tsx`: ở đây mọi khối con là `<div>` mock nên không thể đỏ.
});
