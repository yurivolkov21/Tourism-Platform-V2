import { prisma } from '../../auth/auth.config.js';

/**
 * "Atomic claim" của việc rút consent — MỘT luật cho cả đường khách
 * (`NewsletterService.unsubscribe`, link HMAC trong email) lẫn đường admin
 * (`AdminSubscribersService.unsubscribe`). Nâng lên đây ở vòng vá review F10:
 * hai service trong cùng module từng chép nguyên bộ ba câu lệnh này, và ngày
 * thêm bảng audit consent (việc JSDoc `StatsService` đã dự báo) là ngày một
 * trong hai bản bị bỏ sót — bản admin, đúng bản duy nhất có `adminId`.
 *
 * MỘT statement `updateMany` với guard `unsubscribedAt: null` (ADR-0009) thay
 * vì đọc-rồi-ghi: hai lệnh đồng thời cùng thấy `null` rồi cùng ghi là MỐC RÚT
 * CONSENT bị đè bằng giờ của người sau — mốc đó là bằng chứng pháp lý
 * (GDPR/CAN-SPAM). `count === 0` có HAI nghĩa, phân biệt bằng một `findUnique`
 * CHỈ trên nhánh hỏng — đường thành công vẫn đúng một round-trip.
 *
 * Kết cục là việc của caller: đường khách coi `already` là idempotent 200,
 * đường admin ném 409 — cùng một luật, hai cách trả lời.
 */
export type UnsubscribeClaim =
  | { kind: 'claimed'; at: Date }
  | { kind: 'already' }
  | { kind: 'missing' };

export async function claimUnsubscribe(id: string, at = new Date()): Promise<UnsubscribeClaim> {
  const { count } = await prisma.subscriber.updateMany({
    where: { id, unsubscribedAt: null },
    data: { unsubscribedAt: at },
  });
  if (count === 1) return { kind: 'claimed', at };

  const exists = await prisma.subscriber.findUnique({ where: { id }, select: { id: true } });
  return exists ? { kind: 'already' } : { kind: 'missing' };
}
