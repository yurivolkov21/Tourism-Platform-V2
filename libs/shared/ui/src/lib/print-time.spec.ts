import { describe, expect, it } from 'vitest';
import { formatPrintDateTime, formatPrintTime } from './print-time';

const VN = 'Asia/Ho_Chi_Minh';

describe('giờ in theo múi giờ (G40)', () => {
  it('ngày giờ đủ, 24 giờ, giờ Việt Nam', () => {
    expect(formatPrintDateTime(new Date('2026-10-09T10:59:36.812Z'), VN)).toBe('9 Oct 2026, 17:59');
  });

  it('17:00Z là 00:00 của ngày sau theo giờ Việt Nam — không ra "24:00"', () => {
    expect(formatPrintDateTime(new Date('2026-10-09T17:00:00Z'), VN)).toBe('10 Oct 2026, 00:00');
  });

  it('tháng Chín là "Sep", không phải "Sept"', () => {
    expect(formatPrintDateTime(new Date('2026-09-14T03:12:45Z'), VN)).toBe('14 Sep 2026, 10:12');
  });

  it('giờ riêng cho "Pay by" và câu giờ nhả', () => {
    expect(formatPrintTime(new Date('2026-10-09T12:04:36.812Z'), VN)).toBe('19:04');
  });

  it('múi giờ khác cho kết quả khác — bộ định dạng dùng lại không lẫn múi', () => {
    const at = new Date('2026-10-09T17:00:00Z');
    expect(formatPrintTime(at, VN)).toBe('00:00');
    expect(formatPrintTime(at, 'UTC')).toBe('17:00');
    expect(formatPrintTime(at, VN)).toBe('00:00');
  });
});
