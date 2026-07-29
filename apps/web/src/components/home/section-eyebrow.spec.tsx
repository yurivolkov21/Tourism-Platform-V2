import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SectionEyebrow } from './section-eyebrow';

beforeAll(() => {
  // jsdom không hiện thực IntersectionObserver, mà `SectionEyebrow` dùng
  // `whileInView` của framer-motion — thiếu API này là ném ReferenceError lúc
  // mount. Stub tối giản (không làm gì) là đủ vì test không quan sát animation.
  //
  // CỐ Ý để cục bộ, KHÔNG dời lên `vitest.setup.ts` dù vài spec khác có bản y
  // hệt: đã thử dời lên setup chung và **19 test ở 3 file khác gãy** — có global
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

/** Chấm vuông của eyebrow — phần tử trang trí duy nhất trong component. */
function dot(container: HTMLElement) {
  return container.querySelector('[aria-hidden="true"]');
}

describe('SectionEyebrow', () => {
  it('mặc định dùng cặp token THEO THEME (`foreground`) — 21 chỗ đang dùng không được đổi', () => {
    const { container } = render(<SectionEyebrow>Destinations</SectionEyebrow>);

    expect(dot(container)).toHaveClass('bg-foreground');
    expect(screen.getByText('Destinations')).toHaveClass('text-foreground');
  });

  it('tone="onMedia" đổi sang cặp token CỐ ĐỊNH — dành cho nền tối không lật theo theme', () => {
    const { container } = render(<SectionEyebrow tone="onMedia">How we travel</SectionEyebrow>);

    // Nền `--region-hero` tối ở CẢ HAI theme. Dùng `foreground` ở đó là chữ
    // tối-trên-tối ở light mode — đúng lớp lỗi cụm này đã dính nhiều lần.
    expect(dot(container)).toHaveClass('bg-on-media');
    expect(dot(container)).not.toHaveClass('bg-foreground');
    expect(screen.getByText('How we travel')).toHaveClass('text-on-media');
    expect(screen.getByText('How we travel')).not.toHaveClass('text-foreground');
  });
});
