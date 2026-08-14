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
  factDurationNote: 'Day four is a buffer morning, not a rush.',
  factGroupSizeNote: 'Ten riders, one driver each.',
  factDifficultyNote: null,
  factGoodForNote: null,
  highlights: ['The Mã Pí Lèng pass', 'Đồng Văn old town'],
} as unknown as TourDetailVM;

describe('OverviewPanel', () => {
  it('bốn card dữ kiện, mỗi card một con số lấy thẳng từ dữ liệu', () => {
    render(<OverviewPanel tour={TOUR} />);
    expect(screen.getAllByTestId('fact-card')).toHaveLength(4);
    expect(screen.getByText('4 days · 3 nights')).toBeInTheDocument();
    expect(screen.getByText('Max 10 guests')).toBeInTheDocument();
    expect(screen.getByText('Challenging')).toBeInTheDocument();
    expect(screen.getByText('Friends · Solo travellers')).toBeInTheDocument();
  });

  it('nhãn enum đi qua i18n, KHÔNG in thẳng giá trị enum', () => {
    render(<OverviewPanel tour={TOUR} />);
    expect(screen.queryByText('CHALLENGING')).toBeNull();
    expect(screen.queryByText(/FRIENDS/)).toBeNull();
  });

  it('tour trong ngày KHÔNG ghi "0 nights"', () => {
    render(<OverviewPanel tour={{ ...TOUR, durationDays: 1 } as unknown as TourDetailVM} />);
    expect(screen.getByText('1 day')).toBeInTheDocument();
    expect(screen.queryByText(/0 nights/)).toBeNull();
  });

  it('hai card CÓ chỗ để tới thì mới có link, hai card kia không', () => {
    render(<OverviewPanel tour={TOUR} />);
    expect(screen.getByRole('link', { name: /see the itinerary/i })).toHaveAttribute(
      'href',
      '#itinerary',
    );
    expect(screen.getByRole('link', { name: /how demanding/i })).toHaveAttribute(
      'href',
      '#good-to-know',
    );
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('difficulty null thì BỎ HẲN card đó, không hiện "—" hay chuỗi rỗng', () => {
    render(<OverviewPanel tour={{ ...TOUR, difficulty: null } as unknown as TourDetailVM} />);
    expect(screen.getAllByTestId('fact-card')).toHaveLength(3);
    expect(screen.queryByText('—')).toBeNull();
    expect(screen.getByText('Max 10 guests')).toBeInTheDocument();
  });

  it('suitableFor rỗng thì bỏ card đó', () => {
    render(<OverviewPanel tour={{ ...TOUR, suitableFor: [] } as unknown as TourDetailVM} />);
    expect(screen.getAllByTestId('fact-card')).toHaveLength(3);
  });

  it('summary null thì không render đoạn văn rỗng', () => {
    const { container } = render(
      <OverviewPanel tour={{ ...TOUR, summary: null } as unknown as TourDetailVM} />,
    );
    for (const p of container.querySelectorAll('p')) {
      expect(p.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });

  it('highlights rỗng thì không render danh sách trống', () => {
    render(<OverviewPanel tour={{ ...TOUR, highlights: [] } as unknown as TourDetailVM} />);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('mỗi highlight là một mục có dấu tick', () => {
    render(<OverviewPanel tour={TOUR} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('The Mã Pí Lèng pass')).toBeInTheDocument();
  });

  it('câu mô tả hiện dưới giá trị của đúng card có dữ liệu', () => {
    render(<OverviewPanel tour={TOUR} />);
    expect(screen.getByText('Day four is a buffer morning, not a rush.')).toBeInTheDocument();
    expect(screen.getByText('Ten riders, one driver each.')).toBeInTheDocument();
  });

  it('card thiếu mô tả vẫn đọc được, KHÔNG in dòng rỗng', () => {
    // 30 tour × 4 câu là việc soạn nội dung thật; tour mới ở admin sẽ trống.
    const { container } = render(<OverviewPanel tour={TOUR} />);
    for (const p of container.querySelectorAll('[data-testid="fact-card"] p')) {
      expect(p.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    }
    expect(screen.getAllByTestId('fact-card')).toHaveLength(4);
  });
});
