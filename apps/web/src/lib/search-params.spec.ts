import { describe, expect, it } from 'vitest';
import { listParam, singleParam } from './search-params';

// Next 16 trả `string[]` khi một khoá lặp lại trên URL (`?a=1&a=2`). Trang
// listing từng khai kiểu `string` rồi đưa thẳng vào `.split(',')` — một URL gõ
// tay như thế làm sập cả trang (vòng review F15).
describe('listParam', () => {
  it('giữ nguyên chuỗi danh sách', () => {
    expect(listParam('hoi-an,hue')).toBe('hoi-an,hue');
  });

  it('khoá lặp lại thì nối thành MỘT danh sách — không mất giá trị nào', () => {
    expect(listParam(['hoi-an', 'hue'])).toBe('hoi-an,hue');
  });

  it('không có khoá thì trả undefined', () => {
    expect(listParam(undefined)).toBeUndefined();
  });
});

describe('singleParam', () => {
  it('giữ nguyên chuỗi đơn', () => {
    expect(singleParam('priceAsc')).toBe('priceAsc');
  });

  it('khoá lặp lại thì lấy giá trị ĐẦU', () => {
    expect(singleParam(['ha long', 'sa pa'])).toBe('ha long');
  });

  it('không có khoá thì trả undefined', () => {
    expect(singleParam(undefined)).toBeUndefined();
  });
});
