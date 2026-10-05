import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { catalogOption, hiddenHint } from './catalog-option';

/**
 * Option danh mục/điểm đến cho `Picker` và menu lọc (spec 2026-10-05 §2.2): mục đã ẩn
 * giữ NGUYÊN tên và mang nhãn phụ mờ, thay kiểu ghép "(hidden)" vào tên (lượt thử tay F14:
 * admin phải thấy vì sao một nhóm tour đang bán không có chip nào trên web).
 */
const HIDDEN = messages.admin.tours.list.hiddenHint;

describe('hiddenHint', () => {
  it('mục đang hiện: không có nhãn phụ', () => {
    expect(hiddenHint({ isActive: true })).toBeUndefined();
  });

  it('mục đã ẩn: nhãn phụ "Hidden"', () => {
    expect(hiddenHint({ isActive: false })).toBe(HIDDEN);
    expect(HIDDEN).toBe('Hidden');
  });
});

describe('catalogOption', () => {
  it('đổi một hàng danh mục/điểm đến thành option của Picker', () => {
    expect(catalogOption({ id: 'c1', name: 'Day Tours', isActive: true })).toEqual({
      value: 'c1',
      label: 'Day Tours',
    });
    expect(catalogOption({ id: 'c4', name: 'Retired', isActive: false })).toEqual({
      value: 'c4',
      label: 'Retired',
      hint: HIDDEN,
    });
  });
});
