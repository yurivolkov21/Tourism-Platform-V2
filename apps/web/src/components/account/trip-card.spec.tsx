import { render, screen } from '@testing-library/react';
import type { Booking } from '@tourism/contract';
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

  it('PENDING khởi hành hôm nay: eyebrow "Departing today" (KHÔNG phải endsOn — chưa PAID thì chưa "on the road")', () => {
    render(
      <TripCard
        booking={makeBooking({ status: 'PENDING', departureStartDate: TODAY })}
        variant="hero"
      />,
    );
    expect(screen.getByText('Departing today')).toBeInTheDocument();
  });

  it('PAID đang diễn ra (hôm qua → mai): eyebrow endsOn, không phải đếm ngược', () => {
    render(
      <TripCard
        booking={makeBooking({
          status: 'PAID',
          departureStartDate: '2026-08-09',
          departureEndDate: '2026-08-11',
        })}
        variant="hero"
      />,
    );
    expect(screen.getByText('Ends 11 Aug 2026')).toBeInTheDocument();
  });

  it('PAID khởi hành ngày mai: eyebrow "In 1 day"', () => {
    render(
      <TripCard
        booking={makeBooking({ status: 'PAID', departureStartDate: '2026-08-11' })}
        variant="hero"
      />,
    );
    expect(screen.getByText('In 1 day')).toBeInTheDocument();
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

  it('PENDING quá hạn (chưa trả tiền, ngày đã qua): KHÔNG có link review — chưa PAID thì chưa có gì để review', () => {
    render(
      <TripCard
        booking={makeBooking({
          status: 'PENDING',
          departureStartDate: '2026-01-01',
          departureEndDate: '2026-01-02',
        })}
        variant="row"
      />,
    );
    expect(screen.queryByRole('link', { name: 'Leave a review' })).not.toBeInTheDocument();
    expect(screen.queryByText('Leave a review')).not.toBeInTheDocument();
  });
});

// Final review (NHÓM 2) — khôi phục parity với `BookingCard` cũ: HeroCard
// trước đây KHÔNG hiện status, nên một PENDING chưa trả tiền nhìn y hệt một
// chuyến bình thường. Một nguồn nhãn — `messages.booking.list.status` —
// dùng LẠI đúng key đã có, không bịa bảng thứ hai.
describe('TripCard — variant hero, nhãn status + Pay now', () => {
  const TODAY = '2026-08-10';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T12:00:00.000Z`));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const STATUS_LABEL: Record<Booking['status'], string> = {
    PENDING: 'Awaiting payment',
    PAID: 'Paid',
    CANCELLED: 'Cancelled',
    REFUNDED: 'Refunded',
    PARTIALLY_REFUNDED: 'Partially refunded',
  };

  for (const status of Object.keys(STATUS_LABEL) as Booking['status'][]) {
    it(`status ${status} → dòng mã+tổng tiền hiện đúng nhãn "${STATUS_LABEL[status]}"`, () => {
      const booking = makeBooking({ status, departureStartDate: '2026-08-20' });
      render(<TripCard booking={booking} variant="hero" />);
      // Nhãn nằm CHUNG một <p> với mã + tổng tiền (span mã · tổng tiền ·
      // status), không phải node riêng — neo vào span mã (text riêng, tìm
      // được bằng exact match) rồi soát textContent của cả dòng cha.
      const codeEl = screen.getByText(booking.code);
      expect(codeEl.closest('p')).toHaveTextContent(STATUS_LABEL[status]);
    });
  }

  it('PENDING → link "Pay now" đứng TRƯỚC "View booking", trỏ đúng trang chi tiết', () => {
    render(
      <TripCard
        booking={makeBooking({
          status: 'PENDING',
          code: 'BK-PEND0001',
          departureStartDate: '2026-08-20',
        })}
        variant="hero"
      />,
    );
    const links = screen.getAllByRole('link');
    const payNowIdx = links.findIndex((l) => l.textContent === 'Pay now');
    const viewBookingIdx = links.findIndex((l) => l.textContent === 'View booking');
    expect(payNowIdx).toBeGreaterThanOrEqual(0);
    expect(payNowIdx).toBeLessThan(viewBookingIdx);
    expect(links[payNowIdx]).toHaveAttribute('href', '/account/bookings/BK-PEND0001');
  });

  it('PAID → KHÔNG có action "Pay now" (đã trả tiền rồi)', () => {
    render(
      <TripCard
        booking={makeBooking({ status: 'PAID', departureStartDate: '2026-08-20' })}
        variant="hero"
      />,
    );
    expect(screen.queryByRole('link', { name: 'Pay now' })).not.toBeInTheDocument();
  });
});
