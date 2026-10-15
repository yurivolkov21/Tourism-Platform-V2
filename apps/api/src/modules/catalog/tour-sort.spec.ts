import { describe, expect, it } from 'vitest';
import { tourOrderBy } from './tour-sort.js';

/**
 * Thứ tự của `catalog.tours.list` (ADR-0058 §4). Mọi nhánh kết thúc bằng `id asc` để phân trang
 * ổn định khi khoá sắp bằng nhau — thiếu nó Postgres trả hai hàng ngang điểm theo thứ tự tuỳ kế
 * hoạch truy vấn, và một tour nhảy qua lại giữa trang 1 và trang 2.
 */
describe('tourOrderBy', () => {
  it('khoá cột thường: một cột theo chiều yêu cầu rồi id', () => {
    expect(tourOrderBy('basePrice', 'asc')).toEqual([{ basePrice: 'asc' }, { id: 'asc' }]);
    expect(tourOrderBy('createdAt', 'desc')).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
  });

  it('rating: tour chưa có đánh giá luôn đứng CUỐI, ở cả hai chiều', () => {
    // Chưa ai chấm không có nghĩa là bị chấm thấp nhất — `nulls: 'last'` cả khi sắp tăng dần.
    expect(tourOrderBy('rating', 'desc')[0]).toEqual({
      ratingAvg: { sort: 'desc', nulls: 'last' },
    });
    expect(tourOrderBy('rating', 'asc')[0]).toEqual({ ratingAvg: { sort: 'asc', nulls: 'last' } });
  });

  it('rating hoà điểm: tour nhiều đánh giá hơn đứng trước, rồi tới id', () => {
    expect(tourOrderBy('rating', 'desc').slice(1)).toEqual([
      { ratingCount: 'desc' },
      { id: 'asc' },
    ]);
  });
});
