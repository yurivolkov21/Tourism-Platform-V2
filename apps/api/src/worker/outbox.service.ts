import { Inject, Injectable, Logger } from '@nestjs/common';
import { prisma } from '../auth/auth.config.js';
import { Prisma } from '../generated/prisma/client.js';
import { EmailType, OutboxStatus } from '../generated/prisma/enums.js';
import { EMAIL_DELIVERER, type EmailDeliverer } from './deliverer.js';
import { resolveRecipient } from './recipient.js';

/** Mỗi lượt drain lấy tối đa bấy nhiêu row PENDING (oldest-first). */
const DRAIN_BATCH_SIZE = 50;
/** Quá số lần thử này thì row bị park FAILED chờ operator (giữ để triage). */
export const MAX_ATTEMPTS = 5;
/** Trần cột `last_error` (VarChar(1000)). */
const LAST_ERROR_MAX = 1000;

/**
 * Loại email coi là "bản tin" — chịu chi phối bởi `unsubscribedAt` của
 * Subscriber (spec §4.4: "worker bỏ qua subscriber có unsubscribedAt ≠
 * null"). Set riêng thay vì mọi EmailType: các email giao dịch khác
 * (BOOKING_CONFIRMATION, REVIEW_APPROVED…) không liên quan tới bảng
 * subscribers — subscriber huỷ đăng ký bản tin không có nghĩa họ ngừng nhận
 * email xác nhận đơn hàng của chính họ.
 */
const NEWSLETTER_EMAIL_TYPES: ReadonlySet<EmailType> = new Set([EmailType.NEWSLETTER_WELCOME]);

export interface DrainResult {
  /** Row giao thành công → SENT. */
  sent: number;
  /** Row lỗi và ĐÃ chạm MAX_ATTEMPTS → FAILED. */
  failed: number;
  /** Row lỗi nhưng còn lượt → vẫn PENDING chờ lượt drain sau. */
  retried: number;
  /**
   * Bản tin cho subscriber đã huỷ đăng ký (`unsubscribedAt` ≠ null) — bỏ
   * qua, KHÔNG gọi deliverer, đánh dấu SENT ngay (spec §4.4). Đếm riêng
   * thay vì gộp vào `sent`: gộp chung sẽ nói dối số email THẬT SỰ đã gửi.
   */
  skippedUnsubscribed: number;
}

/**
 * Logic thuần cho state-machine retry: attempts cũ → (attempts mới, status).
 * Tách khỏi service để unit-test không cần DB.
 */
export function nextAttemptState(prevAttempts: number): {
  attempts: number;
  status: typeof OutboxStatus.PENDING | typeof OutboxStatus.FAILED;
} {
  const attempts = prevAttempts + 1;
  return {
    attempts,
    status: attempts >= MAX_ATTEMPTS ? OutboxStatus.FAILED : OutboxStatus.PENDING,
  };
}

/** Chuẩn hóa lỗi bất kỳ về message cắt vừa cột `last_error`. */
export function trimError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.slice(0, LAST_ERROR_MAX);
}

/**
 * Consumer của transactional-email outbox (ADR-0007, spec §7). Producer ghi
 * row PENDING nguyên tử cùng state change; worker pg-boss gọi
 * {@link drainOnce} mỗi phút và {@link purgeSent} hằng ngày (retention M5).
 * Không dính HTTP — chỉ Prisma + {@link EmailDeliverer}.
 */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(@Inject(EMAIL_DELIVERER) private readonly deliverer: EmailDeliverer) {}

  /**
   * Một lượt drain: lấy tối đa `batchSize` row PENDING cũ nhất, giao từng row.
   * Thành công → SENT + processedAt; lỗi → attempts+1, còn lượt thì giữ
   * PENDING, hết lượt thì FAILED (giữ lại cho operator triage).
   */
  async drainOnce(batchSize = DRAIN_BATCH_SIZE): Promise<DrainResult> {
    const rows = await prisma.outbox.findMany({
      where: { status: OutboxStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    const result: DrainResult = { sent: 0, failed: 0, retried: 0, skippedUnsubscribed: 0 };
    for (const row of rows) {
      if (
        NEWSLETTER_EMAIL_TYPES.has(row.type) &&
        (await this.isUnsubscribedRecipient(row.payload))
      ) {
        // Bỏ qua NGAY, không gọi deliverer — đánh dấu SENT để row không kẹt
        // ở đầu hàng đợi PENDING (batch luôn lấy cũ nhất trước, xem
        // `orderBy: createdAt asc` ở trên) và chặn các email khác phía sau.
        await prisma.outbox.updateMany({
          where: { id: row.id, status: OutboxStatus.PENDING },
          data: { status: OutboxStatus.SENT, processedAt: new Date() },
        });
        result.skippedUnsubscribed += 1;
        continue;
      }
      try {
        await this.deliverer.deliver(row.type, row.payload);
        // updateMany + guard status PENDING (pattern Nexora): row có thể bị
        // admin xóa/đụng giữa batch — biến mất thì bỏ qua, KHÔNG throw P2025
        // làm gãy phần còn lại của batch.
        await prisma.outbox.updateMany({
          where: { id: row.id, status: OutboxStatus.PENDING },
          data: { status: OutboxStatus.SENT, processedAt: new Date() },
        });
        result.sent += 1;
      } catch (err) {
        const { attempts, status } = nextAttemptState(row.attempts);
        const lastError = trimError(err);
        await prisma.outbox.updateMany({
          where: { id: row.id, status: OutboxStatus.PENDING },
          data: { attempts, status, lastError },
        });
        if (status === OutboxStatus.FAILED) result.failed += 1;
        else result.retried += 1;
        this.logger.warn(
          `Outbox ${row.id} (${row.type}) deliver failed (attempt ${attempts}/${MAX_ATTEMPTS}, now ${status}): ${lastError}`,
        );
      }
    }

    if (result.sent || result.failed || result.retried || result.skippedUnsubscribed) {
      this.logger.log(
        `Outbox drain: ${result.sent} sent, ${result.failed} failed, ${result.retried} retried, ` +
          `${result.skippedUnsubscribed} skipped (unsubscribed)`,
      );
    }
    return result;
  }

  /**
   * Subscriber ứng với `payload.email` của row (nếu có) đã huỷ đăng ký hay
   * chưa. `findUnique` trên `email` chạy trên cột `@db.Citext` nên không cần
   * tự lowercase ở đây — DB tự so khớp không phân biệt hoa/thường (cùng bài
   * học citext ở `NewsletterService.subscribe()`).
   */
  private async isUnsubscribedRecipient(payload: Prisma.JsonValue): Promise<boolean> {
    const email = resolveRecipient(payload);
    if (!email) return false;
    const subscriber = await prisma.subscriber.findUnique({
      where: { email },
      select: { unsubscribedAt: true },
    });
    return subscriber?.unsubscribedAt != null;
  }

  /**
   * Retention (audit M5): xóa row SENT có processedAt cũ hơn `olderThanDays`.
   * FAILED giữ vĩnh viễn cho triage. Trả về số row đã xóa.
   */
  async purgeSent(olderThanDays = 30): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
    const { count } = await prisma.outbox.deleteMany({
      where: { status: OutboxStatus.SENT, processedAt: { lt: cutoff } },
    });
    if (count > 0) this.logger.log(`Outbox purge: removed ${count} SENT rows > ${olderThanDays}d`);
    return count;
  }

  /**
   * Enqueue idempotent theo dedupeKey (quy ước: docs/conventions/
   * outbox-dedupe-key.md). Key đã tồn tại → no-op, trả false.
   *
   * LƯU Ý P2: đường enqueue production là raw-SQL
   * `INSERT ... ON CONFLICT (dedupe_key) DO NOTHING` NGUYÊN TỬ trong cùng
   * CTE/transaction với state change (seat-claim, review approve…). Helper này
   * dành cho call-site ngoài transaction + test; nó mô phỏng cùng ngữ nghĩa
   * upsert-ignore bằng cách nuốt P2002.
   */
  async enqueue(
    type: EmailType,
    payload: Prisma.InputJsonValue,
    dedupeKey: string,
  ): Promise<boolean> {
    try {
      await prisma.outbox.create({ data: { type, payload, dedupeKey } });
      return true;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return false; // key đã dùng → dedupe, không phải lỗi
      }
      throw err;
    }
  }
}
