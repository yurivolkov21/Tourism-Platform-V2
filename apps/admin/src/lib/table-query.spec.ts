import { describe, expect, it } from 'vitest';
import { appendPaging, firstParam, parsePaging, tableHref } from './table-query';

/**
 * Phần DÙNG CHUNG của trạng thái-trên-URL (spec P4b §2.2) — tách ra ở F3 khi
 * vùng thứ hai (cancellations) tiêu thụ đúng luật phân trang của vùng đầu
 * (§2.1: "kit mọc từ consumer đầu tiên… F3/F4 tiêu thụ và ép tổng quát hoá").
 * Hai contract list dùng CHUNG một hình phân trang (`page` ≥ 1, `limit` 1..100,
 * mặc định 20), nên luật clamp chỉ được có MỘT bản.
 */
describe('firstParam', () => {
  it('giá trị đơn trả về nguyên vẹn', () => {
    expect(firstParam('PAID')).toBe('PAID');
  });

  it('param lặp (?page=2&page=9) lấy giá trị đầu — đúng nếp Next đọc query', () => {
    expect(firstParam(['2', '9'])).toBe('2');
  });

  it('thiếu param hoặc mảng rỗng → undefined', () => {
    expect(firstParam(undefined)).toBeUndefined();
    expect(firstParam([])).toBeUndefined();
  });
});

describe('parsePaging', () => {
  it('không param → trang 1 + limit mặc định của contract', () => {
    expect(parsePaging({})).toEqual({ page: 1, limit: 20 });
  });

  it('page/limit hợp lệ được giữ nguyên', () => {
    expect(parsePaging({ page: '3', limit: '50' })).toEqual({ page: 3, limit: 50 });
  });

  it('page rác (chữ, 0, âm, thập phân, rỗng) rơi về 1 — URL là thứ người gõ', () => {
    for (const page of ['abc', '0', '-2', '1.5', '']) {
      expect(parsePaging({ page })).toEqual({ page: 1, limit: 20 });
    }
  });

  it('limit ngoài trần contract (>100) hoặc rác rơi về mặc định, không ném lên API', () => {
    for (const limit of ['101', '0', '-5', 'many', '10.5']) {
      expect(parsePaging({ limit })).toEqual({ page: 1, limit: 20 });
    }
  });
});

describe('appendPaging + tableHref', () => {
  it('mặc định thì KHÔNG viết ra URL — /path trơn', () => {
    const params = new URLSearchParams();
    appendPaging(params, { page: 1, limit: 20 });
    expect(tableHref('/cancellations', params)).toBe('/cancellations');
  });

  it('page > 1 và limit khác mặc định mới xuất hiện, sau các filter đã có', () => {
    const params = new URLSearchParams({ status: 'REQUESTED' });
    appendPaging(params, { page: 3, limit: 50 });
    expect(tableHref('/cancellations', params)).toBe(
      '/cancellations?status=REQUESTED&limit=50&page=3',
    );
  });
});
