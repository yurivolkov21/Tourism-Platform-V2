import { render, screen } from '@testing-library/react';
import { Button } from '@tourism/ui/components/button';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { describe, expect, it } from 'vitest';
import { BookingRail } from './booking-rail';
import { TourListCard } from './tour-list-card';

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

const DEPARTURE = {
  id: 'dep-1',
  startDate: '2026-08-21',
  endDate: '2026-08-22',
  seatsLeft: 4,
  effectivePrice: '2400000.00',
  compareAtPrice: null,
  // Chuyến 2 ngày: N = 3 (ADR-0041 §2). `BookingRail` nhận `DepartureVM` nên
  // literal phải đủ field của contract.
  bookingDeadline: '2026-08-18',
  bookable: true,
};

const CARD = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'ha-long-bay-cruise',
  title: 'Ha Long Bay Cruise',
  summary: 'Two days on the water.',
  basePrice: '2400000.00',
  priceFrom: '2400000.00',
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
  badges: [],
  nextDeparture: null,
};

describe('CTA điều hướng là LINK, không phải nút', () => {
  it('TourListCard — "View tour" trỏ đúng slug', () => {
    render(<TourListCard tour={CARD} />);
    const cta = screen.getByRole('link', { name: /view tour/i });
    expect(cta).toHaveAttribute('href', '/tours/ha-long-bay-cruise');
  });

  // CTA hỏi ở panel đặt chỗ (nhánh "tour không còn đợt nào") có case riêng trong
  // `tour-media-panel.spec.tsx`, cũng khẳng định bằng `getByRole('link')`. Bar đáy
  // (`BookingRail`) chỉ còn hai CTA — hỏi khi không còn đợt, Reserve khi có đợt —
  // cả hai đều phải là link. Các case của biến thể `rail` xoá cùng nó ngày 20/10.
  it('BookingRail KHÔNG đợt — CTA hỏi là link', () => {
    render(<BookingRail slug="ha-long-bay-cruise" departure={undefined} currency="VND" />);
    expect(screen.getByRole('link', { name: /ask about this trip/i })).toHaveAttribute(
      'href',
      '/tours/ha-long-bay-cruise/enquire',
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
  // còn là nút cụt.
  it('BookingRail có đợt — nút Reserve là link trỏ trang book', () => {
    render(<BookingRail slug="ha-long-bay-cruise" departure={DEPARTURE} currency="VND" />);
    const reserve = screen.getByRole('link', { name: /reserve/i });
    expect(reserve).toHaveAttribute('href', '/tours/ha-long-bay-cruise/book?departure=dep-1');
  });
});
