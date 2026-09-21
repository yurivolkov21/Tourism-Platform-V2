import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  DepartureSelectionProvider,
  useDepartureSelection,
} from '@/components/tours/departure-selection';
import type { DepartureVM, TourDetailVM } from '@/lib/api/tours';
import { TourHero } from './tour-hero';

// Sweep giá 19/08 (user chốt): hero BÁM ĐỢT ĐANG CHỌN — cùng một con số với khối
// chọn ngày bên dưới; không có provider (`/book`, `/enquire`) thì rơi về "from"
// đợt rẻ nhất còn chỗ. Fixture đã qua `resolveDepartureAnchors` như dữ liệu thật
// ra khỏi `fetchTourDetail`, theo luật giá gạch 15/09/2026 (chỉ gạch khi có
// khuyến mãi thật): đợt đúng base 129 KHÔNG gạch, đợt 119 gạch base 129 — còn
// giá niêm yết 149 của tour không hiện ở nhánh nào.
const dep = (
  id: string,
  price: string,
  compareAtPrice: string | null = null,
  bookable = true,
): DepartureVM =>
  ({
    id,
    startDate: '2026-09-19',
    endDate: '2026-09-20',
    effectivePrice: price,
    compareAtPrice,
    seatsLeft: 10,
    // Chuyến 2 ngày → N = 3 (ADR-0041 §3).
    bookingDeadline: '2026-09-16',
    bookable,
    status: 'OPEN',
  }) as unknown as DepartureVM;

const TOUR = {
  slug: 'vung-tau',
  title: 'Vũng Tàu Coastal Escape',
  summary: 'Two easy days.',
  category: { name: 'Beach', slug: 'beach' },
  difficulty: 'EASY',
  ratingAvg: 4.7,
  ratingCount: 3,
  destinations: [{ slug: 'vung-tau', name: 'Vũng Tàu', isPrimary: true }],
  durationDays: 2,
  maxGroupSize: 16,
  currency: 'USD',
  basePrice: '129.00',
  compareAtPrice: '149.00',
  badges: [],
  departures: [dep('sep', '129.00'), dep('oct', '119.00', '129.00'), dep('nov', '129.00')],
} as unknown as TourDetailVM;

/** Nút chọn đợt tối giản — đẩy `select()` của context vào mà không phải dựng cả
    panel đặt chỗ, thứ duy nhất test này cần là hero phản ứng khi đợt đổi. */
function Picker() {
  const { departures, select } = useDepartureSelection();
  return (
    <>
      {departures.map((d) => (
        <button key={d.id} type="button" onClick={() => select(d.id)}>
          pick {d.id}
        </button>
      ))}
    </>
  );
}

describe('TourHero — giá bám đợt đang chọn', () => {
  it('trong provider: mặc định chọn đợt đầu còn chỗ → hero in giá đợt đó, KHÔNG có chữ "from"', () => {
    render(
      <DepartureSelectionProvider departures={TOUR.departures}>
        <TourHero tour={TOUR} />
      </DepartureSelectionProvider>,
    );
    expect(screen.getByText('$129')).toBeInTheDocument();
    expect(screen.queryByText('from')).toBeNull();
    // Đợt đúng giá gốc: không có khuyến mãi thật nên không có chip giảm giá.
    expect(screen.queryByText(/−\d+%/)).toBeNull();
  });

  it('chọn đợt khác → hero đổi theo đúng giá + % giảm của đợt đó', async () => {
    const user = userEvent.setup();
    render(
      <DepartureSelectionProvider departures={TOUR.departures}>
        <TourHero tour={TOUR} />
        <Picker />
      </DepartureSelectionProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'pick oct' }));
    expect(screen.getByText('$119')).toBeInTheDocument();
    // floor((129 − 119) / 129 × 100) = 7
    expect(screen.getByText('−7%')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'pick sep' }));
    expect(screen.getByText('$129')).toBeInTheDocument();
    expect(screen.queryByText(/−\d+%/)).toBeNull();
  });

  it('không có provider (/book, /enquire) → "from" + đợt rẻ nhất còn chỗ', () => {
    render(<TourHero tour={TOUR} />);
    expect(screen.getByText('from')).toBeInTheDocument();
    expect(screen.getByText('$119')).toBeInTheDocument();
    expect(screen.getByText('−7%')).toBeInTheDocument();
  });

  it('mọi đợt hết chỗ → "from" + basePrice, KHÔNG gạch giá niêm yết của tour', () => {
    const soldOut = {
      ...TOUR,
      departures: TOUR.departures.map((d) => ({ ...d, seatsLeft: 0 })),
    } as TourDetailVM;
    render(
      <DepartureSelectionProvider departures={soldOut.departures}>
        <TourHero tour={soldOut} />
      </DepartureSelectionProvider>,
    );
    expect(screen.getByText('from')).toBeInTheDocument();
    expect(screen.getByText('$129')).toBeInTheDocument();
    expect(screen.queryByText('$149')).toBeNull();
    expect(screen.queryByText(/−\d+%/)).toBeNull();
  });

  it('giá "from" bỏ qua đợt đã qua hạn đặt, dù nó rẻ nhất', () => {
    // Cùng tập với giá "from" của `catalog.tours.list` (Task 5): đợt đã đóng
    // không còn là giá khách mua được, tính vào thì thẻ tour và hero in hai số.
    const tour = {
      ...TOUR,
      departures: [dep('a', '119.00', null, false), dep('b', '129.00')],
    } as unknown as TourDetailVM;
    render(<TourHero tour={tour} />);
    expect(screen.getByText(/\$129/)).toBeInTheDocument();
    expect(screen.queryByText(/\$119/)).toBeNull();
  });
});
