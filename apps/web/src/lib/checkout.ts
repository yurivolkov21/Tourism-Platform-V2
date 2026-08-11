import type { Booking } from '@tourism/contract';

/**
 * Hạn sống của một booking PENDING, tính bằng phút kể từ `createdAt`.
 *
 * ⚠️ ĐÂY LÀ BẢN SAO của hằng số phía API — `PENDING_TTL_MINUTES` tại
 * `apps/api/src/worker/pending-sweep.service.ts:15`. Contract KHÔNG trả
 * `expiresAt`, nên web buộc phải tự tính; đổi bên kia thì phải đổi ở đây.
 *
 * Vì sao API chọn 65 chứ không phải một số tròn: nó phải LỚN HƠN hạn session
 * của mọi gateway (Stripe Checkout là 60 phút) — cron quét sớm hơn cổng thì có
 * thể huỷ một booking mà khách vẫn đang trả tiền. 65 = 60 + lề 5 phút.
 */
export const PENDING_TTL_MINUTES = 65;

/**
 * Ba tâm trạng của màn quay-về sau thanh toán.
 *
 * - `confirmed`  — tiền đã về, webhook đã xử lý xong.
 * - `confirming` — khách về trước webhook. Trạng thái TẠM, trang tự làm mới.
 * - `settled`    — booking đã ở một kết cục khác rồi (hết hạn giữa chừng, đã
 *                  huỷ, đã hoàn tiền). KHÔNG tự làm mới: không có gì để đợi.
 */
export type CheckoutMood = 'confirmed' | 'confirming' | 'settled';

/**
 * Tổng tiền booking — MỘT nguồn dùng CHUNG cho nhãn nút CTA (`booking-form.tsx`)
 * VÀ dòng "Total" (`checkout-summary.tsx`) — hai chỗ trước đây tự tính riêng,
 * lệch một chỗ là hai số khác nhau trên cùng một màn hình.
 *
 * Luật giá của hệ: trẻ em CÙNG đơn giá người lớn — `effectivePrice × (adults +
 * children)`, không có mức giá riêng cho trẻ em (khớp API:
 * `totalAmount(unitPrice, adults + children)`).
 *
 * `Number()` chỉ dùng ở BƯỚC CUỐI để tính, không phải nguồn sự thật —
 * `effectivePrice` (chuỗi thập phân) vẫn là nguồn; kết quả trả về CHUỖI đã
 * `.toFixed(2)`, khớp khuôn `formatMoney` nhận vào.
 */
export function computeBookingTotal(
  effectivePrice: string,
  adults: number,
  children: number,
): string {
  return (Number(effectivePrice) * (adults + children)).toFixed(2);
}

export function checkoutMood(booking: Booking): CheckoutMood {
  if (booking.status === 'PAID') return 'confirmed';
  if (booking.status === 'PENDING') return 'confirming';
  return 'settled';
}

export interface PendingExpiry {
  /** Số phút còn lại, đã kẹp ở 0. */
  minutesLeft: number;
  expired: boolean;
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
export function pendingExpiry(createdAt: string, at: Date = new Date()): PendingExpiry {
  const deadline = new Date(createdAt).getTime() + PENDING_TTL_MINUTES * 60_000;
  const msLeft = deadline - at.getTime();
  if (msLeft <= 0) return { minutesLeft: 0, expired: true };
  return { minutesLeft: Math.floor(msLeft / 60_000), expired: false };
}

/**
 * Số serial 10 chữ số cho dòng "NO. …" sát mép trên thân vé (`CheckoutShell`)
 * — mô phỏng số serial một ấn phẩm vé giấy thật, DETERMINISTIC theo mã đặt
 * chỗ (KHÔNG random: random đổi hình mỗi lần render, SSR/CSR lệch nhau, và
 * trông giả hơn cả dashed-border cliché vừa gỡ). Không phải một định danh
 * thật — `code` đã là định danh; đây thuần là trang trí ấn phẩm.
 */
export function ticketSerial(code: string): string {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  }
  return String(hash).padStart(10, '0').slice(-10);
}

/**
 * Số vạch cố định của barcode giả — ĐỘC LẬP với độ dài `code`. Mã đặt chỗ
 * (~10-11 ký tự) một-ký-tự-một-vạch từng ra barcode cụt ~5 vạch nhìn như lỗi;
 * số cố định trong khoảng vạch barcode ấn phẩm thật (24-32) để hình luôn trải
 * gần hết bề ngang cuống bất kể mã dài ngắn.
 */
const TICKET_BARCODE_BAR_COUNT = 28;

/**
 * Bề rộng (px, 1–4) của từng vạch barcode giả — DETERMINISTIC theo mã đặt
 * chỗ, cùng lý do với `ticketSerial`. Mã ngắn hơn số vạch thì LẶP ký tự theo
 * chu kỳ (`i % code.length`); trộn thêm chỉ số `i` vào hash để các vòng lặp
 * lại không tạo cùng một vạch y hệt liên tiếp. Không phải barcode quét được
 * thật (không cần máy quét ở capstone này), chỉ mô phỏng đúng "hình" vạch
 * dày-mỏng không đều của barcode ấn phẩm thật.
 */
export function ticketBarcodeWidths(code: string): number[] {
  return Array.from({ length: TICKET_BARCODE_BAR_COUNT }, (_, i) => {
    const ch = code[i % code.length] ?? 'A';
    return ((ch.charCodeAt(0) + i * 7) % 4) + 1;
  });
}
