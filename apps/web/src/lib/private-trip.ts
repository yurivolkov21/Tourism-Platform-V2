import { type CreateEnquiryInput, CreateEnquiryInputSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';

/**
 * State form "chuyến riêng" — nhánh KHÔNG tạo booking.
 *
 * Khác `BookingFormState` ở bản chất chứ không chỉ ở field: nhánh này gửi
 * `enquiries.create`, tức một câu hỏi cho đội ngũ. Không có đợt khởi hành,
 * không có nơi thanh toán, và KHÔNG giữ chỗ nào.
 */
export interface PrivateTripState {
  /** Ngày mong muốn, dạng `YYYY-MM-DD`. Rỗng = chưa chốt, vẫn gửi được. */
  startDate: string;
  numAdults: number;
  numChildren: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  message: string;
  /** Honeypot — người thật không bao giờ điền. */
  website: string;
}

export type PrivateTripErrors = Partial<Record<keyof PrivateTripState, string>>;

/**
 * Kiểm trước khi gọi API. Bám ĐÚNG `CreateEnquiryInputSchema` để client và
 * server không nói khác nhau — đặc biệt `message` min 10 và `name` min 2, hai
 * ngưỡng dễ bị quên và chỉ lộ ra khi server từ chối một enquiry mà khách tưởng
 * đã gửi xong.
 */
export function validatePrivateTrip(state: PrivateTripState): PrivateTripErrors {
  const t = messages.booking.errors;
  const errors: PrivateTripErrors = {};
  const shape = CreateEnquiryInputSchema.shape;

  if (!shape.name.safeParse(state.contactName).success) errors.contactName = t.INVALID_CONTACT;
  if (!shape.email.safeParse(state.contactEmail.trim()).success) {
    errors.contactEmail = t.INVALID_CONTACT;
  }
  if (!shape.message.safeParse(state.message).success) errors.message = t.INVALID_CONTACT;
  if (state.numAdults < 1) errors.numAdults = t.INVALID_PARTY_SIZE;

  const phone = state.contactPhone.trim();
  if (phone && !shape.phone.safeParse(phone).success) errors.contactPhone = t.INVALID_CONTACT;

  return errors;
}

/**
 * State → payload `enquiries.create`.
 *
 * `groupSize` là TỔNG người đi (người lớn + trẻ em): đội ngũ cần biết đoàn bao
 * nhiêu người để báo giá, không phải cơ cấu độ tuổi — cơ cấu đó nằm trong lời
 * nhắn nếu khách thấy cần.
 *
 * Ba field optional (`phone`, `travelDate`, `website`) bỏ HẲN khi rỗng, không
 * gửi chuỗi rỗng — cùng bẫy đã ghi ở `buildBookingInput`: `''` trượt validate
 * chứ không được hiểu là "không có".
 */
export function buildPrivateTripPayload(
  state: PrivateTripState,
  tourId: string,
): CreateEnquiryInput {
  const phone = state.contactPhone.trim();
  const startDate = state.startDate.trim();

  const payload: CreateEnquiryInput = {
    name: state.contactName.trim(),
    email: state.contactEmail.trim(),
    message: state.message.trim(),
    tourId,
    groupSize: state.numAdults + state.numChildren,
    // `interests` LUÔN có mặt: schema `.default([])` khiến kiểu output không
    // optional. Nhánh này không hỏi sở thích vùng nên luôn rỗng.
    interests: [],
  };

  if (phone) payload.phone = phone;
  if (startDate) payload.travelDate = startDate;
  if (state.website) payload.website = state.website;

  return payload;
}
