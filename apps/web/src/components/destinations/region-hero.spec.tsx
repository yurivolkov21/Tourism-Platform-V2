import { render, screen } from '@testing-library/react';
import { MotionConfig } from 'motion/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { REGIONS } from '@/mocks/regions';
import { RegionHero } from './region-hero';

beforeAll(() => {
  // `CountUp` đếm khi vào viewport (`useInView`); jsdom không có IntersectionObserver.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

function renderHero() {
  const region = REGIONS.find((r) => r.key === 'north');
  if (!region) throw new Error('thiếu vùng north trong REGIONS');
  return render(
    <MotionConfig reducedMotion="always">
      <RegionHero
        region={region}
        tagline="Mountains and bays."
        styles="Cruises · Trekking"
        stats={[
          { value: '$28', label: 'From' },
          { value: '8 days', label: 'Longest trip' },
          { value: 'Challenging', label: 'Hardest grade' },
        ]}
      />
    </MotionConfig>,
  );
}

describe('RegionHero — hàng số liệu', () => {
  it('nhãn là `<dt>` (term), con số là `<dd>` (definition) — trình đọc màn hình đọc "From: $28"', () => {
    renderHero();
    expect(screen.getAllByRole('term').map((el) => el.textContent)).toEqual([
      'From',
      'Longest trip',
      'Hardest grade',
    ]);
    expect(screen.getAllByRole('definition').map((el) => el.textContent)).toEqual([
      '$28',
      '8 days',
      'Challenging',
    ]);
  });
});
