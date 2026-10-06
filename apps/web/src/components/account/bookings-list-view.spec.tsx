import { render, screen } from '@testing-library/react';
import type { BookingsListResult } from '@tourism/contract';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { BookingsListParams } from '@/lib/bookings-list';
import { makeBooking } from '@/test/fixtures/booking';
import { BookingsListView } from './bookings-list-view';

// Hàng lọc gọi `useRouter` — mock như `bookings-toolbar.spec.tsx`; ở đây không bấm gì.
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

// `BookingAccordion` bọc từng hàng trong `RevealItem` (motion `whileInView`) — jsdom không có
// IntersectionObserver. Stub CỤC BỘ, cùng nếp `passport.spec.tsx`.
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

/** Thân trang My bookings (spec P7 §7.1–7.4). */
const TODAY = '2026-10-05';
const NONE: BookingsListParams = { q: null, when: [], status: [], page: 1 };
const FACETS: BookingsListResult['facets'] = {
  when: { ON_TOUR: 0, UPCOMING: 12, PAST: 6 },
  status: { PENDING: 0, PAID: 18, CANCELLED: 0, REFUNDED: 0, PARTIALLY_REFUNDED: 0 },
};
const ZERO: BookingsListResult['facets'] = {
  when: { ON_TOUR: 0, UPCOMING: 0, PAST: 0 },
  status: { PENDING: 0, PAID: 0, CANCELLED: 0, REFUNDED: 0, PARTIALLY_REFUNDED: 0 },
};

/** Đơn thứ n — mã khác nhau để biết hàng nào đang mở. */
const trip = (n: number) =>
  makeBooking({
    id: `b0000000-0000-4000-8000-00000000000${n}`,
    code: `BK-TRIP000${n}`,
    tourTitle: `Trip ${n}`,
  });

function result(patch: Partial<BookingsListResult>): BookingsListResult {
  return {
    items: [],
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    facets: FACETS,
    overallTotal: 18,
    today: TODAY,
    ...patch,
  };
}

describe('BookingsListView', () => {
  it('khách chưa có đơn nào: giữ trạng thái trống cũ, không bày hàng lọc', () => {
    render(<BookingsListView result={result({ overallTotal: 0, facets: ZERO })} params={NONE} />);

    expect(screen.getByRole('heading', { name: 'No trips booked yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse tours' })).toHaveAttribute('href', '/tours');
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('chưa lọc: dòng "{total} trips", hàng lọc, danh sách và phân trang', () => {
    render(
      <BookingsListView
        result={result({ items: [trip(1), trip(2)], total: 12, totalPages: 2 })}
        params={NONE}
      />,
    );

    expect(screen.getByText('12 trips')).toBeInTheDocument();
    expect(
      screen.getByRole('searchbox', { name: 'Search tour or booking code' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2 · trips 1–10 of 12')).toBeInTheDocument();
  });

  it('đang lọc: "{total} of {overallTotal} trips"; một trang thì không phân trang', () => {
    render(
      <BookingsListView
        result={result({ items: [trip(1), trip(2)], total: 2, totalPages: 1 })}
        params={{ ...NONE, when: ['UPCOMING'] }}
      />,
    );

    expect(screen.getByText('2 of 18 trips')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Trip pages' })).toBeNull();
  });

  it('lọc ra rỗng: No trips match, câu gợi ý và nút Reset thứ hai dưới câu gợi ý', () => {
    render(<BookingsListView result={result({})} params={{ ...NONE, status: ['CANCELLED'] }} />);

    expect(screen.getByText('0 of 18 trips')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No trips match' })).toBeInTheDocument();
    expect(screen.getByText('Try another search or clear the filters.')).toBeInTheDocument();
    // Một Reset ở hàng lọc, một ở trạng thái rỗng — cả hai là NÚT replace (không phải link tải
    // lại trang); hành vi của nút thứ hai có ca riêng ở `bookings-toolbar.spec.tsx`.
    expect(screen.getAllByRole('button', { name: 'Reset' })).toHaveLength(2);
    expect(screen.queryByRole('link', { name: 'Reset' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Trip pages' })).toBeNull();
  });

  it('sang trang khác thì hàng ĐẦU của trang mới mở sẵn', () => {
    const { rerender } = render(
      <BookingsListView
        result={result({ items: [trip(1), trip(2)], total: 12, totalPages: 2 })}
        params={NONE}
      />,
    );
    expect(screen.getByRole('link', { name: 'View details' })).toHaveAttribute(
      'href',
      '/account/bookings/BK-TRIP0001',
    );

    rerender(
      <BookingsListView
        result={result({ items: [trip(3), trip(4)], page: 2, total: 12, totalPages: 2 })}
        params={{ ...NONE, page: 2 }}
      />,
    );
    expect(screen.getByRole('link', { name: 'View details' })).toHaveAttribute(
      'href',
      '/account/bookings/BK-TRIP0003',
    );
  });
});
