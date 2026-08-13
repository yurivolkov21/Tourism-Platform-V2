import { render, screen } from '@testing-library/react';
import { Button } from '@tourism/ui/components/button';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { describe, expect, it, vi } from 'vitest';
import type { TourDetailVM } from '@/lib/api/tours';
import { BookingRail } from './booking-rail';
import { DepartureSelectionProvider } from './departure-selection';
import { TourListCard } from './tour-list-card';
import { TourMediaPanel } from './tour-media-panel';

/**
 * Một chỗ duy nhất canh bất biến: **CTA điều hướng phải là LINK, không phải nút.**
 *
 * Vì sao gom vào một file thay vì rải vào spec của từng component: đây không phải
 * hành vi riêng của component nào cả, mà là hệ quả của một lựa chọn nền —
 * `Button` của Base UI với `nativeButton={false}` **luôn** gắn `role="button"` lên
 * phần tử mà `render` sinh ra (đọc `useButton.js`: `isNativeButton ? {type:'button'}
 * : {role:'button'}`, không có đường tắt nào tắt được). Gắn lên `<a href>` thì nó
 * **đè mất role `link` ngầm**, và trình đọc màn hình đọc "button" cho một thứ
 * điều hướng sang trang khác.
 *
 * Bất biến ở đây diễn đạt bằng `getByRole('link')` chứ không phải "không có
 * role=button": khẳng định theo chiều dương thì test vẫn đúng nếu sau này ta đổi
 * cách hiện thực (buttonVariants, `<Link>` của Next, hay upstream sửa lại).
 */

// `TourMediaPanel` gọi `useRouter()` cho nút Reserve (role="button" thật, không
// phải anchor đội lốt — xem doc comment trong component). Cùng khuôn mock với
// `tour-media-panel.spec.tsx`.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const DEPARTURE = {
  id: 'dep-1',
  startDate: '2026-08-21',
  endDate: '2026-08-22',
  seatsLeft: 4,
  effectivePrice: '2400000.00',
  compareAtPrice: null,
};

const CARD = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'ha-long-bay-cruise',
  title: 'Ha Long Bay Cruise',
  summary: 'Two days on the water.',
  basePrice: '2400000.00',
  compareAtPrice: null,
  currency: 'VND',
  durationDays: 2,
  difficulty: 'EASY' as const,
  maxGroupSize: 12,
  isFeatured: false,
  destinations: [{ slug: 'ha-long', name: 'Ha Long', isPrimary: true }],
  category: { slug: 'cruise', name: 'Cruise' },
  ratingAvg: 4.6,
  ratingCount: 14,
  cover: null,
};

const TOUR_NO_DEPARTURES = {
  ...CARD,
  media: [],
  departures: [],
  policies: [],
  ratingAvg: null,
  ratingCount: 0,
} as unknown as TourDetailVM;

describe('CTA điều hướng là LINK, không phải nút', () => {
  it('TourListCard — "View tour" trỏ đúng slug', () => {
    render(<TourListCard tour={CARD} />);
    const cta = screen.getByRole('link', { name: /view tour/i });
    expect(cta).toHaveAttribute('href', '/tours/ha-long-bay-cruise');
  });

  // Thay hai case `TourReviews`/`DeparturesTable` xoá cùng hai component đó ở
  // đợt trùng tu 13/08. `TourMediaPanel` là nơi CTA hỏi còn sống trên trang
  // tour mới: tour không còn đợt nào thì nút Reserve nhường chỗ cho nó.
  it('TourMediaPanel không còn đợt — CTA hỏi là link trỏ /contact', () => {
    render(
      <DepartureSelectionProvider departures={[]}>
        <TourMediaPanel tour={TOUR_NO_DEPARTURES} />
      </DepartureSelectionProvider>,
    );
    expect(screen.getByRole('link', { name: /ask about this trip/i })).toHaveAttribute(
      'href',
      '/contact',
    );
  });

  // Ba nhánh của BookingRail có ba CTA hỏi riêng biệt — cả ba đều phải là link.
  it('BookingRail rail + có đợt — CTA hỏi phụ là link', () => {
    render(
      <BookingRail
        slug="ha-long-bay-cruise"
        departure={DEPARTURE}
        currency="VND"
        basePrice="2400000.00"
        durationDays={2}
        maxGroupSize={12}
        variant="rail"
      />,
    );
    expect(screen.getByRole('link', { name: /ask about this trip/i })).toHaveAttribute(
      'href',
      '/contact',
    );
  });

  it('BookingRail rail + KHÔNG đợt — CTA hỏi là link', () => {
    render(
      <BookingRail
        slug="ha-long-bay-cruise"
        departure={undefined}
        currency="VND"
        basePrice="2400000.00"
        durationDays={2}
        maxGroupSize={12}
        variant="rail"
      />,
    );
    expect(screen.getByRole('link', { name: /ask about this trip/i })).toHaveAttribute(
      'href',
      '/contact',
    );
  });

  it('BookingRail bar + KHÔNG đợt — CTA hỏi là link', () => {
    render(
      <BookingRail
        slug="ha-long-bay-cruise"
        departure={undefined}
        currency="VND"
        basePrice="2400000.00"
        durationDays={2}
        maxGroupSize={12}
        variant="bar"
      />,
    );
    expect(screen.getByRole('link', { name: /ask about this trip/i })).toHaveAttribute(
      'href',
      '/contact',
    );
  });

  it('ButtonLink và Button ra ĐÚNG cùng một chuỗi class — đổi role không đổi pixel', () => {
    // Bất biến chống trôi: `ButtonLink` phải mượn `buttonVariants` chứ không được
    // tự chép lại danh sách class. Khẳng định bằng cách so hai chuỗi thay vì ghim
    // một chuỗi cứng — ghim cứng thì mỗi lần đổi kiểu dáng nút là test đỏ oan.
    const { container: asButton } = render(
      <Button variant="outline" size="sm" className="mt-6">
        x
      </Button>,
    );
    const { container: asLink } = render(
      <ButtonLink variant="outline" size="sm" className="mt-6" href="/contact">
        x
      </ButtonLink>,
    );
    expect(asLink.firstElementChild?.className).toBe(asButton.firstElementChild?.className);
  });

  // `/tours/[slug]/book` nay đã sống — `Reserve` phải điều hướng tới đó, không
  // còn là nút cụt. Kiểm cả hai vị trí render (rail cột phải + bar đáy mobile).
  it('BookingRail rail + có đợt — nút Reserve là link trỏ trang book', () => {
    render(
      <BookingRail
        slug="ha-long-bay-cruise"
        departure={DEPARTURE}
        currency="VND"
        basePrice="2400000.00"
        durationDays={2}
        maxGroupSize={12}
        variant="rail"
      />,
    );
    const reserve = screen.getByRole('link', { name: /reserve/i });
    expect(reserve).toHaveAttribute('href', '/tours/ha-long-bay-cruise/book');
  });

  it('BookingRail bar + có đợt — nút Reserve là link trỏ trang book', () => {
    render(
      <BookingRail
        slug="ha-long-bay-cruise"
        departure={DEPARTURE}
        currency="VND"
        basePrice="2400000.00"
        durationDays={2}
        maxGroupSize={12}
        variant="bar"
      />,
    );
    const reserve = screen.getByRole('link', { name: /reserve/i });
    expect(reserve).toHaveAttribute('href', '/tours/ha-long-bay-cruise/book');
  });
});
