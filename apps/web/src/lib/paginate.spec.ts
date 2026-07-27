import { describe, expect, it } from 'vitest';
import { pageNumbers, paginate } from './paginate';

const items = Array.from({ length: 16 }, (_, i) => i + 1);

describe('paginate', () => {
  it('trả đúng hình dạng Paged của contract', () => {
    expect(paginate(items, 1, 12)).toEqual({
      items: items.slice(0, 12),
      page: 1,
      limit: 12,
      total: 16,
      totalPages: 2,
    });
  });

  it('trang cuối chỉ chứa phần dư', () => {
    expect(paginate(items, 2, 12).items).toEqual([13, 14, 15, 16]);
  });

  it('page vượt totalPages trả trang rỗng chứ không crash', () => {
    const result = paginate(items, 99, 12);
    expect(result.items).toEqual([]);
    expect(result.totalPages).toBe(2);
  });

  it('danh sách rỗng cho totalPages = 0, không phải 1', () => {
    expect(paginate([], 1, 12)).toEqual({
      items: [],
      page: 1,
      limit: 12,
      total: 0,
      totalPages: 0,
    });
  });

  it('page nhỏ hơn 1 được kẹp về 1', () => {
    expect(paginate(items, 0, 12).items).toEqual(items.slice(0, 12));
    expect(paginate(items, 0, 12).page).toBe(1);
  });

  it('không sửa mảng gốc tại chỗ', () => {
    const before = [...items];
    paginate(items, 2, 12);
    expect(items).toEqual(before);
  });
});

describe('pageNumbers', () => {
  it('ít trang thì hiện hết, không ellipsis', () => {
    expect(pageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('đang ở đầu dải dài — ellipsis chỉ ở cuối', () => {
    expect(pageNumbers(2, 10)).toEqual([1, 2, 3, 'ellipsis', 10]);
  });

  it('đang ở giữa — ellipsis cả hai đầu', () => {
    expect(pageNumbers(6, 10)).toEqual([1, 'ellipsis', 5, 6, 7, 'ellipsis', 10]);
  });

  it('đang ở cuối — ellipsis chỉ ở đầu', () => {
    expect(pageNumbers(9, 10)).toEqual([1, 'ellipsis', 8, 9, 10]);
  });

  it('không trang nào thì trả mảng rỗng', () => {
    expect(pageNumbers(1, 0)).toEqual([]);
  });

  it('đúng một trang thì trả [1]', () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
  });
});
