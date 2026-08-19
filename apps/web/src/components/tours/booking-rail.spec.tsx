import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DepartureVM } from '@/lib/api/tours';
import { BookingRail } from './booking-rail';

/**
 * Canh ĐÍCH của hai CTA, không canh dáng.
 *
 * Sinh ra 19/08 khi nhánh chuyến-riêng tách sang route công khai
 * `/tours/[slug]/enquire`: trước đó CTA phụ "Ask about this trip" đổ khách vào
 * `/contact` chung chung — một form không biết khách đang hỏi tour nào, nên đội
 * vận hành phải hỏi lại. Ba nhánh render của rail đều có CTA đó, và bỏ sót một
 * nhánh thì lỗi chỉ lộ ra ở đúng tour hết đợt — thứ hiếm khi mở ra xem.
 */
const DEPARTURE: DepartureVM = {
  id: 'd1',
  startDate: '2026-09-14',
  endDate: '2026-09-17',
  seatsLeft: 6,
  effectivePrice: '329.00',
  compareAtPrice: '369.00',
};

const BASE = {
  slug: 'ha-giang-loop-4d',
  currency: 'USD',
  basePrice: '329.00',
  durationDays: 4,
  maxGroupSize: 12,
} as const;

/** Href của link mang đúng nhãn `name`. */
function hrefOf(name: RegExp): string | null {
  return screen.getByRole('link', { name }).getAttribute('href');
}

describe('BookingRail — đích của hai CTA', () => {
  it('rail còn đợt: Reserve sang /book, CTA phụ sang /enquire của CHÍNH tour này', () => {
    render(<BookingRail {...BASE} departure={DEPARTURE} variant="rail" />);
    expect(hrefOf(/reserve/i)).toBe('/tours/ha-giang-loop-4d/book');
    expect(hrefOf(/ask about this trip/i)).toBe('/tours/ha-giang-loop-4d/enquire');
  });

  it('bar đáy mobile: cùng hai đích đó', () => {
    render(<BookingRail {...BASE} departure={DEPARTURE} variant="bar" />);
    expect(hrefOf(/reserve/i)).toBe('/tours/ha-giang-loop-4d/book');
  });

  it('bar đáy khi CHƯA có đợt nào: chỉ còn CTA hỏi, và nó trỏ /enquire', () => {
    render(<BookingRail {...BASE} departure={undefined} variant="bar" />);
    expect(hrefOf(/ask about this trip/i)).toBe('/tours/ha-giang-loop-4d/enquire');
    expect(screen.queryByRole('link', { name: /reserve/i })).toBeNull();
  });

  it('rail khi CHƯA có đợt nào: không có Reserve, CTA hỏi trỏ /enquire', () => {
    render(<BookingRail {...BASE} departure={undefined} variant="rail" />);
    expect(hrefOf(/ask about this trip/i)).toBe('/tours/ha-giang-loop-4d/enquire');
    expect(screen.queryByRole('link', { name: /reserve/i })).toBeNull();
  });

  /** Chốt chặn cho đúng thứ vừa sửa: không nhánh nào được quay lại `/contact`. */
  it('không nhánh nào còn trỏ về /contact', () => {
    for (const variant of ['rail', 'bar'] as const) {
      for (const departure of [DEPARTURE, undefined]) {
        const { unmount } = render(
          <BookingRail {...BASE} departure={departure} variant={variant} />,
        );
        for (const link of screen.getAllByRole('link')) {
          expect(link.getAttribute('href')).not.toBe('/contact');
        }
        unmount();
      }
    }
  });
});
