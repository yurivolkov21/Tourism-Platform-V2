// Đuôi .tsx để chạy ở project jsdom (cần `window`), theo ADR-0014 §4.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLenis, smoothScrollTo } from './smooth-scroll';

describe('smoothScrollTo', () => {
  afterEach(() => {
    setLenis(null);
    vi.unstubAllGlobals();
  });

  it('có Lenis → đi QUA lenis.scrollTo, KHÔNG gọi window.scrollTo (hai tài xế thì Lenis thắng)', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    const lenis = { scrollTo: vi.fn() };
    setLenis(lenis);
    smoothScrollTo(640);
    expect(lenis.scrollTo).toHaveBeenCalledWith(640);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('không có Lenis (reduced-motion) → window.scrollTo smooth', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    smoothScrollTo(640);
    expect(scrollTo).toHaveBeenCalledWith({ top: 640, behavior: 'smooth' });
  });

  it('kẹp không âm', () => {
    const lenis = { scrollTo: vi.fn() };
    setLenis(lenis);
    smoothScrollTo(-50);
    expect(lenis.scrollTo).toHaveBeenCalledWith(0);
  });
});
