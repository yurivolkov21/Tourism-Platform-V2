import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '../auth/auth.config.js';
import { BookingStatus, DepartureStatus } from '../generated/prisma/enums.js';
import { CancellationsService } from '../modules/bookings/cancellations.service.js';

/**
 * Hàng đợi hoàn tiền khi CÔNG TY huỷ chuyến (F13, ADR-0041 §6) — một job cho
 * MỘT booking.
 *
 * ## Vì sao một job mỗi booking, không phải một job mỗi chuyến
 *
 * Mỗi booking là một lời gọi ra cổng thanh toán, và lời gọi ấy hỏng độc lập
 * với các booking khác. Gom cả chuyến vào một job thì khách thứ 7 hỏng kéo
 * theo lượt retry của cả 6 người đã hoàn xong — mà retry một lần hoàn đã chạy
 * là thứ duy nhất ở đây không được phép xảy ra. Tách nhỏ cũng là cách cột tiến
 * độ *"đã hoàn x/y"* ở màn admin có nghĩa.
 *
 * ## Khác năm queue còn lại của dự án ở đâu
 *
 * Năm queue kia là cron không tham số, `retryLimit: 0`, vì bỏ một lượt thì lượt
 * kế bù được. Ở đây bỏ một lượt là một khách không được hoàn tiền, nên queue
 * khai retry thật (xem `start-worker.ts`). Điều đó chỉ an toàn vì job
 * idempotent: {@link CancellationsService.cancelByOperator} đọc trạng thái
 * booking TRONG khoá và trả `null` khi việc đã xong, nên lượt giao lại dừng
 * TRƯỚC cổng thanh toán.
 */

/**
 * Tên queue — khai ở ĐÂY chứ không ở `start-worker.ts`, cùng lý do với
 * `OUTBOX_DRAIN_QUEUE`: kẻ đăng ký và kẻ đẩy job đọc chung một hằng, không
 * phải hai chuỗi giống nhau ở hai file.
 */
export const DEPARTURE_REFUND_QUEUE = 'departure-refund';

/** Payload một job — đủ để tìm booking và ghi ai là người quyết. */
export interface DepartureRefundJob {
  bookingId: string;
  /**
   * Chuyến mà job này thuộc về. Không thừa: job nằm trong hàng đợi qua nhiều
   * phút, và một booking bị dời sang chuyến khác trong khoảng đó thì job cũ đã
   * LẠC — hoàn theo nó là hoàn tiền cho một chuyến vẫn đang chạy.
   */
  departureId: string;
  /** Admin đã bấm nút huỷ — vào `cancellation_requests.decided_by`. */
  adminId: string;
  /**
   * Lý do admin gõ ở hộp xác nhận, chép vào `cancellation_requests.reason` của
   * TỪNG booking.
   *
   * KHÁCH ĐỌC ĐƯỢC chuỗi này (lịch sử huỷ ở trang booking của họ) — copy ở màn
   * admin phải nói rõ điều đó, vì "guide bỏ việc" là câu ghi cho nội bộ.
   */
  reason: string;
}

@Injectable()
export class DepartureRefundService {
  private readonly logger = new Logger(DepartureRefundService.name);

  constructor(private readonly cancellations: CancellationsService) {}

  /**
   * Chạy MỘT job. Trả số tiền đã hoàn, hoặc `null` khi không có gì để làm
   * (booking đã huỷ ở lượt trước, hoặc job đã lạc chuyến).
   *
   * NÉM khi cổng thanh toán từ chối — đó là lúc `retryLimit` của queue phải
   * làm việc. Lượt hỏng không để lại nửa trạng thái nào: lõi huỷ gọi cổng
   * TRƯỚC rồi mới ghi, nên hỏng ở cổng nghĩa là chưa ghi gì.
   */
  async refundOne(job: DepartureRefundJob): Promise<string | null> {
    const booking = await prisma.booking.findUnique({
      where: { id: job.bookingId },
      select: { id: true, code: true, departureId: true },
    });
    if (!booking) {
      this.logger.warn(`Bỏ qua job hoàn tiền: booking ${job.bookingId} không còn tồn tại`);
      return null;
    }
    if (booking.departureId !== job.departureId) {
      this.logger.warn(
        `Bỏ qua job hoàn tiền: booking ${booking.code} nay thuộc chuyến khác (job mang ${job.departureId})`,
      );
      return null;
    }
    return this.cancellations.cancelByOperator(booking.id, job.adminId, job.reason);
  }

  /**
   * LƯỚI CUỐI cho hoàn tiền sót — chạy theo cron `booking-sweep` (10 phút).
   *
   * Vì sao cần: job được đẩy SAU khi transaction huỷ đã commit, nên có một
   * khoảng hở thật. Nếu lúc ấy không worker nào đăng ký (API chạy tách khỏi
   * worker), hoặc pg-boss lỗi, hoặc tiến trình chết giữa commit và đẩy — thì
   * booking đã trả tiền nằm lại trên một chuyến đã huỷ và KHÔNG có gì đánh
   * thức nó dậy. Khác mọi queue khác của dự án, ở đây không có cron nào tự
   * chạy lại công việc.
   *
   * Câu hỏi đủ hẹp để chạy mỗi 10 phút mà không tốn gì: chuyến nào `CANCELLED`
   * mà còn booking sống. Ca thường gặp trả 0 hàng.
   *
   * Gọi thẳng {@link refundOne} thay vì đẩy lại vào hàng đợi: nếu đường đẩy
   * đang hỏng thì đẩy lại cũng hỏng. `decided_by` lấy từ `cancelled_by` của
   * chính chuyến — đó là lý do ba cột sổ ở `tour_departures` tồn tại.
   */
  async sweepStranded(): Promise<number> {
    const stranded = await prisma.booking.findMany({
      where: {
        status: { in: [BookingStatus.PAID, BookingStatus.PARTIALLY_REFUNDED] },
        departure: { status: DepartureStatus.CANCELLED },
      },
      select: {
        id: true,
        departureId: true,
        departure: { select: { cancelledBy: true, cancelReason: true } },
      },
    });

    let done = 0;
    for (const booking of stranded) {
      const adminId = booking.departure.cancelledBy;
      if (!adminId) {
        // Chuyến huỷ từ trước đợt F13 (seed lịch sử) không có sổ. Không bịa ra
        // một người quyết: để yên và nói rõ, vì đây là tiền thật.
        this.logger.warn(
          `Booking ${booking.id} nằm trên một chuyến đã huỷ nhưng chuyến ấy không có sổ người huỷ — bỏ qua, cần xử lý tay`,
        );
        continue;
      }
      try {
        const refunded = await this.refundOne({
          bookingId: booking.id,
          departureId: booking.departureId,
          adminId,
          reason: booking.departure.cancelReason ?? FALLBACK_REASON,
        });
        if (refunded !== null) done += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown';
        // Một khách hỏng không được kéo theo phần còn lại — lượt quét kế thử lại.
        this.logger.error(`Không hoàn được cho booking ${booking.id}: ${message}`);
      }
    }
    if (done > 0) {
      this.logger.log(`Đã dọn ${done} lượt hoàn tiền sót của chuyến đã huỷ`);
    }
    return done;
  }
}

/** Dùng khi chuyến có người huỷ nhưng lý do trống — không để sổ của khách rỗng. */
const FALLBACK_REASON = 'The operator cancelled this departure';
