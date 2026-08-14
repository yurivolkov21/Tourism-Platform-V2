import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { DepartureSelectionProvider } from '@/components/tours/departure-selection';
import type { DepartureVM, TourDetailVM } from '@/lib/api/tours';
import { DeparturesPanel } from './departures-panel';

const DEPARTURES = [
  {
    id: 'aug',
    startDate: '2026-08-20',
    endDate: '2026-08-23',
    seatsLeft: 2,
    effectivePrice: '329.00',
    compareAtPrice: null,
  },
  {
    id: 'sep',
    startDate: '2026-09-24',
    endDate: '2026-09-27',
    seatsLeft: 10,
    effectivePrice: '329.00',
    compareAtPrice: null,
  },
  {
    id: 'nov',
    startDate: '2026-11-05',
    endDate: '2026-11-08',
    seatsLeft: 7,
    effectivePrice: '299.00',
    compareAtPrice: '329.00',
  },
] as unknown as DepartureVM[];

const TOUR = {
  currency: 'USD',
  basePrice: '329.00',
  durationDays: 4,
  maxGroupSize: 10,
  freeCancellationDays: 10,
  factGroupSizeNote: 'Ten riders, one driver each.',
  policies: [
    {
      kind: 'CANCELLATION',
      title: 'Free until 10 days out',
      body: 'Free cancellation up to 10 days before departure.',
    },
    {
      kind: 'BOOKING',
      title: '30% deposit secures your driver',
      body: 'A 30% deposit secures your driver.',
    },
    {
      kind: 'GENERAL',
      title: 'Long sleeves and closed shoes',
      body: 'Long sleeves are required on the bike.',
    },
  ],
} as unknown as TourDetailVM;

function wrap(departures: DepartureVM[] = DEPARTURES, tour: TourDetailVM = TOUR): ReactNode {
  return (
    <DepartureSelectionProvider departures={departures}>
      <DeparturesPanel tour={tour} />
    </DepartureSelectionProvider>
  );
}

/** Một hàng đợt ẩn vẫn nằm trong DOM (render sẵn, giấu bằng `hidden`), nên test
    phải hỏi đúng câu "có đang hiện không" chứ không phải "có tồn tại không". */
function rowFor(dateText: string): HTMLElement {
  const cell = within(screen.getByRole('table')).getByText(dateText, { exact: false });
  const row = cell.closest('tr');
  if (!row) throw new Error(`không tìm thấy hàng chứa "${dateText}"`);
  return row;
}

describe('DeparturesPanel', () => {
  it('bốn ô thống kê đều DẪN XUẤT từ mảng departures, không có số bịa', () => {
    render(wrap());
    // 3 đợt còn chỗ / 3 đợt, trải 3 tháng, tổng 2+10+7 = 19 ghế, giá 299–329.
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByText('across 3 months')).toBeInTheDocument();
    expect(screen.getByText('19')).toBeInTheDocument();
    expect(screen.getByText('$299–$329')).toBeInTheDocument();
  });

  it('"Next departure" bỏ qua đợt đã hết chỗ', () => {
    render(
      wrap([
        { ...DEPARTURES[0], id: 'x', seatsLeft: 0 } as DepartureVM,
        DEPARTURES[1] as DepartureVM,
      ]),
    );
    expect(screen.getByText('24 Sep')).toBeInTheDocument();
  });

  it('mỗi tháng một hàng cha, dòng phụ ghi số đợt và dải ngày', () => {
    render(wrap());
    expect(screen.getByText('August 2026')).toBeInTheDocument();
    expect(screen.getByText('1 departure · 20 Aug')).toBeInTheDocument();
  });

  it('sức chứa tháng = số đợt × maxGroupSize (contract KHÔNG có cột sức chứa)', () => {
    render(wrap());
    // Tháng 11 có 1 đợt còn 7 chỗ → 7 trên (1 × 10).
    const monthRow = screen.getByText('November 2026').closest('tr');
    expect(monthRow && within(monthRow).getByText('7 of 10 seats left')).toBeInTheDocument();
  });

  it('tháng chứa đợt đang chọn mở sẵn, các tháng khác đóng', () => {
    render(wrap());
    // Provider chọn đợt còn chỗ đầu tiên = 20/08.
    expect(rowFor('Thu, 20 Aug')).toBeVisible();
    expect(rowFor('Thu, 24 Sep')).not.toBeVisible();
  });

  it('bấm hàng tháng đang mở thì ĐÓNG lại được', async () => {
    // Nếu state chỉ ghi "những tháng đang mở", tháng tự mở không nằm trong đó
    // nên bấm vào chẳng đổi gì — nút chết mà không báo lỗi.
    const user = userEvent.setup();
    render(wrap());
    const toggle = screen.getByRole('button', { name: /show departures in August 2026/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(rowFor('Thu, 20 Aug')).not.toBeVisible();
  });

  it('bấm Select đổi đợt đang chọn, và nhãn nút đổi theo', async () => {
    const user = userEvent.setup();
    render(wrap());
    await user.click(screen.getByRole('button', { name: /show departures in November 2026/i }));
    const row = rowFor('Thu, 05 Nov');
    await user.click(within(row).getByRole('button', { name: 'Select' }));
    expect(within(row).getByRole('button', { name: 'Selected' })).toBeInTheDocument();
  });

  it('đợt hết chỗ: gạch ngang ngày, huy hiệu Sold out, nút bấm không được', () => {
    render(wrap([{ ...DEPARTURES[0], seatsLeft: 0 } as DepartureVM]));
    const row = rowFor('Thu, 20 Aug');
    expect(within(row).getByText('No seats left')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Sold out' })).toBeDisabled();
  });

  it('huy hiệu tháng im lặng khi cả tháng còn rộng chỗ', () => {
    render(wrap([DEPARTURES[1] as DepartureVM]));
    // Đợt còn 10/10 → hàng con là "Open"; hàng cha KHÔNG được có huy hiệu nào.
    const monthRow = screen.getByText('September 2026').closest('tr');
    expect(monthRow && within(monthRow).queryByText(/open|sold out|almost full/i)).toBeNull();
  });

  it('giảm giá hiện cả giá gạch lẫn số tiền tiết kiệm', async () => {
    const user = userEvent.setup();
    render(wrap());
    await user.click(screen.getByRole('button', { name: /show departures in November 2026/i }));
    const row = rowFor('Thu, 05 Nov');
    expect(within(row).getByText('$329')).toBeInTheDocument();
    expect(within(row).getByText('Save $30')).toBeInTheDocument();
  });

  it('nhãn mùa suy từ giá tháng so với basePrice, không phải field contract', () => {
    render(wrap());
    expect(screen.getByText('low season')).toBeInTheDocument();
  });

  it('quá 6 đợt một tháng thì chặn ở 6 và mở lối sang modal', async () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      ...DEPARTURES[0],
      id: `d${i}`,
      startDate: `2026-08-${String(i + 1).padStart(2, '0')}`,
      endDate: `2026-08-${String(i + 4).padStart(2, '0')}`,
      seatsLeft: 5,
    })) as DepartureVM[];
    render(wrap(many));
    // 6 hàng hiện ra: 5 nút "Select" cộng 1 nút "Selected" (đợt provider chọn sẵn).
    expect(screen.getAllByRole('button', { name: 'Select' })).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: 'Selected' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /See all 9 August dates/i })).toBeInTheDocument();
  });

  it('tour chưa mở đợt nào thì nói thẳng, KHÔNG render bảng rỗng', () => {
    render(wrap([]));
    expect(screen.getByText(/No upcoming departures/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('ba thẻ chính sách cuối tab — chỗ bản ship 13/08 bỏ sót', () => {
    render(wrap());
    expect(screen.getByText('Securing a seat')).toBeInTheDocument();
    expect(screen.getByText('Changing your mind')).toBeInTheDocument();
    expect(screen.getByText('Travelling as a group')).toBeInTheDocument();
  });

  it('thẻ huỷ in CON SỐ khi tour có freeCancellationDays', () => {
    render(wrap());
    expect(screen.getAllByText('Free until 10 days out').length).toBeGreaterThan(0);
  });

  it('tour tính cửa sổ bằng GIỜ (null) thì rơi về tiêu đề policy, không in "Free until null"', () => {
    render(
      wrap(DEPARTURES, {
        ...TOUR,
        freeCancellationDays: null,
        policies: [
          { kind: 'CANCELLATION', title: 'Free until 24 hours out', body: 'Free up to 24 hours.' },
        ],
      } as unknown as TourDetailVM),
    );
    expect(screen.getByText('Free until 24 hours out')).toBeInTheDocument();
    expect(screen.queryByText(/Free until null/)).toBeNull();
  });

  it('thẻ nhóm suy từ maxGroupSize, KHÔNG lấy từ policies', () => {
    render(wrap());
    expect(screen.getByText('Up to 10 guests')).toBeInTheDocument();
    expect(screen.getByText('Ten riders, one driver each.')).toBeInTheDocument();
  });

  it('tour không có policy nào thì bỏ hẳn hàng thẻ', () => {
    render(wrap(DEPARTURES, { ...TOUR, policies: [] } as unknown as TourDetailVM));
    expect(screen.queryByText('Securing a seat')).toBeNull();
  });
});
