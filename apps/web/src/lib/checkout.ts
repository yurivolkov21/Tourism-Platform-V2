import { type Booking, cancellationDeadline } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { refundSentence, refundSummary, wasCharged } from './booking-vm';
import { formatMoney, formatMoneyExact } from './tours';

/**
 * Phút một đơn chờ CHẮC CHẮN còn trả được kể từ lúc tạo: hạn phiên ngắn nhất trong các cổng — Stripe
 * Checkout 60 phút (`SESSION_EXPIRY_SECONDS` ở `apps/api/src/modules/payments/stripe.gateway.ts`),
 * webhook hết hạn huỷ đơn ngay lúc ấy. Contract KHÔNG trả `expiresAt`, nên web buộc phải tự tính; đổi
 * bên kia thì phải đổi ở đây.
 *
 * KHÔNG dùng TTL quét 65 phút của API (`PENDING_TTL_MINUTES` ở `pending-sweep.service.ts` — lề 5 phút
 * trên hạn Stripe để cron không huỷ đơn đang trả): đó là lưới khi webhook rớt, không phải mốc khách
 * dựa vào; hứa 65 là hứa dư 5 phút với đơn Stripe (review G40). Đơn PayPal (phiên 3 giờ) hay đơn đã mở
 * lại phiên còn sống lâu hơn — mốc này hứa ít hơn thực tế, không bao giờ hứa nhiều hơn.
 */
export const CHECKOUT_SESSION_MINUTES = 60;

/**
 * Hai tâm trạng của hoá đơn chờ (`BookingReceipt`) ở màn quay-về sau thanh toán.
 *
 * - `confirming` — khách về trước webhook. Trạng thái TẠM, trang tự làm mới.
 * - `settled`    — booking đã ở một kết cục khác rồi (hết hạn giữa chừng, đã
 *                  huỷ, đã hoàn tiền). KHÔNG tự làm mới: không có gì để đợi.
 *
 * Không còn `confirmed` (tiền đã về): từ P7 đơn đã trả mở voucher ở `/checkout/success`, và
 * `/checkout/cancel` chuyển nó sang đó (`cancelPageRedirect`) — hoá đơn chỉ còn dựng cho đơn
 * `paidAt` null, mà PAID luôn có `paidAt` (API ghi hai cột cùng lúc, `claimSeatsForPaid`). Nhánh
 * ấy hết đường tới mà spec vẫn canh (review cuối P7, M3).
 */
export type CheckoutMood = 'confirming' | 'settled';

/**
 * Tổng tiền booking — MỘT nguồn dùng CHUNG cho nhãn nút Pay (`booking-wizard.tsx`)
 * VÀ dòng "Total" (`checkout-summary.tsx`) — hai chỗ trước đây tự tính riêng,
 * lệch một chỗ là hai số khác nhau trên cùng một màn hình.
 *
 * Luật giá của hệ: trẻ em CÙNG đơn giá người lớn — `effectivePrice × (adults +
 * children)`, không có mức giá riêng cho trẻ em (khớp API:
 * `totalAmount(unitPrice, adults + children)`).
 *
 * `Number()` chỉ dùng ở BƯỚC CUỐI để tính, không phải nguồn sự thật —
 * `effectivePrice` (chuỗi thập phân) vẫn là nguồn; kết quả trả về CHUỖI đã
 * `.toFixed(2)`, khớp khuôn `formatBookingMoney` nhận vào.
 */
export function computeBookingTotal(
  effectivePrice: string,
  adults: number,
  children: number,
): string {
  return (Number(effectivePrice) * (adults + children)).toFixed(2);
}

/** Một dòng tiền của đơn: nhãn ("2 adults") và số tiền đã định dạng ("$98"). */
export interface PriceLine {
  label: string;
  amount: string;
}

/**
 * Tiền của MỘT đơn (đơn giá, dòng tiền, tổng), định dạng theo CẢ ĐƠN — spec P7 §4.2, review
 * 06/10. Đơn giá chẵn thì không số lẻ như trước nay (`formatMoney`); đơn giá có xu (giá khuyến
 * mãi, vd 49 × 0.85 = 41.65) thì đủ hai số lẻ cho mọi con số của đơn ấy. Làm tròn riêng từng
 * dòng thì "$90 + $90" lại ra Total "$181", và tổng lệch số cổng thanh toán đã thu ($180.96).
 * Tiền HOÀN không qua đây: nó luôn `formatMoneyExact` (đối chiếu sao kê).
 *
 * `exact`: đủ hai số lẻ dù đơn giá chẵn — cho khối tiền mà tiền hoàn đứng CÙNG CỘT với tổng (receipt
 * của voucher): "$867" trên "−$867.00" là hai độ chính xác trong một cột (thử tay prod 09/10).
 */
export function formatBookingMoney(
  booking: Pick<Booking, 'unitPrice' | 'currency'>,
  amount: string,
  { exact = false }: MoneyOptions = {},
): string {
  return exact || Number(booking.unitPrice) % 1 !== 0
    ? formatMoneyExact(amount, booking.currency)
    : formatMoney(amount, booking.currency);
}

/** Tuỳ chọn định dạng tiền của một đơn — xem `formatBookingMoney`. */
export interface MoneyOptions {
  exact?: boolean;
}

/**
 * Dòng tiền theo người lớn và trẻ em, tách khỏi `BookingReceipt` để các trang đơn dùng chung
 * (spec P7 §4.2). Cột tóm tắt của wizard đặt chỗ (`CheckoutSummary`) cũng dùng nó cho đơn đang
 * dựng, với đơn giá là `effectivePrice` của đợt đang chọn, nên trước và sau khi trả tiền khách
 * thấy cùng những con số. Trẻ em cùng đơn giá người lớn (luật của `computeBookingTotal` ngay trên).
 * Nhãn từ `messages.checkoutSummary`, số tiền định dạng bằng `formatBookingMoney` để dòng và
 * tổng cùng một độ chính xác (`options` cũng đi qua đó). Không có trẻ em thì bỏ hẳn dòng ấy.
 */
export function bookingPriceLines(
  booking: Pick<Booking, 'unitPrice' | 'numAdults' | 'numChildren' | 'currency'>,
  options: MoneyOptions = {},
): PriceLine[] {
  const ts = messages.checkoutSummary;
  const line = (label: string, travellers: number): PriceLine => ({
    label,
    amount: formatBookingMoney(
      booking,
      (Number(booking.unitPrice) * travellers).toFixed(2),
      options,
    ),
  });
  const lines = [line(ts.adultsLine(booking.numAdults), booking.numAdults)];
  if (booking.numChildren > 0) {
    lines.push(line(ts.childrenLine(booking.numChildren), booking.numChildren));
  }
  return lines;
}

/** PENDING là đang chờ webhook; mọi trạng thái khác là kết cục đã rồi (xem `CheckoutMood`). */
export function checkoutMood(booking: Pick<Booking, 'status'>): CheckoutMood {
  return booking.status === 'PENDING' ? 'confirming' : 'settled';
}

/**
 * Đường sang voucher khi khách về `/checkout/cancel` với một đơn ĐÃ TRẢ (trả ở tab khác rồi bấm
 * huỷ ở cổng); `null` khi đơn chưa trả — trang huỷ giữ hoá đơn chờ.
 *
 * Trang huỷ kể chuyện của đơn chưa trả: "Payment cancelled", "No charge was made…", nút "Pay now or
 * manage booking". Dựng nó cho đơn đã trả là pill "Paid" và mã vạch ngay dưới "Payment cancelled",
 * còn đơn đã trả rồi huỷ vẫn mang mã vạch — đúng lớp lỗi P7 đã sửa ở `/checkout/success` (review
 * P7C, "Ngoài diff"). Cùng luật "đã có `paidAt` thì là voucher" của `voucherView`: voucher kể đơn
 * đã trả theo giai đoạn của nó, kể cả khi đã huỷ.
 */
export function cancelPageRedirect(booking: Pick<Booking, 'code' | 'paidAt'>): string | null {
  return booking.paidAt === null ? null : `/checkout/success?code=${booking.code}`;
}

/**
 * Câu dưới tiêu đề của hoá đơn (`BookingReceipt`) khi trang không truyền câu riêng — theo tâm
 * trạng. Từ P7 hoá đơn chỉ còn cho đơn CHƯA trả (đơn đã trả mở voucher, spec §2.6), nên câu mặc
 * định cũ cho mọi đơn — "A copy of this receipt was sent to {email}." — nói sai: chưa trả thì
 * không email nào đi, và đơn bị thu rồi hoàn tự động không được nhắc tới khoản hoàn (review
 * P7C#5).
 *
 * - `confirming` — khách về trước webhook: thanh toán đang được xác nhận, trang tự làm tươi.
 * - `settled` — đơn đã ở kết cục khác. Từng bị thu (thua đua ghế, chuyến đóng lúc capture về —
 *   `paidAt` vẫn null, `wasCharged`) thì kể khoản hoàn bằng câu chung `refundSentence`, kèm thời
 *   gian tiền về khi có hoàn; chưa từng thu thì "không còn gì để trả".
 */
export function receiptNote(booking: Booking, mood: CheckoutMood): string {
  const t = messages.booking.success;
  switch (mood) {
    case 'confirming':
      return t.pendingBody;
    case 'settled': {
      const refund = refundSummary(booking);
      if (refund === null) return t.settledBody;
      const sentence = refundSentence(refund, booking.currency);
      return refund.kind === 'none'
        ? sentence
        : `${sentence} ${messages.accountBookingDetail.refundLine.timing}`;
    }
  }
}

export interface PendingExpiry {
  /** Số phút còn lại, đã kẹp ở 0. */
  minutesLeft: number;
  expired: boolean;
}

/** Giờ Việt Nam là UTC+7, không giờ mùa hè. */
const VIETNAM_OFFSET_MS = 7 * 3_600_000;

/** Mili giây cuối cùng (23:59:59.999 giờ Việt Nam) của ngày lịch `YYYY-MM-DD`. */
function vietnamDayEnd(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`) + 86_400_000 - VIETNAM_OFFSET_MS - 1;
}

/**
 * Mốc đơn chờ bị nhả: `createdAt` cộng `CHECKOUT_SESSION_MINUTES`, KẸP ở hết ngày hạn chót của chuyến
 * (23:59:59 giờ Việt Nam, ADR-0041 §3) — qua mốc ấy API thôi mở phiên trả mới (`reCheckout` từ
 * chối), nên đơn đặt 23:30 ngày hạn chót không được hứa trả tới 00:30 hôm sau (review G40). MỘT
 * nguồn cho `pendingExpiry` (câu "released in about n minutes" của trang huỷ) và dòng "Pay by" của
 * hoá đơn chờ in (G40).
 */
export function pendingDeadline(
  booking: Pick<Booking, 'createdAt' | 'departureStartDate' | 'departureEndDate'>,
): Date {
  const ttlEnd = new Date(booking.createdAt).getTime() + CHECKOUT_SESSION_MINUTES * 60_000;
  const deadlineEnd = vietnamDayEnd(
    cancellationDeadline(booking.departureStartDate, booking.departureEndDate),
  );
  return new Date(Math.min(ttlEnd, deadlineEnd));
}

/**
 * Còn bao lâu nữa booking PENDING này bị cron quét.
 *
 * Làm tròn XUỐNG có chủ ý: thà nói "còn 52 phút" khi thực tế còn 52 phút 20
 * giây, hơn là làm tròn lên thành 53 rồi khách quay lại đúng phút cuối và thấy
 * booking đã bị huỷ. Không bao giờ hứa nhiều hơn thực tế.
 *
 * `at` truyền vào được để test không phụ thuộc đồng hồ thật.
 */
export function pendingExpiry(
  booking: Pick<Booking, 'createdAt' | 'departureStartDate' | 'departureEndDate'>,
  at: Date = new Date(),
): PendingExpiry {
  const deadline = pendingDeadline(booking).getTime();
  const msLeft = deadline - at.getTime();
  if (msLeft <= 0) return { minutesLeft: 0, expired: true };
  return { minutesLeft: Math.floor(msLeft / 60_000), expired: false };
}

/**
 * Câu cuống của đơn chưa trả đã đóng (G37, spec §4.3) — MỘT câu cho màn hình (`BookingReceipt`) và
 * bản in: chưa thu đồng nào thì nói thẳng không thu tiền; bị thu rồi hoàn tự động (`wasCharged`) thì
 * câu kết cục theo trạng thái — "no payment was taken" cạnh khoản vừa kể là đã hoàn là nói ngược
 * (cùng bất biến review P7 B1).
 */
export function closedStubSentence(
  booking: Pick<Booking, 'paidAt' | 'refundedTotal' | 'status'>,
): string {
  if (!wasCharged(booking)) return messages.booking.success.stubClosed;
  return (
    messages.accountBookingDetail.terminalNote[booking.status] ??
    messages.booking.success.settledBody
  );
}

/**
 * Số PHẦN TỬ của barcode giả — ĐỘC LẬP với độ dài `code`. Mã đặt chỗ (~10-11 ký
 * tự) một-ký-tự-một-vạch từng ra barcode cụt ~5 vạch nhìn như lỗi.
 *
 * 28 → 56 (19/08). Hai lý do, cả hai đều là hình:
 *  · 28 phần tử vẽ xen kẽ mực/trắng chỉ cho **14 vạch thật** — quá thưa để đọc
 *    ra mã vạch (EAN-13 có 95 module; Code128 cho 11 ký tự khoảng 167). 56 cho
 *    28 vạch, đủ dày.
 *  · Vạch nay vẽ DÍNH LIỀN, không còn `gap` giữa các phần tử — mã vạch thật thì
 *    vạch và khoảng trắng kề nhau, khe đều chen giữa làm nó đọc thành dãy sọc
 *    trang trí.
 *
 * TRẦN 52 KHÔNG PHẢI SỐ ĐẸP, nó bị bề ngang cuống vé dọc ràng buộc: card
 * `max-w-2xl` 672 trừ `px-4` còn 640, cuống chiếm 30% = 192, trừ `md:px-4` hai
 * bên còn **160px**.
 *
 * Con số chốt bằng cách LẤY MẪU chứ không tính trên một mã: bề rộng mỗi vạch
 * phụ thuộc ký tự, nên mã khác cho tổng khác. Quét 200k mã hợp lệ ngẫu nhiên
 * (`BK-` + 8 ký tự) đo trường hợp xấu nhất: n=52 ra 148px (dư 12px), n=56 ra
 * 164px và TRÀN — dù mã mẫu đầu tiên tôi thử chỉ ra 154px và trông có vẻ vừa.
 * Có test canh ràng buộc này; đừng nâng số mà không quét lại.
 */
const TICKET_BARCODE_BAR_COUNT = 52;

/**
 * Bề rộng (px, 1–4) của từng vạch barcode giả — DETERMINISTIC theo mã đặt
 * chỗ (KHÔNG random: random đổi hình mỗi lần render, SSR/CSR lệch nhau, và
 * trông giả hơn cả dashed-border cliché đã gỡ). Mã ngắn hơn số vạch thì LẶP
 * ký tự theo chu kỳ (`i % code.length`); trộn thêm chỉ số `i` vào hash để các
 * vòng lặp lại không tạo cùng một vạch y hệt liên tiếp. Không phải barcode
 * quét được thật (không cần máy quét ở capstone này), chỉ mô phỏng đúng "hình"
 * vạch dày-mỏng không đều của barcode ấn phẩm thật.
 */
export function ticketBarcodeWidths(code: string): number[] {
  return Array.from({ length: TICKET_BARCODE_BAR_COUNT }, (_, i) => {
    const ch = code[i % code.length] ?? 'A';
    return ((ch.charCodeAt(0) + i * 7) % 4) + 1;
  });
}
