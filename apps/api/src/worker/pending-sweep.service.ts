import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '../auth/auth.config.js';
import { Prisma } from '../generated/prisma/client.js';

/**
 * TTL sweep mặc định, phút. BẤT BIẾN: giá trị này PHẢI > SESSION_EXPIRY_SECONDS
 * của MỌI gateway đang bật, nếu không sweep sẽ hủy booking trong khi session
 * thanh toán bên ngoài vẫn còn sống — buyer trả tiền xong bị auto-refund vô cớ
 * (không mất tiền vì orphan-capture vẫn đỡ, nhưng UX tệ + event rác).
 * 65′ = lề 5′ trên hạn Stripe Checkout hiện tại (60′, xem SESSION_EXPIRY_SECONDS
 * ở stripe.gateway.ts, nâng bởi 43d7a2b). PayPal order sống ~3h — đã vượt mốc
 * này sẵn, chấp nhận vì webhook APPROVED + capture idempotent xử được order
 * muộn. Đổi hạn session ở gateway nào thì PHẢI xem lại hằng này.
 */
export const PENDING_TTL_MINUTES = 65;

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
  async sweepAbandoned(ttlMinutes: number): Promise<number> {
    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      UPDATE bookings
      SET status = 'CANCELLED'::"BookingStatus", cancelled_at = now(), updated_at = now()
      WHERE status = 'PENDING'::"BookingStatus"
        AND created_at < now() - make_interval(mins => ${ttlMinutes})
        AND (checkout_session_expires_at IS NULL OR checkout_session_expires_at < now())
      RETURNING id
    `);
    if (rows.length > 0) {
      this.logger.log(`Swept ${rows.length} abandoned PENDING booking(s) → CANCELLED (WRK-1)`);
    }
    return rows.length;
  }
}
