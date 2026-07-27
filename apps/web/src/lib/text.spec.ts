import { describe, expect, it } from 'vitest';
import { foldAccents } from './text';

describe('foldAccents', () => {
  it('bỏ dấu tiếng Việt và hạ chữ thường', () => {
    expect(foldAccents('Hạ Long')).toBe('ha long');
  });

  it('đổi đ/Đ thành d — chữ này không phải dấu phụ nên NFD không tách được', () => {
    expect(foldAccents('Đà Nẵng')).toBe('da nang');
  });

  it('chuỗi không dấu giữ nguyên (chỉ hạ chữ thường)', () => {
    expect(foldAccents('Mekong Delta')).toBe('mekong delta');
  });

  it('chuỗi rỗng trả chuỗi rỗng', () => {
    expect(foldAccents('')).toBe('');
  });
});
