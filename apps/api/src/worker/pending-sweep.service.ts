import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '../auth/auth.config.js';
import { Prisma } from '../generated/prisma/client.js';

/**
 * WRK-1 (ADR-0006): backstop cho webhook `payment.expired` (PAY-1) khi delivery
 * rớt — hủy mọi booking PENDING quá TTL (mặc định 30′, khớp hạn Stripe Checkout).
 *
 * MỘT statement nguyên tử gate `status='PENDING'` → idempotent với webhook cancel
 * và với chính nó (chạy lại chỉ bắt các PENDING mới quá hạn). KHÔNG đụng
 * `seats_booked`: PENDING chưa từng claim ghế (bất biến #1); chưa charge nên
 * không refund. Chạy trong worker process qua pg-boss (xem worker.ts).
 */
@Injectable()
export class PendingSweepService {
  private readonly logger = new Logger(PendingSweepService.name);

  /** Hủy PENDING cũ hơn `ttlMinutes`. Trả về số booking bị hủy. */
  async sweepAbandoned(ttlMinutes: number): Promise<number> {
    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      UPDATE bookings
      SET status = 'CANCELLED'::"BookingStatus", cancelled_at = now(), updated_at = now()
      WHERE status = 'PENDING'::"BookingStatus"
        AND created_at < now() - make_interval(mins => ${ttlMinutes})
      RETURNING id
    `);
    if (rows.length > 0) {
      this.logger.log(`Swept ${rows.length} abandoned PENDING booking(s) → CANCELLED (WRK-1)`);
    }
    return rows.length;
  }
}
