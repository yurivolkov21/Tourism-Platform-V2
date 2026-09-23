import {
  type AdminDepartureRow,
  type AdminDepartureSettableStatus,
  DEPARTURE_PHASE_FILTER_GROUPS,
  type DeparturePhase,
  type DeparturePhaseFilter,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatAmount, formatCalendarDate, formatDateRange } from './bookings-view';

/**
 * Mapper hiển thị vùng chuyến khởi hành (spec P4e-1 F12, F16) — THUẦN, nằm
 * ngoài React nên test được từng nhánh. Bảng chỉ render VM có sẵn: không có
 * chỗ nào trong JSX tự so ngày, tự đếm ghế hay tự đoán nút nào được bấm.
 *
 * Ba thứ quyết định nút là chỗ đáng giá nhất của file, và chúng KHÔNG cùng
 * một loại:
 *
 *  - `canEdit` và `canCancel` là bản SOI GƯƠNG của luật server (chuyến đã huỷ
 *    thì đóng sổ — `DEPARTURE_CANCELLED`; huỷ chuyến chỉ trước ngày khởi hành —
 *    `departureCancelBlocker`). Gương chứ không phải nguồn: server vẫn chặn
 *    thật, đây chỉ để nút không mời bấm một thứ chắc chắn bị từ chối.
 *  - `toggle` thì nửa gương nửa không. Reopen tắt sau hạn chót là gương của
 *    `reopenBlocker`. Nhưng việc ẨN hẳn nút đóng/mở từ ngày khởi hành là luật
 *    của RIÊNG giao diện: server vẫn nhận Close ngày ấy (ADR-0046 đã cân nhắc
 *    và loại phương án chặn), và Close ngày ấy hoàn tiền một khách trả trễ
 *    đúng luật. Đừng nới chỗ ẩn này với niềm tin rằng server sẽ đỡ.
 *
 * Các cờ vòng đời đọc `phase` của server, không tự tính. Hai thứ gắn với hạn
 * chót — dòng "Passed" và việc Reopen sáng hay tắt — đọc `today`, mà `today`
 * cũng đến từ CHÍNH lượt đọc đã tính `phase` (vòng review F16), nên cả hàng
 * nhìn một đồng hồ.
 */

const t = messages.admin.departures;

/** Nút đóng/mở của một hàng: gửi chiều nào, và có bấm được không. */
export interface DepartureToggle {
  /** Trạng thái sẽ gửi lên — `CLOSED` là nút Close, `OPEN` là nút Reopen. */
  next: AdminDepartureSettableStatus;
  /** Reopen tắt khi đã qua hạn chót (gương `reopenBlocker`); Close luôn bấm được. */
  enabled: boolean;
}

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
  /** Giai đoạn do SERVER tính (ADR-0046) — VM chỉ chở, không tính lại. */
  phase: DeparturePhase;
  /** Nhãn của giai đoạn — thứ cột Status in ra. */
  phaseLabel: string;
  /** Sửa được không — chuyến đã huỷ là bản ghi đóng. */
  canEdit: boolean;
  /**
   * Nút đóng/mở của hàng; `null` = hàng KHÔNG có nút này (ô giữ chỗ thay vào,
   * xem `DepartureRowActions`).
   *
   * Chỉ chuyến CHƯA ĐI có nút (nhóm Upcoming). Từ ngày khởi hành, Reopen đã bị
   * chặn vì quá hạn chót, còn Close chỉ còn một hậu quả thật là hoàn tiền một
   * khách đặt đúng luật ngay ngày đi (ADR-0046). Quá hạn chót mà CHƯA đi thì
   * Close vẫn bấm được: checkout mở trước hạn có thể đang dở.
   *
   * Một field thay cho bốn thứ từng tách rời (`showToggle`, `canClose`,
   * `canReopen`, và chiều gửi mà component tự suy từ `status`): hai nguồn
   * cho cùng một nút là hai chỗ có thể lệch nhau (vòng review F16).
   */
  toggle: DepartureToggle | null;
  /**
   * Huỷ chuyến được không (F13). Thước là NGÀY KHỞI HÀNH, không phải hạn nhận
   * đặt: một chuyến quá hạn đặt mà hướng dẫn viên gãy chân vẫn phải huỷ được.
   * Gương của `departureCancelBlocker` ở server, đọc qua `phase` (ngày khởi
   * hành đã là `departed`).
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
 * `today` là ngày lịch VIỆT NAM do SERVER đưa xuống cùng lượt đọc
 * (`AdminDeparturesListResult.today`), không phải `new Date()` của trình
 * duyệt: hạn chót là luật tiền (ADR-0041 §7), và một máy ở múi giờ khác không
 * được phép quyết định nút Reopen sáng hay tối.
 */
export function toDepartureRowVM(row: AdminDepartureRow, today: string): DepartureRowVM {
  // So CHUỖI ISO: chúng sắp thứ tự từ điển đúng bằng thứ tự thời gian, nên
  // không cần dựng `Date` nào (và không mở cửa cho lệch một ngày vì múi giờ).
  const deadlinePassed = today > row.cancellationDeadline;
  const cancelled = row.phase === 'cancelled';

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
    phase: row.phase,
    phaseLabel: t.phase[row.phase],
    canEdit: !cancelled,
    toggle: toggleFor(row.phase, deadlinePassed),
    // Huỷ được đúng khi chuyến chưa đi = đúng tập của tab Upcoming. Hàng thiếu
    // `phase` (API cũ trong khe deploy) rơi về `false` — không mời huỷ.
    canCancel: DEPARTURE_PHASE_FILTER_GROUPS.upcoming.includes(row.phase),
    refundOutstanding:
      cancelled && row.liveBookingCount > 0 ? t.list.refundOutstanding(row.liveBookingCount) : null,
  };
}

/** Nút đóng/mở theo giai đoạn — xem JSDoc của `DepartureRowVM.toggle`. */
function toggleFor(phase: DeparturePhase, deadlinePassed: boolean): DepartureToggle | null {
  switch (phase) {
    case 'on-sale':
    case 'deadline-passed':
      return { next: 'CLOSED', enabled: true };
    case 'closed':
      return { next: 'OPEN', enabled: !deadlinePassed };
    default:
      // `departed`/`completed`: ẩn từ ngày khởi hành (luật của giao diện).
      // `cancelled`: hàng không có nút nào. Không có `phase` (khe deploy):
      // lùi về phía không mời bấm.
      return null;
  }
}

/**
 * Nhãn tab lọc. Ba nhóm MỘT giai đoạn mượn đúng nhãn huy hiệu — một khái
 * niệm, một chữ; đổi nhãn huy hiệu thì tab đổi theo (vòng review F16). Chỉ
 * Upcoming gom ba giai đoạn nên có chữ riêng.
 */
export function phaseFilterLabel(filter: DeparturePhaseFilter): string {
  return filter === 'upcoming' ? t.list.upcoming : t.phase[filter];
}

/** Biến thể Badge theo giai đoạn — `Record` để thêm giai đoạn là đỏ typecheck. */
const PHASE_BADGE_VARIANTS: Record<
  DeparturePhase,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  // Xanh đặc ĐÚNG MỘT chỗ: cổng đặt chỗ còn nhận booking MỚI theo ngày. Không
  // hứa hơn thế — ghế và trạng thái đăng tour là hai trục riêng.
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
