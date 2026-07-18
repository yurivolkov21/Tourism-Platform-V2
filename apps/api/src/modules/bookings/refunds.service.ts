import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AdminRefundResult, Refund as RefundView } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus, EmailType, type PaymentProvider } from '../../generated/prisma/enums.js';
import { PAYMENT_GATEWAYS, type PaymentGateway, resolveGateway } from '../payments/gateway.js';
import { toBooking } from './bookings.service.js';
import {
  classifyRefundAmount,
  deriveStatusAfterRefund,
  RefundNothingLeftError,
} from './refund-math.js';

/** No booking with this code (admin surface: a plain 404, nothing to hide). */
export class BookingNotFoundError extends Error {
  constructor(code: string) {
    super(`Booking "${code}" not found`);
  }
}

/**
 * Refund gate failed: status outside PAID/PARTIALLY_REFUNDED, or no captured
 * payment to refund against. Ported from Nexora's `BOOKING_NOT_REFUNDABLE`
 * gate (PAID-only) and EXTENDED with PARTIALLY_REFUNDED — the ledger makes
 * partial refunds accumulate (spec P2 §4 invariant #5), so a partially
 * refunded booking is still refundable until the ledger sums to the total.
 */
export class BookingNotRefundableError extends Error {
  constructor(status: BookingStatus, hasCapturedPayment: boolean) {
    super(
      hasCapturedPayment
        ? `Booking is ${status}; only a PAID or PARTIALLY_REFUNDED booking can be refunded`
        : 'Booking has no captured payment to refund against',
    );
  }
}

/** The provider refused/failed the refund call — nothing was ledgered. */
export class ProviderRefundFailedError extends Error {
  constructor(detail: string) {
    super(`Provider refund failed: ${detail}`);
  }
}

type RefundRow = Prisma.RefundModel;

/** Refund ledger row → contract shape (money as string, same conventions). */
function toRefund(row: RefundRow): RefundView {
  return {
    id: row.id,
    amount: row.amount.toString(),
    currency: row.currency,
    providerRefundId: row.providerRefundId,
    adminId: row.adminId,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Refund ledger service (spec P2 §3, W3 — the audit-H1 upgrade): Refund rows
 * are APPEND-ONLY and the source of truth; `Booking.status` is a stored
 * projection derived from SUM(refunds) vs totalAmount, and every
 * refund-related transition goes through here (or the W2 auto-refund paths in
 * PaymentsService, which follow the same ledger semantics).
 */
@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(@Inject(PAYMENT_GATEWAYS) private readonly gateways: PaymentGateway[]) {}

  /**
   * Admin-issued (partial) refund, ported from Nexora `refundByAdmin` onto the
   * ledger. Order of operations is the W2 principle:
   *
   *  1. Gate + classify against the ledger (`classifyRefundAmount` on
   *     total vs SUM(refunds) — throws the typed 422 domain errors).
   *  2. Provider refund FIRST, outside any transaction — we never ledger a
   *     refund that did not happen, and provider HTTP latency never holds a
   *     DB connection.
   *  3. ONE transaction: append the Refund row (adminId set) → re-derive
   *     Booking.status via {@link deriveStatusAfterRefund} → enqueue the
   *     BOOKING_REFUNDED outbox row. dedupeKey `refund:<bookingId>:<refundRowId>`
   *     — refunds legitimately repeat per booking, and the refund row id is
   *     unique per refund, satisfying the convention's repeat-event rule
   *     (docs/conventions/outbox-dedupe-key.md).
   *
   * `reason` is carried in the outbox payload ONLY — the Refund model has no
   * reason column on purpose (audit: the ledger stores money facts; free-text
   * context belongs to the notification, schema stays as audited).
   *
   * Unlike Nexora, a FULL admin refund does NOT release seats or set
   * cancelledAt here: seat release belongs to the cancellation flow (W4
   * approve → refund); an admin goodwill refund of a still-travelling booking
   * must not free its seats.
   */
  async refundByAdmin(
    adminUserId: string,
    bookingCode: string,
    input: { amount?: string; reason?: string },
  ): Promise<AdminRefundResult> {
    const booking = await prisma.booking.findUnique({ where: { code: bookingCode } });
    if (!booking) throw new BookingNotFoundError(bookingCode);
    // REFUNDED gets the precise error (the ledger is settled), before the
    // generic status gate — same 422 class, better operator signal.
    if (booking.status === BookingStatus.REFUNDED) throw new RefundNothingLeftError();
    const refundableStatus =
      booking.status === BookingStatus.PAID || booking.status === BookingStatus.PARTIALLY_REFUNDED;
    if (!refundableStatus || !booking.providerPaymentId) {
      throw new BookingNotRefundableError(booking.status, booking.providerPaymentId != null);
    }

    const ledger = await prisma.refund.aggregate({
      where: { bookingId: booking.id },
      _sum: { amount: true },
    });
    const alreadyRefunded = ledger._sum.amount ?? new Prisma.Decimal(0);
    const { kind, amount } = classifyRefundAmount({
      requested: input.amount ?? null,
      total: booking.totalAmount,
      alreadyRefunded,
    });

    // Provider refund FIRST (see doc above). A failure surfaces as a typed
    // error and leaves booking + ledger untouched — the admin just retries.
    const providerRefundId = await this.executeGatewayRefund(
      { ...booking, providerPaymentId: booking.providerPaymentId },
      amount,
    );

    const nextStatus = deriveStatusAfterRefund(alreadyRefunded.add(amount), booking.totalAmount);
    const updated = await prisma.$transaction(async (tx) => {
      const refundRow = await tx.refund.create({
        data: {
          bookingId: booking.id,
          amount,
          currency: booking.currency,
          providerRefundId,
          adminId: adminUserId,
        },
      });
      const row = await tx.booking.update({
        where: { id: booking.id },
        data: { status: nextStatus },
      });
      await tx.outbox.create({
        data: {
          type: EmailType.BOOKING_REFUNDED,
          payload: {
            bookingId: booking.id,
            code: booking.code,
            email: booking.contactEmail,
            name: booking.contactName,
            title: booking.tourTitle,
            amount: amount.toFixed(2),
            currency: booking.currency,
            reason: input.reason ?? null,
          },
          dedupeKey: `refund:${booking.id}:${refundRow.id}`,
        },
      });
      return row;
    });

    this.logger.log(
      `Admin ${adminUserId} refunded ${amount.toFixed(2)} ${booking.currency} on booking ${booking.code} (${kind} → ${nextStatus})`,
    );
    return {
      booking: toBooking(updated, null),
      refunds: await this.historyForBooking(bookingCode),
    };
  }

  /**
   * The provider-refund step SHARED by the admin refund above and the W4
   * cancellation-approve flow (spec: reuse, don't duplicate gateway logic):
   * resolve the booking's gateway and refund `amount` in the BOOKING's
   * currency — invariant #6 by construction, a currency mismatch is
   * unrepresentable. Runs OUTSIDE any transaction on purpose (provider HTTP
   * latency never holds a DB connection; we never ledger a refund that did
   * not happen — callers ledger AFTER this returns). Failures wrap into
   * {@link ProviderRefundFailedError} (→ 502), nothing has been written.
   */
  async executeGatewayRefund(
    booking: {
      code: string;
      currency: string;
      paymentProvider: PaymentProvider;
      providerPaymentId: string;
    },
    amount: Prisma.Decimal,
  ): Promise<string> {
    try {
      const gateway = resolveGateway(this.gateways, booking.paymentProvider);
      const { providerRefundId } = await gateway.refund({
        providerPaymentId: booking.providerPaymentId,
        amount: amount.toFixed(2),
        currency: booking.currency,
      });
      return providerRefundId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      this.logger.error(`Provider refund failed for booking ${booking.code}: ${message}`);
      throw new ProviderRefundFailedError(message);
    }
  }

  /**
   * Refund ledger for a booking, oldest first (append order). Contract-shaped
   * — the admin detail view lands later (P4); int tests call this directly.
   */
  async historyForBooking(bookingCode: string): Promise<RefundView[]> {
    const booking = await prisma.booking.findUnique({
      where: { code: bookingCode },
      select: { id: true },
    });
    if (!booking) throw new BookingNotFoundError(bookingCode);
    const rows = await prisma.refund.findMany({
      where: { bookingId: booking.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toRefund);
  }
}
