import { fireEvent, render } from '@testing-library/react';
import type Lenis from 'lenis';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLenis } from '@/lib/smooth-scroll';
import { LenisScroll } from './lenis-scroll';

// Bắt instance Lenis mà component đăng ký — cửa duy nhất nó lộ ra ngoài.
vi.mock('@/lib/smooth-scroll', () => ({ setLenis: vi.fn() }));

/**
 * Chiều cao tài liệu và khung nhìn như trình duyệt thấy (jsdom không dàn trang nên đè thẳng getter).
 * `<html>` của site mang `h-full`: hộp của nó luôn cao bằng khung nhìn, nên ResizeObserver mà Lenis
 * đặt lên nó không bao giờ báo khi trang dài ra — stub ResizeObserver của `vitest.setup.ts` (không
 * bao giờ gọi callback) đúng là hành vi thật ấy (đo 09/10 trên next build: lăn chuột dừng ở đáy cũ
 * cho tới khi cửa sổ đổi cỡ).
 */
function setDocument({ height, viewport }: { height: number; viewport: number }) {
  const root = document.documentElement;
  Object.defineProperty(root, 'scrollHeight', { configurable: true, get: () => height });
  Object.defineProperty(root, 'clientHeight', { configurable: true, get: () => viewport });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: viewport });
}

function mountedLenis(): Lenis {
  const instance = vi.mocked(setLenis).mock.calls.find(([arg]) => arg !== null)?.[0];
  if (!instance) throw new Error('LenisScroll không đăng ký instance Lenis nào');
  return instance as unknown as Lenis;
}

describe('LenisScroll', () => {
  const innerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');

  beforeEach(() => {
    vi.mocked(setLenis).mockClear();
    // `vitest.setup.ts` giả lập máy GIẢM chuyển động (khi đó LenisScroll không bật Lenis) — các ca
    // ở đây cần máy thường.
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList,
    );
    // jsdom không hiện thực `window.scrollTo` (in "Not implemented"); Lenis gọi nó mỗi khung hình.
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    // Vitest (jsdom) gán `window` = `globalThis`, nên `window instanceof Window` ra false và lớp đo
    // kích thước của Lenis rẽ sang nhánh phần tử (đọc `window.scrollHeight` → NaN). Trình duyệt thật
    // cho true — dựng lại đúng điều đó để Lenis đo như trên trang thật.
    Object.defineProperty(Window, Symbol.hasInstance, {
      configurable: true,
      value: (value: unknown) => value === window,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(Window, Symbol.hasInstance);
    const root = document.documentElement as unknown as Record<string, unknown>;
    delete root.scrollHeight;
    delete root.clientHeight;
    if (innerHeight) Object.defineProperty(window, 'innerHeight', innerHeight);
  });

  /**
   * Lỗi thử prod 09/10 ("thanh cuộn bị kẹt"): tải cứng trang chi tiết đơn rồi bấm "Full itinerary",
   * trang tour mở tab Itinerary nhưng lăn chuột dừng ở 1378 — đáy của trang ĐƠN — dù trang tour còn
   * 1434px phía dưới. Lenis chỉ đo trang lúc khởi tạo và khi cửa sổ đổi cỡ, mà `<html>` cao cố định
   * nên không có tín hiệu nào khác. Cùng bệnh khi bấm tab cao hơn ngay trên một trang.
   */
  it('trang dài ra sau khi Lenis khởi tạo (điều hướng mềm, đổi tab) → giới hạn cuộn theo trang HIỆN TẠI', () => {
    // Trang chi tiết đơn tải cứng: cao 2178 ở khung 800 → đáy 1378.
    setDocument({ height: 2178, viewport: 800 });
    render(<LenisScroll />);
    const lenis = mountedLenis();
    expect(lenis.limit).toBe(1378);

    // Trang tour với tab Itinerary: cao 3612, không cú resize nào báo cho Lenis.
    setDocument({ height: 3612, viewport: 800 });
    expect(lenis.limit).toBe(2812);
  });

  /**
   * Bấm link chỉ ~1,2 giây sau cú lăn chuột (open-items G33): Lenis còn trượt theo cú lăn ấy và ghi
   * vị trí mỗi khung hình, nên trang mới bị kéo về đích cũ thay vì tới mốc `#itinerary` (đo 09/10:
   * dừng ở 1080, dải tab ở 230 thay vì 143) hay đầu trang (link không hash: dừng ở 120 thay vì 0).
   */
  it('bấm link sang trang khác lúc Lenis còn trượt theo cú lăn chuột → Lenis buông, trang mới không bị kéo về chỗ cũ', () => {
    setDocument({ height: 3000, viewport: 800 });
    render(<LenisScroll />);
    const lenis = mountedLenis();
    fireEvent.wheel(window, { deltaY: 300 });
    expect(lenis.isScrolling).toBe('smooth');

    const link = document.createElement('a');
    link.href = '/tours/northern-highlights-5d#itinerary';
    // `next/link` chặn điều hướng của trình duyệt rồi tự điều hướng mềm — làm y vậy để jsdom khỏi
    // điều hướng thật.
    link.addEventListener('click', (event) => event.preventDefault());
    document.body.append(link);
    try {
      fireEvent.click(link);
      expect(lenis.isScrolling).toBe(false);
    } finally {
      link.remove();
    }
  });
});
