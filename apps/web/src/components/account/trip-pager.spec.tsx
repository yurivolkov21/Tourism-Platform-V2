import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BookingsListParams } from '@/lib/bookings-list';
import { TripPager } from './trip-pager';

/** Phân trang "Newer / Older trips" (spec P7 §7.4). Chữ và href đã có test ở `pagerView`;
 *  ở đây canh thứ được VẼ: link hay chữ mờ, có hay không có Older. */
const FILTERED: BookingsListParams = { q: null, when: ['UPCOMING'], status: [], page: 1 };

describe('TripPager', () => {
  it('một trang thì không vẽ gì', () => {
    const { container } = render(
      <TripPager params={FILTERED} totalPages={1} total={7} limit={10} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('trang đầu: Newer mờ không bấm được; Older sang trang 2, giữ bộ lọc', () => {
    render(<TripPager params={FILTERED} totalPages={2} total={18} limit={10} />);

    expect(screen.queryByRole('link', { name: 'Newer trips' })).toBeNull();
    expect(screen.getByText('Newer trips')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Page 1 of 2 · trips 1–10 of 18')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Older trips, Trips 11–18' })).toHaveAttribute(
      'href',
      '/account/bookings?when=upcoming&page=2',
    );
  });

  it('trang giữa: hai link, Newer về trang 1 không mang page', () => {
    render(<TripPager params={{ ...FILTERED, page: 2 }} totalPages={3} total={25} limit={10} />);

    expect(screen.getByRole('link', { name: 'Newer trips' })).toHaveAttribute(
      'href',
      '/account/bookings?when=upcoming',
    );
    expect(screen.getByRole('link', { name: 'Older trips, Trips 21–25' })).toHaveAttribute(
      'href',
      '/account/bookings?when=upcoming&page=3',
    );
  });

  it('trang cuối: không có Older', () => {
    render(<TripPager params={{ ...FILTERED, page: 3 }} totalPages={3} total={25} limit={10} />);

    expect(screen.getByRole('link', { name: 'Newer trips' })).toHaveAttribute(
      'href',
      '/account/bookings?when=upcoming&page=2',
    );
    expect(screen.queryByText('Older trips')).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Trip pages' })).toBeInTheDocument();
  });
});
