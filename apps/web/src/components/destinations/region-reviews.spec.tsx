import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { RegionReview } from '@/lib/regions';
import { RegionReviews } from './region-reviews';

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

function item(
  n: number,
  rating: number,
  author: string | null,
  createdAt: string,
  title: string | null,
  body: string,
  tourSlug = 'mekong-delta-boats',
  tourTitle = 'Mekong Delta Boats',
): RegionReview {
  return {
    review: {
      id: `rv-${n}`,
      rating,
      title,
      body,
      authorName: author,
      authorDeleted: author === null,
      createdAt,
      media: [],
    },
    tourSlug,
    tourTitle,
  };
}

/** Đã sắp mới-nhất-trước bởi `reviewsInRegion()` — khu này KHÔNG sắp lại. */
const SOUTH: RegionReview[] = [
  item(1, 5, 'Aisha R.', '2026-07-20T08:00:00.000Z', 'Dawn on the water', 'Out before the heat.'),
  item(
    2,
    4,
    'Tom H.',
    '2026-06-14T08:00:00.000Z',
    null,
    'The night market walk was the best part.',
    'saigon-street-food-night',
    'Saigon Street Food Night',
  ),
  item(3, 5, null, '2026-05-02T08:00:00.000Z', 'Worth it', 'Quiet reefs, good crew.'),
  item(4, 3, 'Lena P.', '2026-04-01T08:00:00.000Z', 'Fine', 'Rushed on the last day.'),
];

function cards(container: HTMLElement) {
  return [...container.querySelectorAll('[data-review]')];
}

describe('RegionReviews', () => {
  it('tiêu đề nêu TÊN VÙNG', () => {
    render(<RegionReviews regionName="Southern Vietnam" reviews={SOUTH} />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'What travellers say about Southern Vietnam' }),
    ).toBeInTheDocument();
  });

  it('chỉ hiện BA review, dù nhận nhiều hơn', () => {
    const { container } = render(<RegionReviews regionName="Southern Vietnam" reviews={SOUTH} />);
    expect(cards(container)).toHaveLength(3);
    expect(screen.queryByText('Rushed on the last day.')).not.toBeInTheDocument();
  });

  // Thứ tự do `reviewsInRegion()` quyết (mới nhất trước) và khu này GIỮ NGUYÊN.
  // Sắp lại ở đây là hai nguồn cho cùng một thứ tự, rồi chúng lệch nhau im lặng.
  it('giữ ĐÚNG thứ tự đã nhận, không tự sắp lại', () => {
    const reversed = [...SOUTH].reverse();
    const { container } = render(
      <RegionReviews regionName="Southern Vietnam" reviews={reversed} />,
    );
    expect(cards(container).map((el) => el.getAttribute('data-review'))).toEqual([
      'rv-4',
      'rv-3',
      'rv-2',
    ]);
  });

  it('số sao đọc được thành chữ cho trình đọc màn hình', () => {
    render(<RegionReviews regionName="Southern Vietnam" reviews={SOUTH} />);
    // Hai review 5 sao trong ba mục đầu — dùng getAll để chuyện đó không thành
    // lỗi "tìm thấy nhiều phần tử" của một test không nói về số lượng.
    expect(screen.getAllByRole('img', { name: '5 out of 5 stars' })).toHaveLength(2);
    expect(screen.getByRole('img', { name: '4 out of 5 stars' })).toBeInTheDocument();
  });

  // `MockReview.title` là nullable và mock CÓ `null` thật. Bỏ hẳn tiêu đề khi
  // thiếu, không in chuỗi rỗng hay chữ thay thế bịa ra.
  it('title null thì bỏ hẳn tiêu đề, thân review vẫn hiện', () => {
    const { container } = render(
      <RegionReviews regionName="Southern Vietnam" reviews={[SOUTH[1] as RegionReview]} />,
    );
    expect(screen.getByText('The night market walk was the best part.')).toBeInTheDocument();
    expect(container.querySelectorAll('h3')).toHaveLength(0);
  });

  it('tài khoản đã xoá hiện nhãn thay thế, không hiện chuỗi rỗng', () => {
    render(<RegionReviews regionName="Southern Vietnam" reviews={[SOUTH[2] as RegionReview]} />);
    expect(screen.getByText('Deleted account')).toBeInTheDocument();
  });

  it('in tháng và năm của review, không in ngày', () => {
    render(<RegionReviews regionName="Southern Vietnam" reviews={[SOUTH[0] as RegionReview]} />);
    expect(screen.getByText('July 2026')).toBeInTheDocument();
  });

  // Dòng ghi công là thứ giữ khu này khỏi nói sai: review của tour XUYÊN VÙNG
  // cũng thuộc miền Nam, nên người đọc phải thấy ngay nó nói về chuyến nào.
  it('mỗi review ghi công tour đã sinh ra nó, kèm link sang trang tour CÓ THẬT', () => {
    render(<RegionReviews regionName="Southern Vietnam" reviews={SOUTH} />);
    expect(screen.getByRole('link', { name: 'on Saigon Street Food Night' })).toHaveAttribute(
      'href',
      '/tours/saigon-street-food-night',
    );
  });

  it('không review nào thì BỎ HẲN khu', () => {
    const { container } = render(<RegionReviews regionName="Southern Vietnam" reviews={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  // ⚠️ Khu này là khu CUỐI của trang miền Nam. `site-footer.tsx` mang `mt-32` sơn
  // màu `--background`; khu cuối có nền RIÊNG thì 128px đó hiện ra thành một vạch
  // sáng kẹp giữa khu này và footer. Cơ chế `data-flush-footer` từng vá chuyện đó
  // đã xoá (Task 5k) đúng vì cả ba miền giờ kết bằng khu nền-trang.
  it('dùng NỀN TRANG, không nền băng riêng — nó là khu cuối trang', () => {
    const { container } = render(<RegionReviews regionName="Southern Vietnam" reviews={SOUTH} />);
    expect(container.querySelector('section')?.hasAttribute('style')).toBe(false);
  });

  // `PublicReviewSchema` không có số đếm theo từng mức sao, nên histogram phân bố
  // là thứ KHÔNG dựng được thật — và một biểu đồ ở đây là đúng lỗi user vừa bác.
  it('KHÔNG dựng biểu đồ phân bố hay điểm trung bình', () => {
    const { container } = render(<RegionReviews regionName="Southern Vietnam" reviews={SOUTH} />);
    expect(container.querySelector('[role="meter"]')).toBeNull();
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    for (const el of container.querySelectorAll<HTMLElement>('[style]')) {
      expect(el.getAttribute('style')).not.toMatch(/width|height/);
    }
  });
});
