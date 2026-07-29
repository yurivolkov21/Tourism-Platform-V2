import { render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ownToursInRegion, toursInRegion } from '@/lib/regions';
import { DESTINATIONS } from '@/mocks/destinations';
import { REGIONS } from '@/mocks/regions';
import { TOURS } from '@/mocks/tours';
import type { MockTourCard, MockTourDifficulty } from '@/mocks/types';
import { RegionSpectrum } from './region-spectrum';

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

/** Fixture tối giản — chỉ những field khu phổ thật sự đọc mang giá trị có nghĩa. */
function tour(
  slug: string,
  durationDays: number,
  difficulty: MockTourDifficulty | null,
): MockTourCard {
  return {
    id: `id-${slug}`,
    slug,
    title: slug,
    summary: null,
    basePrice: '100.00',
    compareAtPrice: null,
    currency: 'USD',
    durationDays,
    difficulty,
    maxGroupSize: 12,
    isFeatured: false,
    destinations: [{ slug: 'sa-pa', name: 'Sa Pa', isPrimary: true }],
    category: { slug: 'trekking', name: 'Trekking' },
    ratingAvg: null,
    ratingCount: 0,
  };
}

/** Hình dạng thật của miền Bắc: 1, 2, 2, 3, 8 — CÓ hai chuyến cùng 2 ngày. */
const NORTH = [
  tour('ninh-binh-river-caves', 1, 'EASY'),
  tour('ha-long-bay-cruise', 2, 'EASY'),
  tour('sa-pa-homestay-weekend', 2, 'MODERATE'),
  tour('sa-pa-terraces-trek', 3, 'MODERATE'),
  tour('northern-highlands-loop', 8, 'CHALLENGING'),
];

const PROPS = { regionName: 'Northern Vietnam', tours: NORTH };

function rows(container: HTMLElement) {
  return [...container.querySelectorAll('[data-days]')];
}

/** Class HÌNH DẠNG của thanh ở một bậc — chỉ giữ phần mang tín hiệu (độ dày,
    nền, nét viền), bỏ phần khung chung để test không đỏ vì một tinh chỉnh bo góc. */
function barClass(container: HTMLElement, grade: string) {
  const bar = container.querySelector(
    `[data-grade="${grade}"] a > span[aria-hidden="true"] > span:last-child`,
  );
  return (bar?.className ?? '')
    .split(' ')
    .filter((c) => /^(h-|bg-|border)/.test(c))
    .join(' ');
}

describe('RegionSpectrum', () => {
  it('vẽ đúng MỘT điểm cho mỗi chuyến được truyền vào', () => {
    const { container } = render(<RegionSpectrum {...PROPS} />);
    expect(rows(container)).toHaveLength(NORTH.length);
  });

  // Bẫy số 1 của khu này: miền Bắc có HAI chuyến 2 ngày. Vẽ chúng lên cùng một
  // toạ độ trên trục là mất hẳn một chuyến — nhìn thì thấy 4 điểm, dữ liệu có 5.
  it('hai chuyến CÙNG số ngày là hai điểm riêng, không đè lên nhau', () => {
    const { container } = render(<RegionSpectrum {...PROPS} />);
    const twoDay = container.querySelectorAll('[data-days="2"]');
    expect(twoDay).toHaveLength(2);
    // Hai phần tử DOM khác nhau, và mỗi cái mang slug của chính nó.
    const slugs = [...twoDay].map((el) => el.getAttribute('data-tour'));
    expect(new Set(slugs)).toEqual(new Set(['ha-long-bay-cruise', 'sa-pa-homestay-weekend']));
  });

  it('mỗi điểm là LINK sang trang tour có thật', () => {
    render(<RegionSpectrum {...PROPS} />);
    expect(screen.getByRole('link', { name: /northern-highlands-loop/ })).toHaveAttribute(
      'href',
      '/tours/northern-highlands-loop',
    );
  });

  it('sắp theo số ngày TĂNG DẦN — trục đọc từ ngắn tới dài', () => {
    const { container } = render(<RegionSpectrum {...PROPS} />);
    const days = rows(container).map((el) => Number(el.getAttribute('data-days')));
    expect(days).toEqual([1, 2, 2, 3, 8]);
  });

  it('hai chuyến bằng nhau giữ thứ tự CATALOGUE, không đảo theo tên', () => {
    // Cùng luật `longestTourInRegion`: bằng nhau thì chuyến gặp trước đứng trước.
    const { container } = render(<RegionSpectrum {...PROPS} />);
    const slugs = rows(container).map((el) => el.getAttribute('data-tour'));
    expect(slugs.slice(1, 3)).toEqual(['ha-long-bay-cruise', 'sa-pa-homestay-weekend']);
  });

  it('thước chạy tuyến tính từ 1 tới số ngày LỚN NHẤT của tập', () => {
    const { container } = render(<RegionSpectrum {...PROPS} />);
    const ticks = [...container.querySelectorAll('[data-tick]')].map((el) =>
      Number(el.getAttribute('data-tick')),
    );
    expect(ticks).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  // Bài học ADR-0015: màu không được là tín hiệu DUY NHẤT. Người mù màu phải đọc
  // được bậc độ khó, nên mỗi điểm mang nhãn CHỮ chứ không chỉ khác nhau ở hình.
  it('mỗi điểm có nhãn CHỮ cho bậc độ khó, không chỉ khác nhau ở hình', () => {
    const { container } = render(<RegionSpectrum {...PROPS} />);
    const hardest = container.querySelector('[data-tour="northern-highlands-loop"]');
    expect(hardest).not.toBeNull();
    expect(within(hardest as HTMLElement).getByText('Challenging')).toBeInTheDocument();
  });

  // Nhãn chữ là tín hiệu KHÔNG-MÀU bắt buộc, nhưng khu này tồn tại để cho THẤY
  // một dải — nếu ba bậc vẽ ra cùng một hình thì phần đồ hoạ không nói gì và
  // chỉ còn là ba dòng chữ có gạch trang trí.
  it('ba bậc vẽ ra ba HÌNH khác nhau, không chỉ khác nhãn chữ', () => {
    const { container } = render(<RegionSpectrum {...PROPS} />);
    const shapes = ['EASY', 'MODERATE', 'CHALLENGING'].map((grade) => barClass(container, grade));
    expect(shapes.every((s) => s.length > 0)).toBe(true);
    expect(new Set(shapes).size).toBe(3);
  });

  it('mẫu trong chú giải mang ĐÚNG hình của thanh — chú giải không được nói dối', () => {
    const { container } = render(<RegionSpectrum {...PROPS} />);
    for (const grade of ['EASY', 'MODERATE', 'CHALLENGING']) {
      const swatch =
        container.querySelector(`[data-legend-grade="${grade}"] span[aria-hidden="true"]`)
          ?.className ?? '';
      for (const cls of barClass(container, grade).split(' ')) {
        expect(swatch, `${grade} → ${cls}`).toContain(cls);
      }
    }
  });

  it('chú giải liệt kê ĐÚNG các bậc có mặt, không bịa bậc vắng mặt', () => {
    const { container } = render(
      <RegionSpectrum {...PROPS} tours={[tour('a', 1, 'EASY'), tour('b', 2, 'EASY')]} />,
    );
    const legend = container.querySelector('[data-grade-legend]');
    expect(legend).not.toBeNull();
    const scope = within(legend as HTMLElement);
    expect(scope.getByText('Easy')).toBeInTheDocument();
    expect(scope.queryByText('Moderate')).not.toBeInTheDocument();
    expect(scope.queryByText('Challenging')).not.toBeInTheDocument();
  });

  it('chú giải đếm đúng số chuyến mỗi bậc', () => {
    const { container } = render(<RegionSpectrum {...PROPS} />);
    // Đọc theo TỪNG bậc chứ không `getByText('2 tours')`: Easy và Moderate cùng
    // có 2 chuyến, nên một phép tìm theo chữ sẽ trúng hai chỗ và không chứng
    // minh được con số nào thuộc bậc nào.
    const item = (grade: string) =>
      container.querySelector(`[data-legend-grade="${grade}"]`)?.textContent;
    expect(item('EASY')).toContain('2 tours');
    expect(item('MODERATE')).toContain('2 tours');
    expect(item('CHALLENGING')).toContain('1 tour');
  });

  // `difficulty` của contract là nullable — miền Nam có `phu-quoc-reef-days`.
  // Điểm vẫn phải vẽ (số ngày là sự thật), chỉ bậc là chưa biết.
  it('chuyến chưa xếp bậc vẫn có điểm, và mang nhãn "Not graded"', () => {
    const { container } = render(
      <RegionSpectrum {...PROPS} tours={[tour('a', 1, 'EASY'), tour('ungraded', 3, null)]} />,
    );
    expect(rows(container)).toHaveLength(2);
    const row = container.querySelector('[data-tour="ungraded"]');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('Not graded')).toBeInTheDocument();
  });

  it('không chuyến nào thì BỎ HẲN khu — một trục trống không nói gì', () => {
    const { container } = render(<RegionSpectrum {...PROPS} tours={[]} />);
    expect(container.querySelector('section')).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  // Bẫy số 2: `north-to-south-classic` 12 ngày chạm cả ba vùng. Lọt vào tập là
  // trục dài gấp rưỡi và cụm 1–8 bị bóp lại thành một vệt sát mép trái.
  it('nuôi bằng ĐÚNG nguồn (tour riêng vùng) thì tour xuyên vùng vắng mặt và trục dừng ở 8', () => {
    const northOwn = ownToursInRegion(
      REGIONS,
      DESTINATIONS,
      toursInRegion(REGIONS, DESTINATIONS, TOURS, 'north'),
      'north',
    );
    const { container } = render(<RegionSpectrum regionName="Northern Vietnam" tours={northOwn} />);
    expect(container.querySelector('[data-tour="north-to-south-classic"]')).toBeNull();
    const ticks = [...container.querySelectorAll('[data-tick]')];
    expect(ticks[ticks.length - 1]?.getAttribute('data-tick')).toBe('8');
  });
});
