import { describe, expect, it } from 'vitest';
import {
  blocksTraverse,
  type LeaveClick,
  type LeaveTraverse,
  leaveTarget,
} from './unsaved-changes';

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

const BACK: LeaveTraverse = {
  dirty: true,
  navigationType: 'traverse',
  cancelable: true,
  destination: 'https://admin.test/tours',
  current: 'https://admin.test/tours/ha-long/details',
};

/** Nút Back/Forward của trình duyệt, qua sự kiện `navigate` của Navigation API (G7). */
describe('blocksTraverse (G7)', () => {
  it('Back về trang khác khi có thay đổi → chặn để hỏi', () => {
    expect(blocksTraverse(BACK)).toBe(true);
  });

  it('Forward sang một bước khác của cùng tour → cũng là rời trang', () => {
    expect(
      blocksTraverse({ ...BACK, destination: 'https://admin.test/tours/ha-long/itinerary' }),
    ).toBe(true);
  });

  it.each<[string, Partial<LeaveTraverse>]>([
    ['form không có thay đổi', { dirty: false }],
    ['điều hướng mới bằng link hay router (push)', { navigationType: 'push' }],
    ['thay mục hiện tại (replace)', { navigationType: 'replace' }],
    ['tải lại trang — beforeunload lo', { navigationType: 'reload' }],
    // Trình duyệt chỉ cho huỷ khi trang có tương tác từ lần huỷ trước, và không cho huỷ lượt
    // Back sang tài liệu khác (lượt đó qua beforeunload). Không huỷ được thì đừng mở hộp hỏi.
    ['trình duyệt không cho huỷ', { cancelable: false }],
  ])('%s → không chặn', (_name, patch) => {
    expect(blocksTraverse({ ...BACK, ...patch })).toBe(false);
  });

  it('chỉ đổi #hash trên cùng trang → không chặn; đổi query → chặn', () => {
    expect(
      blocksTraverse({
        ...BACK,
        destination: 'https://admin.test/tours/ha-long/details#tour-summary',
      }),
    ).toBe(false);
    expect(
      blocksTraverse({ ...BACK, destination: 'https://admin.test/tours/ha-long/details?x=1' }),
    ).toBe(true);
  });

  it('mục lịch sử ở origin khác → không chặn (beforeunload lo phần rời hẳn)', () => {
    expect(blocksTraverse({ ...BACK, destination: 'https://nexora.test/tours' })).toBe(false);
  });
});
