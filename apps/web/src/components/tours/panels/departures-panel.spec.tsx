import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  DepartureSelectionProvider,
  useDepartureSelection,
} from '@/components/tours/departure-selection';
import type { TourDetailVM } from '@/lib/api/tours';
import { DeparturesPanel } from './departures-panel';

function dep(id: string, startDate: string, endDate: string, seatsLeft: number, price: string) {
  return { id, startDate, endDate, seatsLeft, effectivePrice: price, compareAtPrice: null };
}

const DEPARTURES = [
  dep('d1', '2026-09-14', '2026-09-17', 6, '329.00'),
  dep('d2', '2026-09-28', '2026-10-01', 9, '329.00'),
  dep('d3', '2026-10-12', '2026-10-15', 3, '349.00'),
  dep('d4', '2026-10-26', '2026-10-29', 8, '329.00'),
  dep('d5', '2026-11-09', '2026-11-12', 10, '369.00'),
  dep('d6', '2026-11-23', '2026-11-26', 0, '329.00'),
  dep('d7', '2026-12-07', '2026-12-10', 4, '309.00'),
  dep('d8', '2026-12-21', '2026-12-24', 3, '339.00'),
] as unknown as TourDetailVM['departures'];

const TOUR = {
  basePrice: '329.00',
  currency: 'USD',
  maxGroupSize: 10,
  departures: DEPARTURES,
  policies: [
    { kind: 'CANCELLATION', title: 'Cancellation', body: 'Free cancellation up to 24 hours.' },
    { kind: 'BOOKING', title: 'Booking & payment', body: 'A 30% deposit secures your seat.' },
  ],
} as unknown as TourDetailVM;

function wrap(tour: TourDetailVM) {
  return render(
    <DepartureSelectionProvider departures={tour.departures}>
      <DeparturesPanel tour={tour} />
    </DepartureSelectionProvider>,
  );
}

describe('DeparturesPanel', () => {
  it('bốn ô thống kê đều dẫn xuất từ chính mảng departures', () => {
    wrap(TOUR);
    expect(screen.getByText('14 Sep 2026')).toBeInTheDocument(); // đợt kế tiếp
    expect(screen.getByText('6 of 10 seats left')).toBeInTheDocument();
    expect(screen.getByText('7 / 8')).toBeInTheDocument(); // còn mở / tổng
    expect(screen.getByText('across 4 months')).toBeInTheDocument();
    expect(screen.getByText('$309–$369')).toBeInTheDocument();
    expect(screen.getByText('43')).toBeInTheDocument(); // tổng ghế còn
  });

  it('KHÔNG lặp lại danh sách ngày — đó là việc của modal', () => {
    wrap(TOUR);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText('28 Sep 2026')).toBeNull();
  });

  it('mỗi tháng một hàng, số khối bằng số đợt của tháng đó', () => {
    wrap(TOUR);
    expect(screen.getByText('September 2026')).toBeInTheDocument();
    expect(screen.getByText('December 2026')).toBeInTheDocument();
    const september = screen.getByTestId('month-2026-09');
    expect(september.querySelectorAll('[data-departure-block]')).toHaveLength(2);
    expect(september).toHaveTextContent('15 seats left');
  });

  it('gắn nhãn mùa khi giá tháng lệch giá gốc, im lặng khi bằng', () => {
    wrap(TOUR);
    // Tháng 10 có đợt 349 > 329 → cao mùa; tháng 12 có đợt 309 < 329 → thấp mùa.
    expect(screen.getByTestId('month-2026-10')).toHaveTextContent('peak');
    expect(screen.getByTestId('month-2026-12')).toHaveTextContent('low season');
    expect(screen.getByTestId('month-2026-09')).not.toHaveTextContent(/peak|low season/);
  });

  it('tour không có đợt nào thì hiện trạng thái rỗng, không hiện lịch trống', () => {
    wrap({ ...TOUR, departures: [] } as unknown as TourDetailVM);
    expect(screen.getByText(/no upcoming departures/i)).toBeInTheDocument();
    expect(screen.queryByText(/availability by month/i)).toBeNull();
  });

  it('"See all dates" mở ĐÚNG modal dùng chung, không dựng modal riêng', async () => {
    function Probe() {
      const { allDatesOpen } = useDepartureSelection();
      return <p>{allDatesOpen ? 'DIALOG_OPEN' : 'DIALOG_CLOSED'}</p>;
    }
    render(
      <DepartureSelectionProvider departures={DEPARTURES}>
        <DeparturesPanel tour={TOUR} />
        <Probe />
      </DepartureSelectionProvider>,
    );
    expect(screen.getByText('DIALOG_CLOSED')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /see all dates/i }));
    expect(screen.getByText('DIALOG_OPEN')).toBeInTheDocument();
  });

  it('thẻ điều khoản sinh từ policies, không hardcode ba cái', () => {
    wrap(TOUR);
    expect(screen.getByText('Cancellation')).toBeInTheDocument();
    expect(screen.getByText('Booking & payment')).toBeInTheDocument();
    expect(screen.queryByText('Good to know')).toBeNull();
  });
});
