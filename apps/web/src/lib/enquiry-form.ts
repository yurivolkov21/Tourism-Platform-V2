import type { CreateEnquiryInput } from '@tourism/contract';
import { CreateEnquiryInputSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';

/**
 * State có kiểm soát của form "lá thư" (`contact-split.tsx`, spec §2). Giữ
 * NGUYÊN tên field theo UI (không ép theo tên field của contract) — mapping
 * sang `CreateEnquiryInput` là việc của `buildEnquiryPayload` bên dưới.
 *
 * `region`/`count`/`dates` đều là chuỗi thô từ input/select — chuỗi rỗng
 * nghĩa là "chưa điền/chưa chọn" (không dùng `undefined` để state luôn
 * controlled, tránh cảnh báo React input uncontrolled→controlled).
 */
export interface ContactFormState {
  name: string;
  email: string;
  /** Textarea "What do you love when travelling?" → payload.message */
  loves: string;
  /** Text tự do "When are you free?" — GHÉP vào cuối message, KHÔNG gửi travelDate */
  dates: string;
  /** Text numeric "How many of you?" → payload.groupSize (parse-hoặc-bỏ) */
  count: string;
  /** Select "Where are you dreaming of?" → payload.interests[0] */
  region: string;
  /** Honeypot ẩn — người thật luôn để rỗng */
  website: string;
}

/** Field UI hiển thị lỗi inline — KHÔNG gồm `website` (honeypot không bao giờ báo lỗi cho khách) */
export type ContactFormField = 'name' | 'email' | 'loves' | 'count' | 'dates' | 'region';

/**
 * Parse "count" (chuỗi thô ô "How many of you?") thành `groupSize` hợp lệ
 * theo `CreateEnquiryInputSchema` (int 1..100). Parse KHÔNG được (rỗng, chữ,
 * số thập phân, âm) hoặc ngoài khoảng → trả `undefined` để field bị BỎ khỏi
 * payload, không phải lỗi validate (khách gõ "2 travellers" hay để trống đều
 * hợp lệ, ta chỉ không đoán số).
 */
function parseGroupSize(raw: string): number | undefined {
  const trimmed = raw.trim();
  // Chỉ chấp nhận chuỗi TOÀN chữ số — Number("101abc") vẫn ra NaN nên không
  // cần regex riêng cho trường hợp đó, nhưng "4" lẫn khoảng trắng ("4 ") đã
  // bị trim ở trên; "bốn"/rỗng đều fail test này.
  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }
  const value = Number(trimmed);
  if (value < 1 || value > 100) {
    return undefined;
  }
  return value;
}

/**
 * Map state UI của form "lá thư" → payload đúng contract (spec §2). Hàm
 * THUẦN — không gọi API, không side effect — để TDD được tách biệt khỏi
 * component.
 */
export function buildEnquiryPayload(state: ContactFormState): CreateEnquiryInput {
  const dates = state.dates.trim();
  const message = dates ? `${state.loves}\n\nPreferred dates: ${dates}` : state.loves;

  const payload: CreateEnquiryInput = {
    name: state.name,
    email: state.email,
    message,
    // interests LUÔN có mặt (schema `.default([])` khiến kiểu output không
    // optional) — rỗng khi khách chưa chọn region, không phải "bỏ field".
    // `'any'` ("Anywhere in Vietnam") nghĩa là "không có sở thích vùng cụ
    // thể" — KHÔNG gửi 'any' làm interest rác (final review item 2).
    interests: state.region && state.region !== 'any' ? [state.region] : [],
  };

  const groupSize = parseGroupSize(state.count);
  if (groupSize !== undefined) {
    payload.groupSize = groupSize;
  }

  // Honeypot: passthrough NGUYÊN GIÁ TRỊ khi non-empty — người thật luôn để
  // rỗng nên field này lặng lẽ vắng mặt trong đa số request thật.
  if (state.website) {
    payload.website = state.website;
  }

  return payload;
}

/**
 * Validate client bằng CHÍNH `CreateEnquiryInputSchema` — không khai lại rule
 * (spec §2). `safeParse` chạy trên payload ĐÃ BUILD (không phải state thô) để
 * bám sát đúng những gì server sẽ thấy.
 *
 * Mỗi issue của zod chỉ cho biết field nào sai, KHÔNG phân biệt "để trống"
 * hay "có nhập nhưng chưa đủ" (`.min()` báo `too_small` cho cả hai) — hai
 * trường hợp đó cần copy khác nhau (`required` vs `tooShort`/`invalid`,
 * `messages.contactForm.errors`), nên tự soi giá trị thô của `state` để chọn
 * đúng nhánh copy.
 *
 * `count`/`dates`/`region` KHÔNG map issue nào tới field UI — `dates` không
 * tồn tại độc lập trong schema (đã gộp vào message), `region`→`interests` và
 * `count`→`groupSize` chỉ mang giá trị hợp lệ hoặc bị `buildEnquiryPayload`
 * bỏ hẳn trước khi tới safeParse, nên hai path đó không bao giờ xuất hiện
 * trong `result.error.issues` (đúng như spec: "dates/region không bao giờ có lỗi").
 */
export function validateEnquiry(
  state: ContactFormState,
): Partial<Record<ContactFormField, string>> {
  const errors: Partial<Record<ContactFormField, string>> = {};

  // Final review item 1: khi "dates" có giá trị, buildEnquiryPayload ghép
  // suffix "\n\nPreferred dates: …" (≥18 ký tự) vào message — đủ tự thoả
  // `message.min(10)` của schema DÙ "loves" (textarea thật khách gõ) rỗng
  // hoặc quá ngắn, khiến safeParse không báo lỗi gì cho field "message".
  // Quyết định controller: "loves" LUÔN bắt buộc ≥10 ký tự (trim), ĐỘC LẬP
  // với "dates" — check trước safeParse, không phụ thuộc issues của zod.
  const trimmedLoves = state.loves.trim();
  if (trimmedLoves.length === 0) {
    errors.loves = messages.contactForm.errors.message.required;
  } else if (trimmedLoves.length < 10) {
    errors.loves = messages.contactForm.errors.message.tooShort;
  }

  const payload = buildEnquiryPayload(state);
  const result = CreateEnquiryInputSchema.safeParse(payload);
  if (result.success) {
    return errors;
  }

  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (field === 'name') {
      errors.name =
        state.name.trim().length === 0
          ? messages.contactForm.errors.name.required
          : messages.contactForm.errors.name.tooShort;
    } else if (field === 'email') {
      errors.email =
        state.email.trim().length === 0
          ? messages.contactForm.errors.email.required
          : messages.contactForm.errors.email.invalid;
    } else if (field === 'message') {
      // Payload đặt tên "message", UI đặt tên "loves" — hai tên khác nhau cố
      // ý (mapping giữ UI, không ép người dùng theo schema, spec §2).
      errors.loves =
        state.loves.trim().length === 0
          ? messages.contactForm.errors.message.required
          : messages.contactForm.errors.message.tooShort;
    }
  }
  return errors;
}
