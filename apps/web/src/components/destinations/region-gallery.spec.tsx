import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { REGIONS } from '@/mocks/regions';
import { RegionGallery } from './region-gallery';

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

function tiles(container: HTMLElement) {
  return [...container.querySelectorAll('[role="img"]')];
}

describe('RegionGallery — ba bố cục, một khu', () => {
  it('tiêu đề nêu tên vùng', () => {
    render(<RegionGallery region={NORTH} variant="peaks" />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Northern Vietnam in photos' }),
    ).toBeInTheDocument();
  });

  // "Mỗi miền BẮT BUỘC có gallery riêng — khác bố cục" là ràng buộc user chốt. Số
  // ô là phần dễ đo nhất của "khác bố cục"; hình khối được canh bằng các test dưới.
  it('mỗi biến thể dùng số ô riêng: peaks 8 · lanterns 10 · panorama 3', () => {
    const peaks = render(<RegionGallery region={NORTH} variant="peaks" />);
    expect(tiles(peaks.container)).toHaveLength(8);
    peaks.unmount();

    const lanterns = render(<RegionGallery region={NORTH} variant="lanterns" />);
    expect(tiles(lanterns.container)).toHaveLength(10);
    lanterns.unmount();

    const panorama = render(<RegionGallery region={NORTH} variant="panorama" />);
    expect(tiles(panorama.container)).toHaveLength(3);
  });

  it('nhãn ô CẮT từ danh sách i18n, không bịa thêm nhãn', () => {
    const { container } = render(<RegionGallery region={NORTH} variant="panorama" />);
    const labels = tiles(container).map((el) => el.getAttribute('aria-label'));
    expect(labels).toEqual(messages.regionPage.galleryTiles.slice(0, 3));
  });

  it('không ô nào lặp nhãn — mỗi ô là một cảnh khác', () => {
    const { container } = render(<RegionGallery region={NORTH} variant="lanterns" />);
    const labels = tiles(container).map((el) => el.getAttribute('aria-label'));
    expect(new Set(labels).size).toBe(labels.length);
  });

  // `peaks`: bốn cột lệch dọc so le — đường viền TRÊN của dải là thứ gợi dãy núi,
  // nên bốn cột phải có bốn khoảng lệch KHÁC nhau. Bốn cột cùng một offset là bốn
  // cột thẳng hàng, tức mất hẳn hình.
  it('peaks dựng bốn cột với bốn khoảng lệch dọc khác nhau', () => {
    const { container } = render(<RegionGallery region={NORTH} variant="peaks" />);
    const columns = [...container.querySelectorAll('[data-peak-column]')];
    expect(columns).toHaveLength(4);
    const offsets = columns.map((el) => el.className.match(/sm:pt-\d+/)?.[0]);
    expect(new Set(offsets).size).toBe(4);
  });

  // `lanterns`: cuộn ngang trong CHÍNH container của nó. Thiếu `overflow-x` ở đây
  // là mười ô đẩy THÂN TRANG cuộn ngang — lỗi thấy được ở 390px.
  it('lanterns cuộn ngang trong container riêng, và trả wheel về cho Lenis', () => {
    const { container } = render(<RegionGallery region={NORTH} variant="lanterns" />);
    const scroller = container.querySelector('[data-gallery-scroll]');
    expect(scroller).not.toBeNull();
    expect(scroller?.className).toContain('overflow-x-auto');
    expect(scroller?.hasAttribute('data-lenis-prevent')).toBe(true);
  });

  it('hai biến thể kia KHÔNG có vùng cuộn ngang', () => {
    for (const variant of ['peaks', 'panorama'] as const) {
      const { container, unmount } = render(<RegionGallery region={NORTH} variant={variant} />);
      expect(container.querySelector('[data-gallery-scroll]'), variant).toBeNull();
      unmount();
    }
  });

  // `panorama`: ba ô THẤP và DÀI xếp dọc, ô giữa lệch ngang — gợi mặt nước.
  it('panorama dùng ô 21/9 và lệch ngang ĐÚNG ô giữa', () => {
    const { container } = render(<RegionGallery region={NORTH} variant="panorama" />);
    const items = tiles(container);
    expect(items).toHaveLength(3);
    for (const item of items) expect(item.className).toContain('aspect-21/9');
    const shifted = items.filter((el) => /sm:ml-\d+/.test(el.className));
    expect(shifted).toHaveLength(1);
    expect(items.indexOf(shifted[0] as Element)).toBe(1);
  });
});
