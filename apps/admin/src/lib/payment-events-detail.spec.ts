import { ORPCError } from '@orpc/client';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { classifyLoadError, loadErrorCopy } from './payment-events-detail';

/**
 * Logic THUẦN của đường tải payload cho drawer `/payment-events` (spec P4c
 * §3-F8): phân loại lỗi của `admin.paymentEvents.byId` (một mã contract
 * `NOT_FOUND` + transport) và tra câu — giọng ĐỌC, không mượn `errors.write`.
 */
const t = messages.admin.paymentEvents.detail;

describe('classifyLoadError', () => {
  it('NOT_FOUND do CONTRACT khai → mã contract', () => {
    expect(classifyLoadError(new ORPCError('NOT_FOUND', { status: 404, defined: true }))).toBe(
      'NOT_FOUND',
    );
  });

  it('NOT_FOUND KHÔNG có con dấu defined (tầng khác trùng tên) → không phải phán quyết contract', () => {
    expect(classifyLoadError(new ORPCError('NOT_FOUND', { status: 404 }))).toBe('GENERIC');
  });

  it('401/403 → hết phiên / mất quyền; còn lại → GENERIC', () => {
    expect(classifyLoadError(new ORPCError('UNAUTHORIZED', { status: 401 }))).toBe('UNAUTHORIZED');
    expect(classifyLoadError(new ORPCError('FORBIDDEN', { status: 403 }))).toBe('FORBIDDEN');
    expect(classifyLoadError(new TypeError('fetch failed'))).toBe('GENERIC');
  });
});

describe('loadErrorCopy', () => {
  it('mỗi mã một câu từ khối i18n detail.errors; INVALID_INPUT (id hỏng phía action) đọc như GENERIC', () => {
    expect(loadErrorCopy('NOT_FOUND')).toBe(t.errors.NOT_FOUND);
    expect(loadErrorCopy('UNAUTHORIZED')).toBe(t.errors.UNAUTHORIZED);
    expect(loadErrorCopy('FORBIDDEN')).toBe(t.errors.FORBIDDEN);
    expect(loadErrorCopy('GENERIC')).toBe(t.errors.GENERIC);
    expect(loadErrorCopy('INVALID_INPUT')).toBe(t.errors.GENERIC);
  });
});
