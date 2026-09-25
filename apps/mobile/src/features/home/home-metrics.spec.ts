import { homeMetrics } from './home-metrics';

// Ba cỡ máy thật: nhỏ (iPhone SE), thường (Pixel/iPhone 14), lớn (Pro Max).
const SMALL = { width: 320, height: 568 };
const NORMAL = { width: 390, height: 844 };
const LARGE = { width: 430, height: 932 };

describe('homeMetrics', () => {
  it('rail + thẻ giữ ĐÚNG tỉ lệ bề rộng ở mọi cỡ máy, chừa chỗ cho thẻ kế ló ra', () => {
    for (const size of [SMALL, NORMAL, LARGE]) {
      const { cardWidth } = homeMetrics(size);
      // Rail + thẻ không bao giờ ăn hết bề rộng — phần dư chính là chỗ "ló"
      // của thẻ kế, thứ báo cho người dùng biết còn vuốt được.
      expect(cardWidth).toBeLessThan(size.width);
      expect(size.width - cardWidth).toBeGreaterThanOrEqual(24);
    }
  });

  it('thẻ luôn là khung chân dung (cao hơn rộng)', () => {
    for (const size of [SMALL, NORMAL, LARGE]) {
      const { cardWidth, cardHeight } = homeMetrics(size);
      expect(cardHeight).toBeGreaterThan(cardWidth);
    }
  });

  it('máy thấp: chiều cao thẻ bị kẹp theo chiều cao màn, không theo bề rộng', () => {
    const { cardWidth, cardHeight } = homeMetrics(SMALL);
    // 1.4 × bề rộng sẽ vượt quá nửa màn của máy thấp → phải bị kẹp lại.
    expect(cardHeight).toBeLessThan(cardWidth * 1.4);
    expect(cardHeight).toBeLessThanOrEqual(Math.round(SMALL.height * 0.52));
  });

  it('máy cao: chiều cao thẻ đi theo bề rộng (tỉ lệ ảnh), chưa chạm trần', () => {
    const { cardWidth, cardHeight } = homeMetrics(LARGE);
    expect(cardHeight).toBe(Math.round(cardWidth * 1.4));
  });

  it('kẹp trần/sàn: máy siêu nhỏ và siêu lớn đều không vỡ', () => {
    const tiny = homeMetrics({ width: 240, height: 400 });
    const huge = homeMetrics({ width: 1024, height: 1366 });

    expect(tiny.cardWidth).toBeGreaterThanOrEqual(232);

    expect(huge.cardWidth).toBeLessThanOrEqual(360);
  });
});
