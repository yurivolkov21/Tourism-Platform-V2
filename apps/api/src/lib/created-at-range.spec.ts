import { createdAtRange } from './created-at-range.js';

/**
 * Biên của bộ lọc ngày `/bookings` (spec P4b §3-F6). Đây là chỗ một lỗi lệch
 * một-ngày sống sót lâu nhất mà không ai thấy, nên mọi biên đều có test.
 */
describe('createdAtRange', () => {
  it('không có đầu nào → undefined (where không mọc thêm object rỗng)', () => {
    expect(createdAtRange(undefined, undefined)).toBeUndefined();
  });

  it('from tính vào từ 00:00:00.000 UTC của chính ngày đó', () => {
    expect(createdAtRange('2026-09-01', undefined)).toEqual({
      gte: new Date('2026-09-01T00:00:00.000Z'),
    });
  });

  it('to tính TRỌN NGÀY: chặn nửa-mở ở 00:00 ngày hôm sau', () => {
    expect(createdAtRange(undefined, '2026-09-30')).toEqual({
      lt: new Date('2026-10-01T00:00:00.000Z'),
    });
  });

  it('một ngày duy nhất (from === to) là một cửa sổ 24h, không phải rỗng', () => {
    expect(createdAtRange('2026-09-15', '2026-09-15')).toEqual({
      gte: new Date('2026-09-15T00:00:00.000Z'),
      lt: new Date('2026-09-16T00:00:00.000Z'),
    });
  });

  it('sang tháng và sang năm vẫn đúng ngày kế tiếp', () => {
    expect(createdAtRange(undefined, '2026-02-28')).toEqual({
      lt: new Date('2026-03-01T00:00:00.000Z'),
    });
    expect(createdAtRange(undefined, '2026-12-31')).toEqual({
      lt: new Date('2027-01-01T00:00:00.000Z'),
    });
    // Năm nhuận: 29/02 tồn tại nên ngày kế tiếp là 01/03.
    expect(createdAtRange(undefined, '2024-02-29')).toEqual({
      lt: new Date('2024-03-01T00:00:00.000Z'),
    });
  });

  it('hai khoảng liền kề khít nhau — không row nào bị đếm hai lần', () => {
    const september = createdAtRange('2026-09-01', '2026-09-30');
    const october = createdAtRange('2026-10-01', '2026-10-31');
    expect(september?.lt).toEqual(october?.gte);
  });
});
