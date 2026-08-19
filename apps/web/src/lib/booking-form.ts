import { ORPCError } from '@orpc/client';
import { type CreateBookingInput, CreateBookingInputSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';

/**
 * State của form đặt chỗ ở chế độ Scheduled departure.
 *
 * Giữ nguyên dạng "thứ người dùng đã gõ" — chuỗi rỗng thay vì undefined, chưa
 * cắt khoảng trắng. Việc nắn về đúng `CreateBookingInput` là của
 * {@link buildBookingInput}; tách vậy để test được luật nắn mà không cần dựng
 * cả form.
 */
export interface BookingFormState {
  departureId: string | null;
  numAdults: number;
  numChildren: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  specialRequests: string;
  paymentProvider: CreateBookingInput['paymentProvider'];
}

export type BookingFormErrors = Partial<Record<keyof BookingFormState, string>>;

/** Ràng buộc nào đang quyết định trần — dùng để chọn câu giải thích. */
export type PartyCapReason = 'group' | 'seats';

/**
 * Trần số người đi: cái NHỎ HƠN giữa nhóm tối đa của tour và số ghế còn lại
 * của đợt đang chọn.
 *
 * Trả kèm `reason` vì hai ràng buộc cần hai câu khác nhau — "tour này nhận tối
 * đa N khách" và "đợt này chỉ còn N chỗ" là hai lý do khác hẳn, và nói sai lý
 * do thì khách đi tìm cách sửa sai chỗ (đổi đợt vs bỏ bớt người).
 *
 * `seatsLeft = null` nghĩa là chưa chọn đợt — lúc đó chỉ còn ràng buộc nhóm.
 */
export function partyCap(
  maxGroupSize: number,
  seatsLeft: number | null,
): { cap: number; reason: PartyCapReason } {
  if (seatsLeft === null || seatsLeft >= maxGroupSize) {
    return { cap: maxGroupSize, reason: 'group' };
  }
  return { cap: seatsLeft, reason: 'seats' };
}

/**
 * Kiểm form phía client TRƯỚC khi gọi API.
 *
 * Không phải để thay validate của server — server vẫn là bên quyết định. Đây là
 * để khách không phải đi hết một round-trip mới biết thiếu email. Luật ở đây
 * bám ĐÚNG `CreateBookingInputSchema` (phone min 6, specialRequests max 1000,
 * numAdults min 1) để hai bên không nói khác nhau.
 */
export function validateBookingForm(state: BookingFormState): BookingFormErrors {
  const t = messages.booking.errors;
  // Sweep 19/08: lỗi TỪNG Ô dùng `formErrors` (required/invalid/tooLong tách
  // câu) — trước đó mọi ô liên hệ đều nhận một câu `INVALID_CONTACT` (đã gỡ) "valid
  // name and email", kể cả khi thứ sai là phone hay requests quá dài.
  const f = messages.formErrors;
  const shape = CreateBookingInputSchema.shape;
  const errors: BookingFormErrors = {};

  if (!state.departureId) errors.departureId = t.MISSING_DEPARTURE;
  if (state.numAdults < 1) errors.numAdults = t.INVALID_PARTY_SIZE;

  const name = state.contactName.trim();
  if (!name) errors.contactName = f.name.required;
  else if (!shape.contactName.safeParse(name).success) errors.contactName = f.name.tooLong;

  const email = state.contactEmail.trim();
  if (!email) errors.contactEmail = f.email.required;
  else if (!shape.contactEmail.safeParse(email).success) errors.contactEmail = f.email.invalid;

  // Phone optional: bỏ trống thì thôi, có thì 6–30 ký tự (đúng schema).
  const phone = state.contactPhone.trim();
  if (phone && !shape.contactPhone.safeParse(phone).success) errors.contactPhone = f.phone.invalid;

  if (state.specialRequests.trim().length > 1000) {
    errors.specialRequests = f.specialRequests.tooLong;
  }

  return errors;
}

/**
 * State form → payload `bookings.create`.
 *
 * Hai field optional (`contactPhone`, `specialRequests`) được BỎ HẲN khỏi
 * payload khi rỗng, không gửi chuỗi rỗng: contract khai `.optional()` với
 * `min(6)` và `min(1)`, nên `''` sẽ bị từ chối chứ không được coi là "không
 * có". Đây đúng là cái bẫy `KEY=` thành chuỗi rỗng mà repo đã gặp ở tầng env.
 *
 * Ném nếu chưa chọn đợt: gọi hàm này trước khi {@link validateBookingForm} pass
 * là lỗi lập trình, không phải lỗi người dùng — thà vỡ to tiếng lúc dev.
 */
export function buildBookingInput(state: BookingFormState): CreateBookingInput {
  if (!state.departureId) {
    throw new Error('buildBookingInput: chưa chọn đợt khởi hành — validate trước khi build');
  }

  const phone = state.contactPhone.trim();
  const requests = state.specialRequests.trim();

  return {
    departureId: state.departureId,
    numAdults: state.numAdults,
    numChildren: state.numChildren,
    contactName: state.contactName.trim(),
    contactEmail: state.contactEmail.trim(),
    paymentProvider: state.paymentProvider,
    ...(phone ? { contactPhone: phone } : {}),
    ...(requests ? { specialRequests: requests } : {}),
  };
}

/** Bốn bước của wizard, ĐÚNG thứ tự khách đi qua. */
export const BOOKING_STEPS = ['dates', 'travellers', 'review', 'pay'] as const;

export type BookingStep = (typeof BOOKING_STEPS)[number];

/**
 * Trường nào thuộc bước nào — NGUỒN DUY NHẤT của việc xếp bước.
 *
 * Cố ý dùng `Record` đủ khoá thay vì bốn mảng rời: thêm một trường mới vào
 * `BookingFormState` mà quên xếp bước thì TypeScript báo ngay tại đây, còn mảng
 * rời sẽ im lặng để trường đó rơi ra ngoài mọi bước — và một ô không thuộc bước
 * nào là ô không bao giờ được kiểm.
 *
 * `review` không sở hữu trường nào: nó chỉ đọc lại thứ ba bước kia đã thu.
 */
const FIELD_STEP: Record<keyof BookingFormState, BookingStep> = {
  departureId: 'dates',
  numAdults: 'travellers',
  numChildren: 'travellers',
  contactName: 'travellers',
  contactEmail: 'travellers',
  contactPhone: 'travellers',
  specialRequests: 'travellers',
  paymentProvider: 'pay',
};

export function stepOf(field: keyof BookingFormState): BookingStep {
  return FIELD_STEP[field];
}

/**
 * Lỗi của RIÊNG một bước — lọc {@link validateBookingForm} theo {@link FIELD_STEP}.
 *
 * Vì sao không đổ hết lỗi lên bước hiện tại: khách đang ở bước chọn ngày mà
 * thấy "email không hợp lệ" thì không sửa được, ô email còn chưa hiện ra. Lỗi
 * phải nằm cùng chỗ với ô gây ra nó.
 */
export function stepErrors(step: BookingStep, state: BookingFormState): BookingFormErrors {
  const all = validateBookingForm(state);
  const out: BookingFormErrors = {};
  for (const key of Object.keys(all) as (keyof BookingFormState)[]) {
    if (FIELD_STEP[key] === step) out[key] = all[key];
  }
  return out;
}

/** Bước hiện tại đã sạch lỗi chưa — điều kiện để nút Continue hoạt động. */
export function canLeaveStep(step: BookingStep, state: BookingFormState): boolean {
  return Object.keys(stepErrors(step, state)).length === 0;
}

/**
 * Copy lỗi khi `bookings.create` thất bại (sweep 19/08). Trước đó wizard nuốt
 * MỌI lỗi thành `CHECKOUT_FAILED` "couldn't start the payment session" — kể
 * cả khi API nói rõ hết ghế (`SEATS_UNAVAILABLE` 409), đợt đóng
 * (`DEPARTURE_NOT_AVAILABLE` 400), hết phiên (401) hay throttle (429), dù
 * `booking.errors` đã có sẵn câu cho từng ca. Khớp theo `code`/`status` của
 * `ORPCError` — cùng nguồn sự thật với `classifyActionError` ở
 * `booking-actions.tsx` và `classifySubmitError`.
 */
export function bookingSubmitErrorCopy(error: unknown): string {
  const t = messages.booking.errors;
  if (error instanceof ORPCError) {
    if (error.status === 401) return t.UNAUTHORIZED;
    if (error.status === 429) return messages.accountActionErrors.throttle;
    if (error.code === 'SEATS_UNAVAILABLE') return t.SEATS_NOT_AVAILABLE;
    if (error.code === 'DEPARTURE_NOT_AVAILABLE') return t.DEPARTURE_NOT_OPEN;
  }
  return t.CHECKOUT_FAILED;
}
