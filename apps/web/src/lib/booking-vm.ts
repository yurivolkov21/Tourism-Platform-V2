import {
  type Booking,
  type BookingCancellation,
  type BookingDetail,
  type BookingPhase,
  vietnamToday,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatChipDate, formatDate, formatMoneyExact } from './tours';

/**
 * Ngày lịch Việt Nam (`YYYY-MM-DD`) của một mốc thời gian ISO của đơn — đặt, trả, huỷ, gửi yêu
 * cầu huỷ, viết review. MỘT cách đổi cho cả trang chi tiết đơn, voucher và hoá đơn.
 *
 * Mọi luật ngày của hệ chạy theo lịch Việt Nam (hạn chót hết 23:59 giờ VN, giai đoạn so ngày
 * VN), nên ngày in ra cũng phải là ngày VN. Cắt `iso.slice(0, 10)` là lấy ngày UTC: sự kiện
 * 00:00–06:59 giờ VN (17:00–23:59Z hôm trước) lệch về hôm trước — khách huỷ 06:30 ngày 01/11,
 * sau hạn chót 31/10, từng đọc thấy "Cancelled · 31 Oct" cạnh "No refund" (review P7 B4, C#3).
 * Mốc hỏng ném `RangeError` (từ `vietnamToday`) thay vì in một ngày bịa.
 */
export function vietnamDay(iso: string): string {
  return vietnamToday(new Date(iso));
}

/** Tông màu badge — token-only (spec §3), map 1-1 theo nhóm status. */
export type BookingViewTone = 'success' | 'warning' | 'muted' | 'destructive';

/**
 * Hành động khả dụng trên trang chi tiết booking.
 *
 * `cancelBooking` thay bộ ba `requestCancellation`/`viewCancellationPending`/
 * `resubmitCancellation` của luồng khách xin huỷ, admin duyệt — luồng đó gỡ
 * theo ADR-0041 §4: khách huỷ là huỷ ngay, không còn trạng thái "đang chờ".
 */
export type BookingAction = 'payNow' | 'cancelPending' | 'cancelBooking';

/**
 * Kết quả bảng quyết định — component CHỈ render `BookingView`, KHÔNG
 * if/else theo status trong JSX ngoài map action→nút (plan Task 4 cụm cũ).
 */
export interface BookingView {
  tone: BookingViewTone;
  statusKey: string;
  actions: BookingAction[];
}

/**
 * Bảng quyết định status → (tone, hành động) — hàm THUẦN:
 *
 * - `PENDING` → warning + [payNow, cancelPending].
 * - `PAID` → success; `PARTIALLY_REFUNDED` → destructive. Cả hai có
 *   [cancelBooking] khi và chỉ khi SERVER nói `cancellation.canCancel`
 *   (spec §5.3) — kể cả khi đã quá hạn chót: huỷ vẫn được, chỉ là hoàn 0.
 * - `CANCELLED` → muted + [] (terminal).
 * - `REFUNDED` → destructive + [] — đã hoàn thiện chí toàn bộ thì không huỷ
 *   online, khách liên hệ (spec §3.3).
 *
 * Web KHÔNG tự so ngày để quyết có nút huỷ hay không (ADR-0041 §7): `cancellation`
 * là cờ `bookings.byCode` trả. Vắng cờ (danh sách `mine`, hộ chiếu) thì không
 * có nút huỷ, còn tone giữ nguyên nên `passport.ts` không bị ảnh hưởng.
 */
export function bookingView(
  b: Pick<Booking, 'status'>,
  cancellation: BookingCancellation | null = null,
): BookingView {
  const cancel: BookingAction[] = cancellation?.canCancel ? ['cancelBooking'] : [];
  switch (b.status) {
    case 'PENDING':
      return { tone: 'warning', statusKey: b.status, actions: ['payNow', 'cancelPending'] };
    case 'PAID':
      return { tone: 'success', statusKey: b.status, actions: cancel };
    case 'CANCELLED':
      return { tone: 'muted', statusKey: b.status, actions: [] };
    case 'REFUNDED':
      return { tone: 'destructive', statusKey: b.status, actions: [] };
    case 'PARTIALLY_REFUNDED':
      return { tone: 'destructive', statusKey: b.status, actions: cancel };
  }
}

/** Mộc trạng thái: chữ in trên mộc và tông mực — `VisaStamp` chỉ vẽ. */
export interface BookingStamp {
  label: string;
  tone: BookingViewTone;
}

/** Những gì tấm vé của MỘT đơn mang theo giai đoạn — kết quả của `bookingPass`. */
export interface BookingPass {
  /** Có voucher để xem: trang `/checkout/success` dựng voucher, có nút hay link "View voucher". */
  voucher: boolean;
  /** Có mã vạch trên vé và voucher. */
  barcode: boolean;
  /** Mộc trên vé của trang chi tiết đơn. */
  stamp: BookingStamp;
}

/**
 * Voucher, mã vạch và mộc của MỘT đơn theo giai đoạn (`bookingPhase`) — MỘT luật cho vé và nút
 * "View voucher" của trang chi tiết đơn, voucher `/checkout/success` và accordion My bookings
 * (ADR-0054 AMEND 1 §5). Trước đó bốn chỗ bốn vị từ: vé theo trạng thái đơn — in mã vạch cho
 * chuyến đã đi trong khi voucher của cùng đơn giấu nó, và giấu mã vạch của đơn hoàn thiện chí vẫn
 * đi; khối Details và voucher theo giai đoạn, mỗi bên một bản; accordion chỉ PAID (review P7 B11).
 *
 * Voucher: đơn đã trả ở ba giai đoạn của chuyến còn đi hay đã đi. Mã vạch nói "quét tôi ở điểm
 * đón" — chỉ sắp đi và đang đi; chuyến đã xong không còn cổng nào để quét. Chưa có `paidAt` thì
 * không có gì: in mã vạch cho đơn chưa trả là hứa một thứ không có (cùng bất biến của
 * `BookingReceipt`). Mộc: xem `passStamp`.
 */
export function bookingPass(
  booking: Pick<Booking, 'paidAt' | 'status'>,
  phase: BookingPhase,
): BookingPass {
  const paid = booking.paidAt !== null;
  const stamp = passStamp(booking, phase);
  switch (phase) {
    case 'upcoming':
    case 'on_tour':
      return { voucher: paid, barcode: paid, stamp };
    case 'travelled':
      return { voucher: paid, barcode: false, stamp };
    case 'awaiting_payment':
    case 'cancelled':
    case 'lapsed':
      return { voucher: false, barcode: false, stamp };
  }
}

/**
 * Mộc của vé: chữ của trạng thái đơn (`passportVisa.stampByStatus`), mực theo tông của
 * `bookingView` — trừ hai giai đoạn mà trạng thái đơn nói sai:
 *
 * - `lapsed` — PENDING qua hạn chót. "AWAITING PAYMENT" cam là mời trả một khoản không mở lại
 *   được, mà "đã lỡ" thì chưa chắc: claim của API còn nhận phiên mở trước hạn (ADR-0054 AMEND 1
 *   §4). Chữ trung tính "NOT PAID", mực xám (review P7 B9, S1).
 * - `cancelled` — chuyến công ty huỷ thắng mọi trạng thái đơn (AMEND 1 §2): đơn còn PAID hay hoàn
 *   một phần chờ job hoàn tiền không được đóng mộc "CONFIRMED". Mộc nói "CANCELLED"; đơn đã hoàn
 *   trọn giữ "REFUNDED" — sự thật về tiền vẫn đúng.
 */
function passStamp(booking: Pick<Booking, 'status'>, phase: BookingPhase): BookingStamp {
  const labels = messages.passportVisa.stampByStatus;
  switch (phase) {
    case 'lapsed':
      return { label: messages.passportVisa.stampLapsed, tone: 'muted' };
    case 'cancelled':
      return {
        label: booking.status === 'REFUNDED' ? labels.REFUNDED : labels.CANCELLED,
        tone: 'muted',
      };
    case 'awaiting_payment':
    case 'upcoming':
    case 'on_tour':
    case 'travelled':
      return { label: labels[booking.status], tone: bookingView(booking).tone };
  }
}

/**
 * Đơn còn huỷ miễn phí không — CHỈ đọc cờ server `cancellation.withinDeadline` (ADR-0041 §7). MỘT
 * luật cho thanh hành trình của trang chi tiết đơn và voucher.
 *
 * Vắng cờ thì KHÔNG mở: server chỉ gửi cờ khi luật huỷ của khách còn áp dụng (đơn PAID hay
 * PARTIALLY_REFUNDED trên chuyến còn chạy). Đơn hoàn thiện chí trọn (REFUNDED, khách vẫn đi —
 * ADR-0054 AMEND 1) và chuyến công ty huỷ (ADR-0041 AMEND 1) không có cờ; hai bản cũ của trang
 * đơn và voucher khi ấy tự so ngày chót với hôm nay, tức hứa một quyền huỷ không còn (review P7
 * B2, B15, C mục 16).
 */
export function freeCancellationOpen(booking: Pick<BookingDetail, 'cancellation'>): boolean {
  return booking.cancellation?.withinDeadline === true;
}

/**
 * Câu hạn chót huỷ miễn phí cho trang booking và trang thanh toán thành công —
 * `null` khi server không gửi `cancellation` (booking không ở PAID hoặc
 * PARTIALLY_REFUNDED, hoặc chuyến đã bị công ty huỷ — ADR-0041 AMEND 1).
 *
 * Chỉ IN cờ `withinDeadline` và ngày `deadline` server tính: trang không so
 * ngày chót với giờ trình duyệt, nên chỉnh đồng hồ máy không đổi được câu này
 * (spec §2 Q7).
 */
export function cancellationDeadlineText(cancellation: BookingCancellation | null): string | null {
  if (cancellation === null) return null;
  const t = messages.cancellationDeadline;
  const date = formatChipDate(cancellation.deadline);
  return cancellation.withinDeadline ? t.full(date) : t.passed(date);
}

/**
 * Yêu cầu huỷ của luồng duyệt đã gỡ (REQUESTED, DENIED) còn nằm trên dữ liệu
 * trước lượt seed lại — in dạng chỉ đọc, chỉ kể lại sự việc (spec §5.3).
 * REFUNDED là kết cục thường của mọi lần huỷ nên không có dòng riêng.
 */
export function legacyCancellationNote(b: Booking): string | null {
  if (b.cancellationRequestedAt === null) return null;
  const t = messages.accountBookingDetail.legacyRequest;
  const sentOn = formatDate(vietnamDay(b.cancellationRequestedAt));
  if (b.cancellationStatus === 'REQUESTED') return t.requested(sentOn);
  if (b.cancellationStatus === 'DENIED') return t.denied(sentOn);
  return null;
}

/**
 * Ngày lịch VN đơn bị huỷ (`YYYY-MM-DD`), `null` khi không có mốc nào nói thật được — MỘT luật cho
 * mốc Cancelled của thanh hành trình và nhật ký voucher.
 *
 * `cancelledAt` có ở mọi đường huỷ thật của code: khách huỷ, quét giữ chỗ, công ty huỷ chuyến
 * (đơn chờ trả huỷ ngay lúc ấy, đơn đã trả qua job hoàn tiền). Dữ liệu có thể thiếu nó: luồng duyệt
 * huỷ cũ (trước ADR-0041) — khi ấy chỉ mốc QUYẾT của một yêu cầu huỷ ĐƯỢC DUYỆT
 * (`cancellationStatus` REFUNDED) là ngày huỷ; đơn đã trả trên chuyến công ty huỷ mà job chưa chạy,
 * hay của seed lượt 1 (REFUNDED, không mốc) — không ngày. Yêu cầu bị từ chối (DENIED) hay còn treo
 * (REQUESTED) không huỷ gì cả — chuỗi dự phòng cũ lấy cả ngày của chúng, in ngày một yêu cầu bị
 * từ chối cạnh câu "was declined" cùng trang (review P7 B3).
 */
export function cancelledOn(
  b: Pick<Booking, 'cancelledAt' | 'cancellationStatus' | 'cancellationDecidedAt'>,
): string | null {
  if (b.cancelledAt !== null) return vietnamDay(b.cancelledAt);
  if (b.cancellationStatus === 'REFUNDED' && b.cancellationDecidedAt !== null) {
    return vietnamDay(b.cancellationDecidedAt);
  }
  return null;
}

/**
 * Chuyện gì đã xảy ra với TIỀN của khách — `null` khi không có gì để kể.
 *
 * Có mặt vì tới 04/09 trang chi tiết booking của khách không hề nói số tiền
 * đã hoàn: khách thấy đúng chữ "Cancelled" và không gì khác, còn bằng chứng
 * duy nhất nằm trong hộp mail.
 *
 * `none` (huỷ mà không hoàn đồng nào) CŨNG là một câu chuyện phải kể: im lặng
 * thì khách tự đoán rồi ngồi đợi một khoản không bao giờ tới.
 */
export type RefundSummary =
  | { kind: 'full'; amount: string }
  | { kind: 'partial'; amount: string; total: string }
  | { kind: 'none' };

/**
 * Đơn đã từng thu tiền của khách: có `paidAt`, HOẶC sổ đã có khoản hoàn.
 *
 * `paidAt` một mình không đủ: đơn bị thu rồi hoàn tự động trước khi kịp sang PAID (thua đua
 * ghế, chuyến đóng hay dời lúc capture về, capture mồ côi) bị API đặt CANCELLED hay REFUNDED mà
 * không ghi `paid_at` — tiền vẫn đã đi một vòng. Coi nó là "chưa thu" thì cùng một trang vừa in
 * "Refunded −$147.00" ở khối Payment vừa im về khoản hoàn ở thanh hành trình (review P7 B1).
 *
 * So bằng `Number`: '0' và '0.00' là cùng một số tiền, và cả hai đều xuất hiện thật (API trả
 * '0.00', sổ rỗng trả '0').
 */
export function wasCharged(b: Pick<Booking, 'paidAt' | 'refundedTotal'>): boolean {
  return b.paidAt !== null || Number(b.refundedTotal) > 0;
}

/**
 * Booking chưa từng thu tiền thì KHÔNG kể gì: PENDING hết hạn hay khách tự
 * huỷ trước khi trả là "chưa bao giờ có giao dịch", không phải "hoàn 0 đồng".
 * Đó là lý do cổng đầu tiên là `wasCharged`, không phải status.
 */
export function refundSummary(b: Booking): RefundSummary | null {
  if (!wasCharged(b)) return null;
  const refunded = Number(b.refundedTotal);
  const total = Number(b.totalAmount);
  if (refunded <= 0) return b.status === 'CANCELLED' ? { kind: 'none' } : null;
  // `>=` chứ không `===`: sổ chốt trần ở total (trigger ADR-0009), nhưng một
  // ca làm tròn lẻ cent không được biến "đã hoàn đủ" thành "hoàn một phần".
  if (refunded >= total) return { kind: 'full', amount: b.refundedTotal };
  return { kind: 'partial', amount: b.refundedTotal, total: b.totalAmount };
}

/**
 * Câu kể khoản hoàn cho khách đọc (`accountBookingDetail.refundLine`) — MỘT bản cho cột phải của
 * đơn đã huỷ (`TripClosedPanel`) và nhật ký voucher. Số tiền THẬT khách đối chiếu với sao kê nên
 * `formatMoneyExact`, đủ hai số lẻ.
 *
 * `switch` đủ ba biến thể: `RefundSummary` thêm biến thể là typecheck đỏ ở đây. Bản ternary cũ
 * của trang chi tiết đơn rơi về câu "không hoàn" cho mọi biến thể lạ (review P7 B14, C#14).
 */
export function refundSentence(refund: RefundSummary, currency: string): string {
  const t = messages.accountBookingDetail.refundLine;
  switch (refund.kind) {
    case 'full':
      return t.full(formatMoneyExact(refund.amount, currency));
    case 'partial':
      return t.partial(
        formatMoneyExact(refund.amount, currency),
        formatMoneyExact(refund.total, currency),
      );
    case 'none':
      return t.none;
  }
}

/**
 * Tên cổng thanh toán cho khách đọc ("Card (Stripe)", "PayPal") — MỘT nguồn cho biên nhận,
 * trang chi tiết đơn và voucher. Trước P7 có hai bảng `PROVIDER_LABEL` chép tay (biên nhận và
 * trang chi tiết đơn); hai bản là hai chỗ sẽ trôi lệch khi thêm cổng. `switch` đủ mọi giá trị:
 * enum `PaymentProvider` thêm cổng mới thì typecheck đỏ ngay ở đây.
 */
export function paymentProviderLabel(provider: Booking['paymentProvider']): string {
  switch (provider) {
    case 'STRIPE':
      return messages.booking.form.stripe;
    case 'PAYPAL':
      return messages.booking.form.paypal;
  }
}

/**
 * Nhãn ô tổng tiền của MỘT đơn: "Total paid" chỉ khi tiền đã về (`paidAt`), chưa thì "Total" —
 * MỘT luật cho biên nhận, danh sách đơn và trang chi tiết (review P7 06/10: danh sách ghi "Total"
 * mà trang chi tiết vẫn "Total paid" cho cùng một đơn chưa từng trả).
 */
export function bookingTotalLabel(booking: Pick<Booking, 'paidAt'>): string {
  return booking.paidAt === null
    ? messages.checkoutSummary.totalLabel
    : messages.booking.success.totalLabel;
}
