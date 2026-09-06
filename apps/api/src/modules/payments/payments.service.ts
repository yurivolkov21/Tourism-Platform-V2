import { Inject, Injectable, Logger } from '@nestjs/common';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus, type PaymentProvider } from '../../generated/prisma/enums.js';
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
   *   không giữ seat nào — buyer retry qua `bookings.checkout` (BK-1), hoặc cron
   *   sweep WRK-1 dọn nếu bỏ luôn).
   * - `payment.expired` → hủy PENDING mồ côi → CANCELLED (PAY-1, ADR-0006).
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
        // ADR-0006 AMEND 1d + AMEND 2a: đối chiếu tiền của event với booking
        // TRƯỚC khi flip PAID — flip trên số lệch là tự nhận doanh thu chưa
        // từng thu. Nhưng tiền lệch vẫn là tiền THẬT đã rời tài khoản khách:
        // hoàn ngay ở provider (vòng vá review 06/09 — bản đầu để booking
        // PENDING "cho operator" rồi sweep huỷ nó, khách mất tiền không ai hay).
        // Chỉ so khi booking còn PENDING: booking đã settle thì claim tự trả
        // `already-paid` và capture lệch đi đường dup-capture.
        const mismatch = await this.detectAmountMismatch(verified);
        if (mismatch) {
          await this.refundMismatchedCapture(provider, verified, mismatch);
          break;
        }
        outcome = await this.bookings.claimSeatsForPaid(
          verified.bookingId,
          verified.providerPaymentId ?? null,
        );
        if (outcome === 'overbooked' || outcome === 'departure-closed') {
          await this.refundUnclaimablePending(provider, verified.bookingId, verified, outcome);
        } else if (outcome === 'cancelled') {
          await this.refundOrphanedCapture(provider, verified.bookingId, verified);
        } else if (outcome === 'already-paid') {
          // ADR-0006 AMEND 1b: booking đã settle mà event mang capture KHÁC =
          // khách bị trừ tiền HAI lần — không được nuốt im lặng.
          await this.refundDuplicateCapture(provider, verified);
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
      case 'payment.expired':
        // PAY-1 (ADR-0006): checkout hết hạn → hủy PENDING mồ côi. Không giữ ghế
        // nên không bù trừ; gate status='PENDING' → idempotent với cron sweep.
        if (verified.bookingId) {
          outcome = await this.cancelExpiredPending(verified.bookingId, verified.sessionId);
        }
        break;
      default:
        this.logger.log(`Ignoring ${provider} event type '${verified.type}' (${verified.eventId})`);
    }

    await this.finishEvent(provider, verified.eventId);
    return { status: 'processed', ...(outcome ? { outcome } : {}) };
  }

  /**
   * PAY-1 (ADR-0006): checkout session hết hạn → hủy PENDING mồ côi. MỘT statement
   * nguyên tử gate `status='PENDING'` — idempotent với cron sweep (WRK-1) và với
   * retry/duplicate delivery (booking đã CANCELLED → 0 row → no-op). Không đụng
   * `seats_booked`: PENDING chưa từng claim ghế (bất biến #1). adminId/refund
   * không liên quan — chưa charge.
   *
   * AMEND 1c: gate thêm `provider_session_id = sessionId` — expired của một
   * session CŨ đến muộn (khách đã re-mint sang session mới và có thể đang trả
   * tiền trên đó) không được huỷ booking. Event không mang sessionId (gateway
   * cũ/payload thiếu) thì giữ hành vi cũ — backstop vẫn là sweep.
   */
  private async cancelExpiredPending(
    bookingId: string,
    sessionId: string | undefined,
  ): Promise<ClaimOutcome> {
    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      UPDATE bookings
      SET status = 'CANCELLED'::"BookingStatus", cancelled_at = now(), updated_at = now()
      WHERE id = ${bookingId}::uuid AND status = 'PENDING'::"BookingStatus"
        AND (${sessionId ?? null}::text IS NULL OR provider_session_id = ${sessionId ?? null}::text)
      RETURNING id
    `);
    if (rows.length > 0) {
      this.logger.log(`Booking ${bookingId} checkout expired → CANCELLED (PAY-1)`);
    } else if (sessionId) {
      this.logger.log(
        `Ignoring stale checkout-expired for booking ${bookingId} (session ${sessionId} is no longer current)`,
      );
    }
    return 'expired';
  }

  /**
   * Invariant #3 (+ ADR-0009 AMEND 1) — buyer đã trả tiền nhưng booking không
   * claim được trong khi VẪN PENDING, vì một trong hai lẽ:
   * - `overbooked`: thua cuộc đua giành seat khi còn ở trang hosted checkout;
   * - `departure-closed`: chuyến không còn OPEN / đã khởi hành lúc capture về.
   *
   * Cùng một cách xử vì cùng một sự thật — booking chưa từng rời PENDING, chưa
   * từng là doanh thu. Refund provider TRƯỚC (HTTP outbound nằm ngoài mọi DB
   * write — và ta không bao giờ ghi một refund chưa thực sự xảy ra), rồi MỘT
   * CTE nguyên tử duy nhất: booking → CANCELLED + Refund ledger row (toàn bộ
   * amount, `adminId` NULL = tự động) + outbox row BOOKING_REFUNDED. dedupeKey
   * `overbook-refund:<bookingId>` / `departure-closed-refund:<bookingId>` —
   * hợp lệ đúng một lần cho mỗi booking (quy ước `<event>:<entityId>`).
   * EmailType: schema không có REFUND_ISSUED; BOOKING_REFUNDED là email type
   * cho refund (ngang Nexora).
   *
   * Trạng thái terminal giữ nguyên CANCELLED (KHÔNG re-derive thành REFUNDED,
   * quyết định W3): booking chưa từng giao seat và chưa từng tính là doanh thu
   * — nên full refund + CANCELLED là trạng thái terminal đúng của nó. Đối lập
   * với {@link refundOrphanedCapture}, nơi tiền-PAID đã bị capture trên một
   * booking đã cancelled và ledger derivation cho ra REFUNDED.
   */
  private async refundUnclaimablePending(
    provider: PaymentProvider,
    bookingId: string,
    verified: VerifiedEvent,
    cause: 'overbooked' | 'departure-closed',
  ): Promise<void> {
    const dedupeKey =
      cause === 'overbooked'
        ? `overbook-refund:${bookingId}`
        : `departure-closed-refund:${bookingId}`;
    // 'failed' (thiếu payment id / provider lỗi) để booking ở PENDING cho
    // operator. 'already-refunded' vẫn chạy CTE cancel — nó đóng lại crash
    // window giữa lúc insert Refund và lúc flip khi retry (CTE idempotent,
    // gate trên PENDING). CTE chạy TRONG lock (AMEND 2c): một claim của
    // delivery khác phải xếp hàng sau cả cặp refund→cancel, không chen vào giữa.
    await this.issueFullAutoRefund(provider, bookingId, verified, {
      cause,
      finalize: async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          WITH cancelled AS (
            UPDATE bookings b
            SET status = 'CANCELLED'::"BookingStatus",
                cancelled_at = now(),
                provider_payment_id = COALESCE(b.provider_payment_id, ${verified.providerPaymentId ?? null}),
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
                     'reason', ${cause}::text
                   ),
                   ${dedupeKey}::text
            FROM cancelled c
            ON CONFLICT (dedupe_key) DO NOTHING
          )
          SELECT id FROM cancelled
        `);
        if (rows.length === 0) {
          // Tiền đã ra provider mà booking không còn PENDING để huỷ (khách tự
          // cancelPending đúng lúc, hoặc sweep vừa quét): KHÔNG được log như
          // thành công (vòng vá review 06/09) — ghi note để đối soát.
          const message =
            `${cause} auto-refund for booking ${bookingId} was issued but the booking ` +
            'was no longer PENDING when cancelling — no refund email sent, reconcile ledger vs provider';
          this.logger.error(message);
          await this.noteEvent(tx, provider, verified.eventId, message);
          return;
        }
        this.logger.warn(`Auto-refunded ${cause} booking ${bookingId} (${provider}) — CANCELLED`);
      },
    });
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
   * hoàn đủ; nguồn orphan-thật là một PENDING bị hủy qua pending-expiry (PAY-1
   * webhook / WRK-1 cron, ADR-0006 — nay đã dựng) rồi nhận capture đến muộn.
   * `paid_at` KHÔNG phân biệt được (overbook-retry lẫn orphan-thật đều NULL).
   */
  private async refundOrphanedCapture(
    provider: PaymentProvider,
    bookingId: string,
    verified: VerifiedEvent,
  ): Promise<void> {
    await this.issueFullAutoRefund(provider, bookingId, verified, {
      cause: 'orphaned capture',
      // PAY-R1 (ADR-0009): CHỈ re-derive REFUNDED khi refund vừa phát MỚI
      // ('refunded') — booking chưa có refund nào trước đó → capture này là
      // tiền orphan thật. 'already-refunded' = booking đã có refund từ path
      // KHÁC (overbook auto-refund hoặc W4 cancel-approve): terminal của nó
      // do path đó quản — giữ nguyên CANCELLED, không re-derive, không email
      // lần hai. (Không dùng `paid_at` để phân biệt: overbook-retry và
      // orphan-thật đều NULL.) Chạy TRONG lock (AMEND 2c).
      finalize: async (tx, result) => {
        if (result !== 'refunded') return;
        // Ledger → projection, quy tắc W3 (spec §3): không bao giờ hardcode
        // status đích; derive nó từ giá trị mà ledger thực sự cộng lại.
        const [booking, ledger] = await Promise.all([
          tx.booking.findUniqueOrThrow({ where: { id: bookingId }, select: { totalAmount: true } }),
          tx.refund.aggregate({ where: { bookingId }, _sum: { amount: true } }),
        ]);
        const status = deriveStatusAfterRefund(
          ledger._sum.amount ?? new Prisma.Decimal(0),
          booking.totalAmount,
        );
        // dedupeKey `orphan-refund:<bookingId>` — một refund orphaned-capture
        // hợp lệ đúng một lần cho mỗi booking (quy ước `<event>:<entityId>`).
        // Ghi luôn capture lên booking (AMEND 2b): guard theo capture cần nó
        // để nhận ra row sổ cũ của chính booking này ở lần redelivery sau.
        await tx.$queryRaw(Prisma.sql`
          WITH refunded AS (
            UPDATE bookings b
            SET status = ${status}::"BookingStatus",
                provider_payment_id = COALESCE(b.provider_payment_id, ${verified.providerPaymentId ?? null}),
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
      },
    });
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
    verified: VerifiedEvent,
    opts: {
      cause: string;
      /**
       * Việc phải làm NGAY SAU khi sổ đã ghi, còn TRONG lock (AMEND 2c): flip
       * booking + outbox. Đứng ngoài lock là mở khe cho một claim của delivery
       * khác chen vào giữa refund và cancel. Gọi cả khi 'already-refunded'
       * (callback tự quyết có làm gì không); KHÔNG gọi khi 'failed'.
       */
      finalize?: (
        tx: Prisma.TransactionClient,
        result: 'refunded' | 'already-refunded',
      ) => Promise<void>;
    },
  ): Promise<'refunded' | 'already-refunded' | 'failed'> {
    const providerPaymentId = verified.providerPaymentId;
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { code: true, totalAmount: true, currency: true, providerPaymentId: true },
    });
    if (!booking) return 'failed';
    if (!providerPaymentId) {
      const message = `Cannot auto-refund ${opts.cause} booking ${booking.code} — providerPaymentId missing (operator follow-up required)`;
      this.logger.error(message);
      await this.noteEvent(prisma, provider, verified.eventId, message);
      return 'failed';
    }

    return withBookingRefundLock(bookingId, async (tx) => {
      // Re-check TRONG lock — điểm serialize TOCTOU. Guard theo CAPTURE
      // (ADR-0006 AMEND 1b), không theo "đã có Refund row bất kỳ": một retry
      // của CHÍNH capture này skip, nhưng một capture KHÁC trên cùng booking
      // không còn bị nuốt. Row cũ trước migration (`providerPaymentId` null)
      // được tính là "đã hoàn capture này" khi booking chưa mang capture nào
      // (đường orphan/unclaimable không bao giờ set cột ấy — AMEND 2b) hoặc
      // capture của event trùng capture chính của booking: row null của một
      // booking chỉ có thể là khoản hoàn cho capture duy nhất nó từng nhận.
      const legacyRowIsThisCapture =
        booking.providerPaymentId === null || booking.providerPaymentId === providerPaymentId;
      const existing = await tx.refund.findFirst({
        where: {
          bookingId,
          OR: [
            { providerPaymentId },
            ...(legacyRowIsThisCapture ? [{ providerPaymentId: null }] : []),
          ],
        },
        select: { id: true },
      });
      if (existing) {
        this.logger.log(
          `Booking ${booking.code} already refunded capture ${providerPaymentId} — skipping ${opts.cause} auto-refund (retry)`,
        );
        await opts.finalize?.(tx, 'already-refunded');
        return 'already-refunded';
      }

      // Sổ đã settle mà capture NÀY chưa từng được hoàn: tiền của capture nằm
      // NGOÀI total (dup capture trên booking đã hoàn đủ qua đường khác) —
      // refund thẳng ở provider, KHÔNG ghi sổ (ghi là phá trigger SUM ≤ total).
      const ledger = await tx.refund.aggregate({
        where: { bookingId },
        _sum: { amount: true },
      });
      const alreadyRefunded = ledger._sum.amount ?? new Prisma.Decimal(0);
      const remainder = booking.totalAmount.sub(alreadyRefunded);
      const offLedger = remainder.lessThanOrEqualTo(0);

      // Gọi provider TRƯỚC ghi ledger — không bao giờ ledger một refund chưa xảy
      // ra. Chạy TRONG tx của lock (ngoại lệ có chủ đích ADR-0009) để lock giữ
      // suốt check→gateway→ledger. Provider refund thất bại để booking y nguyên
      // cho operator (ngữ nghĩa refundOrphanedCapture của Nexora).
      // Số hoàn kẹp trong phần dư của sổ khi ghi sổ (capture luôn = total ở
      // money-path này; phần dư nhỏ hơn chỉ khi một đường khác đã hoàn trước).
      const amount = offLedger
        ? booking.totalAmount
        : Prisma.Decimal.min(booking.totalAmount, remainder);
      let providerRefundId: string;
      try {
        const gateway = resolveGateway(this.gateways, provider);
        ({ providerRefundId } = await gateway.refund({
          providerPaymentId,
          amount: amount.toFixed(2),
          currency: booking.currency,
          // W5: idempotency ở phía provider — khoá theo CAPTURE (AMEND 2c):
          // một crash giữa lời gọi này và finishEvent khiến provider retry
          // quay lại, và hai delivery có thể gọi tên hai nguyên nhân khác nhau
          // cho cùng một capture (chuyến đóng giữa hai lần) — cùng key thì
          // provider dedupe thay vì hoàn hai lần. Nhánh off-ledger có key
          // riêng để phân biệt với khoản hoàn đã ghi sổ của cùng capture.
          idempotencyKey: offLedger
            ? `dup-capture:${providerPaymentId}`
            : `auto-refund:${providerPaymentId}`,
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown';
        const text = `${opts.cause} auto-refund failed for booking ${booking.code} (capture ${providerPaymentId}): ${message} — operator must refund manually`;
        this.logger.error(text);
        await this.noteEvent(tx, provider, verified.eventId, text);
        return 'failed';
      }

      if (offLedger) {
        const text =
          `DUPLICATE CAPTURE on settled booking ${booking.code}: ${providerPaymentId} ` +
          `(${amount.toFixed(2)} ${booking.currency}, cause ${opts.cause}) auto-refunded as ${providerRefundId} — NOT ledgered (money outside the booking total)`;
        this.logger.error(text);
        // Dấu vết DB duy nhất của khoản hoàn ngoài sổ (AMEND 2a): không có
        // Refund row (trigger SUM ≤ total), nên note của chính event là nơi
        // đối soát nhìn thấy nó.
        await this.noteEvent(tx, provider, verified.eventId, text);
        // 'already-refunded' để caller giữ nguyên terminal hiện có: không
        // re-derive (orphan path), không email refund lần hai.
        await opts.finalize?.(tx, 'already-refunded');
        return 'already-refunded';
      }

      await tx.refund.create({
        data: {
          bookingId,
          amount,
          currency: booking.currency,
          providerRefundId,
          providerPaymentId, // capture được hoàn — nguồn cho guard phía trên
          adminId: null, // đường tự động (schema: null = không phải admin phát hành)
        },
      });
      await opts.finalize?.(tx, 'refunded');
      return 'refunded';
    });
  }

  /**
   * Ghi lý do/kết quả vào cột `note` của chính audit row (ADR-0006 AMEND 2a):
   * mọi khoản tiền đi qua handler mà KHÔNG thành Refund row — từ chối vì lệch
   * tiền, hoàn ngoài sổ, hoàn thất bại — phải để lại một dòng ở DB, không chỉ
   * ở log. Cắt 500 ký tự theo cột.
   */
  private async noteEvent(
    db: Prisma.TransactionClient | typeof prisma,
    provider: PaymentProvider,
    eventId: string,
    text: string,
  ): Promise<void> {
    await db.paymentEvent.update({
      where: { provider_eventId: { provider, eventId } },
      data: { note: text.slice(0, 500) },
    });
  }

  /**
   * ADR-0006 AMEND 1d — lý do từ chối một `payment.completed` có tiền LỆCH với
   * booking, hoặc null khi khớp/không so được. Event không mang amount/currency
   * (PayPal APPROVED, payload malformed-nhưng-đã-ký) thì bỏ qua bước so — các
   * cột audit H4 vẫn nullable đúng như beginEvent đã ghi.
   */
  private async detectAmountMismatch(verified: VerifiedEvent): Promise<string | null> {
    if (!verified.bookingId || !verified.amount || !verified.currency) return null;
    const booking = await prisma.booking.findUnique({
      where: { id: verified.bookingId },
      select: { code: true, status: true, totalAmount: true, currency: true },
    });
    // Booking lạ → để claimSeatsForPaid trả 'not-found' như cũ (log-and-skip).
    // Booking đã settle → claim trả 'already-paid' và capture (lệch hay không)
    // đi đường dup-capture — so ở đây chỉ chặn nhầm nhánh ấy (AMEND 2a).
    if (!booking || booking.status !== BookingStatus.PENDING) return null;
    const eventAmount = new Prisma.Decimal(verified.amount);
    // Currency so KHÔNG phân biệt hoa/thường: gateway đã upper-case phía event,
    // nhưng cột booking chép nguyên từ tour và không có CHECK nào ép chữ hoa.
    if (
      !eventAmount.equals(booking.totalAmount) ||
      verified.currency.toUpperCase() !== booking.currency.toUpperCase()
    ) {
      return (
        `amount mismatch: event says ${verified.amount} ${verified.currency}, ` +
        `booking ${booking.code} expects ${booking.totalAmount.toFixed(2)} ${booking.currency} — not claimed`
      );
    }
    return null;
  }

  /**
   * ADR-0006 AMEND 2a — capture LỆCH tiền trên booking còn PENDING: không
   * claim (không nhận doanh thu chưa từng thu), nhưng cũng không giữ tiền của
   * khách: hoàn NGAY đúng số event khai, ngoài sổ (booking chưa từng PAID nên
   * sổ của nó chưa có gì để đo), idempotency `mismatch-refund:<capture>`.
   * Booking ở lại PENDING — khách trả lại đúng tiền thì claim bình thường,
   * bỏ luôn thì sweep dọn. Kết cục nào cũng ghi `note`; event vẫn processed
   * (provider retry không đổi được gì).
   */
  private async refundMismatchedCapture(
    provider: PaymentProvider,
    verified: VerifiedEvent,
    mismatch: string,
  ): Promise<void> {
    this.logger.error(`${provider} event ${verified.eventId} REJECTED before claim: ${mismatch}`);
    if (!verified.providerPaymentId || !verified.amount || !verified.currency) {
      const text = `${mismatch}; event carries no capture id/amount to refund — operator must refund manually`;
      this.logger.error(text);
      await this.noteEvent(prisma, provider, verified.eventId, text);
      return;
    }
    try {
      const gateway = resolveGateway(this.gateways, provider);
      const { providerRefundId } = await gateway.refund({
        providerPaymentId: verified.providerPaymentId,
        amount: verified.amount,
        currency: verified.currency,
        idempotencyKey: `mismatch-refund:${verified.providerPaymentId}`,
      });
      const text = `${mismatch}; capture ${verified.providerPaymentId} auto-refunded as ${providerRefundId} (${verified.amount} ${verified.currency}, not ledgered)`;
      this.logger.error(text);
      await this.noteEvent(prisma, provider, verified.eventId, text);
    } catch (err) {
      const text = `${mismatch}; auto-refund of capture ${verified.providerPaymentId} FAILED (${err instanceof Error ? err.message : 'unknown'}) — operator must refund manually`;
      this.logger.error(text);
      await this.noteEvent(prisma, provider, verified.eventId, text);
    }
  }

  /**
   * ADR-0006 AMEND 1b — capture THỨ HAI trên một booking đã settle
   * (claim outcome `already-paid`, event mang `providerPaymentId` KHÁC với
   * capture đã ghi trên booking): auto-refund NGAY khoản thừa qua gateway.
   *
   * CỐ Ý KHÔNG ghi sổ `refunds`: sổ đo tiền hoàn so với `total_amount` của
   * booking (trigger ADR-0009 `SUM ≤ total`); capture thừa là tiền NGOÀI total
   * — ghi vào là vừa phá trigger vừa chặn refund hợp lệ về sau. Idempotency
   * nằm ở provider key `dup-capture:<providerPaymentId>`; dấu vết DB là `note`
   * của chính event (AMEND 2a). Hoàn ĐÚNG số event khai — không đoán bằng
   * total của booking; thiếu số thì để operator (vòng vá review 06/09).
   */
  private async refundDuplicateCapture(
    provider: PaymentProvider,
    verified: VerifiedEvent,
  ): Promise<void> {
    if (!verified.bookingId || !verified.providerPaymentId) return;
    const booking = await prisma.booking.findUnique({
      where: { id: verified.bookingId },
      select: { code: true, providerPaymentId: true },
    });
    if (!booking) return;
    // Cùng capture = một retry vô hại của event đã settle → no-op.
    if (booking.providerPaymentId === verified.providerPaymentId) return;
    const capture = verified.providerPaymentId;
    if (!booking.providerPaymentId) {
      // Booking settle mà không mang capture (claim từng nhận event thiếu
      // capture id): không đối chiếu được — không dám hoàn, nhưng cũng không
      // im lặng.
      const text = `DUPLICATE CAPTURE? booking ${booking.code} is settled without a recorded capture; event capture ${capture} left untouched — operator must reconcile`;
      this.logger.error(text);
      await this.noteEvent(prisma, provider, verified.eventId, text);
      return;
    }
    if (!verified.amount || !verified.currency) {
      const text = `DUPLICATE CAPTURE on booking ${booking.code}: ${capture} on top of ${booking.providerPaymentId}, but the event carries no amount — operator must refund manually`;
      this.logger.error(text);
      await this.noteEvent(prisma, provider, verified.eventId, text);
      return;
    }

    try {
      const gateway = resolveGateway(this.gateways, provider);
      const { providerRefundId } = await gateway.refund({
        providerPaymentId: capture,
        amount: verified.amount,
        currency: verified.currency,
        idempotencyKey: `dup-capture:${capture}`,
      });
      const text =
        `DUPLICATE CAPTURE on booking ${booking.code}: ${capture} (${verified.amount} ${verified.currency}) ` +
        `captured on top of ${booking.providerPaymentId} — auto-refunded as ${providerRefundId} (${provider}, not ledgered)`;
      this.logger.error(text);
      await this.noteEvent(prisma, provider, verified.eventId, text);
    } catch (err) {
      const text =
        `DUPLICATE CAPTURE on booking ${booking.code}: ${capture} (${verified.amount} ${verified.currency}) ` +
        `and the auto-refund FAILED (${err instanceof Error ? err.message : 'unknown'}) — operator must refund manually`;
      this.logger.error(text);
      await this.noteEvent(prisma, provider, verified.eventId, text);
    }
  }

  private isUniqueConstraintError(err: unknown): boolean {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
  }
}
