import { ORPCError } from '@orpc/client';
import { contract, OUTBOX_MAX_ATTEMPTS } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  classifyRetryError,
  isStaleStateCode,
  RETRY_CONTRACT_CODES,
  retryConfirmRows,
  retryDialogCopy,
  retryErrorCopy,
} from './outbox-retry';

/**
 * Logic THUẦN của hành vi retry (spec P4c §3-F7): tập mã contract derive từ
 * i18n và đối chiếu với `errorMap` thật, câu cho từng mã, luật "mã nào là
 * trạng-thái-cũ", và copy của dialog xác nhận (ngữ cảnh + hệ quả + cảnh báo
 * mang đúng trần attempts).
 */
const t = messages.admin.outbox.retry;

describe('RETRY_CONTRACT_CODES', () => {
  it('khớp ĐÚNG errorMap của contract.admin.outbox.retry — không thừa không thiếu', () => {
    const errorMap = (contract.admin.outbox.retry as unknown as { '~orpc': { errorMap: object } })[
      '~orpc'
    ].errorMap;
    expect([...RETRY_CONTRACT_CODES].sort()).toEqual(Object.keys(errorMap).sort());
  });
});

describe('classifyRetryError + retryErrorCopy', () => {
  it('mã contract có dấu defined → chính mã đó, mỗi mã một câu riêng', () => {
    for (const code of ['NOT_FOUND', 'NOT_FAILED'] as const) {
      const error = new ORPCError(code, { defined: true, status: 409 });
      expect(classifyRetryError(error)).toBe(code);
      expect(retryErrorCopy(code)).toBe(t.errors[code]);
    }
    expect(retryErrorCopy('NOT_FOUND')).not.toBe(retryErrorCopy('NOT_FAILED'));
  });

  it('401/403/lỗi lạ → mã transport dùng chung', () => {
    expect(classifyRetryError(new ORPCError('UNAUTHORIZED', { status: 401 }))).toBe('UNAUTHORIZED');
    expect(classifyRetryError(new ORPCError('FORBIDDEN', { status: 403 }))).toBe('FORBIDDEN');
    expect(classifyRetryError(new Error('socket hang up'))).toBe('GENERIC');
    expect(retryErrorCopy('GENERIC')).toBe(messages.admin.errors.write.GENERIC);
  });

  it('một ORPCError trùng tên nhưng KHÔNG defined không được giả làm phán quyết contract', () => {
    expect(classifyRetryError(new ORPCError('NOT_FAILED', { status: 409 }))).toBe('GENERIC');
  });
});

describe('isStaleStateCode', () => {
  it('cả hai mã contract đều là trạng-thái-cũ (hàng đã biến mất / đã rời FAILED)', () => {
    expect(isStaleStateCode('NOT_FOUND')).toBe(true);
    expect(isStaleStateCode('NOT_FAILED')).toBe(true);
    expect(isStaleStateCode('UNAUTHORIZED')).toBe(false);
    expect(isStaleStateCode('GENERIC')).toBe(false);
  });
});

describe('retryDialogCopy', () => {
  it('cảnh báo mang đúng trần attempts của contract, không viết cứng', () => {
    const copy = retryDialogCopy();
    expect(copy.warning).toBe(t.dialog.warning(OUTBOX_MAX_ATTEMPTS));
    expect(copy.warning).toContain(String(OUTBOX_MAX_ATTEMPTS));
    expect(copy).toMatchObject({
      title: t.dialog.title,
      body: t.dialog.body,
      submit: t.dialog.submit,
      submitting: t.dialog.submitting,
      cancel: t.cancel,
    });
  });

  it('không có ô note — retry không mang ghi chú đi đâu', () => {
    expect(retryDialogCopy()).not.toHaveProperty('noteLabel');
  });
});

describe('retryConfirmRows', () => {
  const target = {
    typeLabel: 'Booking confirmation',
    recipient: 'ada@example.com',
    dedupeKey: 'booking-confirmation:BK-ABCD1234',
    lastError: 'Resend: 401 invalid api key',
  };

  it('bốn dòng ngữ cảnh theo thứ tự type · recipient · dedupeKey · lastError', () => {
    expect(retryConfirmRows(target)).toEqual([
      { label: t.type, value: 'Booking confirmation' },
      { label: t.recipient, value: 'ada@example.com' },
      { label: t.dedupeKey, value: 'booking-confirmation:BK-ABCD1234' },
      { label: t.lastError, value: 'Resend: 401 invalid api key' },
    ]);
  });

  it('recipient null → chữ thay thế; lastError null → bỏ dòng (không có gì để kể)', () => {
    const rows = retryConfirmRows({ ...target, recipient: null, lastError: null });
    expect(rows.find((row) => row.label === t.recipient)?.value).toBe(
      messages.admin.outbox.list.noRecipient,
    );
    expect(rows.some((row) => row.label === t.lastError)).toBe(false);
  });
});
