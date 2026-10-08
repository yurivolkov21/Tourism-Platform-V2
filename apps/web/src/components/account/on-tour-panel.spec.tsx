import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeBooking, makeTourData } from '@/test/fixtures/booking';
import { OnTourPanel } from './on-tour-panel';

/** Chuyến 04–06/10, hôm nay 05/10 là ngày 2. Ba ngày lịch trình khác chữ để bắt chọn nhầm ngày. */
const BOOKING = makeBooking({ departureStartDate: '2026-10-04', departureEndDate: '2026-10-06' });
const TOUR = makeTourData({
  meetingPoint: 'Hội An Ancient Town gate, Trần Phú street',
  itinerary: [
    { dayNumber: 1, title: 'Đà Nẵng arrival', description: '14:00 — Check in' },
    { dayNumber: 2, title: 'Hội An old town', description: '08:00 — Walk\n12:00 — Cao lầu lunch' },
    { dayNumber: 3, title: 'Mỹ Sơn sanctuary', description: '06:00 — Sunrise visit' },
  ],
});

describe('OnTourPanel', () => {
  it('h2 "Today’s plan" và "Day 2 of 3"', () => {
    render(<OnTourPanel booking={BOOKING} tour={TOUR} today="2026-10-05" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Today’s plan' })).toBeInTheDocument();
    expect(screen.getByText('Day 2 of 3')).toBeInTheDocument();
  });

  it('lịch trình ĐÚNG ngày hôm nay, in nguyên văn giữ xuống dòng', () => {
    const { container } = render(<OnTourPanel booking={BOOKING} tour={TOUR} today="2026-10-05" />);
    expect(screen.getByText('Day 2 · Hội An old town')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="day-text"]')?.textContent).toBe(
      '08:00 — Walk\n12:00 — Cao lầu lunch',
    );
    expect(screen.queryByText('Day 1 · Đà Nẵng arrival')).toBeNull();
  });

  it('điểm hẹn và lối "Need help today? Contact us"', () => {
    render(<OnTourPanel booking={BOOKING} tour={TOUR} today="2026-10-05" />);
    expect(screen.getByText('Meeting point')).toBeInTheDocument();
    expect(screen.getByText('Hội An Ancient Town gate, Trần Phú street')).toBeInTheDocument();
    expect(screen.getByText('Need help today?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/contact');
  });

  it('tour đã gỡ: vẫn còn ngày thứ mấy và lối liên hệ', () => {
    render(<OnTourPanel booking={BOOKING} tour={null} today="2026-10-06" />);
    expect(screen.getByText('Day 3 of 3')).toBeInTheDocument();
    expect(screen.queryByText('Meeting point')).toBeNull();
    expect(screen.getByRole('link', { name: 'Contact us' })).toBeInTheDocument();
  });
});
