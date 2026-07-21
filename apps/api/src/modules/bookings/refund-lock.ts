import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Serialize refund/cancel-approve per-booking (BK-R1, ADR-0009). Interactive tx
 * bao advisory xact-lock + TOÀN BỘ read→gateway→ledger; lock tự nhả lúc commit.
 * Hai flow đồng thời trên cùng booking: flow thứ hai block ở `pg_advisory_xact_lock`
 * tới khi flow đầu commit → đọc ledger đã cập nhật → refund đúng phần còn lại hoặc
 * ném error, thay vì double-refund.
 *
 * Timeout 20s > 15s HTTP timeout của gateway. Đặt gateway HTTP trong tx là NGOẠI
 * LỆ có chủ đích của nguyên tắc "gateway ngoài transaction" — chỉ cho đường refund
 * hiếm (admin/cancel-approve), không phải claim-path tần suất cao.
 *
 * `hashtextextended(text, int8) → int8`: băm bookingId (uuid) thành khoá bigint cho
 * advisory lock.
 */
export async function withBookingRefundLock<T>(
  bookingId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${bookingId}, 0))`;
      return fn(tx);
    },
    { timeout: 20_000, maxWait: 5_000 },
  );
}
