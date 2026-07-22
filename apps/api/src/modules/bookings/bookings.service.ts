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

/** Departure không tồn tại / không OPEN / đã departed / tour unpublished — cố
 * ý gộp thành một error (contract: một code DEPARTURE_NOT_AVAILABLE duy nhất,
 * không leak sự tồn tại). */
export class DepartureNotAvailableError extends Error {
  constructor() {
    super('This departure is not available for booking');
  }
}

/** Soft capacity check fail lúc create (xem note invariant #1 phía dưới). */
export class SeatsUnavailableError extends Error {
  constructor(seatsLeft: number, requested: number) {
    super(`Only ${seatsLeft} seat(s) left, requested ${requested}`);
  }
}

/** Prisma Decimal → string không mất mát ("39.00"). Money KHÔNG BAO GIỜ thành float. */
const money = (value: Prisma.Decimal): string => value.toFixed(2);

/** Prisma `@db.Date` (Date nửa đêm UTC) → calendar date "YYYY-MM-DD".
 * Export cho cancellation surface (cùng quy ước serialize). */
export const calendarDate = (value: Date): string => value.toISOString().slice(0, 10);

type BookingRow = Prisma.BookingModel;

/** Row → contract shape. `checkoutUrl` chỉ non-null ngay sau khi create.
 * Export cho admin surface (RefundsService trả về cùng shape). */
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
 * Kết quả của {@link BookingsService.claimSeatsForPaid} (spec P2 §4, ADR-0009):
 * - `claimed`       — seat đã tăng, booking flip PAID, outbox đã enqueue.
 * - `overbooked`    — booking vẫn PENDING nhưng party không còn vừa chỗ →
 *                     caller auto-refund + cancel (invariant #3).
 * - `cancelled`     — booking đã CANCELLED sẵn khi capture về (orphaned
 *                     capture, invariant #4) → caller auto-refund.
 * - `already-paid`  — PAID / REFUNDED / PARTIALLY_REFUNDED: một retry hoặc một
 *                     provider event thứ hai cho booking đã settle → no-op.
 * - `not-found`     — không có booking id này (webhook tham chiếu thứ ta chưa
 *                     bao giờ mint) → log-and-skip.
 */
export type ClaimOutcome =
  | 'claimed'
  | 'overbooked'
  | 'cancelled'
  | 'already-paid'
  | 'not-found'
  | 'expired';

/** UNIQUE violation trên bookings.code (mint bị đụng) — retryable. */
function isCodeCollision(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    JSON.stringify(error.meta?.target ?? '').includes('code')
  );
}

const CODE_MINT_ATTEMPTS = 3;

/**
 * Các customer booking flow (spec P2 §3, W1) — logic create-PENDING port từ
 * bookings.service của Nexora (thứ tự validation đã dày dạn), nâng lên
 * interface `PaymentGateway` (không branch theo provider) và checkout ngay lúc
 * create (Nexora tách create / startCheckout; v2 book + mint session trong một
 * lời gọi — một round-trip tới redirect).
 */
@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(@Inject(PAYMENT_GATEWAYS) private readonly gateways: PaymentGateway[]) {}

  /**
   * Tạo một PENDING booking + gateway checkout session.
   *
   * Validation (giữ nguyên semantics đã port): departure tồn tại, tour của nó
   * đã published, status OPEN, và chưa DEPARTED — same-day vẫn book được
   * (walk-in, rule Nexora); chỉ startDate strictly-past mới reject. So sánh
   * calendar-date string kiểu UTC (`@db.Date` load thành nửa đêm UTC) độc lập
   * với timezone của server.
   *
   * Seats: CHỈ soft check (`seatsTotal - seatsBooked >= party`) — KHÔNG phải
   * reservation. Invariant #1 (spec §4): một PENDING booking KHÔNG giữ seat
   * nào; seat được claim nguyên tử bởi đường PAID webhook (W2, ADR-0009 CTE).
   * Hai create chạy đua có thể cùng pass check này theo thiết kế — claim mới
   * là bên quyết định.
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

    // Snapshot đóng băng lúc create (audit H3): thứ khách đã mua không bao giờ
    // render lại khi tour bị sửa. Code unique: mint + retry khi hiếm hoi đụng
    // UNIQUE collision (P2002) thay vì SELECT pre-flight (TOCTOU).
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

    // Lời gọi provider ra ngoài NGOÀI mọi transaction (latency HTTP của nó
    // không bao giờ được giữ connection). Gateway fail thì nổi lên sau khi row
    // đã tồn tại: booking ở lại PENDING mà không có session — vô hại (không giữ
    // seat) và sẽ được quét bởi pass pending-expiry (W2).
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

  /** Booking của chính user, mới nhất trước (id làm tiebreak ổn định), status filter optional. */
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
   * Booking của chính user theo code, hoặc null (controller → NOT_FOUND). Cố ý
   * chỉ owner — code của user khác thì 404 (không phải 403: không leak sự tồn
   * tại). KHÔNG có admin bypass ở đây; admin surface là list riêng của nó (W3+).
   */
  async byCode(userId: string, code: string): Promise<Booking | null> {
    const booking = await prisma.booking.findUnique({ where: { code } });
    if (!booking || booking.userId !== userId) return null;
    return toBooking(booking, null);
  }

  /**
   * List quản trị cho admin (spec P2 W3, port nhẹ từ admin list của Nexora):
   * TẤT CẢ booking, mới nhất trước, status filter optional + `search`
   * free-text khớp case-insensitive theo code / contact email / contact name.
   * Được guard bằng @Roles('ADMIN') ở controller.
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

  /** Bất kỳ booking nào theo code — admin surface, cố ý KHÔNG scope theo owner. */
  async adminByCode(code: string): Promise<Booking | null> {
    const booking = await prisma.booking.findUnique({ where: { code } });
    return booking ? toBooking(booking, null) : null;
  }

  /**
   * PAID claim nguyên tử CHỦ CHỐT (ADR-0009, đã hardened cho v2). MỘT statement
   * data-modifying, xếp lớp sao cho mọi qual quyết-định-race đều nằm trên một
   * bảng UPDATE-target (được re-evaluate tươi mới dưới READ COMMITTED
   * EvalPlanQual — các CTE row KHÔNG được re-fetch sau khi chờ lock, nên qual
   * đi vòng qua một CTE join sẽ bị stale theo snapshot và không đáng tin cho
   * concurrency control):
   *
   *   (a) `claim` — flip BOOKING trước: `UPDATE bookings … WHERE
   *       status = 'PENDING'`. Row bị tranh chấp trong race duplicate-delivery
   *       (cùng booking, hai eventId khác nhau — beginEvent không dedupe được
   *       chúng) chính là booking row; bên thua block trên nó, EPQ re-check
   *       `status` với committed tuple của bên thắng, khớp zero row, và toàn bộ
   *       phần còn lại của statement thành no-op.
   *   (b) `seat_claim` — seat tăng VÔ ĐIỀU KIỆN, driven FROM `claim`. Bảo vệ
   *       overbook là DB CHECK `departures_seats_within_total` (migration
   *       hardening): một increment làm tràn sẽ abort TOÀN BỘ statement — kể cả
   *       PAID flip ở (a) — một cách nguyên tử. Caller map SQLSTATE 23514 trên
   *       constraint đó → 'overbooked' (booking khi đó vẫn PENDING, đúng thứ mà
   *       refund path mong đợi).
   *   (c) `outbox_insert` — BOOKING_CONFIRMATION được enqueue trong CÙNG
   *       statement (invariant #7), `ON CONFLICT (dedupe_key) DO NOTHING`,
   *       dedupeKey `booking-confirmed:<bookingId>` (once per booking,
   *       docs/conventions/outbox-dedupe-key.md).
   *
   * `SELECT id FROM claim` cuối cùng là success marker — happy path không cần
   * round-trip thứ hai. Zero row ⇒ không có gì đổi; classification khi đó chạy
   * như một SELECT follow-up riêng trên snapshot tươi (shape gốc của Nexora —
   * nó chỉ classification, không effect, nên không cần atomic chung với claim).
   *
   * Single-statement vẫn là điểm cốt lõi: nguyên tử trên BẤT KỲ pool nào
   * (không cần vặn vẹo transaction pooler), idempotent ở mức booking.
   * `updated_at` set thủ công — `@updatedAt` của Prisma chạy client-side và raw
   * SQL đi vòng qua nó.
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
        // CHECK đã abort cả statement: không PAID flip, không seat, không
        // outbox — booking chắc chắn vẫn PENDING và đã không vừa chỗ.
        this.logger.warn(`PAID claim for booking ${bookingId}: overbooked (CHECK abort)`);
        return 'overbooked';
      }
      throw err;
    }
    if (claimed.length === 1) {
      this.logger.log(`PAID claim for booking ${bookingId}: claimed`);
      return 'claimed';
    }

    // Không có gì đổi — classify trên snapshot tươi (SELECT follow-up).
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true },
    });
    let outcome: ClaimOutcome;
    if (!booking) outcome = 'not-found';
    else if (booking.status === BookingStatus.CANCELLED) outcome = 'cancelled';
    else if (booking.status === BookingStatus.PENDING) {
      // Về lý thuyết là bất khả tới: không exception + zero claim row + vẫn
      // PENDING. Map phòng thủ: coi như overbooked — đường handler của nó là
      // đường an toàn cho một PENDING booking đang giữ tiền thật.
      outcome = 'overbooked';
    } else outcome = 'already-paid'; // PAID / REFUNDED / PARTIALLY_REFUNDED
    this.logger.log(`PAID claim for booking ${bookingId}: ${outcome}`);
    return outcome;
  }
}

/**
 * Statement bị abort do CHECK `departures_seats_within_total` — tín hiệu
 * overbook từ {@link BookingsService.claimSeatsForPaid}. Shape đã kiểm chứng
 * thực nghiệm với Prisma 7.8.0 + @prisma/adapter-pg trên một violation thật:
 * `PrismaClientKnownRequestError` với `code: 'P2010'` và SQLSTATE Postgres nằm
 * lồng ở `meta.driverAdapterError.cause.code = '23514'` (check_violation), tên
 * constraint chỉ có trong message của cause.
 */
function isSeatsCheckViolation(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2010') return false;
  const cause = (
    err.meta as { driverAdapterError?: { cause?: { code?: string; message?: string } } } | undefined
  )?.driverAdapterError?.cause;
  return cause?.code === '23514' && (cause.message ?? '').includes('departures_seats_within_total');
}
