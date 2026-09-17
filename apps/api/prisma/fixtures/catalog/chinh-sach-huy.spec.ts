import { describe, expect, it } from 'vitest';
import { tourFaqs, tourPolicies, tours } from './index.js';

/**
 * Nội dung catalog khớp luật một hạn chót (ADR-0041, spec 2026-09-15 §7): chính sách huỷ
 * sinh từ luật chung ở `@tourism/contract`, nên fixture không còn con số hay văn bản huỷ
 * riêng của từng tour. Câu trả lời FAQ không được hứa một mốc khác với mốc trang tour in ra.
 */
describe('catalog theo luật một hạn chót', () => {
  it('không tour nào còn khoá freeCancellationDays', () => {
    for (const tour of tours) {
      expect(Object.keys(tour), tour.slug).not.toContain('freeCancellationDays');
    }
  });

  it('mỗi tour có đúng hai policy BOOKING và GENERAL, không còn CANCELLATION', () => {
    for (const tour of tours) {
      const loai = tourPolicies
        .filter((p) => p.tourId === tour.id)
        .map((p) => p.kind)
        .sort();
      expect(loai, tour.slug).toEqual(['BOOKING', 'GENERAL']);
    }
  });

  it('không câu FAQ nào còn hứa mốc huỷ riêng hoặc đổi ngày miễn phí', () => {
    for (const faq of tourFaqs) {
      expect(faq.answer, faq.id).not.toMatch(/free cancellation up to|free rebooking/i);
    }
  });
});
