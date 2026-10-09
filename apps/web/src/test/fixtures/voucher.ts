import { type BookingDetail, cancellationDeadline } from '@tourism/contract';
import { makeBooking, makeCancellation } from './booking';

/**
 * Fixture dùng chung cho các spec voucher `/checkout/success` (plan P7, phần C).
 *
 * "Bây giờ" của mọi spec voucher: 10:00 giờ Việt Nam ngày 20/10/2026. Spec truyền mốc này
 * vào `voucherView` thay vì đọc đồng hồ thật.
 */
export const VOUCHER_NOW = new Date('2026-10-20T03:00:00.000Z');

/**
 * Cùng 10:00 giờ Việt Nam như `VOUCHER_NOW` nhưng ở ngày lịch VN `day` (`YYYY-MM-DD`).
 * `voucherView` suy hôm nay từ chính `now` (một đồng hồ), nên spec cần giai đoạn đang đi hay đã
 * đi truyền mốc này thay vì một chuỗi ngày riêng.
 */
export function voucherNowOn(day: string): Date {
  return new Date(`${day}T03:00:00.000Z`);
}

/** Mốc ISO cách `VOUCHER_NOW` `minutes` phút về trước (số âm là về sau). */
export function minutesBeforeNow(minutes: number): string {
  return new Date(VOUCHER_NOW.getTime() - minutes * 60_000).toISOString();
}

/**
 * Chuyến ba ngày 3–5/11 (N = 3 nên hạn chót 31/10 — hôm nay 20/10 còn trong hạn): ngày đi khác
 * ngày về để ca khoảng ngày bắt được chỗ lấy nhầm mốc. Hạn chót và cờ huỷ do `voucherBooking`
 * suy từ hai ngày này.
 */
export const THREE_DAY_TRIP = {
  departureStartDate: '2026-11-03',
  departureEndDate: '2026-11-05',
} as const;

/**
 * Đơn đã trả rồi bị huỷ (khách huỷ, có `cancelledAt`) — voucher hết hiệu lực. Một bản cho mọi
 * spec voucher thay vì mỗi spec tự dựng một bộ ngày huỷ.
 */
export const CANCELLED_AFTER_PAYING = {
  status: 'CANCELLED',
  cancellation: null,
  cancelledAt: '2026-10-19T08:00:00.000Z',
} as const satisfies Partial<BookingDetail>;

/**
 * Chuyến bị CÔNG TY huỷ khi job hoàn tiền (`departure-refund`) chưa chạy: đơn vẫn PAID, chưa hoàn
 * đồng nào, chưa có mốc huỷ, server không gửi cờ huỷ (ADR-0041 AMEND 1, ADR-0054 AMEND 1).
 */
export const OPERATOR_CANCELLED_PENDING = {
  departureCancelled: true,
  cancellation: null,
} as const satisfies Partial<BookingDetail>;

/**
 * Đơn của bản vẽ `booking-voucher.src.html`: Hà Nội một ngày 3/11, 3 người lớn × $49, trả
 * bằng PayPal hai ngày trước `VOUCHER_NOW` — mặc định là voucher MỞ LẠI của chuyến sắp đi.
 *
 * Hai điểm đến để ca `{nơi}` phân biệt "điểm đến đầu tiên" với "điểm đến nào cũng được".
 *
 * `cancellationDeadline` và cờ huỷ của server SUY từ ngày đi, ngày về sau khi đè (cùng hàm
 * server dùng — `cancellationDeadline`, `makeCancellation`): spec đổi ngày chuyến thì hạn chót
 * và cờ đổi theo. Spec cần cờ khác (quá hạn, không cờ) thì truyền `cancellation` tường minh.
 */
export function voucherBooking(overrides: Partial<BookingDetail> = {}): BookingDetail {
  const departureStartDate = overrides.departureStartDate ?? '2026-11-03';
  const departureEndDate = overrides.departureEndDate ?? '2026-11-03';
  const booking = makeBooking({
    code: 'BK-B6VCOQNW',
    status: 'PAID',
    tourTitle: 'Hanoi Heritage in a Day',
    tourSlug: 'hanoi-heritage-day',
    tourDestinations: [
      { slug: 'ha-noi', name: 'Hà Nội', isPrimary: true },
      { slug: 'ninh-binh', name: 'Ninh Bình', isPrimary: false },
    ],
    departureStartDate,
    departureEndDate,
    cancellationDeadline: cancellationDeadline(departureStartDate, departureEndDate),
    unitPrice: '49.00',
    totalAmount: '147.00',
    currency: 'USD',
    numAdults: 3,
    numChildren: 0,
    contactName: 'Erik Lund',
    contactEmail: 'erik.lund@example.com',
    paymentProvider: 'PAYPAL',
    createdAt: '2026-10-18T02:00:00.000Z',
    paidAt: '2026-10-18T02:20:00.000Z',
    ...overrides,
  });
  return 'cancellation' in overrides
    ? booking
    : { ...booking, cancellation: makeCancellation(booking) };
}
