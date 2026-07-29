import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { MockTourCard } from '@/mocks/types';
import { RegionTours } from './region-tours';

beforeAll(() => {
  // jsdom không hiện thực IntersectionObserver, mà khu này render `SectionEyebrow`
  // (dùng `whileInView` của framer-motion) — thiếu API này là ném ReferenceError
  // lúc mount. Stub tối giản (không làm gì) là đủ vì test không quan sát animation.
  //
  // CỐ Ý để cục bộ, KHÔNG dời lên `vitest.setup.ts` dù `region-group.spec.tsx` và
  // `home/gallery.spec.tsx` có bản y hệt: đã thử dời lên setup chung (cả bản no-op
  // lẫn bản báo-ngay isIntersecting) và **19 test ở 3 file khác gãy** — có global
  // này thì framer-motion đi nhánh khác hẳn so với khi không có.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

const PLACES = [
  { slug: 'sa-pa', name: 'Sa Pa' },
  { slug: 'ha-long', name: 'Hạ Long' },
  { slug: 'ninh-binh', name: 'Ninh Bình' },
];

function tour(
  slug: string,
  title: string,
  destinations: { slug: string; name: string; isPrimary: boolean }[],
): MockTourCard {
  return {
    id: `id-${slug}`,
    slug,
    title,
    summary: null,
    basePrice: '199.00',
    compareAtPrice: null,
    currency: 'USD',
    durationDays: 3,
    difficulty: 'EASY',
    maxGroupSize: 12,
    isFeatured: false,
    destinations,
    category: { slug: 'trekking', name: 'Trekking' },
    ratingAvg: 4.5,
    ratingCount: 20,
  };
}

/** Số tour mỗi trang của khu này — phải khớp `REGION_PAGE_SIZE` ở component.
    Gõ lại ở đây thay vì export hằng số: nếu component đổi cỡ trang mà test không
    đổi theo thì hai test phân trang bên dưới ĐỎ ngay, đúng thứ ta muốn nghe. */
const PAGE_SIZE = 8;

// Ninh Bình CỐ TÌNH không có tour nào — đó là nhánh "lọc ra 0 kết quả", nhánh
// có thật khi một địa điểm mới chưa gắn tour nào.
const TOURS = [
  tour('sapa-trek', 'Sa Pa Valley Trek', [{ slug: 'sa-pa', name: 'Sa Pa', isPrimary: true }]),
  tour('halong-cruise', 'Hạ Long Bay Cruise', [
    { slug: 'ha-long', name: 'Hạ Long', isPrimary: true },
  ]),
  tour('north-loop', 'Northern Highlands Loop', [
    { slug: 'sa-pa', name: 'Sa Pa', isPrimary: true },
    { slug: 'ha-long', name: 'Hạ Long', isPrimary: false },
  ]),
];

/** Vượt một trang: 9 tour cùng ở Sa Pa → 2 trang với cỡ trang 8. Nhánh CÓ phân
    trang trước đây không test nào chạy qua. */
const MANY_TOURS = Array.from({ length: PAGE_SIZE + 1 }, (_, i) =>
  tour(`sa-pa-${i}`, `Sa Pa Trip ${i + 1}`, [{ slug: 'sa-pa', name: 'Sa Pa', isPrimary: true }]),
);

/** Tiêu đề tour = <h3> trong `TourCard`; đếm chúng là đếm số card trong lưới. */
function tourTitles() {
  return screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
}

describe('RegionTours', () => {
  it('mặc định hiện tất cả tour của vùng', () => {
    render(<RegionTours tours={TOURS} places={PLACES} />);
    expect(tourTitles()).toEqual([
      'Sa Pa Valley Trek',
      'Hạ Long Bay Cruise',
      'Northern Highlands Loop',
    ]);
  });

  it('bấm chip một địa điểm thì chỉ còn tour chạm địa điểm đó', async () => {
    const user = userEvent.setup();
    render(<RegionTours tours={TOURS} places={PLACES} />);

    await user.click(screen.getByRole('button', { name: 'Hạ Long' }));

    // `north-loop` chạm Hạ Long ở chặng phụ nên PHẢI còn — lọc theo `some()`,
    // không phải theo điểm đến chính.
    expect(tourTitles()).toEqual(['Hạ Long Bay Cruise', 'Northern Highlands Loop']);
  });

  it('chip đang chọn mang aria-pressed=true, các chip khác false', async () => {
    const user = userEvent.setup();
    render(<RegionTours tours={TOURS} places={PLACES} />);

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Sa Pa' }));

    expect(screen.getByRole('button', { name: 'Sa Pa' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Hạ Long' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('lọc ra 0 tour thì hiện trạng thái rỗng, KHÔNG phải lưới rỗng', async () => {
    const user = userEvent.setup();
    render(<RegionTours tours={TOURS} places={PLACES} />);

    await user.click(screen.getByRole('button', { name: 'Ninh Bình' }));

    // Chuỗi lấy từ i18n chứ không gõ tay: sửa copy thì test đi theo nguồn thay
    // vì gãy ở một chỗ chẳng liên quan gì đến hành vi đang canh.
    expect(screen.getByText(messages.regionPage.noTours)).toBeInTheDocument();
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
  });

  it('chỉ một trang thì KHÔNG render thanh phân trang', () => {
    // 3 tour < 8/trang → đúng một trang. Thanh phân trang vẫn được DỰNG (nhánh
    // có thật khi gắn API) nhưng phải tự ẩn ở đây.
    //
    // ⚠️ Canh dòng "Showing …", KHÔNG canh `nav[aria-label=Pagination]`:
    // `PaginationBar` vốn KHÔNG BAO GIỜ render cái `<nav>` đó khi `totalPages ≤ 1`
    // (`PageNumbers` trả `<div aria-hidden>` trước) — nên phép khẳng định kia
    // đúng kể cả khi guard ở component bị xoá và thanh phân trang hiện nguyên
    // (viền `border-t` + dòng "Showing 1–3 of 3"). Dòng "Showing …" thì CHỈ tồn
    // tại khi cả thanh được dựng, nên nó canh được thật.
    render(<RegionTours tours={TOURS} places={PLACES} />);
    expect(
      screen.queryByText(messages.toursPage.showing(1, TOURS.length, TOURS.length)),
    ).not.toBeInTheDocument();
  });

  it('quá một trang thì trang 1 chỉ hiện 8 card VÀ thanh phân trang có mặt', () => {
    render(<RegionTours tours={MANY_TOURS} places={PLACES} />);

    expect(tourTitles()).toHaveLength(PAGE_SIZE);
    expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
    expect(
      screen.getByText(messages.toursPage.showing(1, PAGE_SIZE, MANY_TOURS.length)),
    ).toBeInTheDocument();
  });
});
