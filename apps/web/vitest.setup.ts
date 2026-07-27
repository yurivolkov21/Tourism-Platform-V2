import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Repo KHÔNG bật `globals: true` (test import describe/it/expect tường minh),
// nên RTL không tự gắn cleanup — phải gọi tay, nếu không DOM của test trước
// còn nguyên và query của test sau khớp nhầm phần tử.
afterEach(() => {
  cleanup();
});
