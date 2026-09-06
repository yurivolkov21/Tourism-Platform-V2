import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '../auth/auth.config.js';
import { Prisma } from '../generated/prisma/client.js';

/**
 * TTL sweep MỀM, phút — mốc "bỏ dở" tính từ `created_at`, chỉ có hiệu lực khi
 * session hiện tại đã hết (ADR-0006 AMEND 1c/2d). 65′ = lề 5′ trên hạn Stripe
 * Checkout (60′, SESSION_EXPIRY_SECONDS ở stripe.gateway.ts). PayPal khai 3h
 * nên PENDING PayPal sống tới hạn ấy — đó là hành vi CÓ CHỦ ĐÍCH: PayPal
 * không có expire API lẫn webhook hết hạn, huỷ sớm hơn là huỷ một order còn
 * thu được tiền (orphan refund + event rác). Unit spec canh cả hai gateway.
 */
export const PENDING_TTL_MINUTES = 65;

/**
 * Trần CỨNG, giờ — hủy mọi PENDING quá tuổi này BẤT KỂ session còn sống hay
 * không (ADR-0006 AMEND 2d). Bản AMEND 1c AND điều kiện session vào TTL mềm
 * mà không có trần này, tức `created_at` hết là trần tuyệt đối: một tài khoản
 * gọi reCheckout mỗi ~55′ giữ PENDING sống vô hạn trong hàng đợi/thống kê.
 * 24h > hạn session dài nhất (PayPal 3h) nhiều lần, nên chỉ chạm tới khi
 * booking đã được re-mint suốt một ngày — lúc đó session sống bị bỏ rơi cũng
 * chỉ dẫn tới orphan refund, lưới có sẵn.
 */
export const PENDING_HARD_TTL_HOURS = 24;

/**
 * WRK-1 (ADR-0006): backstop cho webhook `payment.expired` (PAY-1) khi delivery
 * rớt — hủy mọi booking PENDING quá TTL (xem {@link PENDING_TTL_MINUTES}).
 *
 * MỘT statement nguyên tử gate `status='PENDING'` → idempotent với webhook cancel
 * và với chính nó (chạy lại chỉ bắt các PENDING mới quá hạn). KHÔNG đụng
 * `seats_booked`: PENDING chưa từng claim ghế (bất biến #1); chưa charge nên
 * không refund. Chạy trong worker process qua pg-boss (xem worker.ts).
 */
@Injectable()
export class PendingSweepService {
  private readonly logger = new Logger(PendingSweepService.name);

  /** Hủy PENDING cũ hơn `ttlMinutes`. Trả về số booking bị hủy.
   *
   * ADR-0006 AMEND 1c: neo thêm theo LẦN MINT GẦN NHẤT — session hiện tại còn
   * sống (checkout_session_expires_at ở tương lai) thì KHÔNG sweep, kể cả khi
   * created_at đã quá TTL: khách bỏ dở rồi quay lại bấm re-checkout thì đồng
   * hồ phải tính từ session mới, không phải từ lúc tạo booking. Cột null
   * (booking cũ trước migration / chưa mint được session) giữ luật cũ theo
   * created_at. */
  async sweepAbandoned(
    ttlMinutes: number,
    hardTtlHours: number = PENDING_HARD_TTL_HOURS,
  ): Promise<number> {
    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      UPDATE bookings
      SET status = 'CANCELLED'::"BookingStatus", cancelled_at = now(), updated_at = now(),
          checkout_session_url = NULL, checkout_session_expires_at = NULL
      WHERE status = 'PENDING'::"BookingStatus"
        AND created_at < now() - make_interval(mins => ${ttlMinutes})
        AND (
          checkout_session_expires_at IS NULL
          OR checkout_session_expires_at < now()
          -- Trần cứng (AMEND 2d): re-mint liên tục không kéo dài đời PENDING mãi.
          OR created_at < now() - make_interval(hours => ${hardTtlHours})
        )
      RETURNING id
    `);
    if (rows.length > 0) {
      this.logger.log(`Swept ${rows.length} abandoned PENDING booking(s) → CANCELLED (WRK-1)`);
    }
    return rows.length;
  }
}
