import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import type { StatCardProps } from './stat-card';
import { StatCard, StatCardRow } from './stat-card';

/**
 * Hợp đồng của stat card (kit P4b — mẫu user chốt 31/08: nhãn · số lớn · pill
 * delta ↑/↓ · caption "vs X prior 28 days"). Card KHÔNG tính gì: mọi con chữ
 * do `stats-view.ts` (thuần, có test riêng) nấu sẵn — test ở đây chỉ soi việc
 * nó hiện đúng thứ được đưa và tô đúng hướng.
 */

const BASE: StatCardProps = {
  label: 'Revenue',
  value: '$1,240.50',
  caption: 'vs $900.00 prior 28 days',
};

const UP: StatCardProps = {
  ...BASE,
  delta: { direction: 'up', amount: '33.3%', srLabel: 'Up 33.3% on the previous period' },
  deltaGood: true,
};

describe('StatCard', () => {
  it('hiện nhãn, số lớn và caption kỳ trước', () => {
    render(<StatCard {...BASE} />);

    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('$1,240.50')).toBeInTheDocument();
    expect(screen.getByText('vs $900.00 prior 28 days')).toBeInTheDocument();
  });

  it('pill mang độ lớn % kèm MỘT CÂU cho trình đọc màn hình — mũi tên không thành câu', () => {
    render(<StatCard {...UP} />);

    expect(screen.getByText('33.3%')).toBeInTheDocument();
    expect(screen.getByText('Up 33.3% on the previous period')).toBeInTheDocument();
  });

  it('con số nhìn thấy được ẩn khỏi trình đọc màn hình — nếu không nó đọc % hai lần', () => {
    render(<StatCard {...UP} />);

    expect(screen.getByText('33.3%')).toHaveAttribute('aria-hidden', 'true');
  });

  it('chiều và hướng tốt/xấu phơi ra thành data-attribute — tô màu là hệ quả, không phải nguồn', () => {
    const { rerender } = render(<StatCard {...UP} />);
    expect(screen.getByTestId('stat-delta')).toHaveAttribute('data-trend', 'up');
    expect(screen.getByTestId('stat-delta')).toHaveAttribute('data-tone', 'good');

    // Cùng chiều ĐI LÊN nhưng của một metric mà lên là xấu (tỉ lệ huỷ, hàng
    // đợi phình ra): pill vẫn mũi tên lên, màu đổi.
    rerender(<StatCard {...UP} deltaGood={false} />);
    expect(screen.getByTestId('stat-delta')).toHaveAttribute('data-trend', 'up');
    expect(screen.getByTestId('stat-delta')).toHaveAttribute('data-tone', 'bad');

    // Metric trung tính: có pill, không có phán quyết màu.
    rerender(<StatCard {...UP} deltaGood={undefined} />);
    expect(screen.getByTestId('stat-delta')).toHaveAttribute('data-tone', 'neutral');
  });

  it('callout (card ảnh chụp): pill trạng thái có tông, KHÔNG mũi tên, testid riêng — không phải delta', () => {
    // Vòng vá review F7: card Failed từng mượn `delta.direction='flat'` để
    // lấy tông đỏ; nay có khe riêng để "flat" vẫn chỉ nghĩa là "không đổi".
    render(
      <StatCard
        {...BASE}
        callout={{ label: 'Needs attention', srLabel: '2 failed emails', tone: 'bad' }}
      />,
    );
    expect(screen.queryByTestId('stat-delta')).toBeNull();
    const pill = screen.getByTestId('stat-callout');
    expect(pill).toHaveAttribute('data-tone', 'bad');
    expect(pill).not.toHaveAttribute('data-trend');
    expect(screen.getByText('2 failed emails')).toHaveClass('sr-only');
  });

  it('không so sánh được thì KHÔNG có pill', () => {
    render(<StatCard {...BASE} value={messages.admin.stats.noValue} />);

    expect(screen.queryByTestId('stat-delta')).not.toBeInTheDocument();
  });
});

describe('StatCardRow', () => {
  it('dựng đúng một card cho mỗi VM, trong một landmark có tên', () => {
    render(
      <StatCardRow
        cards={[
          { key: 'revenue', ...BASE },
          { key: 'paid', ...BASE, label: 'Paid bookings', value: '12' },
        ]}
      />,
    );

    expect(
      screen.getByRole('region', { name: messages.admin.stats.regionLabel }),
    ).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('Paid bookings')).toBeInTheDocument();
  });
});
