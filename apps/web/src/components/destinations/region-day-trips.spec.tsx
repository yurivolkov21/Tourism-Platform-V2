import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { MockTourCard } from '@/mocks/types';
import { RegionDayTrips } from './region-day-trips';

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

/** Fixture tối giản — chỉ những field khu này thật sự đọc mang giá trị có nghĩa. */
function tour(
  slug: string,
  title: string,
  durationDays: number,
  basePrice: string,
  category: string,
): MockTourCard {
  return {
    id: `id-${slug}`,
    slug,
    title,
    summary: null,
    basePrice,
    compareAtPrice: null,
    currency: 'USD',
    durationDays,
    difficulty: 'EASY',
    maxGroupSize: 12,
    isFeatured: false,
    destinations: [{ slug: 'hoi-an', name: 'Hội An', isPrimary: true }],
    category: { slug: category.toLowerCase(), name: category },
    ratingAvg: null,
    ratingCount: 0,
  };
}

/** Hình dạng thật của miền Trung: BỐN chuyến một ngày cộng một chuyến 6 ngày. */
const CENTRAL = [
  tour('hoi-an-lantern-evening', 'Hội An Lantern Evening', 1, '59.00', 'Culture & heritage'),
  tour('hue-imperial-day', 'Huế Imperial Day', 1, '75.00', 'Culture & heritage'),
  tour('da-nang-coast-ride', 'Đà Nẵng Coast Ride', 1, '89.00', 'Scenic routes'),
  tour('hoi-an-cooking-market', 'Hội An Cooking Market', 1, '62.00', 'Food & markets'),
  tour('central-heritage-week', 'Central Heritage Week', 6, '740.00', 'Culture & heritage'),
];

function items(container: HTMLElement) {
  return [...container.querySelectorAll('[data-day-trip]')];
}

describe('RegionDayTrips', () => {
  it('hiện ĐỦ bốn chuyến một ngày của miền Trung — không nuốt mất chuyến nào', () => {
    const { container } = render(<RegionDayTrips tours={CENTRAL} />);
    expect(items(container).map((el) => el.getAttribute('data-day-trip'))).toEqual([
      'hoi-an-lantern-evening',
      'hue-imperial-day',
      'da-nang-coast-ride',
      'hoi-an-cooking-market',
    ]);
  });

  it('loại chuyến DÀI HƠN một ngày — tiêu đề hứa "fit in a single day"', () => {
    const { container } = render(<RegionDayTrips tours={CENTRAL} />);
    expect(container.querySelector('[data-day-trip="central-heritage-week"]')).toBeNull();
  });

  it('số trong tiêu đề là số ĐẾM ĐƯỢC, không phải hằng gõ tay', () => {
    render(<RegionDayTrips tours={CENTRAL} />);
    expect(
      screen.getByRole('heading', { level: 2, name: '4 of these trips fit in a single day' }),
    ).toBeInTheDocument();
  });

  it('bớt một chuyến thì con số trong tiêu đề đi theo', () => {
    render(<RegionDayTrips tours={CENTRAL.slice(0, 3)} />);
    expect(
      screen.getByRole('heading', { level: 2, name: '3 of these trips fit in a single day' }),
    ).toBeInTheDocument();
  });

  it('mỗi mục là LINK sang trang tour có thật', () => {
    render(<RegionDayTrips tours={CENTRAL} />);
    expect(screen.getByRole('link', { name: /Huế Imperial Day/ })).toHaveAttribute(
      'href',
      '/tours/hue-imperial-day',
    );
  });

  it('mỗi mục in chuyên mục và giá khởi điểm', () => {
    render(<RegionDayTrips tours={CENTRAL} />);
    expect(screen.getByText('Scenic routes')).toBeInTheDocument();
    expect(screen.getByText('$89')).toBeInTheDocument();
  });

  it('giá dùng MÃ TIỀN của chính tour, không phải hằng USD đặt cứng', () => {
    const eur = CENTRAL.slice(0, 2).map((t) => ({ ...t, currency: 'EUR' }));
    render(<RegionDayTrips tours={eur} />);
    expect(screen.getByText('€59')).toBeInTheDocument();
  });

  // Một "dải" một phần tử không phải dải — nó là một card lạc lõng, và tiêu đề
  // "1 of these trips fit in a single day" thì vừa sai ngữ pháp vừa vô nghĩa.
  it('chỉ MỘT chuyến một ngày thì BỎ HẲN khu', () => {
    const { container } = render(<RegionDayTrips tours={CENTRAL.slice(0, 1)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('không chuyến một ngày nào thì BỎ HẲN khu', () => {
    const { container } = render(<RegionDayTrips tours={[CENTRAL[4] as MockTourCard]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('mảng rỗng thì BỎ HẲN khu', () => {
    const { container } = render(<RegionDayTrips tours={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
