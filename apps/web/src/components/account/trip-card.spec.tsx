import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { TripCard } from './trip-card';

describe('TripCard — variant hero', () => {
  const TODAY = '2026-08-10';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T12:00:00.000Z`));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('nhóm upcoming: hiện đúng số ngày đếm ngược + link "View booking" đúng href', () => {
    render(
      <TripCard
        booking={makeBooking({ code: 'BK-UPCOMING1', departureStartDate: '2026-08-13' })}
        variant="hero"
      />,
    );
    expect(screen.getByText('In 3 days')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View booking' })).toHaveAttribute(
      'href',
      '/account/bookings/BK-UPCOMING1',
    );
  });

  it('thiếu ảnh (tourImage null) không vỡ — không render <img>', () => {
    const { container } = render(
      <TripCard booking={makeBooking({ tourImage: null })} variant="hero" />,
    );
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });
});

describe('TripCard — variant row', () => {
  it('PAID đã qua: hiện link "Leave a review"', () => {
    render(
      <TripCard
        booking={makeBooking({
          status: 'PAID',
          departureStartDate: '2026-01-01',
          departureEndDate: '2026-01-02',
        })}
        variant="row"
      />,
    );
    expect(screen.getByRole('link', { name: 'Leave a review' })).toBeInTheDocument();
  });

  it('CANCELLED: hiện "Cancelled", KHÔNG có link review', () => {
    render(
      <TripCard
        booking={makeBooking({
          status: 'CANCELLED',
          departureStartDate: '2026-01-01',
          departureEndDate: '2026-01-02',
        })}
        variant="row"
      />,
    );
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Leave a review' })).not.toBeInTheDocument();
  });
});
