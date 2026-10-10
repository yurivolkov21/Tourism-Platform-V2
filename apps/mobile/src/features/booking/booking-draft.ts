/**
 * Draft đặt tour đang đi qua ba bước (B1→B3), module-scope — cùng khuôn
 * `features/auth/return-to.ts`: chỉ MỘT lượt đặt chỗ đi cùng lúc nên không cần
 * context/store phản ứng, chỉ cần đọc/ghi khi chuyển route.
 */

export interface BookingDraftTrip {
  tourSlug: string;
  tourTitle: string;
  tourImageUrl: string | null;
  departureId: string;
  startDate: string;
  endDate: string;
  unitPrice: string;
  currency: string;
  maxGroupSize: number;
  seatsLeft: number;
  /** Hạn chót đặt chỗ CỦA ĐỢT — cũng là hạn huỷ miễn phí (ADR-0041 §2). */
  bookingDeadline: string;
}

export interface BookingDraft {
  trip: BookingDraftTrip;
  numAdults: number;
  numChildren: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  specialRequests: string;
  paymentProvider: 'STRIPE' | 'PAYPAL';
  /**
   * Điền sau khi `bookings.create` thành công (B4→B5) — link thật của cổng
   * thanh toán và mã booking vừa tạo. B5 mở LẠI đúng link này khi khách bấm
   * "Open payment page" lần nữa, KHÔNG mint link mới (mockup B5 caption).
   */
  checkoutUrl: string | null;
  bookingCode: string | null;
}

let draft: BookingDraft | null = null;
/** Bản chụp draft đã PAID — chỉ để B8 hiển thị; draft thật đã xoá nên các
 *  màn B1–B5 còn nằm trong stack không thể tạo booking mới nữa. `totalAmount` là
 *  số SERVER xác nhận, không phải số điện thoại tự nhân lại. */
export type CompletedBooking = BookingDraft & { totalAmount: string };
let completed: CompletedBooking | null = null;

/** Các trường quyết định nội dung booking đã gửi server — đổi một trong số này
 *  thì booking PENDING cũ không còn khớp, phải tạo lại thay vì checkout lại. */
const BOOKING_INPUT_KEYS = [
  'numAdults',
  'numChildren',
  'contactName',
  'contactEmail',
  'contactPhone',
  'specialRequests',
  'paymentProvider',
] as const;

/** Gọi lúc bấm "Book now" ở trang tour — mở draft mới, điền sẵn tên/email nếu đã đăng nhập. */
export function startBookingDraft(
  trip: BookingDraftTrip,
  contact: { name: string; email: string },
): BookingDraft {
  completed = null;
  draft = {
    trip,
    numAdults: 1,
    numChildren: 0,
    contactName: contact.name,
    contactEmail: contact.email,
    contactPhone: '',
    specialRequests: '',
    paymentProvider: 'STRIPE',
    checkoutUrl: null,
    bookingCode: null,
  };
  return draft;
}

/** `null` nghĩa là chưa có draft nào đang mở — màn gọi hàm này phải tự điều
 *  hướng lùi về trang tour (deep-link thẳng vào một bước giữa chừng). */
export function getBookingDraft(): BookingDraft | null {
  return draft;
}

export function updateBookingDraft(
  patch: Partial<Omit<BookingDraft, 'trip'>>,
): BookingDraft | null {
  if (draft === null) return null;
  const current = draft;
  const changed = BOOKING_INPUT_KEYS.some((key) => key in patch && patch[key] !== current[key]);
  draft = {
    ...current,
    ...patch,
    ...(changed ? { checkoutUrl: null, bookingCode: null } : {}),
  };
  return draft;
}

/** Gọi khi B6 xác nhận PAID — xoá draft ngay, chỉ giữ bản chụp cho B8. */
export function completeBookingDraft(totalAmount: string): void {
  if (draft === null || draft.bookingCode === null) return;
  completed = { ...draft, totalAmount };
  draft = null;
}

export function getCompletedBooking(): CompletedBooking | null {
  return completed;
}

export function clearCompletedBooking(): void {
  completed = null;
}

/** Gọi sau khi `bookings.create` xong (thành hoặc bại-dứt-điểm) — dọn draft để
 *  lượt đặt chỗ tiếp theo không kế thừa dữ liệu của lượt trước. */
export function clearBookingDraft(): void {
  draft = null;
}
