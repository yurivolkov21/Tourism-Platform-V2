import { Inject, Injectable, Logger } from '@nestjs/common';
import { OUTBOX_MAX_ATTEMPTS } from '@tourism/contract';
import { prisma } from '../auth/auth.config.js';
import { Prisma } from '../generated/prisma/client.js';
import { EmailType, OutboxStatus } from '../generated/prisma/enums.js';
import { isMailableSubscriber } from '../modules/newsletter/mailable.js';
import { EMAIL_DELIVERER, type EmailDeliverer, isPermanentDeliveryError } from './deliverer.js';
import { resolveRecipient } from './recipient.js';

/** Mỗi lượt drain lấy tối đa bấy nhiêu row PENDING (oldest-first). */
const DRAIN_BATCH_SIZE = 50;
/**
 * Quá số lần thử này thì row bị park FAILED chờ operator (giữ để triage).
 * Giá trị sống ở CONTRACT từ F7 (spec P4c §3-F7): cột "3/5" của trang
 * `/outbox` đọc cùng hằng đó — đây chỉ là tên cũ giữ cho worker/test.
 */
export const MAX_ATTEMPTS = OUTBOX_MAX_ATTEMPTS;
/** Trần cột `last_error` (VarChar(1000)). */
const LAST_ERROR_MAX = 1000;
/** Row FAILED giữ để triage tối đa bấy nhiêu ngày rồi purge (vòng vá review W4). */
export const FAILED_RETENTION_DAYS = 180;

/**
 * Loại email coi là "bản tin" — chịu chi phối bởi `unsubscribedAt` của
 * Subscriber (spec §4.4: "worker bỏ qua subscriber có unsubscribedAt ≠
 * null"). Set riêng thay vì mọi EmailType: các email giao dịch khác
 * (BOOKING_CONFIRMATION, REVIEW_APPROVED…) không liên quan tới bảng
 * subscribers — subscriber huỷ đăng ký bản tin không có nghĩa họ ngừng nhận
 * email xác nhận đơn hàng của chính họ.
 */
const NEWSLETTER_EMAIL_TYPES: ReadonlySet<EmailType> = new Set([EmailType.NEWSLETTER_WELCOME]);

/**
 * Email AUTH — đường duy nhất để chủ tài khoản lấy lại quyền vào tài khoản
 * (vòng vá review W4, ADR-0039 AMEND 1). Bounce vĩnh viễn vẫn chặn (địa chỉ
 * chết là chết), nhưng ghi WARN riêng: đây là ca operator cần nhìn — người
 * đó mất reset mật khẩu cho tới khi suppression được gỡ bằng SQL.
 */
const AUTH_EMAIL_TYPES: ReadonlySet<EmailType> = new Set([
  EmailType.PASSWORD_RESET,
  EmailType.EMAIL_VERIFICATION,
  EmailType.EMAIL_OTP,
  EmailType.EMAIL_CHANGED,
]);

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
  /**
   * Người nhận nằm trong `email_suppressions` (bounce cứng/complaint từ
   * Resend — W4 E6, ADR-0039 §4) — SKIPPED với lý do trong `lastError`.
   * Khác `skippedUnsubscribed` ở PHẠM VI: suppression chặn MỌI loại email
   * (địa chỉ chết là chết với cả email giao dịch), không riêng bản tin.
   */
  skippedSuppressed: number;
}

/**
 * Suppression có áp cho loại email này không (thuần, ADR-0039 AMEND 1):
 * `bounced` → mọi loại; `complained` → chỉ bản tin; lý do lạ (nguồn khác
 * ghi tay) → coi như bounced (phía an toàn).
 */
export function suppressionApplies(reason: string, type: EmailType): boolean {
  if (reason === 'complained') return NEWSLETTER_EMAIL_TYPES.has(type);
  return true;
}

/**
 * Backoff luỹ thừa (W4 E5, ADR-0039 §4): 2^attempts PHÚT, trần 60 phút —
 * một sự cố provider kéo dài không đẩy lịch hẹn ra vô tận, và hàng đợi
 * không còn đốt sạch attempts trong 5 phút drain-mỗi-phút như trước.
 */
export function backoffDelayMs(attempts: number): number {
  return Math.min(2 ** attempts, 60) * 60_000;
}

/**
 * Logic thuần cho state-machine retry: attempts cũ → (attempts mới, status,
 * lịch hẹn lượt sau). Tách khỏi service để unit-test không cần DB.
 *
 * `permanent` (W4 E5): lỗi 4xx-không-phải-429 — FAILED NGAY, không xếp lịch
 * (gửi lại y nguyên chỉ ra y kết quả); attempts vẫn +1 để triage thấy đã thử.
 */
export function nextAttemptState(
  prevAttempts: number,
  opts: { now?: Date; permanent?: boolean } = {},
): {
  attempts: number;
  status: typeof OutboxStatus.PENDING | typeof OutboxStatus.FAILED;
  nextAttemptAt: Date | null;
} {
  const now = opts.now ?? new Date();
  const attempts = prevAttempts + 1;
  const status =
    opts.permanent || attempts >= MAX_ATTEMPTS ? OutboxStatus.FAILED : OutboxStatus.PENDING;
  return {
    attempts,
    status,
    nextAttemptAt:
      status === OutboxStatus.PENDING ? new Date(now.getTime() + backoffDelayMs(attempts)) : null,
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
      // W4 E5: chỉ lấy row ĐÃ TỚI GIỜ — null là tới hạn ngay (row mới hoặc
      // trước W4), còn row đang backoff chờ đúng lịch của nó, không quay lại
      // đầu batch mỗi phút đốt attempts.
      where: {
        status: OutboxStatus.PENDING,
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
      },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    const result: DrainResult = {
      sent: 0,
      failed: 0,
      retried: 0,
      skippedUnsubscribed: 0,
      skippedSuppressed: 0,
    };
    for (const row of rows) {
      // W4 E6 (+ vòng vá review W4, ADR-0039 AMEND 1): suppression kiểm TRƯỚC.
      // Phạm vi theo LÝ DO: `bounced` (địa chỉ chết) chặn MỌI loại — gửi
      // tiếp là đốt uy tín domain; `complained` (bấm spam một bản tin) chỉ
      // chặn BẢN TIN — khách bấm spam một welcome không được vì thế mất
      // reset mật khẩu hay xác nhận đơn của chính họ.
      const suppression = await this.suppressionOfRecipient(row.payload);
      if (suppression && suppressionApplies(suppression.reason, row.type)) {
        if (suppression.reason === 'bounced' && AUTH_EMAIL_TYPES.has(row.type)) {
          this.logger.warn(
            `Outbox: auth email ${row.type} skipped — recipient suppressed (${suppression.source}); lift the suppression by SQL if the address is alive`,
          );
        }
        await prisma.outbox.updateMany({
          where: { id: row.id, status: OutboxStatus.PENDING },
          data: {
            status: OutboxStatus.SKIPPED,
            processedAt: new Date(),
            // Lý do vào lastError cho admin outbox đọc được vì sao thư này
            // không bao giờ đi (spec E6).
            lastError: `suppressed: ${suppression.reason} (${suppression.source})`,
          },
        });
        result.skippedSuppressed += 1;
        continue;
      }
      if (
        NEWSLETTER_EMAIL_TYPES.has(row.type) &&
        (await this.isBlockedNewsletterRecipient(row.type, row.payload))
      ) {
        // Bỏ qua NGAY, không gọi deliverer — đánh dấu SKIPPED (trạng thái
        // riêng, vòng vá review F7: trước là SENT nên card "Sent" của admin đếm
        // cả email chưa từng tới Resend) để row không kẹt ở đầu hàng đợi
        // PENDING (batch luôn lấy cũ nhất trước, xem `orderBy: createdAt asc`
        // ở trên) và chặn các email khác phía sau. `processedAt` vẫn ghi: purge
        // dọn SKIPPED cùng lịch với SENT.
        await prisma.outbox.updateMany({
          where: { id: row.id, status: OutboxStatus.PENDING },
          data: { status: OutboxStatus.SKIPPED, processedAt: new Date() },
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
        // W4 E5: 4xx (trừ 429) là lỗi VĨNH VIỄN → FAILED ngay; lỗi tạm xếp
        // lịch backoff luỹ thừa thay vì quay lại đầu batch phút sau.
        const { attempts, status, nextAttemptAt } = nextAttemptState(row.attempts, {
          permanent: isPermanentDeliveryError(err),
        });
        const lastError = trimError(err);
        await prisma.outbox.updateMany({
          where: { id: row.id, status: OutboxStatus.PENDING },
          data: { attempts, status, lastError, nextAttemptAt },
        });
        if (status === OutboxStatus.FAILED) result.failed += 1;
        else result.retried += 1;
        this.logger.warn(
          `Outbox ${row.id} (${row.type}) deliver failed (attempt ${attempts}/${MAX_ATTEMPTS}, now ${status}): ${lastError}`,
        );
      }
    }

    if (
      result.sent ||
      result.failed ||
      result.retried ||
      result.skippedUnsubscribed ||
      result.skippedSuppressed
    ) {
      this.logger.log(
        `Outbox drain: ${result.sent} sent, ${result.failed} failed, ${result.retried} retried, ` +
          `${result.skippedUnsubscribed} skipped (unsubscribed), ` +
          `${result.skippedSuppressed} skipped (suppressed)`,
      );
    }
    return result;
  }

  /**
   * Suppression ứng với người nhận thật của row (W4 E6) — cùng
   * `resolveRecipient` với deliverer nên không có chuyện kiểm một địa chỉ
   * mà gửi địa chỉ khác. Cột `email` là citext — DB tự so không phân biệt
   * hoa/thường.
   */
  private async suppressionOfRecipient(
    payload: Prisma.JsonValue,
  ): Promise<{ reason: string; source: string } | null> {
    const email = resolveRecipient(payload);
    if (!email) return null;
    return prisma.emailSuppression.findUnique({
      where: { email },
      select: { reason: true, source: true },
    });
  }

  /**
   * Bản tin tới người nhận này có bị chặn không. Thư XÁC NHẬN
   * (NEWSLETTER_WELCOME) chỉ tránh row đã huỷ — nó là thư đi xin consent nên
   * gửi tới row chưa xác nhận là đúng. Mọi loại bản tin KHÁC (campaign tương
   * lai) phải qua predicate mailable chung (`isMailableSubscriber`, ADR-0039
   * §2): chưa xác nhận hoặc đã huỷ đều chặn. `findUnique` trên `email` chạy
   * trên cột `@db.Citext` nên không cần tự lowercase — DB tự so khớp không
   * phân biệt hoa/thường (cùng bài học citext ở `NewsletterService.subscribe()`).
   */
  private async isBlockedNewsletterRecipient(
    type: EmailType,
    payload: Prisma.JsonValue,
  ): Promise<boolean> {
    const email = resolveRecipient(payload);
    if (!email) return false;
    const subscriber = await prisma.subscriber.findUnique({
      where: { email },
      select: { unsubscribedAt: true, confirmedAt: true },
    });
    if (!subscriber) return false;
    if (type === EmailType.NEWSLETTER_WELCOME) return subscriber.unsubscribedAt !== null;
    return !isMailableSubscriber(subscriber);
  }

  /**
   * Retention (audit M5): xóa row SENT/SKIPPED có processedAt cũ hơn
   * `olderThanDays` — SKIPPED cùng lịch với SENT (vòng vá review F7: đó là
   * "đã xử lý xong, không có gì để triage"). FAILED giữ cho triage nhưng
   * KHÔNG vĩnh viễn (vòng vá review W4): payload mang PII (tên, email, nội
   * dung enquiry) — giữ mãi là vượt retention 18 tháng của chính enquiry
   * (ADR-0039 §6); trần `FAILED_RETENTION_DAYS` tính theo `createdAt` (row
   * FAILED không có processedAt). Trả về tổng số row đã xóa.
   */
  async purgeSent(olderThanDays = 30): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
    const { count } = await prisma.outbox.deleteMany({
      where: {
        status: { in: [OutboxStatus.SENT, OutboxStatus.SKIPPED] },
        processedAt: { lt: cutoff },
      },
    });
    if (count > 0) {
      this.logger.log(`Outbox purge: removed ${count} SENT/SKIPPED rows > ${olderThanDays}d`);
    }
    const failedCutoff = new Date(Date.now() - FAILED_RETENTION_DAYS * 86_400_000);
    const { count: failed } = await prisma.outbox.deleteMany({
      where: { status: OutboxStatus.FAILED, createdAt: { lt: failedCutoff } },
    });
    if (failed > 0) {
      this.logger.log(`Outbox purge: removed ${failed} FAILED rows > ${FAILED_RETENTION_DAYS}d`);
    }
    return count + failed;
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
