import { ORPCError } from '@orpc/server';
import { describeOrpcError, isUnexpectedOrpcError, orpcErrorStack } from './orpc-error-log.js';

/**
 * W2 mục 6 (audit cụm 6 — Thấp): onError của oRPC từng `console.error` dump
 * NGUYÊN object lỗi — `cause` mang cả dữ liệu response bị output-validation
 * từ chối, tức PII của khách, thẳng ra stdout của platform. Hai hàm thuần
 * dưới đây là phần test được của đường log mới: một DÒNG code + message,
 * không bao giờ serialize object.
 */
describe('describeOrpcError', () => {
  it('ORPCError → "CODE (status): message" — không kèm cause/data', () => {
    const err = new ORPCError('OUTPUT_VALIDATION_FAILED', {
      status: 500,
      message: 'Output validation failed',
      cause: { email: 'khach@example.com' },
    });
    const line = describeOrpcError(err);
    expect(line).toContain('OUTPUT_VALIDATION_FAILED');
    expect(line).toContain('Output validation failed');
    expect(line).not.toContain('khach@example.com');
  });

  it('Error thường → tên + message; không phải Error → String()', () => {
    expect(describeOrpcError(new RangeError('boom'))).toContain('boom');
    expect(describeOrpcError('vỡ')).toContain('vỡ');
  });
});

describe('orpcErrorStack', () => {
  it('lỗi thường (500 thật) mang stack để log; ORPCError nghiệp vụ thì không', () => {
    expect(orpcErrorStack(new TypeError('boom'))).toContain('TypeError: boom');
    expect(orpcErrorStack(new ORPCError('NOT_FOUND', { status: 404 }))).toBeUndefined();
    expect(orpcErrorStack('vỡ')).toBeUndefined();
  });
});

describe('isUnexpectedOrpcError', () => {
  it('lỗi nghiệp vụ 4xx của oRPC KHÔNG tính là bất ngờ (không đẩy Sentry)', () => {
    expect(isUnexpectedOrpcError(new ORPCError('NOT_FOUND', { status: 404 }))).toBe(false);
    expect(isUnexpectedOrpcError(new ORPCError('CONFLICT', { status: 409 }))).toBe(false);
  });

  it('ORPCError 5xx và lỗi thường LÀ bất ngờ', () => {
    expect(isUnexpectedOrpcError(new ORPCError('INTERNAL_SERVER_ERROR', { status: 500 }))).toBe(
      true,
    );
    expect(isUnexpectedOrpcError(new Error('boom'))).toBe(true);
  });
});
