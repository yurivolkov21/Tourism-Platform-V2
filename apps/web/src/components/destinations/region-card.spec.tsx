import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
// `REGIONS` là DỮ LIỆU, sống ở `mocks/regions.ts` — `lib/regions.ts` chỉ có hàm
// thuần (xem comment đầu file đó). Brief gốc ghi `@/lib/regions`, đã sửa lại.
import { REGIONS } from '@/mocks/regions';
import type { MockDestination } from '@/mocks/types';
import { RegionCard } from './region-card';

// biome-ignore lint/style/noNonNullAssertion: REGIONS là hằng 3 phần tử ở module scope, phần tử 0 luôn tồn tại
const NORTH = REGIONS[0]!;

function dest(slug: string, name: string, tourCount: number): MockDestination {
  return {
    id: `id-${slug}`,
    slug,
    name,
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description: `About ${name}`,
    tourCount,
  };
}

const PLACES = [dest('ha-long', 'Hạ Long', 2), dest('sa-pa', 'Sa Pa', 3)];

describe('RegionCard', () => {
  it('CTA vào trang vùng dùng slug URL, không dùng key token', () => {
    render(<RegionCard region={NORTH} destinations={PLACES} tourCount={6} />);
    const cta = screen.getByRole('link', { name: /explore northern vietnam/i });
    expect(cta).toHaveAttribute('href', '/destinations/northern-vietnam');
  });

  it('mỗi địa điểm là LINK sang trang lọc tour CÓ THẬT', () => {
    render(<RegionCard region={NORTH} destinations={PLACES} tourCount={6} />);
    expect(screen.getByRole('link', { name: /Hạ Long/ })).toHaveAttribute(
      'href',
      '/tours?destinations=ha-long',
    );
  });

  it('in số tour của VÙNG, không cộng dồn số của từng địa điểm', () => {
    // 2 + 3 = 5 nhưng vùng có 6 (tour distinct). In tổng cộng dồn là nói sai.
    render(<RegionCard region={NORTH} destinations={PLACES} tourCount={6} />);
    expect(screen.getByText('6 tours')).toBeInTheDocument();
    expect(screen.queryByText('5 tours')).not.toBeInTheDocument();
  });

  it('gắn data-region để lớp token tint đúng vùng', () => {
    const { container } = render(<RegionCard region={NORTH} destinations={PLACES} tourCount={6} />);
    expect(container.querySelector('[data-region="north"]')).not.toBeNull();
  });

  it('số ÍT khi vùng chỉ có 1 tour', () => {
    render(<RegionCard region={NORTH} destinations={PLACES} tourCount={1} />);
    expect(screen.getByText('1 tour')).toBeInTheDocument();
  });
});
