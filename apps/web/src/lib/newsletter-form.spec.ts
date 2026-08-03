import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { validateNewsletterEmail } from './newsletter-form';

// Validate email của form newsletter footer (spec §3, task-3-brief.md) — cùng
// khuôn `validateEnquiry` (`enquiry-form.ts`): hàm THUẦN TDD, chạy zod CHÍNH
// `SubscribeInputSchema` (không khai lại rule), tự soi giá trị thô để chọn
// copy "required" vs "invalid" (zod báo `invalid_format`/`too_small` không đủ
// phân biệt).
describe('validateNewsletterEmail', () => {
  it('email hợp lệ → không có lỗi (undefined)', () => {
    expect(validateNewsletterEmail('minh@example.com')).toBeUndefined();
  });

  it('email rỗng → copy "required"', () => {
    expect(validateNewsletterEmail('')).toBe(messages.newsletterForm.errors.email.required);
  });

  it('email chỉ toàn khoảng trắng → copy "required" (không phải "invalid")', () => {
    expect(validateNewsletterEmail('   ')).toBe(messages.newsletterForm.errors.email.required);
  });

  it('email sai định dạng → copy "invalid"', () => {
    expect(validateNewsletterEmail('not-an-email')).toBe(
      messages.newsletterForm.errors.email.invalid,
    );
  });
});
