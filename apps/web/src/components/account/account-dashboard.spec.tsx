import { render, screen } from '@testing-library/react';
import type { WishlistItem } from '@tourism/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import { AccountDashboard } from './account-dashboard';

const TODAY = '2026-08-04';

function makeWishlistItem(overrides: Partial<WishlistItem> = {}): WishlistItem {
  return {
    tourId: '604041ef-3601-43cb-8a46-cf91f2c9b53a',
    slug: 'ninh-binh-trang-an-day',
    title: 'Ninh Bình: Tràng An, Múa Cave & Rice Fields',
    basePrice: '79.00',
    currency: 'USD',
    durationDays: 1,
    ratingAvg: 4.8,
    ratingCount: 132,
    addedAt: '2026-07-28T14:00:00.000Z',
    unavailable: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00.000Z`));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AccountDashboard — empty tổng', () => {
  it('không booking, không saved → empty-state với CTA /tours, KHÔNG render ô số', () => {
    render(<AccountDashboard bookings={[]} wishlist={[]} />);
    expect(screen.getByRole('link', { name: /browse tours/i })).toHaveAttribute('href', '/tours');
    expect(screen.queryByText('Trips paid')).not.toBeInTheDocument();
  });
});

describe('AccountDashboard — thứ tự khối (redesign 10/08)', () => {
  it('thẻ "chuyến kế tiếp" đứng TRƯỚC hai ô số và trước "Recent bookings"', () => {
    // Đảo trục là điểm chính của redesign: câu người ta mở trang này để hỏi là
    // "tôi sắp đi đâu", không phải "tôi có bao nhiêu chuyến". Kiểm bằng thứ tự
    // xuất hiện trong DOM chứ không bằng class.
    render(
      <AccountDashboard
        bookings={[makeBooking({ code: 'BK-NEAREST1', departureStartDate: '2026-08-20' })]}
        wishlist={[makeWishlistItem()]}
      />,
    );
    const html = document.body.innerHTML;
    expect(html.indexOf('Your next trip')).toBeLessThan(html.indexOf('Trips paid'));
    expect(html.indexOf('Trips paid')).toBeLessThan(html.indexOf('Recent bookings'));
  });

  it('CHỈ hai ô số — bốn ô cũ đã bỏ', () => {
    render(<AccountDashboard bookings={[makeBooking()]} wishlist={[makeWishlistItem()]} />);
    expect(screen.getByText('Trips paid')).toBeInTheDocument();
    expect(screen.getByText('Tours saved')).toBeInTheDocument();
    expect(screen.queryByText('Upcoming')).not.toBeInTheDocument();
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();
  });
});

describe('AccountDashboard — thẻ chuyến kế tiếp', () => {
  const soon = makeBooking({ code: 'BK-NEAREST1', departureStartDate: '2026-08-20' });

  it('hiện số ngày còn lại và link tới đúng booking', () => {
    render(<AccountDashboard bookings={[soon]} wishlist={[]} />);
    expect(screen.getByText('Your next trip')).toBeInTheDocument();
    expect(screen.getByText('16')).toBeInTheDocument(); // 04/08 → 20/08
    expect(screen.getByText('days away')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view booking/i })).toHaveAttribute(
      'href',
      '/account/bookings/BK-NEAREST1',
    );
  });

  it('khởi hành HÔM NAY dùng câu riêng, không phải "0 days away"', () => {
    // "0 days away" đọc như một lỗi chứ không như tin vui.
    render(
      <AccountDashboard bookings={[makeBooking({ departureStartDate: TODAY })]} wishlist={[]} />,
    );
    expect(screen.getByText('Departing today')).toBeInTheDocument();
    expect(screen.queryByText('days away')).not.toBeInTheDocument();
  });

  it('khởi hành NGÀY MAI cũng dùng câu riêng', () => {
    render(
      <AccountDashboard
        bookings={[makeBooking({ departureStartDate: '2026-08-05' })]}
        wishlist={[]}
      />,
    );
    expect(screen.getByText('Departing tomorrow')).toBeInTheDocument();
  });

  it('đếm số khách theo người lớn CỘNG trẻ em', () => {
    render(
      <AccountDashboard
        bookings={[makeBooking({ departureStartDate: '2026-08-20', numAdults: 2, numChildren: 1 })]}
        wishlist={[]}
      />,
    );
    expect(screen.getByText(/3 travellers/)).toBeInTheDocument();
  });

  it('một khách → số ít, không phải "1 travellers"', () => {
    render(
      <AccountDashboard
        bookings={[makeBooking({ departureStartDate: '2026-08-20', numAdults: 1, numChildren: 0 })]}
        wishlist={[]}
      />,
    );
    expect(screen.getByText(/1 traveller(?!s)/)).toBeInTheDocument();
  });

  it('toàn booking quá khứ → KHÔNG hiện thẻ, nhưng cũng KHÔNG rơi vào empty tổng', () => {
    render(
      <AccountDashboard
        bookings={[makeBooking({ departureStartDate: '2026-01-01' })]}
        wishlist={[]}
      />,
    );
    expect(screen.queryByText('Your next trip')).not.toBeInTheDocument();
    expect(screen.getByText('Trips paid')).toBeInTheDocument();
  });
});

describe('AccountDashboard — Recent bookings', () => {
  it('GIỮ booking CANCELLED — đây là khác biệt so với khối "upcoming" cũ', () => {
    const cancelled = makeBooking({
      code: 'BK-CANCEL01',
      status: 'CANCELLED',
      tourTitle: 'Cancelled Trip',
      departureStartDate: '2026-01-01',
    });
    render(<AccountDashboard bookings={[cancelled]} wishlist={[]} />);
    expect(screen.getByText('Cancelled Trip')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cancelled trip/i })).toHaveAttribute(
      'href',
      '/account/bookings/BK-CANCEL01',
    );
  });

  it('sắp theo lúc ĐẶT giảm dần, không theo ngày khởi hành', () => {
    const older = makeBooking({
      code: 'BK-OLDER001',
      tourTitle: 'Booked First',
      createdAt: '2026-07-01T00:00:00.000Z',
      departureStartDate: '2026-08-10',
    });
    const newer = makeBooking({
      code: 'BK-NEWER001',
      tourTitle: 'Booked Later',
      createdAt: '2026-08-03T00:00:00.000Z',
      departureStartDate: '2026-12-31',
    });
    render(<AccountDashboard bookings={[older, newer]} wishlist={[]} />);
    // Đo TRONG danh sách, không đo cả trang: 'Booked First' khởi hành gần hơn
    // nên nó còn xuất hiện ở thẻ "chuyến kế tiếp" phía trên, và phép đo toàn
    // trang sẽ bắt nhầm lần xuất hiện đó.
    const rows = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(rows[0]).toContain('Booked Later');
    expect(rows[1]).toContain('Booked First');
  });

  it('nhãn status lấy từ i18n booking.list.status — một nguồn với trang bookings', () => {
    render(
      <AccountDashboard
        bookings={[makeBooking({ status: 'PENDING', departureStartDate: '2026-08-25' })]}
        wishlist={[]}
      />,
    );
    expect(screen.getByText('Awaiting payment')).toBeInTheDocument();
  });

  it('chỉ có tour đã lưu, không booking nào → khối rỗng có câu riêng', () => {
    render(<AccountDashboard bookings={[]} wishlist={[makeWishlistItem()]} />);
    expect(screen.getByText('No bookings yet.')).toBeInTheDocument();
  });

  it('KHÔNG còn khối "tour đã lưu" — mockup đã bỏ hẳn', () => {
    render(<AccountDashboard bookings={[makeBooking()]} wishlist={[makeWishlistItem()]} />);
    expect(
      screen.queryByText('Ninh Bình: Tràng An, Múa Cave & Rice Fields'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Saved tours')).not.toBeInTheDocument();
  });
});
