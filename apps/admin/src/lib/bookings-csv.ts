import type { Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { guestCount } from './bookings-view';

/**
 * Booking → hàng CSV (spec P4b §3-F6). THUẦN, nằm ngoài route handler nên
 * từng cột test được mà không cần dựng một request.
 *
 * Vì sao KHÔNG dùng lại `toBookingRow` (mapper của bảng): hai đích khác nhau.
 * Bảng nấu cho MẮT NGƯỜI — '$117.00', '2 adults, 1 child', '18 Sep 2026'.
 * File nấu cho CÔNG CỤ — người mở nó sẽ lọc, cộng, dựng pivot, nên tiền phải
 * là '117.00' (Excel đọc '$117.00' thành text và mọi phép SUM chết), ngày là
 * ISO, trạng thái là chính member enum, và đoàn khách tách thành ba cột đếm
 * được. Nhập hai đích vào một mapper là hỏng cả hai.
 *
 * Giá trị vắng ra Ô RỖNG chứ không phải '—': ô rỗng là "không có giá trị" với
 * mọi công cụ, còn em-dash là text và phá lọc/tính trên cả cột.
 */

const t = messages.admin.bookings.csv;

/** Thứ tự cột — hàng dữ liệu bên dưới PHẢI xếp đúng thứ tự này. */
export const BOOKINGS_CSV_HEADER: readonly string[] = [
  t.code,
  t.status,
  t.tour,
  t.departureStart,
  t.departureEnd,
  t.adults,
  t.children,
  t.guests,
  t.unitPrice,
  t.totalAmount,
  t.currency,
  t.customer,
  t.email,
  t.phone,
  t.createdAt,
  t.paidAt,
  t.cancelledAt,
];

/** Một booking → một hàng, cùng thứ tự với `BOOKINGS_CSV_HEADER`. */
export function toBookingCsvRow(booking: Booking): string[] {
  return [
    booking.code,
    booking.status,
    booking.tourTitle,
    booking.departureStartDate,
    booking.departureEndDate,
    String(booking.numAdults),
    String(booking.numChildren),
    String(guestCount(booking)),
    booking.unitPrice,
    booking.totalAmount,
    booking.currency,
    booking.contactName,
    booking.contactEmail,
    booking.contactPhone ?? '',
    booking.createdAt,
    booking.paidAt ?? '',
    booking.cancelledAt ?? '',
  ];
}

/**
 * Cả bảng CSV: header + một hàng mỗi booking. Tập rỗng vẫn giữ header — file
 * tải về mở ra thấy tên cột nói rõ "bộ lọc này không có booking nào", khác
 * hẳn một file trắng trông như hỏng.
 */
export function bookingsCsvRows(bookings: readonly Booking[]): string[][] {
  return [[...BOOKINGS_CSV_HEADER], ...bookings.map(toBookingCsvRow)];
}
