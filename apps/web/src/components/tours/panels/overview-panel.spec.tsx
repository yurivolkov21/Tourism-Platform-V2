import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TourDetailVM } from '@/lib/api/tours';
import { OverviewPanel } from './overview-panel';

const TOUR = {
  durationDays: 4,
  maxGroupSize: 10,
  difficulty: 'CHALLENGING',
  suitableFor: ['FRIENDS', 'SOLO'],
  summary: 'Four days riding pillion behind a local easyrider.',
  highlights: ['The Mã Pí Lèng pass', 'Đồng Văn old town'],
} as unknown as TourDetailVM;

describe('OverviewPanel', () => {
  it('hiện dữ kiện bằng nhãn i18n, KHÔNG in thẳng giá trị enum', () => {
    render(<OverviewPanel tour={TOUR} />);
    expect(screen.getByText('Challenging')).toBeInTheDocument();
    expect(screen.queryByText('CHALLENGING')).toBeNull();
    expect(screen.getByText(/Friends/)).toBeInTheDocument();
    expect(screen.queryByText(/FRIENDS/)).toBeNull();
  });

  it('difficulty null thì BỎ HẲN card đó, không hiện "—" hay chuỗi rỗng', () => {
    render(<OverviewPanel tour={{ ...TOUR, difficulty: null } as unknown as TourDetailVM} />);
    expect(screen.queryByText('Challenging')).toBeNull();
    expect(screen.queryByText('—')).toBeNull();
    // ba card còn lại vẫn đứng
    expect(screen.getByText('Max 10 guests')).toBeInTheDocument();
  });

  it('suitableFor rỗng thì bỏ card đó', () => {
    render(<OverviewPanel tour={{ ...TOUR, suitableFor: [] } as unknown as TourDetailVM} />);
    expect(screen.queryByText(/Friends/)).toBeNull();
  });

  it('highlights rỗng thì không render danh sách trống', () => {
    render(<OverviewPanel tour={{ ...TOUR, highlights: [] } as unknown as TourDetailVM} />);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('summary null thì không render đoạn văn rỗng', () => {
    const { container } = render(
      <OverviewPanel tour={{ ...TOUR, summary: null } as unknown as TourDetailVM} />,
    );
    for (const p of container.querySelectorAll('p')) {
      expect(p.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });

  it('card thời lượng có link mở tab lịch trình bằng hash', () => {
    render(<OverviewPanel tour={TOUR} />);
    const link = screen.getByRole('link', { name: /itinerary/i });
    expect(link).toHaveAttribute('href', '#itinerary');
  });
});
