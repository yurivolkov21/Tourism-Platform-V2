import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '../auth/auth.config.js';
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
    return this.cancellations.cancelByOperator(booking.id, job.adminId, REASON);
  }
}

/**
 * Lý do ghi vào `cancellation_requests` cho mọi booking của lượt huỷ này.
 *
 * Tiếng ANH vì nó lọt ra bề mặt người dùng thấy (luật 7): lịch sử huỷ ở trang
 * booking của khách in đúng chuỗi này. Lý do RIÊNG mà admin gõ sống ở sổ của
 * chuyến, không nhân bản xuống từng booking — nội bộ và khách không cần đọc.
 */
const REASON = 'The operator cancelled this departure';
