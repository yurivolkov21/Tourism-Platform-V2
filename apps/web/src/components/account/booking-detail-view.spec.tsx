import { render, screen } from '@testing-library/react';
import type { BookingDetail } from '@tourism/contract';
import { describe, expect, it, vi } from 'vitest';
import type { JourneyView } from '@/lib/booking-journey';
import type { GetReadyView } from '@/lib/get-ready';
import { makeBooking, makeCancellation, makeTourData } from '@/test/fixtures/booking';
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
vi.mock('@/components/account/review-panel', () => ({
  ReviewPanel: () => <div data-testid="panel">review</div>,
}));
vi.mock('@/components/account/trip-closed-panel', () => ({
  TripClosedPanel: ({ kind }: { kind: string }) => <div data-testid="panel">closed|{kind}</div>,
}));
vi.mock('@/components/account/awaiting-payment-panel', () => ({
  AwaitingPaymentPanel: () => <div data-testid="panel">awaiting-payment</div>,
}));

const TODAY = '2026-10-05';
const TOUR = makeTourData({ meetingPoint: 'Hotel pickup' });
const at = (patch: Partial<BookingDetail>) => makeBooking({ code: 'BK-B6VCOQNW', ...patch });
/** Đơn sắp đi 03/11 (hạn chót 02/11) kèm cờ huỷ server còn trong hạn. */
const UPCOMING_TRIP = at({
  departureStartDate: '2026-11-03',
  departureEndDate: '2026-11-03',
  cancellationDeadline: '2026-11-02',
});
const UPCOMING = { ...UPCOMING_TRIP, cancellation: makeCancellation(UPCOMING_TRIP) };

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
      'awaiting-payment',
    ],
    ['upcoming', UPCOMING, 'get-ready|BK-B6VCOQNW|4'],
    [
      'on_tour',
      at({ departureStartDate: '2026-10-04', departureEndDate: '2026-10-06' }),
      'on-tour|2026-10-05',
    ],
    [
      'travelled',
      at({ departureStartDate: '2026-02-11', departureEndDate: '2026-02-11' }),
      'review',
    ],
    [
      'cancelled',
      at({ status: 'CANCELLED', departureStartDate: '2026-11-03' }),
      'closed|cancelled',
    ],
    [
      'lapsed',
      at({
        status: 'PENDING',
        paidAt: null,
        departureStartDate: '2026-10-01',
        departureEndDate: '2026-10-03',
      }),
      'closed|lapsed',
    ],
  ])('%s', (_, booking, expected) => {
    render(<BookingDetailView booking={booking} tour={TOUR} today={TODAY} />);
    expect(screen.getByTestId('panel')).toHaveTextContent(expected);
  });

  it('tour đã gỡ: Get ready chỉ còn một bước, cột trái không có điểm hẹn', () => {
    render(<BookingDetailView booking={UPCOMING} tour={null} today={TODAY} />);
    expect(screen.getByTestId('panel')).toHaveTextContent('get-ready|BK-B6VCOQNW|1');
    expect(screen.getByTestId('details')).toHaveTextContent('upcoming|none');
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

  it('không có h1 — hero của trang giữ h1 duy nhất', () => {
    const { container } = render(
      <BookingDetailView booking={UPCOMING} tour={TOUR} today={TODAY} />,
    );
    expect(container.querySelectorAll('h1')).toHaveLength(0);
  });
});
