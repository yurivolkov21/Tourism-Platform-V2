import { describe, expect, it } from 'vitest';
import { type LeaveClick, leaveTarget } from './unsaved-changes';

const BASE: LeaveClick = {
  dirty: true,
  defaultPrevented: false,
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  anchor: { href: 'https://admin.test/tours/ha-long/itinerary', target: '', hasDownload: false },
  current: 'https://admin.test/tours/ha-long',
};

describe('leaveTarget', () => {
  it('link nội bộ sang trang khác khi có thay đổi → trả đường cần hỏi', () => {
    expect(leaveTarget(BASE)).toBe('/tours/ha-long/itinerary');
  });

  it.each<[string, Partial<LeaveClick>]>([
    ['form không có thay đổi', { dirty: false }],
    ['không bấm vào link', { anchor: null }],
    ['cú bấm đã bị chặn ở chỗ khác', { defaultPrevented: true }],
    ['bấm chuột giữa', { button: 1 }],
    ['Ctrl+bấm (mở tab mới)', { ctrlKey: true }],
    ['Cmd+bấm', { metaKey: true }],
    ['Shift+bấm', { shiftKey: true }],
    ['Alt+bấm', { altKey: true }],
  ])('%s → không hỏi', (_name, patch) => {
    expect(leaveTarget({ ...BASE, ...patch })).toBeNull();
  });

  it('link mở tab mới, link tải file, link ra ngoài → không hỏi (beforeunload lo phần rời hẳn)', () => {
    const anchor = BASE.anchor as NonNullable<LeaveClick['anchor']>;
    expect(leaveTarget({ ...BASE, anchor: { ...anchor, target: '_blank' } })).toBeNull();
    expect(leaveTarget({ ...BASE, anchor: { ...anchor, hasDownload: true } })).toBeNull();
    expect(
      leaveTarget({ ...BASE, anchor: { ...anchor, href: 'https://nexora.test/tours' } }),
    ).toBeNull();
  });

  it('chỉ đổi #hash trên cùng trang → không hỏi; đổi query → hỏi', () => {
    const anchor = BASE.anchor as NonNullable<LeaveClick['anchor']>;
    expect(
      leaveTarget({
        ...BASE,
        anchor: { ...anchor, href: 'https://admin.test/tours/ha-long#tour-summary' },
      }),
    ).toBeNull();
    expect(
      leaveTarget({ ...BASE, anchor: { ...anchor, href: 'https://admin.test/tours/ha-long?x=1' } }),
    ).toBe('/tours/ha-long?x=1');
  });

  it('target="_self" vẫn là cùng tab → hỏi', () => {
    const anchor = BASE.anchor as NonNullable<LeaveClick['anchor']>;
    expect(leaveTarget({ ...BASE, anchor: { ...anchor, target: '_self' } })).toBe(
      '/tours/ha-long/itinerary',
    );
  });
});
