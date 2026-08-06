import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Repo KHÔNG bật `globals: true` (test import describe/it/expect tường minh),
// nên RTL không tự gắn cleanup — phải gọi tay, nếu không DOM của test trước
// còn nguyên và query của test sau khớp nhầm phần tử.
afterEach(() => {
  cleanup();
});

// jsdom KHÔNG hiện thực matchMedia. Thiếu nó thì `MotionConfig reducedMotion="user"`
// (bọc ở root layout) không quyết được, và AnimatePresence giữ phần tử đang
// thoát trong DOM MÃI MÃI — mọi assertion đếm phần tử sau khi lọc đều treo.
// Khai báo `reduce` để test chạy ở chế độ giảm chuyển động: animation kết thúc
// tức thì, DOM phản ánh đúng trạng thái cuối.
vi.stubGlobal(
  'matchMedia',
  vi.fn((query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
);

// jsdom KHÔNG hiện thực ResizeObserver. `input-otp` (OtpForm, Task 5) đo kích
// thước container bằng nó lúc mount — thiếu polyfill thì effect ném
// ReferenceError và mọi test render OtpForm/InputOTP đều fail ngay từ mount.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

// jsdom KHÔNG hiện thực `elementFromPoint` — `input-otp` polling nội bộ (theo
// dõi caret) gọi hàm này, ném TypeError không bắt được khi chạy dưới fake
// timers (spec OtpForm dùng fake timers để test countdown resend 60s).
if (!document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

// jsdom KHÔNG hiện thực IntersectionObserver. ContactLocation dùng nó để hoãn
// nạp chunk bản đồ tới khi khách cuộn tới — thiếu polyfill thì effect ném
// ReferenceError ngay lúc mount và mọi test render section này fail.
// Stub gọi callback NGAY với isIntersecting=true: test luôn thấy trạng thái
// "đã cuộn tới", đúng thứ ta muốn khẳng định.
class IntersectionObserverStub {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe() {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
