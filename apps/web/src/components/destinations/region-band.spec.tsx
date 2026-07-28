import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { REGIONS } from '@/mocks/regions';
import type { MockDestination } from '@/mocks/types';
import { RegionBand } from './region-band';

// biome-ignore lint/style/noNonNullAssertion: REGIONS là hằng 3 phần tử ở module scope, phần tử 0 luôn tồn tại
const NORTH = REGIONS[0]!;

function dest(slug: string, name: string, description: string, tourCount: number): MockDestination {
  return {
    id: `id-${slug}`,
    slug,
    name,
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description,
    tourCount,
  };
}

const PLACES = [
  dest('sa-pa', 'Sa Pa', 'Misty rice terraces', 3),
  dest('ha-long', 'Hạ Long', 'Limestone bay cruises', 2),
];

describe('RegionBand', () => {
  it('HIỆN mô tả từng địa điểm — đây là thứ bản thẻ cũ bỏ phí', () => {
    render(<RegionBand region={NORTH} destinations={PLACES} tourCount={6} />);
    expect(screen.getByText('Misty rice terraces')).toBeInTheDocument();
    expect(screen.getByText('Limestone bay cruises')).toBeInTheDocument();
  });

  it('mỗi địa điểm là link sang trang lọc tour CÓ THẬT', () => {
    render(<RegionBand region={NORTH} destinations={PLACES} tourCount={6} />);
    expect(screen.getByRole('link', { name: /Sa Pa/ })).toHaveAttribute(
      'href',
      '/tours?destinations=sa-pa',
    );
  });

  it('CTA vùng dùng slug URL', () => {
    render(<RegionBand region={NORTH} destinations={PLACES} tourCount={6} />);
    expect(screen.getByRole('link', { name: /explore northern vietnam/i })).toHaveAttribute(
      'href',
      '/destinations/northern-vietnam',
    );
  });

  it('in số tour của VÙNG, không cộng dồn số của từng địa điểm', () => {
    // 3 + 2 = 5 nhưng vùng có 6 (tour distinct). Cộng dồn là nói sai.
    render(<RegionBand region={NORTH} destinations={PLACES} tourCount={6} />);
    expect(screen.getByText(/6 tours/)).toBeInTheDocument();
    expect(screen.queryByText(/5 tours/)).not.toBeInTheDocument();
  });

  it('gắn data-region để lớp token tint đúng vùng', () => {
    const { container } = render(<RegionBand region={NORTH} destinations={PLACES} tourCount={6} />);
    expect(container.querySelector('[data-region="north"]')).not.toBeNull();
  });

  it('KHÔNG đánh số thứ tự vùng — ba vùng không phải các bước tuần tự', () => {
    render(<RegionBand region={NORTH} destinations={PLACES} tourCount={6} />);
    expect(screen.queryByText(/^0?1$/)).not.toBeInTheDocument();
  });
});
