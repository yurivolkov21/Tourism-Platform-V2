import { Inject, Injectable, Logger } from '@nestjs/common';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { PaymentProvider } from '../../generated/prisma/enums.js';
import { BookingsService, type ClaimOutcome } from '../bookings/bookings.service.js';
import { withBookingRefundLock } from '../bookings/refund-lock.js';
import { deriveStatusAfterRefund } from '../bookings/refund-math.js';
import {
  PAYMENT_GATEWAYS,
  type PaymentGateway,
  resolveGateway,
  type VerifiedEvent,
} from './gateway.js';

/** Thứ mà {@link PaymentsService.handleEvent} báo lại cho webhook controller. */
export interface HandleEventResult {
  /**
   * `processed` — event đã chạy (hoặc chủ ý bỏ qua) và giờ được đánh dấu xong;
   * `duplicate` — một PaymentEvent với `[provider, eventId]` này đã được xử lý
   * rồi, không có gì chạy lại. Cả hai đều trả HTTP 200 (provider retry mãi mãi
   * khi gặp non-2xx; với họ một duplicate là THÀNH CÔNG).
   */
  status: 'processed' | 'duplicate';
  /** Kết quả claim, chỉ có ở một `payment.completed` đã processed. */
  outcome?: ClaimOutcome;
}

/** {@link PaymentsService.beginEvent}: một webhook delivery hóa ra là loại gì. */
type BeginOutcome = 'new' | 'retry' | 'duplicate';

/**
 * Idempotency cho PaymentEvent + dispatch webhook provider-neutral (spec P2
 * §3/§4 invariant #2) — port hình dạng beginEvent/finishEvent đã dày dạn trận
 * mạc của Nexora sang schema v2 (audit H4: `amount`/`currency`/`bookingId` giờ
 * là các cột thật, ghi ngay lúc begin, nên money forensics không bao giờ phải
 * parse lại payload).
 *
 * Hai lớp idempotency (giữ nguyên từ Nexora):
 *  1. **Cấp event** — `PaymentEvent @@unique([provider, eventId])`.
 *     `processedAt` đã set ⇒ duplicate thật (skip, trả 200).
 *     `processedAt` NULL ⇒ một lượt trước crash giữa chừng → CHẠY LẠI handler;
 *     an toàn nhờ lớp 2.
 *  2. **Cấp booking** — seat claim là một câu lệnh điều kiện đơn, gate trên
 *     `status = 'PENDING'` ({@link BookingsService.claimSeatsForPaid}), nên
 *     replay không bao giờ đếm trùng seat.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly bookings: BookingsService,
    @Inject(PAYMENT_GATEWAYS) private readonly gateways: PaymentGateway[],
  ) {}

  /**
   * Ghi lại event đã verify (`processedAt` NULL = "đã nhận, chưa xong").
   * `P2002` trên `[provider, eventId]` nghĩa là ta đã thấy delivery này trước
   * đó: nếu `processedAt` đã set thì đây là duplicate thật (`duplicate` —
   * skip); nếu NULL thì lượt trước chưa từng tới {@link finishEvent} (`retry` —
   * chạy lại, các handler idempotent ở cấp booking).
   */
  async beginEvent(provider: PaymentProvider, verified: VerifiedEvent): Promise<BeginOutcome> {
    try {
      await prisma.paymentEvent.create({
        data: {
          provider,
          eventId: verified.eventId,
          type: verified.type,
          payload: verified.raw as Prisma.InputJsonValue,
          // Các cột audit H4 — ghi từ payload ĐÃ VERIFY, nullable với event
          // 'other'/malformed-nhưng-đã-ký.
          amount: verified.amount ?? null,
          currency: verified.currency ?? null,
          bookingId: verified.bookingId ?? null,
        },
      });
      return 'new';
    } catch (err) {
      if (!this.isUniqueConstraintError(err)) throw err;
      const existing = await prisma.paymentEvent.findUnique({
        where: { provider_eventId: { provider, eventId: verified.eventId } },
        select: { processedAt: true },
      });
      if (existing?.processedAt) {
        this.logger.log(`Skipping duplicate ${provider} event ${verified.eventId}`);
        return 'duplicate';
      }
      this.logger.warn(
        `Re-processing ${provider} event ${verified.eventId} — prior attempt never finished`,
      );
      return 'retry';
    }
  }

  /** Đánh dấu event xong — mọi retry sau này của id này trở thành no-op thuần túy. */
  async finishEvent(provider: PaymentProvider, eventId: string): Promise<void> {
    await prisma.paymentEvent.update({
      where: { provider_eventId: { provider, eventId } },
      data: { processedAt: new Date() },
    });
  }

  /**
   * Dispatch một event đã verify signature. Được webhook controller gọi SAU khi
   * `gateway.verifyWebhook` thành công — không có gì chưa verify lọt tới đây.
   *
   * - `payment.completed` → claim PAID nguyên tử; outcome `overbooked` /
   *   `cancelled` auto-refund (invariant #3/#4).
   * - `payment.failed` → ghi lại + đánh dấu processed; booking vẫn PENDING (nó
   *   không giữ seat nào — buyer có thể retry checkout, hoặc để sweep
   *   pending-expiry dọn nó).
   * - `other` → ghi lại + đánh dấu processed (chỉ để audit log).
   */
  async handleEvent(
    provider: PaymentProvider,
    verified: VerifiedEvent,
  ): Promise<HandleEventResult> {
    const begin = await this.beginEvent(provider, verified);
    if (begin === 'duplicate') return { status: 'duplicate' };

    let outcome: ClaimOutcome | undefined;
    switch (verified.type) {
      case 'payment.completed': {
        if (!verified.bookingId) {
          this.logger.warn(
            `${provider} event ${verified.eventId} is payment.completed without a bookingId — recording only`,
          );
          break;
        }
        outcome = await this.bookings.claimSeatsForPaid(
          verified.bookingId,
          verified.providerPaymentId ?? null,
        );
        if (outcome === 'overbooked') {
          await this.refundOverbooked(provider, verified.bookingId, verified.providerPaymentId);
        } else if (outcome === 'cancelled') {
          await this.refundOrphanedCapture(
            provider,
            verified.bookingId,
            verified.providerPaymentId,
          );
        }
        break;
      }
      case 'payment.failed':
        // Hệ quả của invariant #1: PENDING không giữ seat nào, nên một payment
        // thất bại không cần bù trừ gì — log lại rồi đi tiếp.
        this.logger.log(
          `${provider} payment.failed for booking ${verified.bookingId ?? '<unknown>'} — booking stays PENDING`,
        );
        break;
      default:
        this.logger.log(`Ignoring ${provider} event type '${verified.type}' (${verified.eventId})`);
    }

    await this.finishEvent(provider, verified.eventId);
    return { status: 'processed', ...(outcome ? { outcome } : {}) };
  }

  /**
   * Invariant #3 — buyer đã trả tiền nhưng thua cuộc đua giành seat khi còn ở
   * trang hosted checkout (booking vẫn PENDING, seat không còn đủ). Refund
   * provider TRƯỚC (HTTP outbound nằm ngoài mọi DB write — và ta không bao giờ
   * ghi một refund chưa thực sự xảy ra), rồi MỘT CTE nguyên tử duy nhất:
   * booking → CANCELLED + Refund ledger row (toàn bộ amount, `adminId` NULL =
   * tự động) + outbox row BOOKING_REFUNDED. dedupeKey
   * `overbook-refund:<bookingId>` — một overbook refund hợp lệ đúng một lần cho
   * mỗi booking (quy ước `<event>:<entityId>`). EmailType: schema không có
   * REFUND_ISSUED; BOOKING_REFUNDED là email type cho refund (ngang Nexora).
   *
   * Trạng thái terminal giữ nguyên CANCELLED (KHÔNG re-derive thành REFUNDED,
   * quyết định W3): một booking overbooked chưa từng giao seat và chưa từng
   * tính là doanh thu — nó chưa từng rời PENDING — nên full refund + CANCELLED
   * là trạng thái terminal đúng của nó. Đối lập với {@link refundOrphanedCapture},
   * nơi tiền-PAID đã bị capture trên một booking đã cancelled và ledger
   * derivation cho ra REFUNDED.
   */
  private async refundOverbooked(
    provider: PaymentProvider,
    bookingId: string,
    providerPaymentId: string | undefined,
  ): Promise<void> {
    const refund = await this.issueFullAutoRefund(provider, bookingId, providerPaymentId, {
      cause: 'overbooked',
      // Hợp lệ đúng một lần cho mỗi booking → dùng booking id đặt tên cho lượt
      // thử (cùng quy ước với outbox dedupeKey bên dưới, ở phía provider).
      idempotencyKey: `overbook-refund:${bookingId}`,
    });
    // 'failed' (thiếu payment id / provider lỗi) để booking ở PENDING cho
    // operator. 'already-refunded' vẫn chạy CTE cancel bên dưới — nó đóng lại
    // crash window giữa lúc insert Refund và lúc flip khi retry (CTE là
    // idempotent, gate trên PENDING).
    if (refund === 'failed') return;

    await prisma.$queryRaw(Prisma.sql`
      WITH cancelled AS (
        UPDATE bookings b
        SET status = 'CANCELLED'::"BookingStatus",
            cancelled_at = now(),
            provider_payment_id = COALESCE(b.provider_payment_id, ${providerPaymentId ?? null}),
            updated_at = now()
        WHERE b.id = ${bookingId}::uuid AND b.status = 'PENDING'::"BookingStatus"
        RETURNING b.id, b.code, b.contact_email, b.contact_name, b.tour_title, b.total_amount, b.currency
      ),
      outbox_insert AS (
        INSERT INTO outbox (type, payload, dedupe_key)
        SELECT 'BOOKING_REFUNDED'::"EmailType",
               jsonb_build_object(
                 'bookingId', c.id,
                 'code', c.code,
                 'email', c.contact_email,
                 'name', c.contact_name,
                 'title', c.tour_title,
                 'amount', c.total_amount::text,
                 'currency', c.currency,
                 'reason', 'overbooked'
               ),
               'overbook-refund:' || c.id::text
        FROM cancelled c
        ON CONFLICT (dedupe_key) DO NOTHING
      )
      SELECT id FROM cancelled
    `);
    this.logger.warn(`Auto-refunded overbooked booking ${bookingId} (${provider}) — CANCELLED`);
  }

  /**
   * Invariant #4 — orphaned capture: payment completed SAU khi booking đã
   * CANCELLED (Nexora đã trả giá cho bài học này ở bug 7e51a24). Refund toàn bộ
   * capture + ghi Refund ledger row, rồi finalize theo ngữ nghĩa ledger W3:
   * derive Booking.status từ SUM(refunds) so với totalAmount (một full
   * auto-refund cộng lại bằng tổng → REFUNDED) + enqueue email refund, nguyên
   * tử, gate trên status='CANCELLED'.
   *
   * Khác biệt trạng thái terminal so với {@link refundOverbooked}: một orphaned
   * capture là tiền-PAID bị capture trên một booking đã cancelled — doanh thu
   * thật đã vào rồi lại đi ra, nên REFUNDED derive từ ledger là trạng thái
   * terminal trung thực. Một booking overbooked chưa từng giao seat và chưa
   * từng tính là doanh thu (nó chưa từng rời PENDING); full refund + CANCELLED
   * là trạng thái terminal đúng của nó, nên nó KHÔNG re-derive ở đây.
   *
   * PAY-R1 (ADR-0009): chỉ re-derive khi refund vừa phát MỚI (`'refunded'`).
   * `'already-refunded'` nghĩa là booking đã mang một Refund row từ path KHÁC —
   * overbook auto-refund (terminal CANCELLED) hoặc W4 cancel-approve (terminal
   * CANCELLED) — bị route nhầm vào đây khi một capture redelivery/late tới sau
   * lúc booking đã cancelled. KHÔNG re-derive các terminal đó thành REFUNDED
   * (chúng không phải orphan). Đánh đổi: một crash đúng khe giữa `refund.create`
   * và CTE flip của một orphan THẬT khiến retry (đọc thấy refund cũ →
   * 'already-refunded') để booking kẹt CANCELLED thay vì REFUNDED — tiền vẫn
   * hoàn đủ; nguồn orphan-thật duy nhất là pending-expiry (sub-project A chưa
   * dựng). `paid_at` KHÔNG phân biệt được (overbook-retry lẫn orphan-thật đều NULL).
   */
  private async refundOrphanedCapture(
    provider: PaymentProvider,
    bookingId: string,
    providerPaymentId: string | undefined,
  ): Promise<void> {
    const refund = await this.issueFullAutoRefund(provider, bookingId, providerPaymentId, {
      cause: 'orphaned capture',
      // Hợp lệ đúng một lần cho mỗi booking → dùng booking id đặt tên cho lượt
      // thử (cùng quy ước với outbox dedupeKey bên dưới, ở phía provider).
      idempotencyKey: `orphan-refund:${bookingId}`,
    });
    // PAY-R1 (ADR-0009): CHỈ re-derive REFUNDED khi refund vừa phát MỚI ('refunded')
    // — nghĩa là booking chưa có refund nào trước đó → capture này là tiền orphan
    // thật. 'already-refunded' = booking đã có refund từ path KHÁC (overbook
    // auto-refund hoặc W4 cancel-approve): terminal của nó do path đó quản, KHÔNG
    // phải orphan này — giữ nguyên CANCELLED, không re-derive, không email lần hai.
    // (Không dùng `paid_at` để phân biệt: overbook-retry và orphan-thật đều NULL.)
    if (refund !== 'refunded') return;

    // Ledger → projection, quy tắc W3 (spec §3): không bao giờ hardcode status
    // đích; derive nó từ giá trị mà ledger thực sự cộng lại.
    const [booking, ledger] = await Promise.all([
      prisma.booking.findUniqueOrThrow({
        where: { id: bookingId },
        select: { totalAmount: true },
      }),
      prisma.refund.aggregate({ where: { bookingId }, _sum: { amount: true } }),
    ]);
    const status = deriveStatusAfterRefund(
      ledger._sum.amount ?? new Prisma.Decimal(0),
      booking.totalAmount,
    );

    // dedupeKey `orphan-refund:<bookingId>` — một refund orphaned-capture hợp
    // lệ đúng một lần cho mỗi booking (quy ước `<event>:<entityId>`).
    await prisma.$queryRaw(Prisma.sql`
      WITH refunded AS (
        UPDATE bookings b
        SET status = ${status}::"BookingStatus",
            updated_at = now()
        WHERE b.id = ${bookingId}::uuid AND b.status = 'CANCELLED'::"BookingStatus"
        RETURNING b.id, b.code, b.contact_email, b.contact_name, b.tour_title, b.total_amount, b.currency
      ),
      outbox_insert AS (
        INSERT INTO outbox (type, payload, dedupe_key)
        SELECT 'BOOKING_REFUNDED'::"EmailType",
               jsonb_build_object(
                 'bookingId', c.id,
                 'code', c.code,
                 'email', c.contact_email,
                 'name', c.contact_name,
                 'title', c.tour_title,
                 'amount', c.total_amount::text,
                 'currency', c.currency,
                 'reason', 'orphaned capture'
               ),
               'orphan-refund:' || c.id::text
        FROM refunded c
        ON CONFLICT (dedupe_key) DO NOTHING
      )
      SELECT id FROM refunded
    `);
    this.logger.warn(
      `Auto-refunded orphaned capture on cancelled booking ${bookingId} (${provider}) — ${status}`,
    );
  }

  /**
   * Bước auto-refund dùng chung: refund qua gateway (toàn bộ amount) + Refund
   * ledger row.
   *
   * Idempotency: một crash sau khi gọi gateway nhưng trước `finishEvent` khiến
   * provider retry quay lại đây (khi đó claim báo `cancelled` cho một booking
   * mà CHÍNH TA đã cancel) — guard existing-Refund biến replay đó thành
   * `already-refunded`. Guard này vẫn hợp lệ khi có mặt RefundsService của W3:
   * cả hai đường auto-refund đều chạy trên các booking chưa bao giờ
   * admin-refundable được (PENDING-overbook / CANCELLED-orphan, đều nằm ngoài
   * gate admin PAID/PARTIALLY_REFUNDED), nên BẤT KỲ Refund row nào tồn tại ở
   * đây cũng chỉ có thể là một lượt thử trước của chính full auto-refund này.
   *
   * TOCTOU (ADR-0009 #4): check-existing → gateway → ghi-ledger nằm TRONG
   * `withBookingRefundLock` (cùng advisory lock của W3), nên hai delivery
   * duplicate ĐỒNG THỜI (eventId khác nhau → beginEvent không dedupe) bị
   * serialize: flow thứ hai block tới khi flow đầu commit, đọc existing-Refund
   * đã có → `already-refunded`, KHÔNG gọi gateway lần hai. Không có lock, cả hai
   * cùng đọc existing=none → double gateway call (provider W5-key dedupe được ở
   * prod, nhưng trigger `SUM≤total` sẽ ném ở ledger insert thứ hai → 500).
   */
  private async issueFullAutoRefund(
    provider: PaymentProvider,
    bookingId: string,
    providerPaymentId: string | undefined,
    opts: { cause: string; idempotencyKey: string },
  ): Promise<'refunded' | 'already-refunded' | 'failed'> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { code: true, totalAmount: true, currency: true },
    });
    if (!booking) return 'failed';
    if (!providerPaymentId) {
      this.logger.error(
        `Cannot auto-refund ${opts.cause} booking ${booking.code} — providerPaymentId missing (operator follow-up required)`,
      );
      return 'failed';
    }

    return withBookingRefundLock(bookingId, async (tx) => {
      // Re-check existing-Refund TRONG lock — điểm serialize TOCTOU. Existing-refund
      // là idempotency-signal tổng quát cho CẢ overbook (PENDING) lẫn orphan
      // (CANCELLED); dùng nó thay cho re-check status vốn overbook-specific.
      const existing = await tx.refund.findFirst({
        where: { bookingId },
        select: { id: true },
      });
      if (existing) {
        this.logger.log(
          `Booking ${booking.code} already has a Refund row — skipping ${opts.cause} auto-refund (retry)`,
        );
        return 'already-refunded';
      }

      // Gọi provider TRƯỚC ghi ledger — không bao giờ ledger một refund chưa xảy
      // ra. Chạy TRONG tx của lock (ngoại lệ có chủ đích ADR-0009) để lock giữ
      // suốt check→gateway→ledger. Provider refund thất bại để booking y nguyên
      // cho operator (ngữ nghĩa refundOrphanedCapture của Nexora).
      let providerRefundId: string;
      try {
        const gateway = resolveGateway(this.gateways, provider);
        ({ providerRefundId } = await gateway.refund({
          providerPaymentId,
          amount: booking.totalAmount.toFixed(2),
          currency: booking.currency,
          // W5: idempotency ở phía provider — một crash giữa lời gọi này và
          // finishEvent khiến provider retry quay lại; cùng một key khiến
          // provider dedupe thay vì double-refund.
          idempotencyKey: opts.idempotencyKey,
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown';
        this.logger.error(
          `${opts.cause} auto-refund failed for booking ${booking.code}: ${message}`,
        );
        return 'failed';
      }

      await tx.refund.create({
        data: {
          bookingId,
          amount: booking.totalAmount,
          currency: booking.currency,
          providerRefundId,
          adminId: null, // đường tự động (schema: null = không phải admin phát hành)
        },
      });
      return 'refunded';
    });
  }

  private isUniqueConstraintError(err: unknown): boolean {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
  }
}
