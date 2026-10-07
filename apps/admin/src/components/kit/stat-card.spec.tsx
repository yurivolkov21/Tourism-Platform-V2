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

  // Review AL3: ngưỡng `@[220px]` từng hiệu chỉnh theo MỘT mẫu ("$40,849.38" kèm "13.5%") —
  // doanh thu 6–7 chữ số hay pill % lớn vẫn bị Card `overflow-hidden` cắt mất 10–44px. jsdom
  // không dựng bố cục, nên các ca dưới canh đúng cấu trúc và lớp; số đo thật (Edge headless, CSS
  // Tailwind biên dịch từ globals.css của admin, thẻ rộng 150–340px) ghi ở báo cáo của đợt vá.
  it.each([
    ['delta', UP, 'stat-delta'],
    [
      'callout',
      { ...BASE, callout: { label: 'Needs attention', tone: 'bad' as const } },
      'stat-callout',
    ],
  ])(
    'phần đầu bố cục theo nội dung: pill %s nằm cạnh khối nhãn + số, hết chỗ thì tự xuống dòng — không ngưỡng px nào',
    (_kind, props, testId) => {
      render(<StatCard {...props} />);

      const header = document.querySelector('[data-slot="card-header"]') as HTMLElement;
      expect(header).toHaveClass('flex', 'flex-wrap', 'justify-between');

      // Hai mục của hàng: khối nhãn + con số, và pill. Nhãn với số đi chung một khối để pill
      // còn chỗ thì đứng góc phải ngang hàng nhãn, hết chỗ thì xuống dưới con số, căn trái.
      const action = screen.getByTestId(testId).closest('[data-slot="card-action"]');
      expect(action?.parentElement).toBe(header);
      const block = screen.getByText(props.value).parentElement;
      expect(block?.parentElement).toBe(header);
      expect(block).toContainElement(screen.getByText(props.label));

      // Không còn ngưỡng bề rộng cố định nào quyết chỗ của pill.
      for (const element of [header, action]) {
        expect(element?.className).not.toMatch(/@\[\d+px\]/);
      }
    },
  );

  it('con số không bao giờ bị cắt: cỡ chữ co theo bề ngang phần đầu thẻ, hết chỗ thì xuống dòng chứ không bị cắt hay thành "…"', () => {
    render(<StatCard {...UP} />);

    const value = screen.getByText('$1,240.50');
    // Cỡ chữ là hàm của bề ngang khung (đơn vị `cqi`), không phải bậc theo ngưỡng px.
    expect(value.className).toMatch(/text-\[length:[^\]]*cqi/);
    expect(value.className).not.toMatch(/@\[\d+px\]/);
    expect(value).toHaveClass('wrap-anywhere');
    expect(value).not.toHaveClass('truncate');
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

  // ADR-0028 — khoảng ngày nói MỘT lần cho cả hàng, không lặp trong bốn
  // caption. Chỉ `/bookings` truyền; sáu vùng còn lại không có bộ lọc ngày.
  it('in dòng khoảng ngày khi được đưa', () => {
    render(
      <StatCardRow cards={[{ key: 'revenue', ...BASE }]} period="Showing Sep 1 – Sep 30, 2026" />,
    );
    expect(screen.getByText('Showing Sep 1 – Sep 30, 2026')).toBeInTheDocument();
  });

  it('không có khoảng thì KHÔNG thêm dòng nào — sáu vùng kia không đổi', () => {
    const { container } = render(<StatCardRow cards={[{ key: 'revenue', ...BASE }]} />);
    expect(container.querySelector('[data-testid="stat-period"]')).toBeNull();
  });

  it('hàng 4 thẻ: 2 cột từ màn hẹp nhất (spec 2026-10-05 §4 #12), một hàng bốn thẻ ở màn rộng', () => {
    render(
      <StatCardRow
        cards={[
          { key: 'revenue', ...BASE },
          { key: 'paid', ...BASE, label: 'Paid bookings' },
          { key: 'pending', ...BASE, label: 'Pending' },
          { key: 'cancelled', ...BASE, label: 'Cancelled' },
        ]}
      />,
    );
    const grid = screen
      .getByRole('region', { name: messages.admin.stats.regionLabel })
      .querySelector('.grid');
    expect(grid).toHaveClass('grid-cols-2', '@5xl/main:grid-cols-4');
  });

  // Review A2-5: lưới 2 cột từ màn hẹp nhất từng áp cho MỌI hàng, nên bốn trang 3 thẻ (Outbox,
  // Payment events, Enquiries, Subscribers) ra dáng 2+1 ở 375px — thẻ thứ ba mồ côi. Hàng 3 thẻ
  // về như trước: 1 cột trên điện thoại, 2 cột từ `@xl/main`, 3 cột ở màn rộng.
  it('hàng 3 thẻ: 1 cột trên điện thoại — không thẻ mồ côi; các bậc rộng hơn giữ nguyên', () => {
    render(
      <StatCardRow
        cards={[
          { key: 'created', ...BASE, label: 'Created 28d' },
          { key: 'won', ...BASE, label: 'Won 28d' },
          { key: 'open', ...BASE, label: 'Open now' },
        ]}
      />,
    );
    const grid = screen
      .getByRole('region', { name: messages.admin.stats.regionLabel })
      .querySelector('.grid');
    expect(grid).toHaveClass('grid-cols-1', '@xl/main:grid-cols-2', '@5xl/main:grid-cols-3');
    expect(grid).not.toHaveClass('grid-cols-2');
  });

  it('hàng một thẻ: 1 cột ở mọi bề rộng — nửa bề rộng trơ trọi', () => {
    render(<StatCardRow cards={[{ key: 'revenue', ...BASE }]} />);
    const grid = screen
      .getByRole('region', { name: messages.admin.stats.regionLabel })
      .querySelector('.grid');
    expect(grid).toHaveClass('grid-cols-1');
    expect(grid).not.toHaveClass('grid-cols-2');
    expect(grid).not.toHaveClass('@xl/main:grid-cols-2');
  });
});
