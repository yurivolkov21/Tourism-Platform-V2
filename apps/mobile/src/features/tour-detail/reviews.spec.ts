import { formatReviewDate, reviewAuthorInitials, reviewBreakdownPercent } from './reviews';

describe('formatReviewDate', () => {
  it('"5 Jul 2026" — ngày (không đệm 0) + tháng viết tắt + năm', () => {
    expect(formatReviewDate('2026-07-05T10:30:00.000Z')).toBe('5 Jul 2026');
  });
});

describe('reviewAuthorInitials', () => {
  it('tên hai từ: chữ đầu + chữ đầu từ CUỐI', () => {
    expect(reviewAuthorInitials('Yerin Oh')).toBe('YO');
  });

  it('tên ba từ: chữ đầu + chữ đầu từ cuối, bỏ qua từ giữa', () => {
    expect(reviewAuthorInitials('Nguyễn Văn An')).toBe('NA');
  });

  it('tên một từ: chỉ một chữ', () => {
    expect(reviewAuthorInitials('Madonna')).toBe('M');
  });

  it('tài khoản đã xoá (null): "?"', () => {
    expect(reviewAuthorInitials(null)).toBe('?');
  });
});

describe('reviewBreakdownPercent', () => {
  it('tính theo TỔNG review, khớp bản vẽ D4 (1/3 và 2/3 review)', () => {
    expect(reviewBreakdownPercent(1, 3)).toBeCloseTo(33.33, 1);
    expect(reviewBreakdownPercent(2, 3)).toBeCloseTo(66.67, 1);
    expect(reviewBreakdownPercent(0, 3)).toBe(0);
  });

  it('chưa ai đánh giá (total 0): 0, không chia cho 0', () => {
    expect(reviewBreakdownPercent(0, 0)).toBe(0);
  });
});
