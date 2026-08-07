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
  const errors: BookingFormErrors = {};

  if (!state.departureId) errors.departureId = t.MISSING_DEPARTURE;
  if (state.numAdults < 1) errors.numAdults = t.INVALID_PARTY_SIZE;
  if (!state.contactName.trim()) errors.contactName = t.INVALID_CONTACT;

  const email = state.contactEmail.trim();
  if (!email || !CreateBookingInputSchema.shape.contactEmail.safeParse(email).success) {
    errors.contactEmail = t.INVALID_CONTACT;
  }

  // Phone optional: bỏ trống thì thôi, có thì phải đủ 6 ký tự.
  const phone = state.contactPhone.trim();
  if (phone && (phone.length < 6 || phone.length > 30)) errors.contactPhone = t.INVALID_CONTACT;

  if (state.specialRequests.trim().length > 1000) errors.specialRequests = t.INVALID_CONTACT;

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
