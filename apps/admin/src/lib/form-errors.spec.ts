import { describe, expect, it } from 'vitest';
import { hasFormErrors } from './form-errors';

/**
 * Một chỗ hỏi "form có ô nào hỏng không" cho danh mục và điểm đến (bài học 11
 * của plan P4e-2). Validator chỉ ghi khoá khi ô ấy thật sự hỏng.
 */
describe('hasFormErrors', () => {
  it('không có khoá nào là form sạch', () => {
    expect(hasFormErrors({})).toBe(false);
  });

  it('một ô hỏng là đủ chặn', () => {
    expect(hasFormErrors({ region: 'Choose the region it belongs to.' })).toBe(true);
  });
});
