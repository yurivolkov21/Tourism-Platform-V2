import type { BookingCancellation } from '@tourism/contract';
import {
  canCancelOnline,
  cancellationDeadline,
  isWithinDeadline,
  refundOnCancel,
  remainingRefundable,
} from '@tourism/contract';
import { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus, DepartureStatus } from '../../generated/prisma/enums.js';
import { calendarDate } from '../../lib/calendar-date.js';

/**
 * Luật huỷ của MỘT booking ở tầng API (ADR-0041 §4) — hàm thuần, không đọc DB.
 * Hai nơi dùng chung để con số khách THẤY là con số server HOÀN:
 * `bookings.byCode` (trường `cancellation`) và lõi huỷ trong
 * `CancellationsService` (chặn trước khi gọi cổng thanh toán).
 *
 * Ngày chuyến đọc từ SNAPSHOT của booking (`departure_start_date`,
 * `departure_end_date`), không join sống chuyến: sửa chuyến sau khi đặt không
 * đổi hạn chót đã hứa với khách. TRẠNG THÁI chuyến thì ngược lại, đọc SỐNG
 * (ADR-0041 AMEND 1): công ty huỷ chuyến là sự kiện xảy ra SAU lúc đặt, bản sao
 * không bao giờ thấy nó — người gọi đọc rồi đưa vào qua {@link CancelPath}.
 */

/** Phần booking mà luật huỷ cần — cắt đúng chừng này để test dựng bằng object thuần. */
export interface CancellableBooking {
  status: BookingStatus;
  departureStartDate: Date;
  departureEndDate: Date;
  totalAmount: Prisma.Decimal;
  providerPaymentId: string | null;
}

/** PAID hoặc PARTIALLY_REFUNDED — hai trạng thái luật huỷ áp dụng; REFUNDED thì khách liên hệ. */
export function isCancellableStatus(status: BookingStatus): boolean {
  return status === BookingStatus.PAID || status === BookingStatus.PARTIALLY_REFUNDED;
}

/**
 * Ai đang huỷ — và thứ đường ấy phải mang theo.
 *
 * Đường KHÁCH bắt buộc mang trạng thái SỐNG của chuyến, không có mặc định: quên
 * nó là mở lại đúng lỗ hổng của ADR-0041 AMEND 1 (khách tự huỷ trong khoảng chờ
 * job hoàn tiền của công ty và mất khoản 100%). Đường CÔNG TY không cần: chuyến
 * `CANCELLED` là tiền đề của nó.
 */
export type CancelPath =
  | { initiator: 'customer'; departureStatus: DepartureStatus }
  | { initiator: 'operator' };

/**
 * Lý do booking KHÔNG huỷ online được lúc `now`, hoặc `null` khi huỷ được. Chuỗi
 * trả về là chi tiết cho log và thông điệp lỗi 422, không phải copy cho khách
 * (web in câu của `@tourism/i18n`).
 *
 * Đường đi đổi ĐÚNG HAI chốt, cả hai chỉ áp cho khách:
 *
 * - **Chuyến đã bị công ty huỷ** (ADR-0041 AMEND 1). Từ lúc chuyến `CANCELLED`,
 *   §6 thắng §4: tiền của mọi booking trên chuyến ấy chỉ đi đường công ty, trọn
 *   phần chưa hoàn. Để khách tự huỷ trong khoảng chờ là để luật hạn chót trả 0
 *   cho một chuyến sẽ không bao giờ chạy — rồi job tới sau thấy booking đã
 *   đóng và coi như xong. Chốt này đứng TRƯỚC chốt ngày: chuyến bị huỷ thì đó
 *   mới là lý do thật.
 * - **Ngày khởi hành.** Khách không huỷ được một chuyến đang chạy hoặc đã chạy
 *   xong; lúc đó là chuyện sau chuyến đi, không phải huỷ. Đường công ty KHÔNG
 *   chịu chốt này: chuyến đã bị bỏ trước ngày khởi hành
 *   (`departureCancelBlocker` gác ở API), nên "đã tới ngày khởi hành" chỉ còn
 *   là một sự thật về tờ lịch, không phải lý do giữ tiền của khách (ADR-0041
 *   §6: hoàn 100%, mọi lý do).
 *
 * Vì sao phải khai đường đi tường minh thay vì để lõi tự đoán: lượt hoàn tiền
 * của công ty chạy BẤT ĐỒNG BỘ qua hàng đợi. Worker gói free ngủ 15 phút, cổng
 * thanh toán hờn một lúc rồi retry giãn luỹ thừa — job hoàn toàn có thể chạy
 * sau ngày khởi hành. Để chốt của khách áp vào đó là im lặng bỏ rơi một khách
 * đã trả tiền, và không có gì báo lại.
 *
 * Hai chốt còn lại (trạng thái booking, thiếu capture) áp cho CẢ HAI đường và
 * nói TRƯỚC: chúng là chuyện của chính booking, không phải chuyện của ai bấm nút.
 */
export function cancellationBlocker(
  booking: CancellableBooking,
  now: Date,
  path: CancelPath,
): string | null {
  if (!isCancellableStatus(booking.status)) {
    return `booking is ${booking.status}; only a PAID or PARTIALLY_REFUNDED booking can be cancelled online`;
  }
  if (booking.providerPaymentId === null) {
    return 'booking has no captured payment to refund against';
  }
  if (path.initiator === 'operator') return null;
  if (path.departureStatus === DepartureStatus.CANCELLED) {
    return 'the operator has cancelled this departure; its full refund is on the way';
  }
  if (!canCancelOnline(now, calendarDate(booking.departureStartDate))) {
    return 'the departure date has been reached (Vietnam time)';
  }
  return null;
}

/**
 * Số tiền hoàn nếu huỷ lúc `now`, dạng `'117.00'`: trong hạn là phần còn lại của
 * sổ, quá hạn là `'0.00'`. `refundedTotal` là SUM(refunds); `null` = chưa hoàn
 * đồng nào. Không kiểm `cancellationBlocker` — người gọi tự quyết thứ tự.
 */
export function refundOnCancelForBooking(
  booking: CancellableBooking,
  refundedTotal: Prisma.Decimal | null,
  now: Date,
): string {
  return refundOnCancel({
    now,
    startDate: calendarDate(booking.departureStartDate),
    endDate: calendarDate(booking.departureEndDate),
    totalAmount: booking.totalAmount.toFixed(2),
    refundedTotal: (refundedTotal ?? new Prisma.Decimal(0)).toFixed(2),
  });
}

/**
 * Số tiền hoàn khi CÔNG TY huỷ chuyến (ADR-0041 §6) — trọn phần chưa hoàn,
 * KHÔNG xét hạn chót.
 *
 * Vì sao khác {@link refundOnCancelForBooking}: hạn chót là luật cho KHÁCH đổi
 * ý — qua hạn thì chỗ không bán lại được nữa nên không tự hoàn (ADR-0041 §1).
 * Chuyến bị công ty bỏ thì khách chẳng đổi ý gì cả; bắt họ chịu cùng luật ấy là
 * giữ tiền của một chuyến sẽ không bao giờ chạy. Nên cùng một mốc thời gian,
 * hai đường ra hai con số.
 *
 * `now` KHÔNG phải tham số ở đây, có chủ đích: thêm vào là mời người đọc tin
 * rằng thời điểm có ảnh hưởng.
 */
export function refundOnOperatorCancelForBooking(
  booking: CancellableBooking,
  refundedTotal: Prisma.Decimal | null,
): string {
  return remainingRefundable(
    booking.totalAmount.toFixed(2),
    (refundedTotal ?? new Prisma.Decimal(0)).toFixed(2),
  );
}

/**
 * Trường `bookings.byCode.cancellation` (plan 15/09 Hợp đồng B): `null` khi
 * trạng thái ngoài PAID/PARTIALLY_REFUNDED, hoặc khi chuyến đã bị công ty huỷ
 * (ADR-0041 AMEND 1) — luật huỷ của khách không còn áp dụng, và in hạn chót hay
 * số `refundAmount` theo hạn chót lúc ấy là nói sai: công ty hoàn trọn qua job.
 *
 * `departureStatus` là trạng thái SỐNG của chuyến, người gọi đọc rồi đưa vào.
 */
export function bookingCancellation(
  booking: CancellableBooking,
  refundedTotal: Prisma.Decimal | null,
  now: Date,
  departureStatus: DepartureStatus,
): BookingCancellation | null {
  if (!isCancellableStatus(booking.status)) return null;
  if (departureStatus === DepartureStatus.CANCELLED) return null;
  const startDate = calendarDate(booking.departureStartDate);
  const endDate = calendarDate(booking.departureEndDate);
  return {
    deadline: cancellationDeadline(startDate, endDate),
    withinDeadline: isWithinDeadline(now, startDate, endDate),
    refundAmount: refundOnCancelForBooking(booking, refundedTotal, now),
    canCancel:
      cancellationBlocker(booking, now, { initiator: 'customer', departureStatus }) === null,
  };
}
