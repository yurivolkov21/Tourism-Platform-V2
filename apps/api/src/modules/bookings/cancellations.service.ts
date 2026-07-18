import { Injectable, Logger } from '@nestjs/common';
import type {
  AdminCancellationRequest,
  AdminCancellationsListQuery,
  CancellationRequest as CancellationRequestView,
  DecideCancellationResult,
  Paged,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus, CancellationRequestStatus } from '../../generated/prisma/enums.js';
import { calendarDate, toBooking } from './bookings.service.js';
import { classifyRefundAmount } from './refund-math.js';
import {
  BookingNotFoundError,
  BookingNotRefundableError,
  RefundsService,
} from './refunds.service.js';

/** Booking not PAID, or its departure already started — cannot enter the flow (422). */
export class BookingNotCancellableError extends Error {
  constructor(detail: string) {
    super(`Booking cannot be cancelled: ${detail}`);
  }
}

/** The partial unique index fired — a live REQUESTED row already exists (409). */
export class CancellationAlreadyRequestedError extends Error {
  constructor() {
    super('A cancellation request is already open for this booking');
  }
}

/** No cancellation request with this id (admin surface: plain 404). */
export class CancellationRequestNotFoundError extends Error {
  constructor(id: string) {
    super(`Cancellation request "${id}" not found`);
  }
}

/** The request is already DENIED/REFUNDED — decisions are final (409). D1-B:
 * history rows are never reused; the customer re-requests instead. */
export class CancellationAlreadyDecidedError extends Error {
  constructor(status: CancellationRequestStatus) {
    super(`Request is ${status}; only an open (REQUESTED) request can be decided`);
  }
}

type CancellationRow = Prisma.CancellationRequestModel;

/** Booking context an admin needs to decide without a second lookup — all
 * SNAPSHOT columns (tourTitle/departureStartDate frozen at create, audit H3). */
const BOOKING_CONTEXT = {
  code: true,
  tourTitle: true,
  departureStartDate: true,
  contactName: true,
  contactEmail: true,
} as const;

type BookingContext = {
  code: string;
  tourTitle: string;
  departureStartDate: Date;
  contactName: string;
  contactEmail: string;
};

/** Row → public contract shape (customer surface + history in admin byCode). */
function toCancellationRequest(row: CancellationRow, bookingCode: string): CancellationRequestView {
  return {
    id: row.id,
    bookingCode,
    reason: row.reason,
    status: row.status,
    decisionNote: row.decisionNote,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Row + booking context → admin-queue shape. */
function toAdminCancellationRequest(
  row: CancellationRow & { booking: BookingContext },
): AdminCancellationRequest {
  return {
    ...toCancellationRequest(row, row.booking.code),
    tourTitle: row.booking.tourTitle,
    departureStartDate: calendarDate(row.booking.departureStartDate),
    contactName: row.booking.contactName,
    contactEmail: row.booking.contactEmail,
  };
}

/**
 * Cancellation flow (spec P2 §3 W4, D1 resolved as B): a PAID customer asks to
 * cancel; an admin denies (booking untouched) or approves (full-remainder
 * refund + booking CANCELLED + seats released). Requests are APPEND-ONLY
 * history — every request INSERTs a new row, DENIED rows are never reused
 * (Nexora upserted over them, losing the denial audit trail — audit M7); "one
 * live request per booking" is the DB's job via the partial unique index
 * `cancellation_requests_one_live_per_booking` (WHERE status = 'REQUESTED').
 *
 * Terminal-state semantics live in docs/conventions/booking-states.md: the
 * Refund ledger records the MONEY story, Booking.status the SEAT/TRAVEL story
 * — an approved cancellation sets CANCELLED explicitly (customer stopped
 * travelling, seats returned), NOT the ledger-derived REFUNDED, even though
 * the ledger sums to the total. Cancellation ≠ refund-only.
 */
@Injectable()
export class CancellationsService {
  private readonly logger = new Logger(CancellationsService.name);

  constructor(private readonly refunds: RefundsService) {}

  /**
   * Customer requests cancellation of an own PAID booking (Nexora gate,
   * ported): owner-or-404 (no existence leak), PAID-only, and the departure
   * must not have started — v2 folds Nexora's DEPARTURE_ALREADY_STARTED into
   * NOT_CANCELLABLE (422) and compares SNAPSHOT calendar dates the same way
   * create does (strictly-past rejects; a same-day departure can still ask —
   * consistent with the same-day walk-in booking rule).
   *
   * Write path is ONE atomic statement (house CTE style, pooler-safe):
   * INSERT the REQUESTED row + enqueue CANCELLATION_REQUESTED (invariant #7),
   * dedupeKey `cancellation-requested:<requestId>` — append-only rows make the
   * request id the natural once-per-entity key (a re-request after a denial is
   * a NEW row → new id → new email, exactly the convention's semantics).
   * A concurrent duplicate loses at the partial unique index (23505 → 409),
   * not at a racy pre-SELECT.
   */
  async request(
    userId: string,
    bookingCode: string,
    reason: string,
  ): Promise<CancellationRequestView> {
    const booking = await prisma.booking.findUnique({
      where: { code: bookingCode },
    });
    if (!booking || booking.userId !== userId) throw new BookingNotFoundError(bookingCode);
    if (booking.status !== BookingStatus.PAID) {
      throw new BookingNotCancellableError(
        `booking is ${booking.status}; only a PAID booking can be cancelled by request`,
      );
    }
    if (calendarDate(booking.departureStartDate) < new Date().toISOString().slice(0, 10)) {
      throw new BookingNotCancellableError('the departure has already started');
    }

    const trimmed = reason.trim();
    let inserted: { id: string }[];
    try {
      inserted = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        WITH req AS (
          INSERT INTO cancellation_requests (id, booking_id, user_id, reason, updated_at)
          VALUES (gen_random_uuid(), ${booking.id}::uuid, ${userId}::uuid, ${trimmed}, now())
          RETURNING id
        ),
        outbox_insert AS (
          INSERT INTO outbox (type, payload, dedupe_key)
          SELECT 'CANCELLATION_REQUESTED'::"EmailType",
                 jsonb_build_object(
                   'requestId', r.id,
                   'bookingId', ${booking.id}::text,
                   'code', ${booking.code}::text,
                   'email', ${booking.contactEmail}::text,
                   'name', ${booking.contactName}::text,
                   'title', ${booking.tourTitle}::text,
                   'reason', ${trimmed}::text
                 ),
                 'cancellation-requested:' || r.id::text
          FROM req r
          ON CONFLICT (dedupe_key) DO NOTHING
        )
        SELECT id FROM req
      `);
    } catch (err) {
      if (isOneLiveRequestViolation(err)) throw new CancellationAlreadyRequestedError();
      throw err;
    }
    const requestId = inserted[0]?.id;
    if (!requestId) throw new Error('unreachable: request INSERT returned no row');

    const row = await prisma.cancellationRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    this.logger.log(`Cancellation requested for booking ${booking.code} (request ${requestId})`);
    return toCancellationRequest(row, booking.code);
  }

  /** Own request history, newest first — the customer sees every attempt. */
  async myRequests(userId: string): Promise<CancellationRequestView[]> {
    const rows = await prisma.cancellationRequest.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: { booking: { select: { code: true } } },
    });
    return rows.map((row) => toCancellationRequest(row, row.booking.code));
  }

  /** Full history for one booking, oldest first (the D1-B audit trail) —
   * merged into `admin.bookings.byCode` by the admin controller. */
  async historyForBooking(
    bookingId: string,
    bookingCode: string,
  ): Promise<CancellationRequestView[]> {
    const rows = await prisma.cancellationRequest.findMany({
      where: { bookingId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => toCancellationRequest(row, bookingCode));
  }

  /** Admin queue: paged, newest first, optional status filter (omitted → all —
   * consistent with admin.bookings.list; the open queue is ?status=REQUESTED). */
  async adminList(query: AdminCancellationsListQuery): Promise<Paged<AdminCancellationRequest>> {
    const { page, limit, status } = query;
    const where: Prisma.CancellationRequestWhereInput = status ? { status } : {};
    const [total, rows] = await Promise.all([
      prisma.cancellationRequest.count({ where }),
      prisma.cancellationRequest.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { booking: { select: BOOKING_CONTEXT } },
      }),
    ]);
    return {
      items: rows.map(toAdminCancellationRequest),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Admin decision — 404 unknown id, 409 once decided (append-only: a decision
   * is final, the customer re-requests instead of the row being reopened).
   */
  async decide(
    adminUserId: string,
    requestId: string,
    input: { approve: boolean; decisionNote?: string },
  ): Promise<DecideCancellationResult> {
    const request = await prisma.cancellationRequest.findUnique({
      where: { id: requestId },
      include: { booking: true },
    });
    if (!request) throw new CancellationRequestNotFoundError(requestId);
    if (request.status !== CancellationRequestStatus.REQUESTED) {
      throw new CancellationAlreadyDecidedError(request.status);
    }
    const note = input.decisionNote?.trim() || null;
    return input.approve
      ? this.approve(adminUserId, request, note)
      : this.deny(adminUserId, request, note);
  }

  /**
   * DENY — the booking is untouched (stays PAID; deny does not cancel).
   * ONE atomic statement: flip gated on status='REQUESTED' (the race-deciding
   * qual sits on the UPDATE target — a concurrent decision makes this a no-op)
   * + CANCELLATION_DENIED outbox row, dedupeKey `cancellation-denied:<requestId>`
   * (a given request is denied at most once — its row is never reused).
   */
  private async deny(
    adminUserId: string,
    request: CancellationRow & { booking: Prisma.BookingModel },
    note: string | null,
  ): Promise<DecideCancellationResult> {
    const decided = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      WITH decided AS (
        UPDATE cancellation_requests cr
        SET status = 'DENIED'::"CancellationRequestStatus",
            decision_note = ${note},
            decided_by = ${adminUserId}::uuid,
            decided_at = now(),
            updated_at = now()
        WHERE cr.id = ${request.id}::uuid
          AND cr.status = 'REQUESTED'::"CancellationRequestStatus"
        RETURNING cr.id, cr.booking_id
      ),
      outbox_insert AS (
        INSERT INTO outbox (type, payload, dedupe_key)
        SELECT 'CANCELLATION_DENIED'::"EmailType",
               jsonb_build_object(
                 'requestId', d.id,
                 'bookingId', b.id,
                 'code', b.code,
                 'email', b.contact_email,
                 'name', b.contact_name,
                 'title', b.tour_title,
                 'note', ${note}::text
               ),
               'cancellation-denied:' || d.id::text
        FROM decided d
        JOIN bookings b ON b.id = d.booking_id
        ON CONFLICT (dedupe_key) DO NOTHING
      )
      SELECT id FROM decided
    `);
    if (decided.length === 0) {
      // Lost a decide race between the pre-check and the flip. Nothing ran.
      const fresh = await prisma.cancellationRequest.findUnique({
        where: { id: request.id },
        select: { status: true },
      });
      throw new CancellationAlreadyDecidedError(fresh?.status ?? CancellationRequestStatus.DENIED);
    }
    this.logger.log(`Cancellation request ${request.id} denied by ${adminUserId}`);
    return this.decisionResult(request.id);
  }

  /**
   * APPROVE — the W4 money+seats orchestration (spec §4 invariants, order is
   * the W2/W3 principle):
   *
   *  1. Gate: booking must be refundable (PAID / PARTIALLY_REFUNDED with a
   *     captured payment) and the ledger must leave a remainder — a booking
   *     already fully refunded through W3 while the request sat open cannot be
   *     approved (NOT_REFUNDABLE 422; the admin denies it instead).
   *  2. Provider refund of the FULL REMAINDER first, outside any transaction
   *     (never ledger what didn't happen; HTTP never holds a connection).
   *     `adminId` = the deciding admin.
   *  3. ONE atomic statement (house CTE style), everything driven FROM the
   *     request flip so a lost decide-race makes the WHOLE statement a no-op:
   *       req_flip     — REQUESTED → REFUNDED (the model's resolved-by-refund
   *                      value) + decidedBy/decidedAt/note; race-deciding qual
   *                      on the UPDATE target.
   *       refund_insert— append the Refund ledger row (money story).
   *       cancel       — booking → CANCELLED + cancelledAt: the travel story.
   *                      EXPLICITLY CANCELLED, not ledger-derived REFUNDED —
   *                      the customer stopped travelling and the seats return;
   *                      deriveStatusAfterRefund is for refund-only flows
   *                      (docs/conventions/booking-states.md).
   *       seat_release — single-statement `seats_booked - party`, guarded
   *                      `seats_booked >= party` (defensive; the PAID claim
   *                      counted them in) with CHECK seats_booked >= 0 as the
   *                      DB backstop. W3's refundByAdmin deliberately does NOT
   *                      release seats — this flow OWNS seat release.
   *       outbox       — CANCELLATION_APPROVED, dedupeKey
   *                      `cancellation-approved:<requestId>` (once per request).
   *
   * Failure notes: a refused provider refund aborts before any write (502,
   * request stays REQUESTED — retryable). If the flip races to zero rows AFTER
   * the provider refund succeeded, nothing is ledgered — logged loudly for
   * operator reconciliation (same residual window as any gateway-then-DB
   * sequence; the pre-check makes it concurrent-admin-only). A failed seat
   * guard does NOT abort: the money story already happened and MUST commit.
   */
  private async approve(
    adminUserId: string,
    request: CancellationRow & { booking: Prisma.BookingModel },
    note: string | null,
  ): Promise<DecideCancellationResult> {
    const booking = request.booking;
    const refundableStatus =
      booking.status === BookingStatus.PAID || booking.status === BookingStatus.PARTIALLY_REFUNDED;
    if (!refundableStatus || !booking.providerPaymentId) {
      throw new BookingNotRefundableError(booking.status, booking.providerPaymentId != null);
    }
    const ledger = await prisma.refund.aggregate({
      where: { bookingId: booking.id },
      _sum: { amount: true },
    });
    // requested:null → full remainder; throws RefundNothingLeftError on a
    // settled ledger (mapped to NOT_REFUNDABLE by the controller).
    const { amount } = classifyRefundAmount({
      requested: null,
      total: booking.totalAmount,
      alreadyRefunded: ledger._sum.amount ?? new Prisma.Decimal(0),
    });

    // Provider idempotency key `cancel-refund:<requestId>`: a request is
    // approved at most once (append-only, flip gated on REQUESTED), so the
    // request id names this refund attempt deterministically (W5).
    const providerRefundId = await this.refunds.executeGatewayRefund(
      { ...booking, providerPaymentId: booking.providerPaymentId },
      amount,
      `cancel-refund:${request.id}`,
    );

    const flipped = await prisma.$queryRaw<{ id: string; released: bigint }[]>(Prisma.sql`
      WITH req_flip AS (
        UPDATE cancellation_requests cr
        SET status = 'REFUNDED'::"CancellationRequestStatus",
            decision_note = ${note},
            decided_by = ${adminUserId}::uuid,
            decided_at = now(),
            updated_at = now()
        WHERE cr.id = ${request.id}::uuid
          AND cr.status = 'REQUESTED'::"CancellationRequestStatus"
        RETURNING cr.id, cr.booking_id
      ),
      refund_insert AS (
        INSERT INTO refunds (id, booking_id, amount, currency, provider_refund_id, admin_id)
        SELECT gen_random_uuid(), r.booking_id, ${amount.toFixed(2)}::numeric,
               ${booking.currency}::text, ${providerRefundId}::text, ${adminUserId}::uuid
        FROM req_flip r
        RETURNING id
      ),
      cancel AS (
        UPDATE bookings b
        SET status = 'CANCELLED'::"BookingStatus",
            cancelled_at = now(),
            updated_at = now()
        FROM req_flip r
        WHERE b.id = r.booking_id
        RETURNING b.id, b.departure_id, (b.num_adults + b.num_children) AS seats,
                  b.code, b.contact_email, b.contact_name, b.tour_title
      ),
      seat_release AS (
        UPDATE tour_departures d
        SET seats_booked = d.seats_booked - c.seats,
            updated_at = now()
        FROM cancel c
        WHERE d.id = c.departure_id AND d.seats_booked >= c.seats
        RETURNING d.id
      ),
      outbox_insert AS (
        INSERT INTO outbox (type, payload, dedupe_key)
        SELECT 'CANCELLATION_APPROVED'::"EmailType",
               jsonb_build_object(
                 'requestId', r.id,
                 'bookingId', c.id,
                 'code', c.code,
                 'email', c.contact_email,
                 'name', c.contact_name,
                 'title', c.tour_title,
                 'amount', ${amount.toFixed(2)}::text,
                 'currency', ${booking.currency}::text,
                 'note', ${note}::text
               ),
               'cancellation-approved:' || r.id::text
        FROM req_flip r
        JOIN cancel c ON c.id = r.booking_id
        ON CONFLICT (dedupe_key) DO NOTHING
      )
      SELECT r.id, (SELECT count(*) FROM seat_release) AS released FROM req_flip r
    `);

    const flip = flipped[0];
    if (!flip) {
      // Concurrent decision won between pre-check and flip: the provider
      // refund WENT THROUGH but nothing was ledgered — operator must reconcile.
      this.logger.error(
        `Approve race on request ${request.id}: provider refund ${providerRefundId} ` +
          `(${amount.toFixed(2)} ${booking.currency}, booking ${booking.code}) issued but NOT ledgered`,
      );
      const fresh = await prisma.cancellationRequest.findUnique({
        where: { id: request.id },
        select: { status: true },
      });
      throw new CancellationAlreadyDecidedError(
        fresh?.status ?? CancellationRequestStatus.REFUNDED,
      );
    }
    if (Number(flip.released) === 0) {
      // Seats guard failed (counter drifted below the party size) — the CHECK
      // backstop kept it >= 0; money story committed regardless. Operator item.
      this.logger.error(
        `Approve on request ${request.id}: seats NOT released for booking ${booking.code} ` +
          `(guard seats_booked >= party failed) — departure counter needs operator attention`,
      );
    }

    this.logger.log(
      `Cancellation request ${request.id} approved by ${adminUserId}: refunded ` +
        `${amount.toFixed(2)} ${booking.currency}, booking ${booking.code} CANCELLED, seats released`,
    );
    return this.decisionResult(request.id);
  }

  /** Fresh read → contract result (decided request + booking after decision). */
  private async decisionResult(requestId: string): Promise<DecideCancellationResult> {
    const row = await prisma.cancellationRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { booking: true },
    });
    return {
      request: toAdminCancellationRequest({ ...row, booking: row.booking }),
      booking: toBooking(row.booking, null),
    };
  }
}

/**
 * UNIQUE violation (SQLSTATE 23505) on the D1-B partial index (one live
 * REQUESTED per booking). Shape verified empirically against Prisma 7.8.0 +
 * @prisma/adapter-pg on a live violation — NOT the same nesting as
 * isSeatsCheckViolation (bookings.service.ts): the adapter NORMALIZES 23505
 * (unlike 23514, which stays a generic cause with a `code`) into
 * `meta.driverAdapterError.cause = { kind: 'UniqueConstraintViolation',
 * constraint: { fields: ['booking_id'] } }` under the outer P2010; the index
 * NAME only survives in the outer error message
 * (`… violates unique constraint "cancellation_requests_one_live_per_booking"`),
 * so that is where it is matched.
 */
function isOneLiveRequestViolation(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2010') return false;
  const cause = (err.meta as { driverAdapterError?: { cause?: { kind?: string } } } | undefined)
    ?.driverAdapterError?.cause;
  return (
    cause?.kind === 'UniqueConstraintViolation' &&
    err.message.includes('cancellation_requests_one_live_per_booking')
  );
}
