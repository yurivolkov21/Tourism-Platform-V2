import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  AdminBookingsListQuery,
  Booking,
  BookingsListQuery,
  CreateBookingInput,
  Paged,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { env } from '../../config/env.js';
import { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus, DepartureStatus } from '../../generated/prisma/enums.js';
import { PAYMENT_GATEWAYS, type PaymentGateway, resolveGateway } from '../payments/gateway.js';
import { mintBookingCode } from './booking-code.js';
import { effectiveUnitPrice, totalAmount } from './pricing.js';

/** Departure missing / not OPEN / departed / tour unpublished — one error on
 * purpose (contract: single DEPARTURE_NOT_AVAILABLE code, no existence leak). */
export class DepartureNotAvailableError extends Error {
  constructor() {
    super('This departure is not available for booking');
  }
}

/** Soft capacity check failed at create time (see invariant #1 note below). */
export class SeatsUnavailableError extends Error {
  constructor(seatsLeft: number, requested: number) {
    super(`Only ${seatsLeft} seat(s) left, requested ${requested}`);
  }
}

/** Prisma Decimal → lossless string ("39.00"). Money NEVER becomes a float. */
const money = (value: { toString(): string }): string => value.toString();

/** Prisma `@db.Date` (UTC midnight Date) → calendar date "YYYY-MM-DD".
 * Exported for the cancellation surface (same serialization convention). */
export const calendarDate = (value: Date): string => value.toISOString().slice(0, 10);

type BookingRow = Prisma.BookingModel;

/** Row → contract shape. `checkoutUrl` is non-null only right after create.
 * Exported for the admin surface (RefundsService returns the same shape). */
export function toBooking(row: BookingRow, checkoutUrl: string | null): Booking {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    tourTitle: row.tourTitle,
    departureStartDate: calendarDate(row.departureStartDate),
    departureEndDate: calendarDate(row.departureEndDate),
    unitPrice: money(row.unitPrice),
    totalAmount: money(row.totalAmount),
    currency: row.currency,
    numAdults: row.numAdults,
    numChildren: row.numChildren,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    specialRequests: row.specialRequests,
    paymentProvider: row.paymentProvider,
    checkoutUrl,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Outcome of {@link BookingsService.claimSeatsForPaid} (spec P2 §4, ADR-0009):
 * - `claimed`       — seats incremented, booking flipped PAID, outbox enqueued.
 * - `overbooked`    — booking still PENDING but the party no longer fits →
 *                     caller auto-refunds + cancels (invariant #3).
 * - `cancelled`     — booking was already CANCELLED when the capture landed
 *                     (orphaned capture, invariant #4) → caller auto-refunds.
 * - `already-paid`  — PAID / REFUNDED / PARTIALLY_REFUNDED: a retry or a second
 *                     provider event for a booking already settled → no-op.
 * - `not-found`     — no such booking id (webhook references something we
 *                     never minted) → log-and-skip.
 */
export type ClaimOutcome = 'claimed' | 'overbooked' | 'cancelled' | 'already-paid' | 'not-found';

/** UNIQUE violation on bookings.code (the mint collided) — retryable. */
function isCodeCollision(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    JSON.stringify(error.meta?.target ?? '').includes('code')
  );
}

const CODE_MINT_ATTEMPTS = 3;

/**
 * Customer booking flows (spec P2 §3, W1) — create-PENDING logic ported from
 * Nexora bookings.service (battle-tested validation order), upgraded to the
 * `PaymentGateway` interface (no provider branching) and to create-time
 * checkout (Nexora split create / startCheckout; v2 books + mints the session
 * in one call — one round-trip to a redirect).
 */
@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(@Inject(PAYMENT_GATEWAYS) private readonly gateways: PaymentGateway[]) {}

  /**
   * Creates a PENDING booking + gateway checkout session.
   *
   * Validation (ported semantics): departure exists, its tour is published,
   * status OPEN, and it has not DEPARTED — same-day stays bookable (walk-in,
   * Nexora rule); only a strictly-past startDate rejects. UTC calendar-date
   * string compare (`@db.Date` loads as UTC midnight) is server-tz independent.
   *
   * Seats: SOFT check only (`seatsTotal - seatsBooked >= party`) — NOT a
   * reservation. Invariant #1 (spec §4): a PENDING booking holds NO seats;
   * seats are claimed atomically by the PAID webhook path (W2, ADR-0009 CTE).
   * Two racing creates can both pass this check by design — the claim decides.
   */
  async create(userId: string, input: CreateBookingInput): Promise<Booking> {
    const departure = await prisma.tourDeparture.findUnique({
      where: { id: input.departureId },
      include: {
        tour: {
          select: {
            id: true,
            title: true,
            currency: true,
            basePrice: true,
            isPublished: true,
          },
        },
      },
    });
    if (!departure) throw new DepartureNotAvailableError();
    const todayUtc = new Date().toISOString().slice(0, 10);
    if (
      !departure.tour.isPublished ||
      departure.status !== DepartureStatus.OPEN ||
      calendarDate(departure.startDate) < todayUtc
    ) {
      throw new DepartureNotAvailableError();
    }

    const seats = input.numAdults + input.numChildren;
    const seatsLeft = departure.seatsTotal - departure.seatsBooked;
    if (seatsLeft < seats) {
      throw new SeatsUnavailableError(seatsLeft, seats);
    }

    const unitPrice = effectiveUnitPrice(departure.tour.basePrice, departure.priceOverride);
    const total = totalAmount(unitPrice, seats);

    // Snapshots frozen at create (audit H3): what the customer bought never
    // re-renders when the tour is edited. Unique code: mint + retry on the
    // rare UNIQUE collision (P2002) instead of a pre-flight SELECT (TOCTOU).
    let booking: BookingRow | undefined;
    for (let attempt = 1; attempt <= CODE_MINT_ATTEMPTS; attempt++) {
      try {
        booking = await prisma.booking.create({
          data: {
            code: mintBookingCode(),
            userId,
            tourId: departure.tour.id,
            departureId: departure.id,
            numAdults: input.numAdults,
            numChildren: input.numChildren,
            totalAmount: total,
            currency: departure.tour.currency,
            status: BookingStatus.PENDING,
            tourTitle: departure.tour.title,
            departureStartDate: departure.startDate,
            departureEndDate: departure.endDate,
            unitPrice,
            contactName: input.contactName,
            contactEmail: input.contactEmail,
            contactPhone: input.contactPhone ?? null,
            specialRequests: input.specialRequests ?? null,
            paymentProvider: input.paymentProvider,
          },
        });
        break;
      } catch (error) {
        if (isCodeCollision(error) && attempt < CODE_MINT_ATTEMPTS) continue;
        throw error;
      }
    }
    if (!booking) throw new Error('unreachable: booking create loop exited without a row');

    // Outbound provider call OUTSIDE any transaction (its HTTP latency must
    // never hold a connection). A gateway failure surfaces after the row
    // exists: the booking stays PENDING without a session — harmless (holds
    // no seats) and swept by the pending-expiry pass (W2).
    const gateway = resolveGateway(this.gateways, input.paymentProvider);
    const session = await gateway.createCheckoutSession({
      bookingId: booking.id,
      code: booking.code,
      amount: total.toFixed(2),
      currency: booking.currency,
      description: `${booking.tourTitle} (${calendarDate(booking.departureStartDate)} – ${calendarDate(booking.departureEndDate)})`,
      successUrl: `${env.FRONTEND_URL}/checkout/success?code=${booking.code}`,
      cancelUrl: `${env.FRONTEND_URL}/checkout/cancel?code=${booking.code}`,
    });
    const withSession = await prisma.booking.update({
      where: { id: booking.id },
      data: { providerSessionId: session.sessionId },
    });

    this.logger.log(
      `Created booking ${withSession.code} (departure=${departure.id}, seats=${seats}, provider=${input.paymentProvider})`,
    );
    return toBooking(withSession, session.checkoutUrl);
  }

  /** Own bookings, newest first (stable id tiebreak), optional status filter. */
  async mine(userId: string, query: BookingsListQuery): Promise<Paged<Booking>> {
    const { page, limit, status } = query;
    const where: Prisma.BookingWhereInput = {
      userId,
      ...(status ? { status } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => toBooking(row, null)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Own booking by code, or null (controller → NOT_FOUND). Owner-only on
   * purpose — another user's code 404s (not 403: no existence leak). Admin
   * bypass is NOT here; the admin surface is its own list (W3+).
   */
  async byCode(userId: string, code: string): Promise<Booking | null> {
    const booking = await prisma.booking.findUnique({ where: { code } });
    if (!booking || booking.userId !== userId) return null;
    return toBooking(booking, null);
  }

  /**
   * Admin management list (spec P2 W3, ported lightly from Nexora's admin
   * list): ALL bookings, newest first, optional status filter + free-text
   * `search` matched case-insensitively against code / contact email /
   * contact name. Guarded by @Roles('ADMIN') at the controller.
   */
  async adminList(query: AdminBookingsListQuery): Promise<Paged<Booking>> {
    const { page, limit, status, search } = query;
    const term = search?.trim();
    const where: Prisma.BookingWhereInput = {
      ...(status ? { status } : {}),
      ...(term
        ? {
            OR: [
              { code: { contains: term, mode: 'insensitive' } },
              { contactEmail: { contains: term, mode: 'insensitive' } },
              { contactName: { contains: term, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => toBooking(row, null)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Any booking by code — admin surface, deliberately NOT owner-scoped. */
  async adminByCode(code: string): Promise<Booking | null> {
    const booking = await prisma.booking.findUnique({ where: { code } });
    return booking ? toBooking(booking, null) : null;
  }

  /**
   * THE atomic PAID claim (ADR-0009, v2-hardened). ONE data-modifying
   * statement, layered so every race-deciding qual sits on an UPDATE-target
   * table (re-evaluated fresh under READ COMMITTED EvalPlanQual — CTE rows are
   * NOT re-fetched after a lock wait, so quals routed through a joined CTE are
   * snapshot-stale and unsound for concurrency control):
   *
   *   (a) `claim` — flip the BOOKING first: `UPDATE bookings … WHERE
   *       status = 'PENDING'`. The contended row for a duplicate-delivery race
   *       (same booking, two distinct eventIds — beginEvent cannot dedupe
   *       those) is the booking row itself; the loser blocks on it, EPQ
   *       re-checks `status` against the winner's committed tuple, matches
   *       zero rows, and the whole rest of the statement is a no-op.
   *   (b) `seat_claim` — seats increment UNCONDITIONAL, driven FROM `claim`.
   *       Overbook protection is the DB CHECK `departures_seats_within_total`
   *       (hardening migration): an overfilling increment aborts the ENTIRE
   *       statement — including the PAID flip in (a) — atomically. The caller
   *       maps SQLSTATE 23514 on that constraint → 'overbooked' (booking is
   *       then still PENDING, exactly what the refund path expects).
   *   (c) `outbox_insert` — BOOKING_CONFIRMATION enqueued in the SAME
   *       statement (invariant #7), `ON CONFLICT (dedupe_key) DO NOTHING`,
   *       dedupeKey `booking-confirmed:<bookingId>` (once per booking,
   *       docs/conventions/outbox-dedupe-key.md).
   *
   * The final `SELECT id FROM claim` is the success marker — the happy path
   * needs no second round-trip. Zero rows ⇒ nothing changed; classification
   * then runs as a separate follow-up SELECT on a fresh snapshot (Nexora's
   * original shape — it is classification-only, no effects, so it needs no
   * atomicity with the claim).
   *
   * Single-statement is still the point: atomic on ANY pool (no transaction
   * pooler contortions), idempotent at booking level. `updated_at` set
   * manually — Prisma's `@updatedAt` is client-side and raw SQL bypasses it.
   */
  async claimSeatsForPaid(
    bookingId: string,
    providerPaymentId: string | null,
  ): Promise<ClaimOutcome> {
    let claimed: { id: string }[];
    try {
      claimed = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        WITH claim AS (
          UPDATE bookings b
          SET status = 'PAID'::"BookingStatus",
              paid_at = now(),
              provider_payment_id = ${providerPaymentId},
              updated_at = now()
          WHERE b.id = ${bookingId}::uuid AND b.status = 'PENDING'::"BookingStatus"
          RETURNING b.id, b.departure_id, (b.num_adults + b.num_children) AS seats,
                    b.code, b.contact_email, b.contact_name, b.tour_title,
                    b.departure_start_date, b.departure_end_date, b.total_amount, b.currency
        ),
        seat_claim AS (
          UPDATE tour_departures d
          SET seats_booked = d.seats_booked + c.seats,
              updated_at = now()
          FROM claim c
          WHERE d.id = c.departure_id
          RETURNING d.id
        ),
        outbox_insert AS (
          INSERT INTO outbox (type, payload, dedupe_key)
          SELECT 'BOOKING_CONFIRMATION'::"EmailType",
                 jsonb_build_object(
                   'bookingId', c.id,
                   'code', c.code,
                   'email', c.contact_email,
                   'name', c.contact_name,
                   'title', c.tour_title,
                   'startDate', c.departure_start_date::text,
                   'endDate', c.departure_end_date::text,
                   'amount', c.total_amount::text,
                   'currency', c.currency
                 ),
                 'booking-confirmed:' || c.id::text
          FROM claim c
          ON CONFLICT (dedupe_key) DO NOTHING
        )
        SELECT id FROM claim
      `);
    } catch (err) {
      if (isSeatsCheckViolation(err)) {
        // The CHECK aborted the whole statement: no PAID flip, no seats, no
        // outbox — the booking is provably still PENDING and did not fit.
        this.logger.warn(`PAID claim for booking ${bookingId}: overbooked (CHECK abort)`);
        return 'overbooked';
      }
      throw err;
    }
    if (claimed.length === 1) {
      this.logger.log(`PAID claim for booking ${bookingId}: claimed`);
      return 'claimed';
    }

    // Nothing changed — classify on a fresh snapshot (follow-up SELECT).
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true },
    });
    let outcome: ClaimOutcome;
    if (!booking) outcome = 'not-found';
    else if (booking.status === BookingStatus.CANCELLED) outcome = 'cancelled';
    else if (booking.status === BookingStatus.PENDING) {
      // Theoretically unreachable: no exception + zero claim rows + still
      // PENDING. Defensive mapping: treat as overbooked — its handler path is
      // the safe one for a PENDING booking holding real money.
      outcome = 'overbooked';
    } else outcome = 'already-paid'; // PAID / REFUNDED / PARTIALLY_REFUNDED
    this.logger.log(`PAID claim for booking ${bookingId}: ${outcome}`);
    return outcome;
  }
}

/**
 * Statement abort caused by the `departures_seats_within_total` CHECK — the
 * overbook signal from {@link BookingsService.claimSeatsForPaid}. Shape
 * verified empirically against Prisma 7.8.0 + @prisma/adapter-pg on a live
 * violation: `PrismaClientKnownRequestError` with `code: 'P2010'` and the
 * Postgres SQLSTATE nested at `meta.driverAdapterError.cause.code = '23514'`
 * (check_violation), constraint name only inside the cause message.
 */
function isSeatsCheckViolation(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2010') return false;
  const cause = (
    err.meta as { driverAdapterError?: { cause?: { code?: string; message?: string } } } | undefined
  )?.driverAdapterError?.cause;
  return cause?.code === '23514' && (cause.message ?? '').includes('departures_seats_within_total');
}
