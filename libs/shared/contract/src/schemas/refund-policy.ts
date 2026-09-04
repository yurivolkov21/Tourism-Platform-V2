/**
 * Chính sách hoàn tiền khi huỷ — NGUỒN DUY NHẤT (ADR-0030).
 *
 * Bảng bậc dưới đây sinh ra CẢ BA thứ:
 *
 * 1. gạch đầu dòng ở `/cancellation-policy` (khách đọc),
 * 2. đoạn tương ứng ở `/terms` (khách đọc),
 * 3. con số mà màn quyết định của admin tính (server trả tiền theo).
 *
 * ## Vì sao ở CONTRACT chứ không ở i18n
 *
 * Nó vừa là **copy** vừa là **luật tiền**. Đặt ở `@tourism/i18n` thì API phải
 * import một gói copy để tính tiền — sai tầng, và mở đường cho một sửa đổi
 * "chỉ đổi chữ" âm thầm đổi số tiền trả cho khách. Đặt ở contract thì cả hai
 * đầu đọc chung một bảng, và i18n chỉ lo dịch nó thành câu.
 *
 * Trước ADR-0030 các bậc này chỉ sống dưới dạng **văn xuôi** trong hai file
 * legal, nên công cụ admin hoàn toàn mù chính sách: hai admin xử hai ca giống
 * hệt nhau ra hai con số khác nhau, và không ai đối chiếu được với thứ đã hứa.
 */

/**
 * Một bậc hoàn tiền. `minDaysBefore` là biên DƯỚI, TÍNH VÀO — bậc áp dụng khi
 * số ngày còn lại `>= minDaysBefore`.
 *
 * Bảng phải xếp GIẢM DẦN theo `minDaysBefore` để phép tra "bậc đầu tiên khớp"
 * cho đúng bậc rộng rãi nhất; `refundPolicySpec` canh bất biến này.
 */
export interface RefundPolicyTier {
  /** Số ngày tối thiểu trước khởi hành để bậc này áp dụng (TÍNH VÀO). */
  minDaysBefore: number;
  /** Phần trăm tổng tiền booking được hoàn, 0..100. */
  percent: number;
}

/**
 * Bậc hoàn tiền theo số ngày trước khởi hành (ADR-0030 §2).
 *
 * | Trước khởi hành | Hoàn |
 * | --- | --- |
 * | ≥ 30 ngày | 100% |
 * | 15–29 ngày | 50% |
 * | 7–14 ngày | 25% |
 * | < 7 ngày | 0% |
 *
 * Dải 25% là MỚI so với bản văn xuôi cũ, và nó làm ba việc: vá lỗ ngày 14 (bản
 * cũ viết "15–29" và "dưới 14" nên bỏ rơi đúng ngày 14 chẵn), hạ vực từ 50
 * xuống 25 điểm, và **chỉ nới rộng hơn** — ngày 7–14 đi từ 0% lên 25%, các mốc
 * khác giữ nguyên, nên không booking nào đã đặt bị thiệt so với điều khoản
 * khách đã đọc lúc mua. Đó là điều kiện để sửa được văn bản công khai mà không
 * phải xử lý riêng cho booking cũ; ngày nào cần SIẾT một mốc thì đó là quyết
 * định khác hẳn.
 */
export const REFUND_POLICY_TIERS: readonly RefundPolicyTier[] = [
  { minDaysBefore: 30, percent: 100 },
  { minDaysBefore: 15, percent: 50 },
  { minDaysBefore: 7, percent: 25 },
  { minDaysBefore: 0, percent: 0 },
];

/** Phần trăm hoàn của một kỳ hạn — bậc RỘNG RÃI NHẤT mà số ngày ấy còn với tới. */
export function refundPercentForDays(daysBeforeDeparture: number): number {
  // Ngày ÂM (yêu cầu gửi sau khi đã khởi hành) rơi vào bậc cuối = 0%, đúng câu
  // "no-shows or cancellations after the tour has started are not refundable".
  const tier = REFUND_POLICY_TIERS.find((entry) => daysBeforeDeparture >= entry.minDaysBefore);
  return tier?.percent ?? 0;
}

/**
 * Ngưỡng hoàn 100% của MỘT tour. Tour có `freeCancellationDays` thì đó là
 * ngưỡng của nó (ADR-0030 §3 — "where they differ, the tour-specific terms
 * apply"); tour không có thì theo bậc cao nhất của site.
 *
 * KHÔNG có sàn cho `freeCancellationDays`. Bản đầu ADR-0030 khai một sàn để
 * "chặn vực" ở tour hứa mốc ngắn, rồi bị chính test bác: sàn không xoá được
 * vực, và nâng sàn là SIẾT quyền khách (badge là số ngày TỐI THIỂU để được
 * miễn phí, nâng nó lên là lấy mất mấy ngày cuối). Bất biến thật sự cần canh
 * nằm ở `refundPercentForBooking`: badge chỉ NÂNG, không bao giờ HẠ.
 */
export function fullRefundThresholdDays(freeCancellationDays: number | null): number {
  return freeCancellationDays ?? REFUND_POLICY_TIERS[0]?.minDaysBefore ?? 0;
}

/**
 * Phần trăm hoàn cho một booking cụ thể: badge của tour NÂNG ngưỡng 100%, dưới
 * ngưỡng thì bảng bậc áp bình thường.
 *
 * Ví dụ tour `freeCancellationDays = 21`: huỷ ở ngày 21 trở lên hoàn 100% (dù
 * bậc site chỉ cho 50% ở khoảng 15–29), dưới đó rơi vào 7–14 hoặc <7.
 */
export function refundPercentForBooking(
  daysBeforeDeparture: number,
  freeCancellationDays: number | null,
): number {
  return daysBeforeDeparture >= fullRefundThresholdDays(freeCancellationDays)
    ? 100
    : refundPercentForDays(daysBeforeDeparture);
}

/**
 * Số NGÀY LỊCH từ `requestedAt` tới `departureStartDate`.
 *
 * Hai luật, cả hai đều là quyết định chứ không phải tiện tay (ADR-0030 §4):
 *
 * 1. **Mốc đếm là lúc KHÁCH GỬI yêu cầu**, không phải lúc admin quyết. Khách
 *    gửi ở ngày 20 mà admin duyệt chậm tới ngày 12 thì không được rớt bậc vì
 *    ta xử chậm — chính sách đã hứa "báo càng sớm hoàn càng nhiều".
 * 2. **Đếm bằng NGÀY LỊCH UTC, không phải hiệu millisecond.** Yêu cầu gửi lúc
 *    `2026-09-04T23:00Z` cho chuyến `2026-10-04`: hiệu millisecond là 29,04
 *    ngày, làm tròn xuống thành 29 và rơi nhầm sang bậc 50%, trong khi lịch
 *    nói đúng 30 ngày và phải hoàn 100%. Một giờ trong ngày không được phép
 *    làm khách mất một nửa số tiền.
 *
 * `departureStartDate` là ngày lịch `YYYY-MM-DD` (cột `@db.Date`), nên cả hai
 * đầu quy về nửa đêm UTC rồi mới trừ.
 */
export function daysBeforeDeparture(requestedAt: Date, departureStartDate: string): number {
  const DAY_MS = 86_400_000;
  const from = Date.UTC(
    requestedAt.getUTCFullYear(),
    requestedAt.getUTCMonth(),
    requestedAt.getUTCDate(),
  );
  const to = Date.parse(`${departureStartDate}T00:00:00.000Z`);
  return Math.round((to - from) / DAY_MS);
}

/**
 * Cửa sổ ÂN HẠN sau khi thanh toán (ADR-0030 §3c) — huỷ trong ngần này giờ kể
 * từ `paidAt` thì hoàn 100%, bất kể còn bao nhiêu ngày tới khởi hành.
 *
 * Chữa lỗ "người đặt muộn không bao giờ với tới bậc 100%": bảng bậc chỉ đo còn
 * bao xa tới khởi hành, không đo khách đã giữ chỗ bao lâu — mà người giữ chỗ
 * mười phút rồi trả lại không gây tổn thất cho ai. Trong 24 giờ đầu chưa có
 * chi phí nhà cung cấp nào được cam kết, và đó chính là lý do bảng bậc tồn tại.
 */
export const REFUND_GRACE_HOURS = 24;

/** Mọi thứ cần để quyết phần trăm hoàn của MỘT yêu cầu huỷ. */
export interface RefundRequestContext {
  /** Lúc khách GỬI yêu cầu — không phải lúc admin quyết (xem `daysBeforeDeparture`). */
  requestedAt: Date;
  /** ISO; `null` = booking chưa trả tiền, nên không có ân hạn (không có gì để hoàn). */
  paidAt: string | null;
  departureStartDate: string;
  freeCancellationDays: number | null;
}

/** Yêu cầu có nằm trong cửa sổ ân hạn không. Đúng mốc 24 giờ vẫn TÍNH VÀO. */
export function isWithinGracePeriod(paidAt: string | null, requestedAt: Date): boolean {
  if (paidAt === null) return false;
  const elapsed = requestedAt.getTime() - Date.parse(paidAt);
  // `>= 0` chặn ca đồng hồ lệch cho ra khoảng âm rồi lọt cửa vô tình.
  return elapsed >= 0 && elapsed <= REFUND_GRACE_HOURS * 3_600_000;
}

/**
 * Phần trăm hoàn của một yêu cầu huỷ — ĐIỂM VÀO DUY NHẤT mà cả khách lẫn admin
 * dùng, nên hai bên không thể nhìn hai con số khác nhau.
 *
 * Ân hạn là LỚP PHỦ chỉ có lợi: nó trả về 100, tức trần của bảng bậc, nên
 * không bao giờ hạ kết quả xuống. Bất biến ấy có test quét mọi tổ hợp.
 */
export function refundPercentForRequest(context: RefundRequestContext): number {
  if (isWithinGracePeriod(context.paidAt, context.requestedAt)) return 100;
  return refundPercentForBooking(
    daysBeforeDeparture(context.requestedAt, context.departureStartDate),
    context.freeCancellationDays,
  );
}
