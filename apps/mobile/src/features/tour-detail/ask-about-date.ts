import { ORPCError } from '@orpc/client';
import type { CreateEnquiryInput } from '@tourism/contract';
import { CreateEnquiryInputSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';

export interface AskAboutDateState {
  name: string;
  email: string;
  message: string;
}

export type AskAboutDateField = 'name' | 'email' | 'message';
export type AskAboutDateErrors = Partial<Record<AskAboutDateField, string>>;

/** Chỉ BA ô khách thật sự gõ trên tấm D3 — `tourId`/`travelDate` đến từ đợt đã bấm. */
const AskAboutDateFieldsSchema = CreateEnquiryInputSchema.pick({
  name: true,
  email: true,
  message: true,
});

/**
 * Payload gửi `enquiries.create` (D3, đợt đã đóng) — `tourId`/`travelDate`
 * đọc từ đợt khách vừa bấm "Ask about this date", KHÔNG phải ô nhập tự do
 * (khác web `PrivateTripForm` cho khách tự chọn ngày mong muốn).
 */
export function buildAskAboutDatePayload(
  state: AskAboutDateState,
  departure: { tourId: string; travelDate: string },
): CreateEnquiryInput {
  return {
    name: state.name,
    email: state.email,
    message: state.message,
    tourId: departure.tourId,
    travelDate: departure.travelDate,
    interests: [],
  };
}

/**
 * Validate bằng ĐÚNG `CreateEnquiryInputSchema` (không khai lại rule) — cùng
 * cách web làm ở `validateEnquiry` (`apps/web/src/lib/enquiry-form.ts`). Copy
 * lỗi DÙNG CHUNG `messages.contactForm.errors` — đã là quy ước của mọi form
 * enquiry khác (`/contact`, home contact), field name khớp 1:1 nên không cần
 * mapping riêng như web (web đặt tên UI "loves" khác field "message").
 */
export function validateAskAboutDate(state: AskAboutDateState): AskAboutDateErrors {
  const result = AskAboutDateFieldsSchema.safeParse(state);
  if (result.success) return {};

  const errors: AskAboutDateErrors = {};
  const fieldErrors = messages.contactForm.errors;
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (field === 'name') {
      // Review L6: `too_big` từng rơi vào nhánh "tooShort" — bảo khách viết thêm trong khi lỗi
      // thật là quá dài (cùng lỗi với form web, `validateEnquiry`).
      if (state.name.trim().length === 0) errors.name = fieldErrors.name.required;
      else if (issue.code === 'too_big') errors.name = fieldErrors.name.tooLong;
      else errors.name = fieldErrors.name.tooShort;
    } else if (field === 'email') {
      errors.email =
        state.email.trim().length === 0 ? fieldErrors.email.required : fieldErrors.email.invalid;
    } else if (field === 'message') {
      if (state.message.trim().length === 0) errors.message = fieldErrors.message.required;
      else if (issue.code === 'too_big') {
        errors.message = fieldErrors.message.tooLong(Number(issue.maximum));
      } else errors.message = fieldErrors.message.tooShort;
    }
  }
  return errors;
}

/**
 * Câu lỗi khi gửi tấm "Ask about this date" hỏng. `enquiries.create` có trần 5
 * lượt mỗi phút (PUBLIC_WRITE_THROTTLE): 429 dùng câu bảo chờ của form enquiry
 * (`enquiryErrorCopy`), vì "Please try again" ngay lúc ấy chỉ đụng trần lần
 * nữa. Lỗi khác giữ câu chung của tấm.
 */
export function askAboutDateErrorCopy(error: unknown): string {
  if (error instanceof ORPCError && error.status === 429) {
    return messages.mobile.enquiry.errors.rateLimited;
  }
  return messages.mobile.tourDetail.askAboutDateSheet.error;
}
