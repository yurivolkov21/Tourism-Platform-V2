import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { RegionSignaturePostcards } from './region-signature-postcards';

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

const PROPS = {
  eyebrow: 'Signature',
  heading: 'Life on the water',
  body: 'In the south, the river is the road.',
  postcards: [
    { title: 'The Mekong Delta', caption: 'Floating markets & waterways' },
    { title: 'Sài Gòn', caption: 'City energy & history' },
    { title: 'Phú Quốc', caption: 'Island beaches & reefs' },
  ],
};

function cards(container: HTMLElement) {
  return [...container.querySelectorAll('figure')];
}

describe('RegionSignaturePostcards', () => {
  it('vẽ một bưu thiếp cho mỗi mục', () => {
    const { container } = render(<RegionSignaturePostcards {...PROPS} />);
    expect(cards(container)).toHaveLength(3);
    expect(screen.getByRole('heading', { level: 3, name: 'Phú Quốc' })).toBeInTheDocument();
  });

  // `emphasis` là cách miền Nam BÙ cho việc cố ý không có khu chữ ký thứ hai
  // (xem JSDoc `THEMES` ở lib/region-theme.ts). Prop bị bỏ quên = Nam mất phần
  // bù mà không có gì báo, nên bất biến này được canh chứ không để mắt trông.
  it('emphasis dựng ô CAO hơn — đó là toàn bộ tác dụng của prop', () => {
    const { container: plain } = render(<RegionSignaturePostcards {...PROPS} />);
    const { container: big } = render(<RegionSignaturePostcards {...PROPS} emphasis />);
    expect(cards(plain)[0]?.className).toContain('aspect-4/5');
    expect(cards(big)[0]?.className).toContain('aspect-3/4');
    expect(cards(big)[0]?.className).not.toContain('aspect-4/5');
  });

  it('không có emphasis là mặc định — hai vùng kia không phải truyền gì', () => {
    const { container } = render(<RegionSignaturePostcards {...PROPS} emphasis={false} />);
    expect(cards(container)[0]?.className).toContain('aspect-4/5');
  });
});
