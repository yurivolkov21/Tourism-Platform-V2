import { ORPCError } from '@orpc/client';
import type { CreateEnquiryInput } from '@tourism/contract';
import { CreateEnquiryInputSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';

export interface EnquiryFormState {
  name: string;
  email: string;
  /** Tuỳ chọn — ô rỗng hợp lệ, `buildEnquiryPayload` không gửi field này khi rỗng. */
  phone: string;
  message: string;
}

export type EnquiryFormField = 'name' | 'email' | 'phone' | 'message';
export type EnquiryFormErrors = Partial<Record<EnquiryFormField, string>>;

const EnquiryFieldsSchema = CreateEnquiryInputSchema.pick({
  name: true,
  email: true,
  phone: true,
  message: true,
});

/**
 * Validate bằng ĐÚNG `CreateEnquiryInputSchema` (không khai lại rule) — cùng
 * khuôn `validateAskAboutDate` (D3). Copy lỗi dùng `mobile.enquiry.errors` —
 * khối riêng của E1, CHỮ FLAT một câu mỗi ô (không tách required/tooShort
 * như `contactForm.errors` của D3), đúng mockup `mobile-booking-screens`.
 */
export function validateEnquiry(state: EnquiryFormState): EnquiryFormErrors {
  const result = EnquiryFieldsSchema.safeParse({
    name: state.name,
    email: state.email.trim(),
    message: state.message,
    phone: state.phone.trim() === '' ? undefined : state.phone,
  });
  if (result.success) return {};

  const errors: EnquiryFormErrors = {};
  const fieldErrors = messages.mobile.enquiry.errors;
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (field === 'name') errors.name = fieldErrors.nameRequired;
    else if (field === 'email') errors.email = fieldErrors.emailInvalid;
    else if (field === 'message') errors.message = fieldErrors.messageRequired;
  }
  return errors;
}

/** `tourId` vắng (enquiry chung chung, không gắn tour nào) thì bỏ qua field đó. */
export function buildEnquiryPayload(state: EnquiryFormState, tourId?: string): CreateEnquiryInput {
  const phone = state.phone.trim();
  return {
    name: state.name.trim(),
    email: state.email.trim(),
    message: state.message.trim(),
    ...(phone === '' ? {} : { phone }),
    ...(tourId === undefined ? {} : { tourId }),
    interests: [],
  };
}

/**
 * Câu lỗi khi `enquiries.create` thất bại — khuôn `cancelErrorCopy`
 * (`booking-detail.ts`): chỉ `429` có câu riêng (`rateLimited`), còn lại gộp
 * vào `generic` (form-level, khác lỗi từng ô của `validateEnquiry`).
 */
export function enquiryErrorCopy(error: unknown): string {
  const e = messages.mobile.enquiry.errors;
  if (error instanceof ORPCError && error.status === 429) return e.rateLimited;
  return e.generic;
}
