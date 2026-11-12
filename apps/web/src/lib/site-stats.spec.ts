import { describe, expect, it } from 'vitest';
import { MEASURED_STATS, reviewSummary } from './site-stats';

describe('reviewSummary — điểm và số đánh giá cộng từ thẻ tour', () => {
  it('cộng `ratingCount` của mọi tour thành tổng số đánh giá', () => {
    const tours = [
      { ratingAvg: 4.0, ratingCount: 3 },
      { ratingAvg: 5.0, ratingCount: 1 },
    ];
    expect(reviewSummary(tours).count).toBe(4);
  });

  it('điểm trung bình có trọng số theo số đánh giá, không lấy trung bình cộng các tour', () => {
    // (4.0 × 3 + 5.0 × 1) / 4 = 4.25 → 4.3. Trung bình cộng thường sẽ ra 4.5.
    const tours = [
      { ratingAvg: 4.0, ratingCount: 3 },
      { ratingAvg: 5.0, ratingCount: 1 },
    ];
    expect(reviewSummary(tours).average).toBe(4.3);
  });

  it('làm tròn một chữ số thập phân như số in trên trang', () => {
    const tours = [
      { ratingAvg: 4.3, ratingCount: 2 },
      { ratingAvg: 4.4, ratingCount: 1 },
    ];
    // (8.6 + 4.4) / 3 = 4.333… → 4.3
    expect(reviewSummary(tours).average).toBe(4.3);
  });

  it('bỏ qua tour chưa có đánh giá (ratingAvg null) khi tính điểm', () => {
    const tours = [
      { ratingAvg: null, ratingCount: 0 },
      { ratingAvg: 3.6, ratingCount: 5 },
    ];
    expect(reviewSummary(tours)).toEqual({ count: 5, average: 3.6 });
  });

  it('không tour nào có đánh giá thì điểm là null, KHÔNG phải 0', () => {
    expect(reviewSummary([{ ratingAvg: null, ratingCount: 0 }])).toEqual({
      count: 0,
      average: null,
    });
    expect(reviewSummary([])).toEqual({ count: 0, average: null });
  });
});

describe('MEASURED_STATS — số đo từ DB production', () => {
  it('là số nguyên dương: CountUp chỉ đếm số nguyên', () => {
    for (const value of [
      MEASURED_STATS.travellersHosted,
      MEASURED_STATS.departuresThisYear,
      MEASURED_STATS.satisfactionPercent,
    ]) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });

  it('tỉ lệ hài lòng là phần trăm hợp lệ', () => {
    expect(MEASURED_STATS.satisfactionPercent).toBeLessThanOrEqual(100);
  });
});
