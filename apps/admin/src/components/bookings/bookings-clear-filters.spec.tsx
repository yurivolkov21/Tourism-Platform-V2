import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewsClearFilters } from '@/components/reviews/reviews-toolbar';
import type { BookingsQuery } from '@/lib/bookings-query';
import type { ReviewsQuery } from '@/lib/reviews-query';
import { BookingsClearFilters } from './bookings-toolbar';

/**
 * Nút xoá gộp ở HAI vùng có luật ngày khác hẳn nhau — đây là chỗ một nút xoá
 * dùng chung dễ nói sai nhất, nên canh cả hai:
 *
 * - `/bookings` **độn sẵn** khoảng tháng hiện tại vào URL trần, nên "xoá ngày"
 *   không thể là một URL trần (lượt parse kế sẽ độn lại đúng cái vừa xoá). Nó
 *   phải là sentinel `?dates=all` — đường DUY NHẤT về lại "xem tất cả".
 * - `/reviews` KHÔNG độn gì, nên URL trần chính là trạng thái sạch.
 *
 * Cả hai đều không được đụng dải tab trạng thái: nó ở khe `views`, và sidebar
 * link thẳng vào những URL mang nó.
 */
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (href: string) => push(href) }),
}));

const LABEL = messages.admin.table.clearFilters;
const BOOKINGS: BookingsQuery = { page: 1, limit: 20, from: '2026-09-01', to: '2026-09-30' };
const REVIEWS: ReviewsQuery = { page: 1, limit: 20 };

beforeEach(() => {
  push.mockReset();
});

describe('BookingsClearFilters', () => {
  it('chỉ còn tháng mặc định: nút nói "show all dates" và ra `?dates=all`, KHÔNG ra URL trần', async () => {
    // Không có gì để "xoá" — cú bấm này NỚI bảng sang mọi ngày, nhãn phải nói
    // đúng thế (vòng vá review 05/09).
    const user = userEvent.setup();
    render(<BookingsClearFilters query={BOOKINGS} />);

    expect(screen.queryByRole('button', { name: LABEL })).toBeNull();
    await user.click(
      screen.getByRole('button', { name: messages.admin.bookings.list.showAllDates }),
    );

    // URL trần bị parse độn lại tháng hiện tại — tức hai ô ngày nảy về đúng
    // cái vừa xoá. Sentinel này bookmark được và route export cũng hiểu.
    expect(push).toHaveBeenCalledWith('/bookings?dates=all');
  });

  it('GIỮ dải tab trạng thái — nó ở khe views, không phải bộ lọc của hàng này', async () => {
    const user = userEvent.setup();
    render(<BookingsClearFilters query={{ ...BOOKINGS, status: 'PAID', search: 'ada' }} />);

    await user.click(screen.getByRole('button', { name: LABEL }));

    expect(push).toHaveBeenCalledWith('/bookings?status=PAID&dates=all');
  });

  it('đang ở chế độ xem-tất-cả và không lọc gì thì nút TỰ ẨN', () => {
    const { container } = render(
      <BookingsClearFilters query={{ page: 1, limit: 20, allDates: true }} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe('ReviewsClearFilters', () => {
  it('không lọc gì thì nút TỰ ẨN', () => {
    const { container } = render(<ReviewsClearFilters query={REVIEWS} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('xoá sạch bốn bộ lọc của hàng trong MỘT cú bấm', async () => {
    const user = userEvent.setup();
    render(
      <ReviewsClearFilters
        query={{
          ...REVIEWS,
          search: 'guide',
          from: '2026-05-01',
          to: '2026-05-31',
          source: 'CURATED',
          rating: 5,
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: LABEL }));

    expect(push).toHaveBeenCalledWith('/reviews');
  });

  it('GIỮ dải tab trạng thái, xoá phần còn lại', async () => {
    const user = userEvent.setup();
    render(<ReviewsClearFilters query={{ ...REVIEWS, state: 'pending', rating: 1 }} />);

    await user.click(screen.getByRole('button', { name: LABEL }));

    expect(push).toHaveBeenCalledWith('/reviews?status=pending');
  });

  it('đứng ở trang 5 vẫn tự ẩn khi không lọc gì — phép so GHIM trang', () => {
    // Không ghim thì hai href khác nhau CHỈ VÌ `page` và nút không bao giờ ẩn.
    const { container } = render(<ReviewsClearFilters query={{ page: 5, limit: 20 }} />);

    expect(container).toBeEmptyDOMElement();
  });
});
