import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Booking, BookingsListQuery, CreateBookingInput, Paged } from '@tourism/contract';
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

/** Prisma `@db.Date` (UTC midnight Date) → calendar date "YYYY-MM-DD". */
const calendarDate = (value: Date): string => value.toISOString().slice(0, 10);

type BookingRow = Prisma.BookingModel;

/** Row → contract shape. `checkoutUrl` is non-null only right after create. */
function toBooking(row: BookingRow, checkoutUrl: string | null): Booking {
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
          select: { id: true, title: true, currency: true, basePrice: true, isPublished: true },
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
    const where: Prisma.BookingWhereInput = { userId, ...(status ? { status } : {}) };

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
}
