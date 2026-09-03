import { ORPCError } from '@orpc/client';
import { contract } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  classifyUnsubscribeError,
  isUnsubscribeStale,
  UNSUBSCRIBE_CONTRACT_CODES,
  unsubscribeConfirmRows,
  unsubscribeDialogCopy,
  unsubscribeErrorCopy,
} from './subscribers-unsubscribe';
import type { SubscriberRowVM } from './subscribers-view';

/**
 * Logic THUẦN của hành vi ghi vùng subscribers (spec P4c §3-F10): tập mã
 * contract, phân loại lỗi, câu chữ, và copy dialog dựng sẵn để component
 * không tự ghép chuỗi.
 */

const t = messages.admin.subscribers.unsubscribe;

const row: SubscriberRowVM = {
  id: '4f2a1b3c-0000-4000-8000-000000000001',
  email: 'ada@example.com',
  source: 'footer',
  subscribed: '1 Sep 2026, 10:00 UTC',
  unsubscribed: messages.admin.subscribers.list.stillSubscribed,
  isActive: true,
};

describe('tập mã contract', () => {
  it('đúng bằng errorMap của admin.subscribers.unsubscribe — i18n là nguồn duy nhất', () => {
    expect([...UNSUBSCRIBE_CONTRACT_CODES].sort()).toEqual(
      Object.keys(contract.admin.subscribers.unsubscribe['~orpc'].errorMap ?? {}).sort(),
    );
  });
});

describe('classify', () => {
  it('mã do CONTRACT khai → mã contract; trùng tên mà không có con dấu → GENERIC', () => {
    expect(
      classifyUnsubscribeError(
        new ORPCError('ALREADY_UNSUBSCRIBED', { status: 409, defined: true }),
      ),
    ).toBe('ALREADY_UNSUBSCRIBED');
    expect(
      classifyUnsubscribeError(new ORPCError('NOT_FOUND', { status: 404, defined: true })),
    ).toBe('NOT_FOUND');
    expect(classifyUnsubscribeError(new ORPCError('NOT_FOUND', { status: 404 }))).toBe('GENERIC');
  });

  it('401/403 → hết phiên / mất quyền; lỗi mạng → GENERIC', () => {
    expect(classifyUnsubscribeError(new ORPCError('UNAUTHORIZED', { status: 401 }))).toBe(
      'UNAUTHORIZED',
    );
    expect(classifyUnsubscribeError(new ORPCError('FORBIDDEN', { status: 403 }))).toBe('FORBIDDEN');
    expect(classifyUnsubscribeError(new TypeError('fetch failed'))).toBe('GENERIC');
  });
});

describe('trạng-thái-cũ', () => {
  it('CẢ HAI mã contract là trạng-thái-cũ: đóng dialog + refresh, không mời bấm lại', () => {
    expect(isUnsubscribeStale('NOT_FOUND')).toBe(true);
    // Bấm lại một địa chỉ đã rời danh sách thì lần nào cũng 409 như nhau — và
    // mốc consent cũ vẫn phải được giữ nguyên.
    expect(isUnsubscribeStale('ALREADY_UNSUBSCRIBED')).toBe(true);
  });

  it('mã transport KHÔNG phải trạng-thái-cũ — hết phiên thì đăng nhập lại rồi thử tại chỗ', () => {
    expect(isUnsubscribeStale('UNAUTHORIZED')).toBe(false);
    expect(isUnsubscribeStale('GENERIC')).toBe(false);
  });
});

describe('câu chữ', () => {
  it('mỗi mã contract MỘT câu riêng, không nhánh gộp', () => {
    expect(unsubscribeErrorCopy('NOT_FOUND')).toBe(t.errors.NOT_FOUND);
    expect(unsubscribeErrorCopy('ALREADY_UNSUBSCRIBED')).toBe(t.errors.ALREADY_UNSUBSCRIBED);
    expect(unsubscribeErrorCopy('NOT_FOUND')).not.toBe(
      unsubscribeErrorCopy('ALREADY_UNSUBSCRIBED'),
    );
  });

  it('mã transport rơi về giọng ghi chung của admin', () => {
    expect(unsubscribeErrorCopy('UNAUTHORIZED')).toBe(messages.admin.errors.write.UNAUTHORIZED);
    expect(unsubscribeErrorCopy('GENERIC')).toBe(messages.admin.errors.write.GENERIC);
  });
});

describe('copy dialog', () => {
  it('không có ô note — lệnh này không mang ghi chú đi đâu', () => {
    expect(unsubscribeDialogCopy()).toEqual({
      title: t.dialog.title,
      body: t.dialog.body,
      warning: t.dialog.warning,
      submit: t.dialog.submit,
      submitting: t.dialog.submitting,
      cancel: t.cancel,
    });
  });
});

describe('unsubscribeConfirmRows', () => {
  it('nêu rõ ĐỊA CHỈ đầu tiên — đó là thứ phải đọc lại trước khi bấm', () => {
    const rows = unsubscribeConfirmRows(row);
    expect(rows[0]).toEqual({ label: t.email, value: 'ada@example.com' });
    expect(rows.map((entry) => entry.value)).toContain('footer');
    expect(rows.map((entry) => entry.value)).toContain('1 Sep 2026, 10:00 UTC');
  });

  it('hàng không khai nguồn vẫn có dòng Source — VM đã rơi về chữ thay thế', () => {
    const rows = unsubscribeConfirmRows({
      ...row,
      source: messages.admin.subscribers.list.noSource,
    });
    expect(rows.map((entry) => entry.value)).toContain(messages.admin.subscribers.list.noSource);
  });
});
