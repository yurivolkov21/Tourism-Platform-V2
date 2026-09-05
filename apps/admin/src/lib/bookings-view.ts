import type { Booking, BookingStatusValue } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { type BookingsQuery, bookingDetailHref } from './bookings-query';

/**
 * Mapper hiển thị vùng bookings (spec P4b §3-F1) — THUẦN, nằm ngoài React nên
 * test được từng nhánh. Bảng và trang chi tiết chỉ render VM có sẵn: không có
 * chỗ nào trong JSX tự tính tiền, tự cộng khách hay tự đoán nhãn trạng thái.
 * Copy tiếng Anh lấy từ `@tourism/i18n` (luật 7 CLAUDE.md).
 */

const t = messages.admin.bookings;

/**
 * Tiền giữ ĐỦ hai số lẻ — khác web (`maximumFractionDigits: 0`, giá tour tròn
 * trăm): back-office đối chiếu với sổ cái refund từng cent. `Number()` chỉ
 * dùng ở bước format cuối, nguồn sự thật vẫn là chuỗi thập phân của contract.
 */
// Constructor `Intl.NumberFormat` đắt hơn `.format()` một-hai bậc; từ F2 hàm
// này nằm trong render path client (dialog refund render lại theo từng phím
// gõ) nên cache theo currency — tập hữu hạn, sống trọn đời module.
const AMOUNT_FORMATTERS = new Map<string, Intl.NumberFormat>();

export function formatAmount(amount: string, currency: string): string {
  let formatter = AMOUNT_FORMATTERS.get(currency);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      // Contract chỉ ép `length(3)`, không ép ISO-4217 — currency lạ mà để
      // RangeError nổ trong render/toast là biến một refund THÀNH CÔNG thành
      // màn báo lỗi (review F2 31/08). In thô còn hơn nổ.
      return `${amount} ${currency}`;
    }
    AMOUNT_FORMATTERS.set(currency, formatter);
  }
  return formatter.format(Number(amount));
}

/** Tháng viết tắt — đọc bằng tay để KHÔNG đụng `new Date()` (xem dưới). */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Ngày lịch `YYYY-MM-DD` (cột `@db.Date`) → "14 Sep 2026". Tách CHUỖI chứ
 * không qua `new Date()`: chuỗi date-only bị hiểu là UTC rồi in theo giờ máy,
 * lệch đúng một ngày ở múi giờ âm — cùng cái bẫy đã ghi ở `lib/tours.ts` web.
 */
export function formatCalendarDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Khoảng đợt khởi hành: "14 Sep 2026 – 20 Sep 2026" (gạch ngang en dash). */
export function formatDateRange(start: string, end: string): string {
  return `${formatCalendarDate(start)} – ${formatCalendarDate(end)}`;
}

/**
 * Mốc ISO có múi giờ (`paidAt`, `createdAt`…) → "30 Aug 2026, 09:30 UTC".
 * CỐ Ý in theo UTC chứ không theo giờ máy: admin đọc cùng khung giờ với sổ
 * cái/audit trail của API, và server component render trên máy chủ nên "giờ
 * máy" vốn không phải giờ của người đang nhìn.
 */
export function formatDateTime(iso: string | null): string {
  if (!iso) return t.detail.empty;
  const date = new Date(iso);
  const day = date.getUTCDate();
  const month = MONTHS[date.getUTCMonth()];
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${day} ${month} ${date.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

/** Phần booking mà hai hàm khách bên dưới cần — nhận subset để test gọn. */
export interface GuestParty {
  numAdults: number;
  numChildren: number;
}

/** Số khách của một booking = người lớn + trẻ em (spec P4b §3-F1). */
export function guestCount({ numAdults, numChildren }: GuestParty): number {
  return numAdults + numChildren;
}

/**
 * Diễn giải thành phần đoàn: "2 adults, 1 child"; không trẻ em thì bỏ vế sau.
 * Dùng CHUNG `accountBookings.travellers` — JSDoc bên i18n nói rõ "một nguồn
 * cho mọi nơi in travellers của MỘT booking, không tự chế bản thứ hai"; bản
 * chế riêng đầu tiên của F1 đã lệch luật số nhiều ngay lúc viết (review 31/08).
 */
export function formatGuests({ numAdults, numChildren }: GuestParty): string {
  return messages.accountBookings.travellers(numAdults, numChildren);
}

/** Nhãn trạng thái booking theo enum contract. */
export function statusLabel(status: BookingStatusValue): string {
  return t.status[status];
}

/**
 * Variant Badge cho từng trạng thái — luật màu là DỮ LIỆU, không nằm rải rác
 * trong JSX: PAID nổi bật (chuyện đã xong), PENDING nhạt (đang chờ tiền),
 * CANCELLED cảnh báo, hai trạng thái hoàn tiền viền trơn (kết cục trung tính).
 */
export function statusBadgeVariant(
  status: BookingStatusValue,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'PAID':
      return 'default';
    case 'PENDING':
      return 'secondary';
    case 'CANCELLED':
      return 'destructive';
    default:
      return 'outline';
  }
}

/** Một hàng của bảng `/bookings` — 6 cột đã đặt sẵn ở kit, cộng link chi tiết. */
export interface BookingRowVM {
  code: string;
  tourTitle: string;
  status: BookingStatusValue;
  statusLabel: string;
  guests: number;
  guestsLabel: string;
  amount: string;
  customerName: string;
  customerEmail: string;
  departure: string;
  href: string;
  /**
   * Lúc booking được TẠO, đã format ("29 Aug 2026, 02:05 UTC"). Bảng "Recent
   * bookings" của dashboard (ADR-0036 §3) in cột này vì "gần nhất" cần một
   * con dấu thời gian mới đọc được; `/bookings` chưa hiện nó — thêm khi có
   * nhu cầu, không phải ở đây.
   */
  createdAt: string;
}

/** Booking của contract → hàng bảng đã format sẵn (server component gọi). */
/**
 * `query` tuỳ chọn: bảng `/bookings` truyền để href MANG bộ lọc; dashboard
 * (không bộ lọc) bỏ trống và nhận đường trần `/bookings/<code>` — hết cảnh
 * dựng một `BookingsQuery` giả chỉ để thoả chữ ký (vòng vá review 05/09).
 */
export function toBookingRow(booking: Booking, query?: BookingsQuery): BookingRowVM {
  return {
    code: booking.code,
    tourTitle: booking.tourTitle,
    status: booking.status,
    statusLabel: statusLabel(booking.status),
    guests: guestCount(booking),
    guestsLabel: formatGuests(booking),
    amount: formatAmount(booking.totalAmount, booking.currency),
    customerName: booking.contactName,
    customerEmail: booking.contactEmail,
    departure: formatDateRange(booking.departureStartDate, booking.departureEndDate),
    // MANG THEO bộ lọc đang xem (user báo 04/09): nút "Back to bookings" ở
    // trang chi tiết dựng đích đến từ chính query này, nên vòng đi–về không
    // nhả filter. Chi tiết luật ở `bookingDetailHref`.
    href: query ? bookingDetailHref(query, booking.code) : `/bookings/${booking.code}`,
    createdAt: formatDateTime(booking.createdAt),
  };
}
