import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { REGIONS } from '@/mocks/regions';
import type { MockDestination } from '@/mocks/types';
import { RegionGroup } from './region-group';

beforeAll(() => {
  // jsdom không hiện thực IntersectionObserver, mà `SectionEyebrow` dùng
  // `whileInView` của framer-motion — thiếu API này là ném ReferenceError lúc
  // mount. Stub tối giản (không làm gì) là đủ vì test không quan sát animation.
  //
  // CỐ Ý để cục bộ, KHÔNG dời lên `vitest.setup.ts` dù `home/gallery.spec.tsx`
  // có bản y hệt: đã thử dời lên setup chung (cả bản no-op lẫn bản báo-ngay
  // isIntersecting) và **19 test ở 3 file khác gãy** — có global này thì
  // framer-motion đi nhánh khác hẳn so với khi không có. Gộp lại là việc riêng,
  // cần đo từng file, không phải dọn tiện tay ở đây.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

// biome-ignore lint/style/noNonNullAssertion: REGIONS là hằng 3 phần tử ở module scope, phần tử 0 luôn tồn tại
const NORTH = REGIONS[0]!;

function dest(slug: string, name: string, description: string, tourCount: number): MockDestination {
  return {
    id: `id-${slug}`,
    slug,
    name,
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description,
    tourCount,
  };
}

const PLACES = [
  dest('sa-pa', 'Sa Pa', 'Misty rice terraces', 3),
  dest('ha-long', 'Hạ Long', 'Limestone bay cruises', 2),
];

describe('RegionGroup', () => {
  it('h2 hiện đúng "Places in <tên vùng>"', () => {
    render(<RegionGroup region={NORTH} destinations={PLACES} tourCount={6} />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Places in Northern Vietnam' }),
    ).toBeInTheDocument();
  });

  it('link "View more" trỏ sang trang vùng bằng slug', () => {
    render(<RegionGroup region={NORTH} destinations={PLACES} tourCount={6} />);
    expect(screen.getByRole('link', { name: /view more/i })).toHaveAttribute(
      'href',
      '/destinations/northern-vietnam',
    );
  });

  it('in số tour của VÙNG, không cộng dồn số của từng địa điểm', () => {
    // 3 + 2 = 5 nhưng vùng có 6 (tour distinct). Cộng dồn là nói sai.
    render(<RegionGroup region={NORTH} destinations={PLACES} tourCount={6} />);
    expect(screen.getByText(/6 tours/)).toBeInTheDocument();
    expect(screen.queryByText(/5 tours/)).not.toBeInTheDocument();
  });

  it('render đúng một ô cho mỗi địa điểm, mỗi ô link sang trang lọc tour CÓ THẬT', () => {
    render(<RegionGroup region={NORTH} destinations={PLACES} tourCount={6} />);
    const tiles = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('/tours?destinations='));
    expect(tiles).toHaveLength(PLACES.length);
    expect(screen.getByRole('link', { name: /Sa Pa/ })).toHaveAttribute(
      'href',
      '/tours?destinations=sa-pa',
    );
    expect(screen.getByRole('link', { name: /Hạ Long/ })).toHaveAttribute(
      'href',
      '/tours?destinations=ha-long',
    );
  });

  it('tên địa điểm hiện ở trạng thái nghỉ — không cần hover', () => {
    render(<RegionGroup region={NORTH} destinations={PLACES} tourCount={6} />);
    // h3 tên địa điểm — tách khỏi nhãn của `ImagePlaceholder` (cũng in cùng
    // tên) bằng role heading level 3, không dùng getByText (đụng cả hai).
    expect(screen.getByRole('heading', { level: 3, name: 'Sa Pa' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Hạ Long' })).toBeInTheDocument();
  });

  it('mô tả địa điểm có mặt trong DOM dù đang ẩn bằng CSS — bàn phím/đọc màn hình vẫn tới được', () => {
    render(<RegionGroup region={NORTH} destinations={PLACES} tourCount={6} />);
    expect(screen.getByText('Misty rice terraces')).toBeInTheDocument();
    expect(screen.getByText('Limestone bay cruises')).toBeInTheDocument();
  });

  // ADR-0015 đã rút lớp tint `[data-region]` khỏi tokens, nên thuộc tính này
  // KHÔNG còn tác dụng màu. Nó vẫn là móc CẤU TRÚC mang KHOÁ vùng ('north'),
  // không phải tên hiển thị ('Northern Vietnam') — cùng bất biến mà
  // `destinations-menu.spec.tsx` và `home/gallery.spec.tsx` đang canh.
  it('gắn data-region mang KHOÁ vùng làm móc cấu trúc', () => {
    const { container } = render(
      <RegionGroup region={NORTH} destinations={PLACES} tourCount={6} />,
    );
    expect(container.querySelector('[data-region="north"]')).not.toBeNull();
  });

  it('KHÔNG đánh số thứ tự vùng — ba vùng không phải các bước tuần tự', () => {
    render(<RegionGroup region={NORTH} destinations={PLACES} tourCount={6} />);
    expect(screen.queryByText(/^0?1$/)).not.toBeInTheDocument();
  });
});
