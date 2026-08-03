import { createORPCErrorFromJson } from '@orpc/client';
import { describe, expect, it, vi } from 'vitest';
import { classifySubmitError, submitToast } from './submit';

// Mock module 'sonner' (spec §6) — chỉ cần assert đúng hàm/tham số được gọi,
// không cần Toaster thật (jsdom không render toast container). `vi.mock` được
// vitest hoist lên đầu file nên chạy TRƯỚC import './submit' ở trên; biến mock
// phải qua `vi.hoisted` để không bị hoist-order (ReferenceError TDZ).
const { success, error, warning } = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success, error, warning } }));

// Fixture DỰNG TỪ shape lỗi THẬT — xác minh bằng cách gọi `enquiries.create`
// 6 lần liên tiếp qua API dev cục bộ (limit PUBLIC_WRITE_THROTTLE 5/60s,
// apps/api/src/config/throttle.ts) và log object lỗi client `@orpc/client`
// 1.14.8 thực sự ném ra (xem task-1-report.md). `createORPCErrorFromJson` là
// đúng hàm nội bộ mà `OpenAPILink` gọi khi response không-2xx khớp envelope
// oRPC (`AllExceptionsFilter`, ADR-0010) — dùng lại ở đây để fixture ĐÚNG
// instance `ORPCError`, không phải object giả tay.
const throttleError = createORPCErrorFromJson({
  defined: false,
  code: 'TOO_MANY_REQUESTS',
  status: 429,
  message: 'ThrottlerException: Too Many Requests',
  data: null,
});

const serverError = createORPCErrorFromJson({
  defined: false,
  code: 'INTERNAL_SERVER_ERROR',
  status: 500,
  message: 'Internal server error',
  data: null,
});

describe('classifySubmitError', () => {
  it('ORPCError status 429 (PUBLIC_WRITE_THROTTLE) → throttle', () => {
    expect(classifySubmitError(throttleError)).toBe('throttle');
  });

  it('ORPCError status 500 → error', () => {
    expect(classifySubmitError(serverError)).toBe('error');
  });

  it('lỗi mạng thuần (không phải ORPCError, không có status) → error', () => {
    expect(classifySubmitError(new TypeError('Failed to fetch'))).toBe('error');
  });

  it('timeout AbortSignal.timeout() ném DOMException "TimeoutError" → error', () => {
    expect(classifySubmitError(new DOMException('signal timed out', 'TimeoutError'))).toBe('error');
  });

  it('giá trị không phải Error (vd string bị throw) → error', () => {
    expect(classifySubmitError('boom')).toBe('error');
  });
});

describe('submitToast', () => {
  it('success: gọi toast.success với copy truyền vào, không hardcode chuỗi', () => {
    submitToast('success', { title: 'Letter sent', description: 'We read every letter.' });
    expect(success).toHaveBeenCalledWith('Letter sent', { description: 'We read every letter.' });
  });

  it('error: gọi toast.error với copy truyền vào', () => {
    submitToast('error', { title: 'Something went wrong', description: 'Please try again.' });
    expect(error).toHaveBeenCalledWith('Something went wrong', {
      description: 'Please try again.',
    });
  });

  it('throttle: gọi toast.warning (khác error để phân biệt màu — không phải một lỗi thật)', () => {
    submitToast('throttle', { title: 'Sending a little fast' });
    expect(warning).toHaveBeenCalledWith('Sending a little fast', { description: undefined });
  });
});
