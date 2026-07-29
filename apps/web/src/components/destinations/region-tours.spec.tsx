import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { MockTourCard } from '@/mocks/types';
import { RegionTours } from './region-tours';

const PLACES = [
  { slug: 'sa-pa', name: 'Sa Pa' },
  { slug: 'ha-long', name: 'Hạ Long' },
  { slug: 'ninh-binh', name: 'Ninh Bình' },
];

function tour(
  slug: string,
  title: string,
  destinations: { slug: string; name: string; isPrimary: boolean }[],
): MockTourCard {
  return {
    id: `id-${slug}`,
    slug,
    title,
    summary: null,
    basePrice: '199.00',
    compareAtPrice: null,
    currency: 'USD',
    durationDays: 3,
    difficulty: 'EASY',
    maxGroupSize: 12,
    isFeatured: false,
    destinations,
    category: { slug: 'trekking', name: 'Trekking' },
    ratingAvg: 4.5,
    ratingCount: 20,
  };
}

// Ninh Bình CỐ TÌNH không có tour nào — đó là nhánh "lọc ra 0 kết quả", nhánh
// có thật khi một địa điểm mới chưa gắn tour nào.
const TOURS = [
  tour('sapa-trek', 'Sa Pa Valley Trek', [{ slug: 'sa-pa', name: 'Sa Pa', isPrimary: true }]),
  tour('halong-cruise', 'Hạ Long Bay Cruise', [
    { slug: 'ha-long', name: 'Hạ Long', isPrimary: true },
  ]),
  tour('north-loop', 'Northern Highlands Loop', [
    { slug: 'sa-pa', name: 'Sa Pa', isPrimary: true },
    { slug: 'ha-long', name: 'Hạ Long', isPrimary: false },
  ]),
];

/** Tiêu đề tour = <h3> trong `TourCard`; đếm chúng là đếm số card trong lưới. */
function tourTitles() {
  return screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
}

describe('RegionTours', () => {
  it('mặc định hiện tất cả tour của vùng', () => {
    render(<RegionTours tours={TOURS} places={PLACES} />);
    expect(tourTitles()).toEqual([
      'Sa Pa Valley Trek',
      'Hạ Long Bay Cruise',
      'Northern Highlands Loop',
    ]);
  });

  it('bấm chip một địa điểm thì chỉ còn tour chạm địa điểm đó', async () => {
    const user = userEvent.setup();
    render(<RegionTours tours={TOURS} places={PLACES} />);

    await user.click(screen.getByRole('button', { name: 'Hạ Long' }));

    // `north-loop` chạm Hạ Long ở chặng phụ nên PHẢI còn — lọc theo `some()`,
    // không phải theo điểm đến chính.
    expect(tourTitles()).toEqual(['Hạ Long Bay Cruise', 'Northern Highlands Loop']);
  });

  it('chip đang chọn mang aria-pressed=true, các chip khác false', async () => {
    const user = userEvent.setup();
    render(<RegionTours tours={TOURS} places={PLACES} />);

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Sa Pa' }));

    expect(screen.getByRole('button', { name: 'Sa Pa' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Hạ Long' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('lọc ra 0 tour thì hiện trạng thái rỗng, KHÔNG phải lưới rỗng', async () => {
    const user = userEvent.setup();
    render(<RegionTours tours={TOURS} places={PLACES} />);

    await user.click(screen.getByRole('button', { name: 'Ninh Bình' }));

    expect(screen.getByText('No trips run in this region yet.')).toBeInTheDocument();
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
  });

  it('chỉ một trang thì KHÔNG render thanh phân trang', () => {
    // 3 tour < 8/trang → đúng một trang. Thanh phân trang vẫn được DỰNG (nhánh
    // có thật khi gắn API) nhưng phải tự ẩn ở đây.
    render(<RegionTours tours={TOURS} places={PLACES} />);
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
  });
});
