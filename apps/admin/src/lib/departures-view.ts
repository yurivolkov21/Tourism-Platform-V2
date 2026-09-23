import {
  type AdminDepartureRow,
  type AdminDepartureStatus,
  DEPARTURE_PHASE_FILTER_GROUPS,
  type DeparturePhase,
} from '@tourism/contract';
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
 *
 * Từ F16 các cờ vòng đời đọc `phase` của server (ADR-0046); chỉ hai thứ gắn
 * với hạn chót còn đọc `today`: dòng "Passed" và nút Reopen.
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
  /** Giai đoạn do SERVER tính (ADR-0046) — VM chỉ chở, không tính lại. */
  phase: DeparturePhase;
  /** Nhãn của giai đoạn — thứ cột Status in ra. */
  phaseLabel: string;
  /** Sửa được không — chuyến đã huỷ là bản ghi đóng. */
  canEdit: boolean;
  /**
   * Hàng còn nút đóng/mở không — chỉ chuyến CHƯA ĐI (nhóm Upcoming). Từ ngày
   * khởi hành, Reopen đã bị chặn vì quá hạn chót, còn Close chỉ còn một hậu
   * quả thật là hoàn tiền một khách đặt đúng luật ngay ngày đi (ADR-0046). Ẩn
   * nút thì ô vẫn giữ chỗ — xem `DepartureRowActions`.
   */
  showToggle: boolean;
  /**
   * Đóng được không — chuyến đang bán hoặc đã quá hạn chót mà CHƯA đi (F16);
   * quá hạn vẫn đóng được vì checkout mở trước hạn có thể đang dở.
   */
  canClose: boolean;
  /** Mở lại được không — cần chưa qua hạn chót VÀ chưa bị huỷ. */
  canReopen: boolean;
  /**
   * Huỷ chuyến được không (F13). Thước là NGÀY KHỞI HÀNH, không phải hạn nhận
   * đặt: một chuyến quá hạn đặt mà hướng dẫn viên gãy chân vẫn phải huỷ được.
   * Gương của `departureCancelBlocker` ở server; từ F16 đọc qua `phase` (ngày
   * khởi hành đã là `departed`).
   */
  canCancel: boolean;
  /**
   * Còn BAO NHIÊU khách chưa nhận được tiền trên một chuyến đã huỷ — `null`
   * khi chuyến chưa huỷ, hoặc khi không còn ai phải chờ.
   *
   * Không phải tỉ lệ `x / y`: xem `refundOutstanding` ở i18n về việc vì sao
   * một tử số đếm booking `CANCELLED` lại nói sai. Hoàn tiền chạy qua hàng
   * đợi nên con số này tụt dần qua vài lượt refresh rồi biến mất.
   */
  refundOutstanding: string | null;
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
  const cancelled = row.phase === 'cancelled';
  // Chuyến còn thao tác được = đúng tập của tab Upcoming — một định nghĩa, hai
  // chỗ dùng (nút đóng/mở và nút huỷ).
  const upcoming = DEPARTURE_PHASE_FILTER_GROUPS.upcoming.includes(row.phase);

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
    phase: row.phase,
    phaseLabel: t.phase[row.phase],
    canEdit: !cancelled,
    showToggle: upcoming,
    canClose: row.phase === 'on-sale' || row.phase === 'deadline-passed',
    canReopen: row.phase === 'closed' && !deadlinePassed,
    // Cùng mốc với huy hiệu vì cả hai đọc `phase` của server — trước F16 là
    // `today < startDate` của trang, một đồng hồ thứ hai.
    canCancel: upcoming,
    refundOutstanding:
      cancelled && row.liveBookingCount > 0 ? t.list.refundOutstanding(row.liveBookingCount) : null,
  };
}

/** Biến thể Badge theo giai đoạn — `Record` để thêm giai đoạn là đỏ typecheck. */
const PHASE_BADGE_VARIANTS: Record<
  DeparturePhase,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  // Xanh đặc ĐÚNG MỘT chỗ: còn nhận tiền được.
  'on-sale': 'default',
  'deadline-passed': 'outline',
  closed: 'secondary',
  departed: 'outline',
  completed: 'secondary',
  cancelled: 'destructive',
};

export function departurePhaseBadgeVariant(
  phase: DeparturePhase,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  return PHASE_BADGE_VARIANTS[phase];
}
