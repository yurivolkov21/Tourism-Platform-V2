import { Inject, Injectable, Logger } from '@nestjs/common';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { PaymentProvider } from '../../generated/prisma/enums.js';
import { BookingsService, type ClaimOutcome } from '../bookings/bookings.service.js';
import {
  PAYMENT_GATEWAYS,
  type PaymentGateway,
  resolveGateway,
  type VerifiedEvent,
} from './gateway.js';

/** What {@link PaymentsService.handleEvent} tells the webhook controller. */
export interface HandleEventResult {
  /**
   * `processed` — the event ran (or was consciously ignored) and is now marked
   * done; `duplicate` — a PaymentEvent with this `[provider, eventId]` was
   * already processed, nothing re-ran. Both answer HTTP 200 (providers retry
   * on non-2xx forever; a duplicate is a SUCCESS from their point of view).
   */
  status: 'processed' | 'duplicate';
  /** Claim outcome, present only for a processed `payment.completed`. */
  outcome?: ClaimOutcome;
}

/** {@link PaymentsService.beginEvent}: what a webhook delivery turned out to be. */
type BeginOutcome = 'new' | 'retry' | 'duplicate';

/**
 * PaymentEvent idempotency + provider-neutral webhook dispatch (spec P2 §3/§4
 * invariant #2) — port of Nexora's battle-tested beginEvent/finishEvent shape
 * onto the v2 schema (audit H4: `amount`/`currency`/`bookingId` are now real
 * columns written at begin time, so money forensics never re-parse payloads).
 *
 * Two idempotency layers (unchanged from Nexora):
 *  1. **Event-level** — `PaymentEvent @@unique([provider, eventId])`.
 *     `processedAt` set ⇒ true duplicate (skip, answer 200).
 *     `processedAt` NULL ⇒ a prior attempt crashed mid-flight → RE-RUN the
 *     handler; that is safe because of layer 2.
 *  2. **Booking-level** — the seat claim is a single conditional statement
 *     gated on `status = 'PENDING'` ({@link BookingsService.claimSeatsForPaid}),
 *     so replays can never double-count seats.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly bookings: BookingsService,
    @Inject(PAYMENT_GATEWAYS) private readonly gateways: PaymentGateway[],
  ) {}

  /**
   * Records the verified event (`processedAt` NULL = "received, not finished").
   * `P2002` on `[provider, eventId]` means we have seen this delivery before:
   * with `processedAt` set it is a true duplicate (`duplicate` — skip); with
   * NULL the prior attempt never reached {@link finishEvent} (`retry` —
   * re-run, handlers are idempotent at booking level).
   */
  async beginEvent(provider: PaymentProvider, verified: VerifiedEvent): Promise<BeginOutcome> {
    try {
      await prisma.paymentEvent.create({
        data: {
          provider,
          eventId: verified.eventId,
          type: verified.type,
          payload: verified.raw as Prisma.InputJsonValue,
          // Audit H4 columns — written from the VERIFIED payload, nullable on
          // 'other'/malformed-but-signed events.
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

  /** Marks the event done — every later retry of this id becomes a pure no-op. */
  async finishEvent(provider: PaymentProvider, eventId: string): Promise<void> {
    await prisma.paymentEvent.update({
      where: { provider_eventId: { provider, eventId } },
      data: { processedAt: new Date() },
    });
  }

  /**
   * Dispatches a signature-verified event. Called by the webhook controller
   * AFTER `gateway.verifyWebhook` succeeded — nothing unverified gets here.
   *
   * - `payment.completed` → atomic PAID claim; `overbooked` / `cancelled`
   *   outcomes auto-refund (invariants #3/#4).
   * - `payment.failed` → record + mark processed; the booking stays PENDING
   *   (it holds no seats — the buyer can retry checkout, or the pending-expiry
   *   sweep reaps it).
   * - `other` → record + mark processed (audit log only).
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
        // Invariant #1 corollary: PENDING holds no seats, so a failed payment
        // needs no compensation — log it and move on.
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
   * Invariant #3 — the buyer paid but lost the seat race while on the hosted
   * checkout page (booking still PENDING, seats no longer fit). Provider
   * refund FIRST (outbound HTTP stays outside any DB write — and we never
   * record a refund that did not happen), then ONE atomic CTE: booking →
   * CANCELLED + Refund ledger row (full amount, `adminId` NULL = automatic) +
   * BOOKING_REFUNDED outbox row. dedupeKey `overbook-refund:<bookingId>` —
   * an overbook refund is legitimate exactly once per booking (convention
   * `<event>:<entityId>`). EmailType: the schema has no REFUND_ISSUED;
   * BOOKING_REFUNDED is the refund email type (Nexora parity).
   */
  private async refundOverbooked(
    provider: PaymentProvider,
    bookingId: string,
    providerPaymentId: string | undefined,
  ): Promise<void> {
    const refund = await this.issueFullAutoRefund(provider, bookingId, providerPaymentId, {
      cause: 'overbooked',
    });
    // 'failed' (no payment id / provider error) leaves the booking PENDING for
    // an operator. 'already-refunded' still runs the cancel CTE below — it
    // closes the crash window between the Refund insert and the flip on a
    // retry (the CTE is idempotent, gated on PENDING).
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
   * Invariant #4 — orphaned capture: the payment completed AFTER the booking
   * was already CANCELLED (Nexora paid for this lesson in bug 7e51a24). W2
   * MINIMAL behavior: refund the capture in full + record the Refund ledger
   * row, and LEAVE the booking CANCELLED — we deliberately do NOT set
   * REFUNDED here, because W3's RefundsService owns status derivation from
   * SUM(refunds) vs totalAmount (the ledger is the source of truth, status a
   * projection — spec §3). W3 will re-derive this booking to REFUNDED and own
   * the refund email; W2 enqueues nothing for this path.
   */
  private async refundOrphanedCapture(
    provider: PaymentProvider,
    bookingId: string,
    providerPaymentId: string | undefined,
  ): Promise<void> {
    const refund = await this.issueFullAutoRefund(provider, bookingId, providerPaymentId, {
      cause: 'orphaned capture',
    });
    if (refund === 'refunded') {
      this.logger.warn(
        `Auto-refunded orphaned capture on cancelled booking ${bookingId} (${provider}) — status derivation deferred to W3 RefundsService`,
      );
    }
  }

  /**
   * Shared auto-refund step: gateway refund (full amount) + Refund ledger row.
   *
   * Idempotency: a crash after the gateway call but before `finishEvent` makes
   * the provider retry re-enter here (the claim then reports `cancelled` for a
   * booking WE cancelled) — the existing-Refund guard turns that replay into
   * `already-refunded`. Safe in W2 because auto-full-refunds are the ONLY
   * Refund writers until W3; W3's RefundsService replaces this guard with
   * ledger math (SUM(refunds) vs totalAmount).
   */
  private async issueFullAutoRefund(
    provider: PaymentProvider,
    bookingId: string,
    providerPaymentId: string | undefined,
    opts: { cause: string },
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
    const existing = await prisma.refund.findFirst({ where: { bookingId }, select: { id: true } });
    if (existing) {
      this.logger.log(
        `Booking ${booking.code} already has a Refund row — skipping ${opts.cause} auto-refund (retry)`,
      );
      return 'already-refunded';
    }

    // Provider call FIRST and OUTSIDE any DB write — never ledger a refund
    // that did not happen. A failed provider refund leaves the booking as-is
    // for an operator (Nexora refundOrphanedCapture semantics).
    let providerRefundId: string;
    try {
      const gateway = resolveGateway(this.gateways, provider);
      ({ providerRefundId } = await gateway.refund({
        providerPaymentId,
        amount: booking.totalAmount.toFixed(2),
        currency: booking.currency,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      this.logger.error(`${opts.cause} auto-refund failed for booking ${booking.code}: ${message}`);
      return 'failed';
    }

    await prisma.refund.create({
      data: {
        bookingId,
        amount: booking.totalAmount,
        currency: booking.currency,
        providerRefundId,
        adminId: null, // automatic path (schema: null = not admin-issued)
      },
    });
    return 'refunded';
  }

  private isUniqueConstraintError(err: unknown): boolean {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
  }
}
