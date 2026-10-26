import { describe, expect, it } from 'vitest';
import { chonThuMucSaoLuu } from './thu-muc-sao-luu.mjs';

describe('chonThuMucSaoLuu', () => {
  it('chưa có thư mục của ngày: dùng đúng tên ngày', () => {
    expect(chonThuMucSaoLuu('2026-11-01', () => false)).toBe('2026-11-01');
  });

  it('đã có thư mục của ngày (bản chụp trước reset): sang -2, không ghi đè', () => {
    const daCo = new Set(['2026-11-01']);
    expect(chonThuMucSaoLuu('2026-11-01', (ten) => daCo.has(ten))).toBe('2026-11-01-2');
  });

  it('đã có cả -2 và -3: lấy số trống kế tiếp', () => {
    const daCo = new Set(['2026-11-01', '2026-11-01-2', '2026-11-01-3']);
    expect(chonThuMucSaoLuu('2026-11-01', (ten) => daCo.has(ten))).toBe('2026-11-01-4');
  });

  it('thư mục của ngày khác không ảnh hưởng', () => {
    const daCo = new Set(['2026-10-31', '2026-10-31-2']);
    expect(chonThuMucSaoLuu('2026-11-01', (ten) => daCo.has(ten))).toBe('2026-11-01');
  });
});
