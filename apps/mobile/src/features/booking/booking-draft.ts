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

/** Gọi lúc bấm "Book now" ở trang tour — mở draft mới, điền sẵn tên/email nếu đã đăng nhập. */
export function startBookingDraft(
  trip: BookingDraftTrip,
  contact: { name: string; email: string },
): BookingDraft {
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
  draft = { ...draft, ...patch };
  return draft;
}

/** Gọi sau khi `bookings.create` xong (thành hoặc bại-dứt-điểm) — dọn draft để
 *  lượt đặt chỗ tiếp theo không kế thừa dữ liệu của lượt trước. */
export function clearBookingDraft(): void {
  draft = null;
}
