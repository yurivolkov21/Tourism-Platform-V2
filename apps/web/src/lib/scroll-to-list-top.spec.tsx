// Đuôi .tsx để chạy ở project jsdom (cần `window`), theo ADR-0014 §4 — logic
// thuần thì ở .spec.ts bên node.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { NAV_OFFSET, scrollToListTop } from './scroll-to-list-top';

describe('scrollToListTop', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('cuộn mượt tới top của phần tử trừ offset navbar', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    vi.stubGlobal('scrollY', 1000);
    const el = { getBoundingClientRect: () => ({ top: -300 }) } as unknown as HTMLElement;
    scrollToListTop(el);
    expect(scrollTo).toHaveBeenCalledWith({ top: 1000 - 300 - NAV_OFFSET, behavior: 'smooth' });
  });

  it('không âm khi phần tử ở gần đỉnh trang', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    vi.stubGlobal('scrollY', 0);
    const el = { getBoundingClientRect: () => ({ top: 40 }) } as unknown as HTMLElement;
    scrollToListTop(el);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('el null → không làm gì (ref chưa gắn)', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    scrollToListTop(null);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
