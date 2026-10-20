import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DepartureVM } from '@/lib/api/tours';
import { BookingRail } from './booking-rail';

/**
 * Canh ĐÍCH của hai CTA, không canh dáng.
 *
 * Sinh ra 19/08 khi nhánh chuyến-riêng tách sang route công khai
 * `/tours/[slug]/enquire`: trước đó CTA "Ask about this trip" đổ khách vào
 * `/contact` chung chung — một form không biết khách đang hỏi tour nào, nên đội
 * vận hành phải hỏi lại. Bar chỉ có CTA đó ở nhánh không còn đợt đặt được, và
 * lỗi ở nhánh ấy chỉ lộ ra ở đúng tour hết đợt — thứ hiếm khi mở ra xem.
 * Các case của biến thể `rail` xoá cùng biến thể đó ngày 20/10 (review L2-10).
 */
const DEPARTURE: DepartureVM = {
  id: 'd1',
  startDate: '2026-09-14',
  endDate: '2026-09-17',
  seatsLeft: 6,
  effectivePrice: '329.00',
  compareAtPrice: '369.00',
  // Chuyến 4 ngày: N = 7 (ADR-0041 §2).
  bookingDeadline: '2026-09-07',
  bookable: true,
};

const BASE = { slug: 'ha-giang-loop-4d', currency: 'USD' } as const;

/** Href của link mang đúng nhãn `name`. */
function hrefOf(name: RegExp): string | null {
  return screen.getByRole('link', { name }).getAttribute('href');
}

describe('BookingRail — đích của hai CTA', () => {
  it('còn đợt: Reserve sang /book MANG THEO đợt đang chọn (W-02)', () => {
    render(<BookingRail {...BASE} departure={DEPARTURE} />);
    expect(hrefOf(/reserve/i)).toBe('/tours/ha-giang-loop-4d/book?departure=d1');
  });

  it('CHƯA có đợt nào: chỉ còn CTA hỏi, và nó trỏ /enquire', () => {
    render(<BookingRail {...BASE} departure={undefined} />);
    expect(hrefOf(/ask about this trip/i)).toBe('/tours/ha-giang-loop-4d/enquire');
    expect(screen.queryByRole('link', { name: /reserve/i })).toBeNull();
  });

  /** Chốt chặn cho đúng thứ vừa sửa: không nhánh nào được quay lại `/contact`. */
  it('không nhánh nào còn trỏ về /contact', () => {
    for (const departure of [DEPARTURE, undefined]) {
      const { unmount } = render(<BookingRail {...BASE} departure={departure} />);
      for (const link of screen.getAllByRole('link')) {
        expect(link.getAttribute('href')).not.toBe('/contact');
      }
      unmount();
    }
  });

  /** Copy 15/09 (ADR-0041): MỘT câu chung cho mọi lý do "không đặt được" — chưa
   *  có đợt, hết chỗ, hoặc đã qua hạn đặt. Câu cũ hứa "still being confirmed",
   *  sai với tour đã có đủ ngày nhưng đã đóng cửa đặt. */
  it('không còn đợt đặt được: một câu chung, không còn "still being confirmed"', () => {
    render(<BookingRail {...BASE} departure={undefined} />);
    expect(screen.getByText('No departures are open for booking')).toBeInTheDocument();
    expect(screen.queryByText(/still being confirmed/i)).toBeNull();
  });
});

describe('BookingRail — cờ data-booking-bar cho hai nút nổi (P6)', () => {
  it('bar có mặt thì <body> mang cờ, gỡ bar thì cờ mất', () => {
    const bar = render(<BookingRail {...BASE} departure={DEPARTURE} />);
    expect(document.body.hasAttribute('data-booking-bar')).toBe(true);
    bar.unmount();
    expect(document.body.hasAttribute('data-booking-bar')).toBe(false);
  });
});
