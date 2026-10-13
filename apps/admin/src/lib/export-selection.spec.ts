import { describe, expect, it } from 'vitest';
import { EXPORT_SELECTION_PARAM, parseExportSelection, pickSelectedRows } from './export-selection';

/**
 * Phần chung của cú xuất THEO HÀNG ĐÃ TÍCH — `/bookings/export` (spec 01/09) và
 * `/subscribers/export` (G43). Hai luật đáng canh: URL rác không được biến cú xuất cả
 * tập thành cú xuất có chọn, và thiếu dù MỘT hàng đã tích là từ chối chứ không giao
 * file thiếu.
 */

const params = (query: string) => new URLSearchParams(query);

describe('parseExportSelection', () => {
  it('đọc `sel` tách dấu phẩy, bỏ khoảng trắng và mục rỗng', () => {
    expect(EXPORT_SELECTION_PARAM).toBe('sel');
    expect(parseExportSelection(params('sel=a,b'))).toEqual(['a', 'b']);
    expect(parseExportSelection(params('sel=%20a%20,,b,'))).toEqual(['a', 'b']);
  });

  it('vắng `sel`, `sel=` trống hay chỉ có dấu phẩy đều là KHÔNG chọn — xuất cả tập', () => {
    expect(parseExportSelection(params(''))).toEqual([]);
    expect(parseExportSelection(params('sel='))).toEqual([]);
    expect(parseExportSelection(params('sel=,%20,'))).toEqual([]);
  });
});

describe('pickSelectedRows', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const key = (row: { id: string }) => row.id;

  it('giữ đúng các hàng đã tích, theo thứ tự của trang', () => {
    expect(pickSelectedRows(rows, ['c', 'a'], key)).toEqual([{ id: 'a' }, { id: 'c' }]);
  });

  it('thiếu dù MỘT hàng đã tích → null, kể cả khi các hàng khác vẫn còn', () => {
    expect(pickSelectedRows(rows, ['a', 'z'], key)).toBeNull();
    expect(pickSelectedRows([], ['a'], key)).toBeNull();
  });

  it('khoá lặp trên URL không tính là hai hàng', () => {
    expect(pickSelectedRows(rows, ['a', 'a'], key)).toEqual([{ id: 'a' }]);
  });
});
