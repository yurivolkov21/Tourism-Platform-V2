import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Repo KHÔNG bật `globals: true` (test import describe/it/expect tường minh),
// nên RTL không tự gắn cleanup — phải gọi tay (cùng nếp apps/web).
afterEach(() => {
  cleanup();
});

/**
 * jsdom KHÔNG cài `window.matchMedia` — nó là một API của trình duyệt thật, và
 * mọi component đọc breakpoint bằng media query sẽ ném `is not a function`
 * ngay lúc mount. `Stepper` của `@tourism/ui` (dùng ở dialog approve) là chỗ
 * đầu tiên chạm phải.
 *
 * Shim này trả về "KHÔNG khớp" cho mọi query, tức test chạy ở nhánh hẹp —
 * chọn thế vì đó là nhánh khắt khe hơn: layout nào vừa màn hẹp thì cũng vừa
 * màn rộng. Test nào cần nhánh còn lại thì tự stub `matchMedia` của nó.
 */
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia;
