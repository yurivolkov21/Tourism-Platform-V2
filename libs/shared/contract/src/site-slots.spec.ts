import { describe, expect, it } from 'vitest';
import {
  isSiteImageSlotKey,
  isSiteSlotKey,
  SITE_SLOT_GROUPS,
  SITE_SLOTS,
  siteSlot,
  siteSlotsByGroup,
} from './site-slots.js';

describe('danh mục khe ảnh của web (ADR-0059 §1)', () => {
  it('có đúng 47 khe, khoá không trùng', () => {
    const keys = SITE_SLOTS.map((slot) => slot.key);
    expect(keys).toHaveLength(47);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('khung là hai số nguyên dương, hoặc null ở khổ không hiện khe', () => {
    for (const slot of SITE_SLOTS) {
      for (const frame of [slot.frames.desktop, slot.frames.phone]) {
        if (frame === null) continue;
        const [width, height] = frame;
        expect(Number.isInteger(width) && width > 0, slot.key).toBe(true);
        expect(Number.isInteger(height) && height > 0, slot.key).toBe(true);
      }
      // Khe nào cũng phải hiện ở ít nhất một khổ, không thì không có gì để xem trước.
      expect(slot.frames.desktop ?? slot.frames.phone, slot.key).not.toBeNull();
    }
  });

  it('chỉ panel đăng nhập vắng ở khổ điện thoại', () => {
    const phoneless = SITE_SLOTS.filter((slot) => slot.frames.phone === null).map((s) => s.key);
    expect(phoneless).toEqual(['auth-panel']);
  });

  it('chỉ about-cta-video là khe video', () => {
    expect(SITE_SLOTS.filter((slot) => slot.kind === 'video').map((s) => s.key)).toEqual([
      'about-cta-video',
    ]);
  });

  it('sáu khe mà app mobile ghim ảnh gốc trong auth-media.ts', () => {
    expect(
      SITE_SLOTS.filter((slot) => slot.inMobileApp)
        .map((slot) => slot.key)
        .sort(),
    ).toEqual([
      'auth-panel',
      'cta-band',
      'moment-bentre-canal',
      'moment-hagiang-valley',
      'moment-hoian-river',
      'moment-lanha-kayak',
    ]);
  });

  it('khe của một nhóm đứng liền nhau, nhóm theo đúng thứ tự trang admin bày', () => {
    const order: string[] = [];
    for (const slot of SITE_SLOTS) {
      if (order.at(-1) !== slot.group) order.push(slot.group);
    }
    expect(order).toEqual(SITE_SLOT_GROUPS.map((group) => group.key));
  });

  it('khe mang đường dẫn của nhóm nó', () => {
    for (const slot of SITE_SLOTS) {
      expect(slot.path, slot.key).toBe(
        SITE_SLOT_GROUPS.find((group) => group.key === slot.group)?.path,
      );
    }
  });

  it('số khe từng nhóm khớp bảng khung của spec §3.2', () => {
    expect(siteSlotsByGroup().map(({ group, slots }) => [group.key, slots.length])).toEqual([
      ['home', 8],
      ['about', 14],
      ['contact', 1],
      ['destinations', 5],
      ['north', 6],
      ['central', 6],
      ['south', 6],
      ['auth', 1],
    ]);
  });

  it('tra khe theo khoá; khoá lạ và khe video không phải khe ảnh', () => {
    expect(siteSlot('home-hero').frames.desktop).toEqual([1436, 900]);
    expect(isSiteSlotKey('home-hero')).toBe(true);
    expect(isSiteSlotKey('home-trust')).toBe(false);
    expect(isSiteImageSlotKey('home-hero')).toBe(true);
    expect(isSiteImageSlotKey('about-cta-video')).toBe(false);
    expect(isSiteImageSlotKey('not-a-slot')).toBe(false);
  });
});
