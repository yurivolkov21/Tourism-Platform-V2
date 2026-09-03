import type { SubscriberRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { toSubscriberRowVM } from './subscribers-view';

/**
 * Mapper hiển thị vùng `/subscribers` (spec P4c §3-F10) — THUẦN, ngoài React
 * nên test được từng nhánh; bảng chỉ render VM có sẵn.
 *
 * Hai chỗ dễ sai được pin ở đây: hai giá trị null KHÔNG rơi về cùng một dấu
 * gạch (chúng nói hai chuyện khác nhau), và `isActive` — thứ quyết định hàng
 * nào có nút Unsubscribe — đọc từ `unsubscribedAt` chứ không từ chữ đã format.
 */

const t = messages.admin.subscribers.list;

const row: SubscriberRow = {
  id: '4f2a1b3c-0000-4000-8000-000000000001',
  email: 'ada@example.com',
  source: 'footer',
  createdAt: '2026-09-01T10:00:00.000Z',
  unsubscribedAt: null,
};

describe('toSubscriberRowVM', () => {
  it('hàng còn nhận tin: hai mốc format theo UTC, isActive = true', () => {
    expect(toSubscriberRowVM(row)).toEqual({
      id: row.id,
      email: 'ada@example.com',
      source: 'footer',
      subscribed: '1 Sep 2026, 10:00 UTC',
      unsubscribed: t.stillSubscribed,
      isActive: true,
    });
  });

  it('hàng đã huỷ: cột Unsubscribed at in mốc thật, isActive = false', () => {
    const vm = toSubscriberRowVM({ ...row, unsubscribedAt: '2026-09-02T08:30:00.000Z' });
    expect(vm.unsubscribed).toBe('2 Sep 2026, 08:30 UTC');
    expect(vm.isActive).toBe(false);
  });

  it('`source` null rơi về "Direct sign-up" — hình dạng của mọi hàng thật hôm nay', () => {
    expect(toSubscriberRowVM({ ...row, source: null }).source).toBe(t.noSource);
  });

  it('hai null nói HAI chuyện khác nhau — không rơi về cùng một chữ', () => {
    const vm = toSubscriberRowVM({ ...row, source: null, unsubscribedAt: null });
    expect(vm.source).toBe(t.noSource);
    expect(vm.unsubscribed).toBe(t.stillSubscribed);
    expect(vm.source).not.toBe(vm.unsubscribed);
  });
});
