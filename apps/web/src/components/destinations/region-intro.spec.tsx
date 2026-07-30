import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { REGIONS } from '@/mocks/regions';
import { RegionIntro } from './region-intro';

beforeAll(() => {
  // jsdom không hiện thực IntersectionObserver, mà `SectionEyebrow` dùng
  // `whileInView` của framer-motion — thiếu API này là ném ReferenceError lúc
  // mount. Stub tối giản (không làm gì) là đủ vì test không quan sát animation.
  //
  // CỐ Ý để cục bộ, KHÔNG dời lên `vitest.setup.ts` dù vài spec khác có bản y
  // hệt: đã đo — dời lên setup chung làm **19 test ở 3 file khác gãy**, vì có
  // global này thì framer-motion đi nhánh khác hẳn so với khi không có.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

// biome-ignore lint/style/noNonNullAssertion: REGIONS là hằng 3 phần tử ở module scope
const NORTH = REGIONS[0]!;

const HIGHLIGHTS = [
  { title: 'Emerald bays', body: 'Overnight on a junk.' },
  { title: 'Highland treks', body: 'Walk the rice terraces.' },
  { title: 'River caves', body: 'Row between the karst peaks.' },
];

const TAGS = ['Cruises', 'Trekking'];

const VARIANTS = ['aside', 'row', 'stacked'] as const;

describe('RegionIntro — ba biến thể, một khu', () => {
  it.each(VARIANTS)('biến thể %s in đủ tiêu đề, hai đoạn, tags và CTA', (variant) => {
    render(<RegionIntro region={NORTH} variant={variant} tags={TAGS} highlights={HIGHLIGHTS} />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'The best Northern Vietnam tours' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Browse Northern Vietnam trips/ })).toHaveAttribute(
      'href',
      '#tours',
    );
    expect(screen.getByText('Cruises')).toBeInTheDocument();
    for (const item of HIGHLIGHTS) {
      expect(screen.getByRole('heading', { level: 4, name: item.title })).toBeInTheDocument();
    }
  });

  it.each(VARIANTS)('biến thể %s tự khai tên mình trên DOM', (variant) => {
    const { container } = render(
      <RegionIntro region={NORTH} variant={variant} tags={TAGS} highlights={HIGHLIGHTS} />,
    );
    expect(container.querySelector(`[data-intro="${variant}"]`)).not.toBeNull();
  });

  // Ba biến thể phải khác nhau ở HÌNH KHỐI, không chỉ ở tên. Đo bằng cách so lớp
  // của khối bọc và của khối highlights — ba bộ lớp giống nhau nghĩa là ba trang
  // vẫn đọc "na ná", đúng thứ user đã bác.
  it('ba biến thể cho ba bộ lớp bố cục KHÁC nhau', () => {
    const shapes = VARIANTS.map((variant) => {
      const { container, unmount } = render(
        <RegionIntro region={NORTH} variant={variant} tags={TAGS} highlights={HIGHLIGHTS} />,
      );
      const wrapper = container.querySelector(`[data-intro="${variant}"]`)?.className ?? '';
      const highlights = container.querySelector('[data-intro-highlights]')?.className ?? '';
      const items = container.querySelector('[data-intro-items]')?.className ?? '';
      unmount();
      return `${wrapper}|${highlights}|${items}`;
    });
    expect(new Set(shapes).size).toBe(VARIANTS.length);
  });

  it('aside dựng hai cột — chữ trái, highlights phải', () => {
    const { container } = render(
      <RegionIntro region={NORTH} variant="aside" tags={TAGS} highlights={HIGHLIGHTS} />,
    );
    expect(container.querySelector('[data-intro="aside"]')?.className).toContain('lg:grid-cols-2');
  });

  it('row xếp ba highlight thành HÀNG NGANG, không phải hai cột', () => {
    const { container } = render(
      <RegionIntro region={NORTH} variant="row" tags={TAGS} highlights={HIGHLIGHTS} />,
    );
    expect(container.querySelector('[data-intro="row"]')?.className).not.toContain(
      'lg:grid-cols-2',
    );
    expect(container.querySelector('[data-intro-items]')?.className).toContain('sm:grid-cols-3');
  });

  it('stacked căn giữa khối chữ và xếp highlights DỌC', () => {
    const { container } = render(
      <RegionIntro region={NORTH} variant="stacked" tags={TAGS} highlights={HIGHLIGHTS} />,
    );
    expect(container.querySelector('[data-intro-highlights]')?.className).toContain('mx-auto');
    expect(container.querySelector('[data-intro-items]')?.className).not.toContain(
      'sm:grid-cols-3',
    );
    expect(container.querySelector('[data-intro-copy]')?.className).toContain('text-center');
  });

  // `highlights` rỗng là nhánh có thật khi gắn API (vùng chưa có copy highlight).
  // Khi đó khối highlights bỏ HẲN — một khối rỗng vẫn ăn chỗ trong luồng.
  it.each(VARIANTS)('biến thể %s: highlights rỗng thì bỏ hẳn khối đó', (variant) => {
    const { container } = render(
      <RegionIntro region={NORTH} variant={variant} tags={TAGS} highlights={[]} />,
    );
    expect(container.querySelector('[data-intro-highlights]')).toBeNull();
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  /**
   * ── Hợp đồng SỐ DÒNG (Task 5o) ──
   *
   * Đo ở 1440 trước khi vá: ba mục highlight của miền Bắc cao **56/80/56** vì mục
   * giữa có câu dài hơn nên xuống hai dòng. Ở `aside` ba mục xếp DỌC nên đây không
   * phải "lệch pha giữa hai thẻ cùng hàng" — nó là NHỊP: khoảng giữa các chip icon
   * thành 80px rồi 104px, tức ba mục không còn đứng trên một thang đều.
   *
   * Giữ chỗ hai dòng cho câu mô tả là thứ đưa thang đó về đều. **Không** `line-clamp`
   * — cùng lý lẽ như `region-days.tsx`: câu biên tập ngắn trong hộp rộng, cắt chữ ở
   * đây là đổi một lỗi hình thành một lỗi nội dung. Ở `row` (miền Trung) hộp hẹp hơn
   * nên câu vốn đã 3–4 dòng và `min-h` là no-op; ba mục ở đó cao bằng nhau nhờ
   * `grid` stretch, không nhờ luật này.
   */
  it.each(VARIANTS)('biến thể %s: câu mô tả highlight giữ chỗ hai dòng', (variant) => {
    const { container } = render(
      <RegionIntro region={NORTH} variant={variant} tags={TAGS} highlights={HIGHLIGHTS} />,
    );
    const bodies = [...container.querySelectorAll('[data-intro-items] [data-highlight-body]')];
    expect(bodies).toHaveLength(HIGHLIGHTS.length);
    for (const body of bodies) {
      expect(body.className).toContain('min-h-[2lh]');
      expect(body.className).not.toContain('line-clamp');
    }
  });

  it.each(VARIANTS)('biến thể %s: tags rỗng thì bỏ cả hàng, không để nhãn treo', (variant) => {
    render(<RegionIntro region={NORTH} variant={variant} tags={[]} highlights={HIGHLIGHTS} />);
    expect(screen.queryByText(/Best for/)).not.toBeInTheDocument();
  });
});
