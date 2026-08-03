import { SubscribeInputSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';

/**
 * Validate email của form newsletter footer (`components/newsletter-form.tsx`,
 * spec §3) bằng CHÍNH `SubscribeInputSchema` (không khai lại rule zod) — chỉ
 * soi field `email`; honeypot `website` không qua nhánh này (passthrough
 * thẳng ở component, cùng khuôn `buildEnquiryPayload`).
 *
 * `.pick({ email: true })` để lỗi/thiếu `source`/`website` không lẫn vào kết
 * quả — form chỉ có một input thật, không cần soi `issue.path`.
 *
 * zod báo `too_small` cho CẢ "để trống" lẫn "sai định dạng ngắn" (giống
 * `validateEnquiry`), nên tự soi `email.trim().length === 0` để chọn đúng
 * copy "required" vs "invalid", không suy từ `issue.code`.
 */
export function validateNewsletterEmail(email: string): string | undefined {
  const result = SubscribeInputSchema.pick({ email: true }).safeParse({ email });
  if (result.success) {
    return undefined;
  }
  return email.trim().length === 0
    ? messages.newsletterForm.errors.email.required
    : messages.newsletterForm.errors.email.invalid;
}
