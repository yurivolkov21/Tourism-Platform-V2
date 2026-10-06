import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BOOKINGS_COUNT_ID, type BookingsListParams } from '@/lib/bookings-list';
import { TripPager } from './trip-pager';

/**
 * Phân trang "Previous / Next" (spec P7 §7.4). Chữ và href đã có test ở `pagerView`; ở đây canh
 * thứ được VẼ (link hay chữ mờ, có hay không có Next) và tiêu điểm sau khi sang trang.
 *
 * `next/link` thay bằng thẻ <a> chặn điều hướng: jsdom không có router của App Router, và cú
 * bấm chỉ cần chạy `onClick` của trang — "URL về tới" thì `rerender` tường minh.
 */
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <a
      href={href}
      {...rest}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
      }}
    >
      {children}
    </a>
  ),
}));

const FILTERED: BookingsListParams = { q: null, when: ['UPCOMING'], status: [], page: 1 };

describe('TripPager', () => {
  it('một trang thì không vẽ gì', () => {
    const { container } = render(
      <TripPager params={FILTERED} totalPages={1} total={7} limit={10} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('trang đầu: Previous mờ không bấm được; Next sang trang 2, giữ bộ lọc', () => {
    render(<TripPager params={FILTERED} totalPages={2} total={18} limit={10} />);

    expect(screen.queryByRole('link', { name: 'Previous' })).toBeNull();
    expect(screen.getByText('Previous')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Page 1 of 2 · trips 1–10 of 18')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Next, Trips 11–18' })).toHaveAttribute(
      'href',
      '/account/bookings?when=upcoming&page=2',
    );
  });

  it('trang giữa: hai link, Previous về trang 1 không mang page', () => {
    render(<TripPager params={{ ...FILTERED, page: 2 }} totalPages={3} total={25} limit={10} />);

    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute(
      'href',
      '/account/bookings?when=upcoming',
    );
    expect(screen.getByRole('link', { name: 'Next, Trips 21–25' })).toHaveAttribute(
      'href',
      '/account/bookings?when=upcoming&page=3',
    );
  });

  it('trang cuối: không có Next', () => {
    render(<TripPager params={{ ...FILTERED, page: 3 }} totalPages={3} total={25} limit={10} />);

    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute(
      'href',
      '/account/bookings?when=upcoming&page=2',
    );
    expect(screen.queryByText('Next')).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Trip pages' })).toBeInTheDocument();
  });

  /**
   * Review P7 06/10: sang trang cuối thì link Next đang giữ tiêu điểm bị gỡ, tiêu điểm rơi về
   * <body> và trình đọc màn hình im lặng. Nay tiêu điểm về dòng đếm ở đầu trang mới.
   */
  it('bấm Next rồi trang mới về: tiêu điểm về dòng đếm ở đầu danh sách', () => {
    const { rerender } = render(
      <>
        <p id={BOOKINGS_COUNT_ID} tabIndex={-1}>
          18 trips
        </p>
        <TripPager params={FILTERED} totalPages={2} total={18} limit={10} />
      </>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Next, Trips 11–18' }));
    rerender(
      <>
        <p id={BOOKINGS_COUNT_ID} tabIndex={-1}>
          18 trips
        </p>
        <TripPager params={{ ...FILTERED, page: 2 }} totalPages={2} total={18} limit={10} />
      </>,
    );

    expect(screen.getByText('18 trips')).toHaveFocus();
  });

  it('trang đổi vì lý do khác (lọc, nút Back): không giật tiêu điểm', () => {
    const { rerender } = render(
      <>
        <p id={BOOKINGS_COUNT_ID} tabIndex={-1}>
          18 trips
        </p>
        <TripPager params={FILTERED} totalPages={2} total={18} limit={10} />
      </>,
    );
    rerender(
      <>
        <p id={BOOKINGS_COUNT_ID} tabIndex={-1}>
          18 trips
        </p>
        <TripPager params={{ ...FILTERED, page: 2 }} totalPages={2} total={18} limit={10} />
      </>,
    );

    expect(screen.getByText('18 trips')).not.toHaveFocus();
  });
});
