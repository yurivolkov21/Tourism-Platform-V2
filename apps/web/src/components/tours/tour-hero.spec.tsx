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
// đợt rẻ nhất còn chỗ. Fixture đã qua `resolveDepartureAnchors` (một giá gạch
// duy nhất 149 cho mọi đợt) như dữ liệu thật ra khỏi `fetchTourDetail`.
const dep = (id: string, price: string, seatsLeft = 10): DepartureVM =>
  ({
    id,
    startDate: '2026-09-19',
    endDate: '2026-09-20',
    effectivePrice: price,
    compareAtPrice: '149.00',
    seatsLeft,
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
  departures: [dep('sep', '129.00'), dep('oct', '119.00'), dep('nov', '129.00')],
} as unknown as TourDetailVM;

/** Nút chọn đợt tối giản — thay cho DepartureStrip để test không kéo cả strip. */
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
    expect(screen.getByText('−13%')).toBeInTheDocument();
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
    expect(screen.getByText('−20%')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'pick sep' }));
    expect(screen.getByText('$129')).toBeInTheDocument();
    expect(screen.getByText('−13%')).toBeInTheDocument();
  });

  it('không có provider (/book, /enquire) → "from" + đợt rẻ nhất còn chỗ', () => {
    render(<TourHero tour={TOUR} />);
    expect(screen.getByText('from')).toBeInTheDocument();
    expect(screen.getByText('$119')).toBeInTheDocument();
    expect(screen.getByText('−20%')).toBeInTheDocument();
  });

  it('mọi đợt hết chỗ → không chọn được đợt nào → "from" + basePrice', () => {
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
  });
});
