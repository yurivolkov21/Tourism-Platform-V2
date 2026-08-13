import { describe, expect, it } from 'vitest';
import { emptyStarClass, filledStarClass, starFillPercent } from './rating';

/**
 * Phần tính toán của Rating tách khỏi JSX để test được ở môi trường `node`
 * (vitest của libs/shared/ui không có jsdom — xem vitest.config.ts).
 *
 * Bản gốc ReUI tính thẳng trong `renderStars()` và KHÔNG kẹp biên: `rating`
 * âm hoặc lớn hơn `maxRating` cho ra `width` âm/vượt 100%. Prop `rating` là
 * `number` tự do nên đây là đầu vào hợp lệ về kiểu — kẹp biên ở đây, có test
 * canh.
 */
describe('starFillPercent', () => {
  it('sao nằm trọn dưới mức đánh giá thì đầy 100%', () => {
    expect(starFillPercent(4.4, 1)).toBe(100);
    expect(starFillPercent(4.4, 4)).toBe(100);
  });

  it('sao nằm trọn trên mức đánh giá thì rỗng 0%', () => {
    expect(starFillPercent(4.4, 6)).toBe(0);
    expect(starFillPercent(2, 3)).toBe(0);
  });

  it('sao bị cắt ngang thì đầy đúng phần lẻ', () => {
    expect(starFillPercent(4.4, 5)).toBeCloseTo(40);
    expect(starFillPercent(3.5, 4)).toBeCloseTo(50);
    expect(starFillPercent(0.25, 1)).toBeCloseTo(25);
  });

  it('rating đúng bằng biên dưới của sao thì sao đó rỗng, không phải đầy', () => {
    // 4.0 nghĩa là ĐÚNG 4 sao: sao thứ 5 phải rỗng hẳn.
    expect(starFillPercent(4, 5)).toBe(0);
    expect(starFillPercent(4, 4)).toBe(100);
  });

  it('kẹp biên với giá trị vô lý — bản gốc để lọt ra width âm hoặc quá 100%', () => {
    expect(starFillPercent(-3, 1)).toBe(0);
    expect(starFillPercent(99, 5)).toBe(100);
    expect(starFillPercent(Number.NaN, 1)).toBe(0);
  });
});

/**
 * Luật 6 CLAUDE.md: tokens-only, không hex/bảng màu Tailwind. Bản gốc ReUI
 * hardcode `fill-yellow-400 text-yellow-400` cho sao đầy và
 * `text-muted-foreground/30` cho sao rỗng. Dự án đã có token sinh ra ĐÚNG cho
 * việc này (`--rating`, `--rating-muted`), nên hai hằng dưới đây phải bám token
 * và test canh để không ai "tiện tay" chép lại bảng màu gốc.
 */
describe('class của sao dùng token, không dùng bảng màu Tailwind', () => {
  it('sao đầy tô bằng token rating', () => {
    expect(filledStarClass).toContain('fill-rating');
    expect(filledStarClass).toContain('text-rating');
  });

  it('sao rỗng tô bằng token rating-muted', () => {
    expect(emptyStarClass).toContain('text-rating-muted');
  });

  it('không còn dấu vết bảng màu Tailwind của bản gốc', () => {
    for (const cls of [filledStarClass, emptyStarClass]) {
      expect(cls).not.toMatch(/yellow|amber|slate|gray|zinc/);
      expect(cls).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
  });
});
