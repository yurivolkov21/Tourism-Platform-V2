import { ORPCError } from '@orpc/client';
import { type CreateBookingInput, EmailSchema } from '@tourism/contract';
import { validateProfileName, validateProfilePhone } from '@tourism/core';
import { messages } from '@tourism/i18n';

/**
 * Logic thuần của cụm đặt tour mobile (P5b-3, mockup B1-B5). Port từ
 * `apps/web/src/lib/booking-form.ts` nhưng gọn hơn: mobile luôn có sẵn MỘT
 * đợt đã chọn từ tab Dates trước khi vào wizard (không có bước "chọn đợt"
 * riêng như web), nên không cần `departureId`/`BookingStep` machinery.
 */

/** Ràng buộc nào đang quyết định trần — dùng để chọn câu giải thích (B2). */
export type PartyCapReason = 'group' | 'seats';

/**
 * Trần số người đi: cái NHỎ HƠN giữa nhóm tối đa của tour và số ghế còn lại
 * của đợt đã chọn. Trả kèm `reason` vì "tour nhận tối đa N khách" và "đợt chỉ
 * còn N chỗ" là hai lý do khác hẳn (B2 caption).
 */
export function partyCap(
  maxGroupSize: number,
  seatsLeft: number,
): { cap: number; reason: PartyCapReason } {
  if (seatsLeft >= maxGroupSize) return { cap: maxGroupSize, reason: 'group' };
  return { cap: seatsLeft, reason: 'seats' };
}

/**
 * Hai câu về trần của B1/B2 theo đúng lý do của trần: `hint` luôn hiện dưới hai bộ đếm,
 * `reached` chỉ hiện khi đã chạm trần. Trần do ghế còn lại của đợt thì không được nói "tour
 * chỉ nhận chừng ấy" — tour nhận 12 mà đợt còn 3 thì câu ấy sai sự thật.
 */
export function partyCapCopy(cap: { cap: number; reason: PartyCapReason }): {
  hint: string;
  reached: string;
} {
  const copy = messages.mobile.booking;
  return cap.reason === 'seats'
    ? { hint: copy.seatsLeftOnDate(cap.cap), reached: copy.seatsCapReached }
    : { hint: copy.groupCapNote(cap.cap), reached: copy.groupCapReached(cap.cap) };
}

/**
 * Tổng tiền hiển thị = đơn giá × TỔNG chỗ (API không có giá trẻ em riêng —
 * B1 caption). `Number()` chỉ ở bước cuối để định dạng (cùng luật
 * `format-money.ts`), party size luôn là số nguyên nhỏ nên không có rủi ro
 * mất độ chính xác của phép nhân này.
 */
export function totalPrice(unitPrice: string, partySize: number): string {
  return (Number(unitPrice) * partySize).toFixed(2);
}

export interface ContactFormState {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  specialRequests: string;
}

export type ContactFormErrors = Partial<Record<keyof ContactFormState, string>>;

/**
 * Kiểm form liên hệ (B3) TRƯỚC khi gọi API. Dùng lại NGUYÊN `validateProfileName`
 * / `validateProfilePhone` của `@tourism/core` (đúng dặn của mockup) — cùng luật
 * với ô tên/phone ở hồ sơ tài khoản, không viết lại ngưỡng.
 */
export function validateContactForm(state: ContactFormState): ContactFormErrors {
  const f = messages.formErrors;
  const errors: ContactFormErrors = {};

  const nameError = validateProfileName(state.contactName);
  if (nameError !== undefined) errors.contactName = nameError;

  const email = state.contactEmail.trim();
  if (!email) errors.contactEmail = f.email.required;
  else if (!EmailSchema.safeParse(email).success) errors.contactEmail = f.email.invalid;

  const phoneError = validateProfilePhone(state.contactPhone);
  if (phoneError !== undefined) errors.contactPhone = phoneError;

  if (state.specialRequests.trim().length > 1000) {
    errors.specialRequests = f.specialRequests.tooLong;
  }

  return errors;
}

export interface BookingDraftInput extends ContactFormState {
  departureId: string;
  numAdults: number;
  numChildren: number;
  paymentProvider: CreateBookingInput['paymentProvider'];
}

/**
 * State draft → payload `bookings.create`. Hai field optional bị BỎ HẲN khỏi
 * payload khi rỗng (cùng bẫy `KEY=` chuỗi rỗng đã ghi ở `booking-form.ts` bên
 * web) — contract khai `.optional()` kèm `min()`, gửi `''` sẽ bị từ chối.
 */
export function buildBookingInput(state: BookingDraftInput): CreateBookingInput {
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

/**
 * Copy lỗi khi `bookings.create` thất bại — CÙNG bảng khớp lỗi với web
 * (`bookingSubmitErrorCopy`), đọc chung `messages.booking.errors` để hai
 * client không nói khác nhau cho cùng một mã lỗi server.
 */
export function bookingSubmitErrorCopy(error: unknown): string {
  const t = messages.booking.errors;
  if (error instanceof ORPCError) {
    if (error.status === 401) return t.UNAUTHORIZED;
    if (error.status === 429) return messages.accountActionErrors.throttle;
    if (error.code === 'SEATS_UNAVAILABLE') return t.SEATS_NOT_AVAILABLE;
    if (error.code === 'PARTY_TOO_LARGE') return t.PARTY_TOO_LARGE;
    if (error.code === 'DEPARTURE_NOT_AVAILABLE') return messages.accountActionErrors.bookingClosed;
  }
  return t.CHECKOUT_FAILED;
}

/**
 * Đường đi tiếp khi Pay ở B4 lỗi (B9, mockup): BA trong bốn mã lỗi của
 * `bookings.create` đưa khách đi chỗ khác — `CHECKOUT_FAILED` (và mọi lỗi khác:
 * 401/429/mạng) rơi vào "giữ nguyên màn" vì màn chưa đổi gì để cần điều hướng đi.
 *
 * `NOT_PENDING` chỉ đến từ `bookings.checkout` (draft đã có booking, K1): booking
 * đã đổi trạng thái ở nơi khác — trả xong mà webhook tới muộn, hoặc cron huỷ vì
 * hết hạn. Gọi lại đúng lệnh đó chỉ lỗi lại mãi, nên sang B6 để đọc lại booking
 * và dẫn đi đúng chỗ (PAID → B8, đã chết → báo hết hiệu lực).
 */
export type BookingCreateErrorAction = 'goToDates' | 'goToTravellers' | 'verify' | 'stay';

export function bookingCreateErrorAction(error: unknown): BookingCreateErrorAction {
  if (error instanceof ORPCError) {
    if (error.code === 'SEATS_UNAVAILABLE' || error.code === 'DEPARTURE_NOT_AVAILABLE') {
      return 'goToDates';
    }
    if (error.code === 'PARTY_TOO_LARGE') return 'goToTravellers';
    if (error.code === 'NOT_PENDING') return 'verify';
  }
  return 'stay';
}

/**
 * Nhịp chờ hỏi lại `bookings.byCode` sau khi rời trình duyệt (B6) — 2s, 4s,
 * 8s rồi DỪNG (không quay vòng vô hạn, mockup B6 caption). Webhook của cổng
 * có thể tới sau vài giây, không phải tin ngay lần hỏi đầu.
 */
export const VERIFY_BACKOFF_MS: readonly number[] = [2000, 4000, 8000];

export type VerifyOutcome = 'paid' | 'ended' | 'pending';

/**
 * B6 hỏi lại `bookings.byCode`: PAID → B8; CANCELLED/REFUNDED/PARTIALLY_REFUNDED
 * nghĩa là booking đã chết (hết hạn TTL, huỷ tay) — dừng hỏi và KHÔNG mời trả lại;
 * còn lại (PENDING) mới tiếp tục chờ webhook.
 */
export function verifyOutcome(status: string): VerifyOutcome {
  if (status === 'PAID') return 'paid';
  if (status === 'CANCELLED' || status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED') {
    return 'ended';
  }
  return 'pending';
}
