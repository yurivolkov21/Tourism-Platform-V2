import { ORPCError } from '@orpc/client';
import { contract } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { classifyLoadError, LOAD_CONTRACT_CODES, loadErrorCopy } from './payment-events-detail';

/**
 * Logic THUẦN của đường tải payload cho drawer `/payment-events` (spec P4c
 * §3-F8): phân loại lỗi của `admin.paymentEvents.byId` (một mã contract
 * `NOT_FOUND` + transport) và tra câu — giọng ĐỌC, không mượn `errors.write`.
 */
const t = messages.admin.paymentEvents.detail;

describe('LOAD_CONTRACT_CODES', () => {
  it('đúng bằng errorMap của admin.paymentEvents.byId — thêm mã ở contract mà quên i18n là đỏ', () => {
    expect([...LOAD_CONTRACT_CODES].sort()).toEqual(
      Object.keys(contract.admin.paymentEvents.byId['~orpc'].errorMap ?? {}).sort(),
    );
  });
});

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
  it('mã contract từ detail.errors, mã transport từ detail.transportErrors (giọng đọc); INVALID_INPUT đọc như GENERIC', () => {
    expect(loadErrorCopy('NOT_FOUND')).toBe(t.errors.NOT_FOUND);
    expect(loadErrorCopy('UNAUTHORIZED')).toBe(t.transportErrors.UNAUTHORIZED);
    expect(loadErrorCopy('FORBIDDEN')).toBe(t.transportErrors.FORBIDDEN);
    expect(loadErrorCopy('GENERIC')).toBe(t.transportErrors.GENERIC);
    expect(loadErrorCopy('INVALID_INPUT')).toBe(t.transportErrors.GENERIC);
    // Không mượn giọng ghi chung.
    expect(loadErrorCopy('GENERIC')).not.toBe(messages.admin.errors.write.GENERIC);
  });
});
