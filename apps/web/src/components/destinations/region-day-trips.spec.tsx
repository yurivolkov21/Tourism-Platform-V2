import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { MockItineraryDay, MockTourCard } from '@/mocks/types';
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

/** Fixture tối giản — chỉ những field khu này thật sự đọc mang giá trị có nghĩa.
    `day1` là tiêu đề ngày 1 của hành trình, thứ khu này in làm câu mô tả. */
function tour(
  slug: string,
  title: string,
  durationDays: number,
  basePrice: string,
  category: string,
  day1: string | null = null,
  // Rating và độ khó khai được từ đây (thêm 30/07): thẻ giờ in cả hai, nên fixture
  // phải biểu diễn được CẢ HAI nhánh — có đánh giá và chưa ai đánh giá.
  rating: { avg: number; count: number } | null = null,
  difficulty: MockTourCard['difficulty'] = 'EASY',
): MockTourCard & { itinerary?: MockItineraryDay[] } {
  return {
    id: `id-${slug}`,
    slug,
    title,
    summary: null,
    basePrice,
    compareAtPrice: null,
    currency: 'USD',
    durationDays,
    difficulty,
    maxGroupSize: 12,
    isFeatured: false,
    destinations: [{ slug: 'hoi-an', name: 'Hội An', isPrimary: true }],
    category: { slug: category.toLowerCase(), name: category },
    ratingAvg: rating?.avg ?? null,
    ratingCount: rating?.count ?? 0,
    ...(day1 === null ? {} : { itinerary: [{ dayNumber: 1, title: day1, description: null }] }),
  };
}

/** Hình dạng thật của miền Trung: BỐN chuyến một ngày cộng một chuyến 6 ngày. */
const CENTRAL = [
  tour(
    'hoi-an-lantern-evening',
    'Hội An Lantern Evening',
    1,
    '59.00',
    'Culture & heritage',
    'Old town, lanterns, night market',
  ),
  tour(
    'hue-imperial-day',
    'Huế Imperial Day',
    1,
    '75.00',
    'Culture & heritage',
    'Citadel, lunch, river',
  ),
  tour(
    'da-nang-coast-ride',
    'Đà Nẵng Coast Ride',
    1,
    '89.00',
    'Scenic routes',
    'Bà Nà, the pass, and the lagoon',
    { avg: 4.5, count: 4 },
    'MODERATE',
  ),
  tour(
    'hoi-an-cooking-market',
    'Hội An Cooking Market',
    1,
    '62.00',
    'Food & markets',
    'Market, garden, kitchen',
  ),
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

  it('mỗi mục in chuyên mục · ĐỘ KHÓ và giá khởi điểm kèm "per person"', () => {
    render(<RegionDayTrips tours={CENTRAL} />);
    // Chuyên mục và độ khó nằm CÙNG một dòng, nên khẳng định cả cụm — bản trước chỉ
    // tìm 'Scenic routes' và sẽ tiếp tục xanh kể cả khi độ khó bị bỏ đi.
    // Matcher HÀM: cụm này gồm hai node chữ (`{category}` và template độ khó) nên
    // `getByText('Scenic routes · Moderate')` không khớp — phải so `textContent`.
    expect(
      screen.getByText(
        (_, el) => el?.tagName === 'SPAN' && el.textContent === 'Scenic routes · Moderate',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('$89')).toBeInTheDocument();
    // "per person" nói giá là giá MỘT KHÁCH — tín hiệu "đặt được", có bốn thẻ nên
    // bốn lần.
    expect(screen.getAllByText(messages.toursPage.perPerson)).toHaveLength(4);
  });

  // Ba tín hiệu thêm 30/07 vì user không nhận ra thẻ là tour: độ khó, đánh giá, và
  // nhãn CHỮ thay mũi tên trơn. Nếu ai gỡ một trong ba thì test này đỏ.
  it('mỗi thẻ có đánh giá và nhãn hành động bằng CHỮ, không chỉ mũi tên', () => {
    const { container } = render(<RegionDayTrips tours={CENTRAL} />);
    expect(screen.getAllByText(messages.regionPage.dayTrips.viewTrip)).toHaveLength(4);
    // `da-nang-coast-ride` có ratingAvg 4.5 / 4 lượt trong fixture.
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('(4)')).toBeInTheDocument();
    // NGÔI SAO phải có mặt, không chỉ con số: chính nó nói "4.5" là một ĐÁNH GIÁ chứ
    // không phải một con số bất kỳ. Mutation-test cho thấy nếu chỉ khẳng định hai
    // chuỗi trên thì gỡ hẳn `StarIcon` mà 15/15 vẫn xanh.
    expect(container.querySelector('svg.fill-rating')).not.toBeNull();
  });

  // `ratingAvg === null` là CHƯA AI đánh giá, khác hẳn 0 điểm — phải in nhãn chữ,
  // không phải "0.0" hay năm sao rỗng.
  it('chuyến chưa ai đánh giá in nhãn chữ, KHÔNG in 0.0', () => {
    render(<RegionDayTrips tours={CENTRAL} />);
    // Fixture: chỉ `da-nang-coast-ride` có đánh giá, BA chuyến còn lại `null`.
    expect(screen.getAllByText(messages.toursPage.notRated)).toHaveLength(3);
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
  });

  // Câu mô tả là tiêu đề NGÀY 1 của chính hành trình tour — nội dung biên tập có
  // thật, không phải một nhãn sinh ra từ số liệu. Đây là thứ đưa thẻ ra khỏi họ
  // "bảng số liệu" mà user đã bác.
  it('mỗi thẻ in một câu từ ngày 1 của hành trình', () => {
    render(<RegionDayTrips tours={CENTRAL} />);
    expect(screen.getByText('Citadel, lunch, river')).toBeInTheDocument();
    expect(screen.getByText('Bà Nà, the pass, and the lagoon')).toBeInTheDocument();
  });

  // Tour chưa có hành trình là nhánh có thật khi gắn API — bỏ hẳn dòng đó, đừng in
  // chuỗi rỗng hay một câu bịa thay chỗ.
  it('tour không có hành trình thì bỏ dòng mô tả, thẻ vẫn dựng', () => {
    const bare = [
      tour('a', 'Trip A', 1, '50.00', 'Scenic routes'),
      tour('b', 'Trip B', 1, '60.00', 'Food & markets'),
    ];
    const { container } = render(<RegionDayTrips tours={bare} />);
    expect(items(container)).toHaveLength(2);
    expect(screen.getByRole('link', { name: /Trip A/ })).toBeInTheDocument();
  });

  // ⚠️ Khu này là khu CUỐI của trang miền Trung. `site-footer.tsx` mang `mt-32` sơn
  // màu `--background`; khu cuối có nền RIÊNG thì 128px đó hiện ra thành một vạch
  // sáng kẹp giữa khu này và footer. Cơ chế `data-flush-footer` từng vá chuyện đó
  // đã xoá (Task 5k) đúng vì cả ba miền giờ kết bằng khu nền-trang — nên nền riêng
  // quay lại ở đây là dải sáng quay lại, và Vitest là chốt duy nhất bắt được.
  it('dùng NỀN TRANG, không nền băng riêng — nó là khu cuối trang', () => {
    const { container } = render(<RegionDayTrips tours={CENTRAL} />);
    expect(container.querySelector('section')?.hasAttribute('style')).toBe(false);
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
