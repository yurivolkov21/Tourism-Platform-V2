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
import { withBookingRefundLock } from './refund-lock.js';
import { classifyRefundAmount } from './refund-math.js';
import {
  BookingNotFoundError,
  BookingNotRefundableError,
  RefundsService,
} from './refunds.service.js';

/** Booking không PAID, hoặc departure đã khởi hành — không vào flow được (422). */
export class BookingNotCancellableError extends Error {
  constructor(detail: string) {
    super(`Booking cannot be cancelled: ${detail}`);
  }
}

/** Partial unique index đã fire — đã tồn tại một REQUESTED row còn sống (409). */
export class CancellationAlreadyRequestedError extends Error {
  constructor() {
    super('A cancellation request is already open for this booking');
  }
}

/** Không có cancellation request với id này (admin surface: 404 trơn). */
export class CancellationRequestNotFoundError extends Error {
  constructor(id: string) {
    super(`Cancellation request "${id}" not found`);
  }
}

/** Request đã DENIED/REFUNDED — decision là chung cuộc (409). D1-B: history
 * row không bao giờ được tái dùng; khách re-request thay vào đó. */
export class CancellationAlreadyDecidedError extends Error {
  constructor(status: CancellationRequestStatus) {
    super(`Request is ${status}; only an open (REQUESTED) request can be decided`);
  }
}

type CancellationRow = Prisma.CancellationRequestModel;

/** Booking context admin cần để quyết định mà không phải lookup lần hai — toàn
 * cột SNAPSHOT (tourTitle/departureStartDate đóng băng lúc create, audit H3). */
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

/** Row → public contract shape (customer surface + history trong admin byCode). */
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

/** Row + booking context → shape cho admin-queue. */
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
 * Cancellation flow (spec P2 §3 W4, D1 chốt là B): một khách PAID xin hủy;
 * admin deny (booking để nguyên) hoặc approve (refund full-remainder + booking
 * CANCELLED + release seat). Request là history APPEND-ONLY — mỗi request
 * INSERT một row mới, DENIED row không bao giờ tái dùng (Nexora upsert đè lên
 * chúng, làm mất audit trail của denial — audit M7); "một live request mỗi
 * booking" là việc của DB qua partial unique index
 * `cancellation_requests_one_live_per_booking` (WHERE status = 'REQUESTED').
 *
 * Semantics của terminal-state nằm ở docs/conventions/booking-states.md:
 * Refund ledger ghi câu chuyện MONEY, Booking.status ghi câu chuyện
 * SEAT/TRAVEL — một cancellation được approve set CANCELLED tường minh (khách
 * ngừng du lịch, seat được trả lại), KHÔNG phải REFUNDED derive từ ledger, dù
 * ledger có cộng đủ total. Cancellation ≠ chỉ refund.
 */
@Injectable()
export class CancellationsService {
  private readonly logger = new Logger(CancellationsService.name);

  constructor(private readonly refunds: RefundsService) {}

  /**
   * Khách xin hủy một PAID booking của chính mình (gate Nexora, đã port):
   * owner-hoặc-404 (không leak sự tồn tại), chỉ PAID, và departure chưa được
   * khởi hành — v2 gộp DEPARTURE_ALREADY_STARTED của Nexora vào
   * NOT_CANCELLABLE (422) và so sánh SNAPSHOT calendar date đúng cách create
   * làm (strictly-past thì reject; departure cùng ngày vẫn xin được — nhất
   * quán với rule walk-in booking cùng ngày).
   *
   * Đường ghi là MỘT statement nguyên tử (house CTE style, an toàn với pooler):
   * INSERT REQUESTED row + enqueue CANCELLATION_REQUESTED (invariant #7),
   * dedupeKey `cancellation-requested:<requestId>` — row append-only làm cho
   * request id thành key once-per-entity tự nhiên (một re-request sau denial là
   * một row MỚI → id mới → email mới, đúng semantics của quy ước). Một duplicate
   * đồng thời sẽ thua ở partial unique index (23505 → 409), không phải ở một
   * pre-SELECT dính race.
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

  /** Lịch sử request của chính khách, mới nhất trước — khách thấy mọi attempt. */
  async myRequests(userId: string): Promise<CancellationRequestView[]> {
    const rows = await prisma.cancellationRequest.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: { booking: { select: { code: true } } },
    });
    return rows.map((row) => toCancellationRequest(row, row.booking.code));
  }

  /** Lịch sử đầy đủ cho một booking, cũ nhất trước (audit trail D1-B) —
   * được admin controller merge vào `admin.bookings.byCode`. */
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

  /** Admin queue: phân trang, mới nhất trước, status filter optional (bỏ trống
   * → all — nhất quán với admin.bookings.list; open queue là ?status=REQUESTED). */
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
   * Quyết định của admin — 404 nếu id lạ, 409 khi đã decide (append-only: một
   * decision là chung cuộc, khách re-request chứ không reopen row).
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
   * DENY — booking để nguyên (ở lại PAID; deny không hủy). MỘT statement
   * nguyên tử: flip gate trên status='REQUESTED' (qual quyết-định-race nằm
   * trên UPDATE target — một decision đồng thời làm cái này thành no-op) +
   * CANCELLATION_DENIED outbox row, dedupeKey
   * `cancellation-denied:<requestId>` (một request cho trước bị deny nhiều
   * nhất một lần — row của nó không bao giờ tái dùng).
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
      // Thua một decide race giữa pre-check và flip. Không có gì chạy.
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
   * APPROVE — orchestration money+seats của W4 (invariant spec §4, thứ tự theo
   * nguyên tắc W2/W3):
   *
   * BK-R1 cross-path (ADR-0009): TOÀN BỘ gate→ledger→gateway→ghi nằm TRONG
   * `withBookingRefundLock(booking.id)` — cùng advisory lock mà `refundByAdmin`
   * (W3) dùng, nên hai đường refund khác nhau trên cùng booking serialize:
   * đường thứ hai block tới khi đường đầu commit, đọc ledger đã cập nhật →
   * không double-refund ở gateway. Gate + ledger đọc TƯƠI trong lock (không xài
   * `request.booking` đã cũ lúc `decide`).
   *
   *  1. Gate (TƯƠI, trong lock): booking phải refundable (PAID /
   *     PARTIALLY_REFUNDED có captured payment) và ledger phải còn dư một
   *     remainder — một booking đã fully refund qua W3 trong lúc request còn mở
   *     thì không approve được (NOT_REFUNDABLE 422; admin deny nó thay vào đó).
   *  2. Provider refund FULL REMAINDER (không bao giờ ledger thứ chưa xảy ra).
   *     Chạy TRONG tx của lock — ngoại lệ có chủ đích của "gateway ngoài tx"
   *     (ADR-0009), chỉ cho đường refund hiếm; lock giữ suốt read→gateway→ledger.
   *     `adminId` = admin đang quyết định.
   *  3. MỘT statement nguyên tử (house CTE style, chạy qua `tx.$queryRaw` trong
   *     lock), mọi thứ driven FROM cái flip của request để một decide-race bị
   *     thua làm CẢ statement thành no-op:
   *       req_flip     — REQUESTED → REFUNDED (giá trị resolved-by-refund của
   *                      model) + decidedBy/decidedAt/note; qual quyết-định-race
   *                      trên UPDATE target.
   *       refund_insert— append Refund ledger row (money story).
   *       cancel       — booking → CANCELLED + cancelledAt: travel story.
   *                      CANCELLED TƯỜNG MINH, không phải REFUNDED derive từ
   *                      ledger — khách ngừng du lịch và seat được trả lại;
   *                      deriveStatusAfterRefund là cho các flow chỉ-refund
   *                      (docs/conventions/booking-states.md).
   *       seat_release — single-statement `seats_booked - party`, guard
   *                      `seats_booked >= party` (phòng thủ; PAID claim đã đếm
   *                      chúng vào) với CHECK seats_booked >= 0 làm backstop ở
   *                      DB. refundByAdmin của W3 cố ý KHÔNG release seat —
   *                      flow này mới là chủ của seat release.
   *       outbox       — CANCELLATION_APPROVED, dedupeKey
   *                      `cancellation-approved:<requestId>` (once per request).
   *
   * Ghi chú failure: một provider refund bị từ chối sẽ abort trước mọi lần ghi
   * (502, request ở lại REQUESTED — retryable). Nếu flip race về zero row SAU
   * KHI provider refund thành công, không có gì được ledger — log thật to để
   * operator reconcile (advisory lock giờ khiến nó gần như bất khả: đường thứ
   * hai đã bị chặn ở gate TƯƠI trong lock trước cả gateway). Một seat guard bị
   * fail KHÔNG abort: money story đã xảy ra rồi và PHẢI commit.
   */
  private async approve(
    adminUserId: string,
    request: CancellationRow & { booking: Prisma.BookingModel },
    note: string | null,
  ): Promise<DecideCancellationResult> {
    const bookingId = request.booking.id;

    // MỌI gate + ledger + gateway + ghi nằm TRONG advisory lock (BK-R1
    // cross-path, ADR-0009) — serialize với refundByAdmin/approve đồng thời trên
    // cùng booking. Đọc booking TƯƠI trong lock (không xài request.booking cũ).
    const result = await withBookingRefundLock(bookingId, async (tx) => {
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      const refundableStatus =
        booking.status === BookingStatus.PAID ||
        booking.status === BookingStatus.PARTIALLY_REFUNDED;
      if (!refundableStatus || !booking.providerPaymentId) {
        throw new BookingNotRefundableError(booking.status, booking.providerPaymentId != null);
      }
      const ledger = await tx.refund.aggregate({
        where: { bookingId: booking.id },
        _sum: { amount: true },
      });
      // requested:null → full remainder; ném RefundNothingLeftError trên một
      // ledger đã settle (được controller map sang NOT_REFUNDABLE).
      const { amount } = classifyRefundAmount({
        requested: null,
        total: booking.totalAmount,
        alreadyRefunded: ledger._sum.amount ?? new Prisma.Decimal(0),
      });

      // Provider idempotency key `cancel-refund:<requestId>`: một request được
      // approve nhiều nhất một lần (append-only, flip gate trên REQUESTED), nên
      // request id đặt tên cho refund attempt này một cách deterministic (W5).
      // Gọi TRONG tx của lock (ngoại lệ ADR-0009) để lock giữ suốt read→gateway→ledger.
      const providerRefundId = await this.refunds.executeGatewayRefund(
        { ...booking, providerPaymentId: booking.providerPaymentId },
        amount,
        `cancel-refund:${request.id}`,
      );

      const flipped = await tx.$queryRaw<{ id: string; released: bigint }[]>(Prisma.sql`
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
      return { flipped, amount, providerRefundId, currency: booking.currency, code: booking.code };
    });

    const { flipped, amount, providerRefundId, currency, code } = result;
    const flip = flipped[0];
    if (!flip) {
      // Một decision đồng thời đã thắng giữa pre-check và flip: provider refund
      // ĐÃ ĐI QUA nhưng không có gì được ledger — operator phải reconcile.
      this.logger.error(
        `Approve race on request ${request.id}: provider refund ${providerRefundId} ` +
          `(${amount.toFixed(2)} ${currency}, booking ${code}) issued but NOT ledgered`,
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
      // Seat guard fail (counter đã trôi xuống dưới party size) — CHECK
      // backstop giữ nó >= 0; money story vẫn commit bất kể. Việc của operator.
      this.logger.error(
        `Approve on request ${request.id}: seats NOT released for booking ${code} ` +
          `(guard seats_booked >= party failed) — departure counter needs operator attention`,
      );
    }

    this.logger.log(
      `Cancellation request ${request.id} approved by ${adminUserId}: refunded ` +
        `${amount.toFixed(2)} ${currency}, booking ${code} CANCELLED, seats released`,
    );
    return this.decisionResult(request.id);
  }

  /** Đọc tươi → contract result (request đã decide + booking sau decision). */
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
 * UNIQUE violation (SQLSTATE 23505) trên partial index D1-B (một live
 * REQUESTED mỗi booking). Shape đã kiểm chứng thực nghiệm với Prisma 7.8.0 +
 * @prisma/adapter-pg trên một violation thật — KHÔNG lồng giống
 * isSeatsCheckViolation (bookings.service.ts): adapter NORMALIZE 23505 (khác
 * với 23514, vốn ở lại dạng cause generic có `code`) thành
 * `meta.driverAdapterError.cause = { kind: 'UniqueConstraintViolation',
 * constraint: { fields: ['booking_id'] } }` dưới P2010 bên ngoài; TÊN của index
 * chỉ còn sống trong message của error bên ngoài
 * (`… violates unique constraint "cancellation_requests_one_live_per_booking"`),
 * nên đó là chỗ được đem ra khớp.
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
