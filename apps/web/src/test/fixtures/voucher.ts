import type { BookingCancellation, BookingDetail } from '@tourism/contract';
import { makeBooking } from './booking';

/**
 * Fixture dùng chung cho các spec voucher `/checkout/success` (plan P7, phần C).
 *
 * "Bây giờ" của mọi spec voucher: 10:00 giờ Việt Nam ngày 20/10/2026. Spec truyền mốc này
 * vào `voucherView` thay vì đọc đồng hồ thật.
 */
export const VOUCHER_NOW = new Date('2026-10-20T03:00:00.000Z');

/** Ngày lịch Việt Nam của `VOUCHER_NOW`. */
export const VOUCHER_TODAY = '2026-10-20';

/** Mốc ISO cách `VOUCHER_NOW` `minutes` phút về trước (số âm là về sau). */
export function minutesBeforeNow(minutes: number): string {
  return new Date(VOUCHER_NOW.getTime() - minutes * 60_000).toISOString();
}

/** Cờ `cancellation` server trả cho đơn còn trong hạn huỷ miễn phí. */
export function openCancellation(deadline: string): BookingCancellation {
  return { deadline, withinDeadline: true, refundAmount: '147.00', canCancel: true };
}

/**
 * Đơn của bản vẽ `booking-voucher.src.html`: Hà Nội một ngày 3/11, 3 người lớn × $49, trả
 * bằng PayPal hai ngày trước `VOUCHER_NOW` — mặc định là voucher MỞ LẠI của chuyến sắp đi.
 *
 * Hai điểm đến để ca `{nơi}` phân biệt "điểm đến đầu tiên" với "điểm đến nào cũng được".
 */
export function voucherBooking(overrides: Partial<BookingDetail> = {}): BookingDetail {
  return makeBooking({
    code: 'BK-B6VCOQNW',
    status: 'PAID',
    tourTitle: 'Hanoi Heritage in a Day',
    tourSlug: 'hanoi-heritage-day',
    tourDestinations: [
      { slug: 'ha-noi', name: 'Hà Nội', isPrimary: true },
      { slug: 'ninh-binh', name: 'Ninh Bình', isPrimary: false },
    ],
    departureStartDate: '2026-11-03',
    departureEndDate: '2026-11-03',
    cancellationDeadline: '2026-11-02',
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
    cancellation: openCancellation('2026-11-02'),
    ...overrides,
  });
}
