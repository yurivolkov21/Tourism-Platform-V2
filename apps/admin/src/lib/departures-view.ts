import type { AdminDepartureRow, AdminDepartureStatus } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatAmount, formatCalendarDate, formatDateRange } from './bookings-view';

/**
 * Mapper hiển thị vùng chuyến khởi hành (spec P4e-1 F12) — THUẦN, nằm ngoài
 * React nên test được từng nhánh. Bảng chỉ render VM có sẵn: không có chỗ nào
 * trong JSX tự so ngày, tự đếm ghế hay tự đoán nút nào được bấm.
 *
 * Ba lá cờ `canEdit`/`canClose`/`canReopen` là chỗ đáng giá nhất của file:
 * chúng là bản SOI GƯƠNG của luật server (chuyến đã huỷ thì đóng sổ; mở lại
 * chỉ trước hạn chót). Gương chứ không phải nguồn — server vẫn chặn thật, còn
 * đây chỉ để nút không mời admin bấm một thứ chắc chắn bị từ chối.
 */

const t = messages.admin.departures;

export interface DepartureRowVM {
  id: string;
  /** "14 Sep 2026 – 20 Sep 2026" — một ô, hai ngày. */
  dates: string;
  /** ISO thô, để form sửa mở đúng giá trị đang có. */
  startDate: string;
  endDate: string;
  /** Giá ÁP DỤNG đã format kèm tiền tệ. */
  price: string;
  /** Chuỗi thập phân thô cho ô nhập; `null` = đang thừa hưởng `basePrice`. */
  priceOverride: string | null;
  /** Dòng phụ dưới giá khi chuyến không có giá riêng. */
  priceNote: string | null;
  seats: string;
  seatsLabel: string;
  seatsTotal: number;
  seatsBooked: number;
  deadline: string;
  /** Hạn chót đã trôi qua — bảng in nhãn, nút Reopen tắt. */
  deadlinePassed: boolean;
  liveBookingCount: number;
  bookingsLabel: string;
  /**
   * Phần CHƯA trả tiền trong `liveBookingCount`, và phần ĐÃ trả (hiệu của hai
   * số). Hộp xác nhận Close in hai dòng riêng vì đóng chuyến gây hai hệ quả
   * khác hẳn nhau cho hai nhóm này.
   */
  pendingBookingCount: number;
  paidBookingCount: number;
  /**
   * Token phiên bản của hàng (`updatedAt` dạng ISO) — form sửa gửi ngược lên
   * để server phát hiện ghi đè mù giữa hai tab. VM chỉ chở qua, không đọc.
   */
  version: string;
  status: AdminDepartureStatus;
  statusLabel: string;
  /** Sửa được không — chuyến đã huỷ là bản ghi đóng. */
  canEdit: boolean;
  /** Đóng được không — đóng lúc nào cũng được, trừ khi đã huỷ. */
  canClose: boolean;
  /** Mở lại được không — cần chưa qua hạn chót VÀ chưa bị huỷ. */
  canReopen: boolean;
  /**
   * Huỷ chuyến được không (F13). Thước là NGÀY KHỞI HÀNH, không phải hạn nhận
   * đặt: một chuyến quá hạn đặt mà hướng dẫn viên gãy chân vẫn phải huỷ được.
   * Gương của `departureCancelBlocker` ở server.
   */
  canCancel: boolean;
  /**
   * Tiến độ hoàn tiền — chỉ có nghĩa trên hàng ĐÃ HUỶ, `null` ở mọi hàng khác.
   * Hoàn tiền chạy qua hàng đợi nên con số này bò dần qua vài lượt refresh.
   */
  refundProgress: string | null;
  /** Còn khách chưa được hoàn — bảng in dòng giải thích worker có thể đang ngủ. */
  refundPending: boolean;
}

/**
 * Một hàng contract → một hàng bảng.
 *
 * `today` là ngày lịch VIỆT NAM do SERVER đưa xuống (`vietnamToday`), không
 * phải `new Date()` của trình duyệt: hạn chót là luật tiền (ADR-0041 §7), và
 * một máy ở múi giờ khác không được phép quyết định nút Reopen sáng hay tối.
 */
export function toDepartureRowVM(row: AdminDepartureRow, today: string): DepartureRowVM {
  // So CHUỖI ISO: chúng sắp thứ tự từ điển đúng bằng thứ tự thời gian, nên
  // không cần dựng `Date` nào (và không mở cửa cho lệch một ngày vì múi giờ).
  const deadlinePassed = today > row.cancellationDeadline;
  const cancelled = row.status === 'CANCELLED';
  // Mẫu số của tiến độ: đã huỷ CỘNG còn sống. Booking khách tự huỷ từ trước
  // cộng vào cả tử lẫn mẫu nên tỉ lệ vẫn chạy tới đủ khi lượt cuối xong.
  const refundTotal = row.cancelledBookingCount + row.liveBookingCount;

  return {
    id: row.id,
    dates: formatDateRange(row.startDate, row.endDate),
    startDate: row.startDate,
    endDate: row.endDate,
    price: formatAmount(row.price, row.currency),
    priceOverride: row.priceOverride,
    priceNote: row.priceOverride === null ? t.list.inheritedPrice : null,
    seats: t.list.seats(row.seatsBooked, row.seatsTotal),
    seatsLabel: t.list.seatsLabel(row.seatsBooked, row.seatsTotal),
    seatsTotal: row.seatsTotal,
    seatsBooked: row.seatsBooked,
    deadline: formatCalendarDate(row.cancellationDeadline),
    deadlinePassed,
    liveBookingCount: row.liveBookingCount,
    bookingsLabel: t.list.bookings(row.liveBookingCount),
    pendingBookingCount: row.pendingBookingCount,
    // Hiệu, không phải một con số thứ ba từ server: hai nguồn cho cùng một
    // phép trừ là hai chỗ có thể lệch nhau.
    paidBookingCount: row.liveBookingCount - row.pendingBookingCount,
    version: row.version,
    status: row.status,
    statusLabel: t.status[row.status],
    canEdit: !cancelled,
    canClose: !cancelled && row.status === 'OPEN',
    canReopen: !cancelled && row.status === 'CLOSED' && !deadlinePassed,
    // `today` là ngày lịch VIỆT NAM của SERVER — cùng thước `canCancelOnline`
    // dùng ở API, nên nút không bao giờ mời bấm một thứ server sẽ từ chối.
    canCancel: !cancelled && today < row.startDate,
    refundProgress: cancelled
      ? t.list.refundProgress(row.cancelledBookingCount, refundTotal)
      : null,
    refundPending: cancelled && row.liveBookingCount > 0,
  };
}

/** Badge theo trạng thái — cùng bảng tone với các vùng khác của back office. */
export function departureStatusBadgeVariant(
  status: AdminDepartureStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'OPEN') return 'default';
  if (status === 'CANCELLED') return 'destructive';
  return 'secondary';
}
