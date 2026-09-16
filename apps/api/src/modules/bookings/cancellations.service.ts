import { Injectable, Logger } from '@nestjs/common';
import type {
  AdminCancellationRequest,
  AdminCancellationsListQuery,
  CancelBookingResult,
  CancellationRequest as CancellationRequestView,
  DecideCancellationResult,
  Paged,
} from '@tourism/contract';
import {
  cancellationDeadline,
  policyRefundAmount,
  refundPercentForRequest,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus, CancellationRequestStatus } from '../../generated/prisma/enums.js';
import { calendarDate } from '../../lib/calendar-date.js';
import { createdAtRange } from '../../lib/created-at-range.js';
import { toPaged } from '../../lib/paged.js';
import { MediaService } from '../media/media.service.js';
import { cancellationBlocker, refundOnCancelForBooking } from './booking-cancellation.js';
import { bookingTourInclude, resolveTourCover, toBooking } from './bookings.service.js';
import { withBookingRefundLock } from './refund-lock.js';
import { classifyRefundAmount, RefundNothingLeftError } from './refund-math.js';
import {
  BookingNotFoundError,
  BookingNotRefundableError,
  RefundsService,
} from './refunds.service.js';

/**
 * Booking không huỷ online được (422): trạng thái ngoài PAID/PARTIALLY_REFUNDED,
 * không có capture để hoàn vào, hoặc đã tới ngày khởi hành theo giờ Việt Nam
 * (ADR-0041 §4). Lệnh huỷ thứ hai của cùng booking cũng rơi vào đây.
 */
export class BookingNotCancellableError extends Error {
  constructor(detail: string) {
    super(`Booking cannot be cancelled: ${detail}`);
  }
}

/**
 * Đầu vào lõi huỷ dùng chung (plan 15/09 Hợp đồng C). Người gọi đã giữ advisory
 * lock của booking và tính `refundAmount` trên sổ đọc TRONG khoá. P4e-1 sẽ thêm
 * initiator 'operator' (công ty huỷ chuyến, hoàn toàn bộ phần còn lại).
 */
export interface CancelInLockInput {
  /** Người quyết: chính khách khi `initiator` là 'customer'. */
  decidedById: string;
  refundAmount: Prisma.Decimal;
  reason: string | null;
  initiator: 'customer';
  /** Đồng hồ của lượt huỷ — dùng cho phép kiểm "chưa tới ngày khởi hành". */
  now: Date;
}

/** Không có cancellation request với id này (admin surface: 404 trơn). */
export class CancellationRequestNotFoundError extends Error {
  constructor(id: string) {
    super(`Cancellation request "${id}" not found`);
  }
}

/** Request đã DENIED/REFUNDED — decision là chung cuộc (409). D1-B: history
 * row không bao giờ được tái dùng; khách re-request thay vào đó. */
/**
 * Số tiền hoàn khác mức chính sách mà không có `decisionNote` (ADR-0030 §5).
 * Mang theo mức chính sách để câu lỗi nói được "bậc cho bao nhiêu".
 */
export class OffPolicyNoteRequiredError extends Error {
  constructor(policyAmount: string) {
    super(
      `Refund amount differs from the policy amount (${policyAmount}); a decision note is required`,
    );
  }
}

export class CancellationAlreadyDecidedError extends Error {
  constructor(status: CancellationRequestStatus) {
    super(`Request is ${status}; only an open (REQUESTED) request can be decided`);
  }
}

type CancellationRow = Prisma.CancellationRequestModel;

/** Booking context admin cần để quyết định mà không phải lookup lần hai — toàn
 * cột SNAPSHOT (tourTitle/departureStartDate đóng băng lúc create, audit H3). */
const BOOKING_CONTEXT = {
  id: true,
  code: true,
  tourTitle: true,
  departureStartDate: true,
  contactName: true,
  contactEmail: true,
  // Tiền (review F3 31/08): approve hoàn PHẦN CÒN LẠI — queue phải mang total
  // + đã-hoàn để admin THẤY con số trước khi bấm, không quyết mù.
  totalAmount: true,
  currency: true,
} as const;

type BookingContext = {
  id: string;
  code: string;
  tourTitle: string;
  departureStartDate: Date;
  contactName: string;
  contactEmail: string;
  totalAmount: Prisma.Decimal;
  currency: string;
};

/** Row → public contract shape (customer surface + history trong admin byCode). */
function toCancellationRequest(row: CancellationRow, bookingCode: string): CancellationRequestView {
  return {
    id: row.id,
    bookingCode,
    reason: row.reason,
    status: row.status,
    freeCancellationDays: row.freeCancellationDays,
    decisionNote: row.decisionNote,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Row + booking context + tổng đã hoàn (aggregate ledger) → shape admin-queue. */
function toAdminCancellationRequest(
  row: CancellationRow & { booking: BookingContext },
  refundedTotal: Prisma.Decimal | null,
): AdminCancellationRequest {
  return {
    ...toCancellationRequest(row, row.booking.code),
    tourTitle: row.booking.tourTitle,
    departureStartDate: calendarDate(row.booking.departureStartDate),
    contactName: row.booking.contactName,
    contactEmail: row.booking.contactEmail,
    totalAmount: row.booking.totalAmount.toFixed(2),
    refundedTotal: (refundedTotal ?? new Prisma.Decimal(0)).toFixed(2),
    currency: row.booking.currency,
  };
}

/**
 * Huỷ booking đã trả. Từ ADR-0041 khách tự huỷ NGAY (`cancelByCustomer`, lõi
 * `cancelInLock`); không còn luồng gửi yêu cầu chờ duyệt. Phần admin deny/approve
 * yêu cầu REQUESTED cũ (spec P2 §3 W4, D1 chốt là B; ADR-0029/0030) còn sống tới
 * plan 15/09 Task 8 cho dữ liệu cũ. Request là history APPEND-ONLY — mỗi request
 * INSERT một row mới, DENIED row không bao giờ tái dùng (Nexora upsert đè lên
 * chúng, làm mất audit trail của denial — audit M7); "một live request mỗi
 * booking" là việc của DB qua partial unique index
 * `cancellation_requests_one_live_per_booking` (WHERE status = 'REQUESTED').
 *
 * Semantics của terminal-state nằm ở docs/conventions/booking-states.md:
 * Refund ledger ghi câu chuyện MONEY, Booking.status ghi câu chuyện
 * SEAT/TRAVEL — một lần huỷ set CANCELLED tường minh (khách ngừng du lịch, seat
 * được trả lại), KHÔNG phải REFUNDED derive từ ledger, dù ledger có cộng đủ
 * total. Cancellation ≠ chỉ refund.
 */
@Injectable()
export class CancellationsService {
  private readonly logger = new Logger(CancellationsService.name);

  constructor(
    private readonly refunds: RefundsService,
    private readonly media: MediaService,
  ) {}

  /**
   * Khách tự huỷ booking của chính mình, xử lý NGAY (ADR-0041 §4): trong hạn chót
   * hoàn toàn bộ phần chưa hoàn, quá hạn hoàn 0; cả hai đều huỷ booking, trả chỗ,
   * ghi một yêu cầu REFUNDED do chính khách quyết và xếp email `BOOKING_CANCELLED`.
   *
   * Ném BookingNotFoundError (không phải chủ hoặc không tồn tại — 404, không lộ sự
   * tồn tại), BookingNotCancellableError (trạng thái sai, không có capture, hoặc
   * đã tới ngày khởi hành), ProviderRefundFailedError (cổng lỗi — không ghi gì,
   * khách thử lại được).
   *
   * `now` là tham số để test tất định; route truyền đồng hồ thật.
   */
  async cancelByCustomer(
    userId: string,
    bookingCode: string,
    reason: string | null,
    now: Date = new Date(),
  ): Promise<CancelBookingResult> {
    const probe = await prisma.booking.findUnique({
      where: { code: bookingCode },
      select: { id: true, userId: true },
    });
    // Chủ booking không bao giờ đổi nên kiểm ngoài khoá là đủ; mọi thứ còn lại
    // đọc TƯƠI trong khoá.
    if (!probe || probe.userId !== userId) throw new BookingNotFoundError(bookingCode);

    const refundedAmount = await withBookingRefundLock(probe.id, async (tx) => {
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: probe.id } });
      const ledger = await tx.refund.aggregate({
        where: { bookingId: booking.id },
        _sum: { amount: true },
      });
      // Số tiền theo luật, trên sổ đọc TRONG khoá — cùng hàm với
      // `bookings.byCode.cancellation`. Admin hoàn thiện chí chen giữa thì phải
      // chờ cùng khoá, nên sổ đọc ở đây luôn là sổ mới nhất.
      const refundAmount = new Prisma.Decimal(
        refundOnCancelForBooking(booking, ledger._sum.amount, now),
      );
      await this.cancelInLock(tx, booking, {
        decidedById: userId,
        refundAmount,
        reason,
        initiator: 'customer',
        now,
      });
      return refundAmount;
    });

    const [row, refunded] = await Promise.all([
      prisma.booking.findUniqueOrThrow({
        where: { id: probe.id },
        include: { tour: bookingTourInclude },
      }),
      prisma.refund.aggregate({ where: { bookingId: probe.id }, _sum: { amount: true } }),
    ]);
    const tourImage = await resolveTourCover(this.media, row.tourId);
    this.logger.log(
      `Booking ${row.code} cancelled by its owner: refunded ${refundedAmount.toFixed(2)} ${row.currency}`,
    );
    return {
      // `refundedTotal` THẬT (như adminByCode): khách vừa huỷ cần thấy tổng đã
      // hoàn ngay trong kết quả, không phải '0.00' mặc định của toBooking.
      booking: toBooking(row, null, tourImage, { refundedTotal: refunded._sum.amount }),
      refundedAmount: refundedAmount.toFixed(2),
    };
  }

  /**
   * Lõi huỷ dùng chung (ADR-0041 §4, plan 15/09 Hợp đồng C) — CHẠY TRONG
   * `withBookingRefundLock` mà người gọi đang giữ; `tx` là giao dịch của khoá ấy.
   *
   *  1. Kiểm lại booking vừa đọc trong khoá: trạng thái PAID/PARTIALLY_REFUNDED,
   *     có capture, chưa tới ngày khởi hành (giờ Việt Nam). Lệnh huỷ thứ hai chờ
   *     khoá rồi thấy CANCELLED → BookingNotCancellableError.
   *  2. Tiền > 0 thì gọi cổng thanh toán TRƯỚC (ADR-0009: không ghi sổ thứ chưa
   *     xảy ra), khoá chống trùng `cancel:<bookingId>` — một booking chỉ huỷ được
   *     một lần nên khoá này ổn định qua mọi lần thử lại sau crash. Cổng lỗi thì
   *     ProviderRefundFailedError bay ra, giao dịch rollback, không ghi gì.
   *  3. MỘT câu SQL (CTE), mọi thứ dẫn từ lượt flip booking để guard trạng thái
   *     thua thì cả câu thành no-op:
   *       cancel        — booking → CANCELLED + cancelled_at (travel story,
   *                       docs/conventions/booking-states.md).
   *       req_insert    — một yêu cầu REFUNDED (giữ nghĩa "đã giải quyết" kể cả
   *                       khi hoàn 0), decided_by/decided_at, lý do tuỳ chọn.
   *       refund_insert — dòng sổ khi tiền > 0: admin_id NULL (không ai bấm nút
   *                       admin), provider_payment_id = capture được hoàn vào
   *                       (ADR-0006 AMEND 1b). Trigger `refunds_sum_within_total`
   *                       vẫn là lưới cuối.
   *       seat_release  — `seats_booked − party`, guard `seats_booked >= party`.
   *       outbox_insert — BOOKING_CANCELLED, dedupe `booking-cancelled:<bookingId>`.
   *
   * Guard ghế không khớp: log cho người vận hành, giao dịch vẫn commit (tiền đã đi
   * thì câu chuyện tiền phải được ghi) — giữ hành vi của approve.
   */
  private async cancelInLock(
    tx: Prisma.TransactionClient,
    booking: Prisma.BookingModel,
    input: CancelInLockInput,
  ): Promise<void> {
    const blocker = cancellationBlocker(booking, input.now);
    if (blocker) throw new BookingNotCancellableError(blocker);

    const amount = input.refundAmount;
    const amountText = amount.toFixed(2);
    const deadline = cancellationDeadline(
      calendarDate(booking.departureStartDate),
      calendarDate(booking.departureEndDate),
    );
    // `cancellationBlocker` đã loại booking không có capture, nên ép kiểu an toàn.
    const providerRefundId = amount.greaterThan(0)
      ? await this.refunds.executeGatewayRefund(
          { ...booking, providerPaymentId: booking.providerPaymentId as string },
          amount,
          `cancel:${booking.id}`,
        )
      : null;

    const written = await tx.$queryRaw<{ id: string; released: bigint }[]>(Prisma.sql`
      WITH cancel AS (
        UPDATE bookings b
        SET status = 'CANCELLED'::"BookingStatus",
            cancelled_at = now(),
            updated_at = now()
        WHERE b.id = ${booking.id}::uuid
          AND b.status IN ('PAID'::"BookingStatus", 'PARTIALLY_REFUNDED'::"BookingStatus")
        RETURNING b.id, b.user_id, b.departure_id, (b.num_adults + b.num_children) AS seats,
                  b.code, b.contact_email, b.contact_name, b.tour_title
      ),
      req_insert AS (
        INSERT INTO cancellation_requests (id, booking_id, user_id, reason, status,
                                           decided_by, decided_at, updated_at)
        SELECT gen_random_uuid(), c.id, c.user_id, ${input.reason}::text,
               'REFUNDED'::"CancellationRequestStatus", ${input.decidedById}::uuid, now(), now()
        FROM cancel c
        RETURNING id
      ),
      refund_insert AS (
        INSERT INTO refunds (id, booking_id, amount, currency, provider_refund_id,
                             provider_payment_id, admin_id)
        SELECT gen_random_uuid(), c.id, ${amountText}::numeric, ${booking.currency}::text,
               ${providerRefundId}::text, ${booking.providerPaymentId}::text, NULL
        FROM cancel c
        WHERE ${amountText}::numeric > 0
        RETURNING id
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
        SELECT 'BOOKING_CANCELLED'::"EmailType",
               jsonb_build_object(
                 'bookingId', c.id,
                 'code', c.code,
                 'email', c.contact_email,
                 'name', c.contact_name,
                 'title', c.tour_title,
                 'amount', ${amountText}::text,
                 'currency', ${booking.currency}::text,
                 'refunded', ${amountText}::numeric > 0,
                 'deadline', ${deadline}::text,
                 'initiator', ${input.initiator}::text
               ),
               'booking-cancelled:' || c.id::text
        FROM cancel c
        ON CONFLICT (dedupe_key) DO NOTHING
      )
      SELECT c.id, (SELECT count(*) FROM seat_release) AS released FROM cancel c
    `);

    const flip = written[0];
    if (!flip) {
      // Booking đổi trạng thái giữa lượt kiểm trong khoá và lượt flip — chỉ có thể
      // do một đường ghi NGOÀI khoá. Tiền (nếu có) ĐÃ đi mà sổ không ghi: người vận
      // hành phải đối soát.
      this.logger.error(
        `Cancel on booking ${booking.code}: status changed before the write; provider refund ` +
          `${providerRefundId ?? 'none'} (${amountText} ${booking.currency}) NOT ledgered`,
      );
      throw new BookingNotCancellableError('the booking changed state while cancelling');
    }
    if (Number(flip.released) === 0) {
      this.logger.error(
        `Cancel on booking ${booking.code}: seats NOT released ` +
          '(guard seats_booked >= party failed) — departure counter needs operator attention',
      );
    }
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
    const { page, limit, status, from, to } = query;
    // Khoảng ngày theo `createdAt` — ngày khách GỬI yêu cầu (ADR-0028 §AMEND).
    // KHÔNG theo `decidedAt`: hàng REQUESTED có `decidedAt` null nên lọc theo
    // cột ấy sẽ quét sạch hàng đợi đang mở khỏi bảng. Phép đổi ngày → mốc và
    // lý do dùng biên nửa-mở nằm ở `created-at-range.ts`, dùng CHUNG với
    // `/bookings` nên hai vùng cắt cùng một nhát.
    const createdAt = createdAtRange(from, to);
    const where: Prisma.CancellationRequestWhereInput = {
      ...(status ? { status } : {}),
      ...(createdAt ? { createdAt } : {}),
    };
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
    // MỘT groupBy cho cả trang (chống N+1): tổng đã hoàn theo booking — client
    // tính phần-còn-lại cho dialog approve (review F3 31/08).
    const sums = await prisma.refund.groupBy({
      by: ['bookingId'],
      where: { bookingId: { in: rows.map((row) => row.booking.id) } },
      _sum: { amount: true },
    });
    const refundedByBooking = new Map(sums.map((sum) => [sum.bookingId, sum._sum.amount]));
    return toPaged(
      rows.map((row) =>
        toAdminCancellationRequest(row, refundedByBooking.get(row.booking.id) ?? null),
      ),
      { page, limit, total },
    );
  }

  /**
   * Quyết định của admin — 404 nếu id lạ, 409 khi đã decide (append-only: một
   * decision là chung cuộc, khách re-request chứ không reopen row).
   */
  async decide(
    adminUserId: string,
    requestId: string,
    input: { approve: boolean; decisionNote?: string; refundAmount?: string },
  ): Promise<DecideCancellationResult> {
    const request = await prisma.cancellationRequest.findUnique({
      where: { id: requestId },
      include: { booking: true },
    });
    if (!request) throw new CancellationRequestNotFoundError(requestId);
    if (request.status !== CancellationRequestStatus.REQUESTED) {
      throw new CancellationAlreadyDecidedError(request.status);
    }
    // Contract đã trim + min(1) (W1) — ở đây chỉ còn đổi vắng → null.
    const note = input.decisionNote ?? null;
    return input.approve
      ? this.approve(adminUserId, request, note, input.refundAmount)
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
   *  1. Gate (TƯƠI, trong lock) — CHỈ áp khi còn tiền phải chuyển (ADR-0029
   *     §2 và §AMEND 3): booking phải refundable (PAID / PARTIALLY_REFUNDED có
   *     captured payment). HAI ca bỏ qua gate, cùng một lý do — không đồng nào
   *     phải chuyển nên trạng thái thanh toán không còn là điều kiện của việc
   *     đóng request + nhả ghế: sổ ĐÃ settle (tiền hoàn hết từ trước), và mức
   *     hoàn được duyệt BẰNG 0 (bậc chính sách cho 0% ở ca huỷ sát ngày).
   *     Cả hai đều từng kẹt ở 422 với GHẾ KHÔNG BAO GIỜ ĐƯỢC NHẢ.
   *  2. Provider refund `refundAmount` (vắng → MỨC CHÍNH SÁCH, ADR-0029
   *     AMEND 5 — bậc 0% nghĩa là hoàn 0, KHÔNG còn "trọn phần dư"), không
   *     bao giờ ledger thứ chưa xảy ra. Không có gì để chuyển (settle
   *     hoặc duyệt 0) thì KHÔNG gọi gateway và KHÔNG ghi row nào — sổ
   *     append-only chỉ kể tiền thật sự đi.
   *     Chạy TRONG tx của lock — ngoại lệ có chủ đích của "gateway ngoài tx"
   *     (ADR-0009), chỉ cho đường refund hiếm; lock giữ suốt read→gateway→ledger.
   *     `adminId` = admin đang quyết định.
   *  3. MỘT statement nguyên tử (house CTE style, chạy qua `tx.$queryRaw` trong
   *     lock), mọi thứ driven FROM cái flip của request để một decide-race bị
   *     thua làm CẢ statement thành no-op:
   *       req_flip     — REQUESTED → REFUNDED (giá trị resolved-by-refund của
   *                      model) + decidedBy/decidedAt/note; qual quyết-định-race
   *                      trên UPDATE target.
   *       refund_insert— append Refund ledger row (money story). BỎ QUA khi
   *                      amount = 0: một row 0.00 không có provider_refund_id
   *                      là một dòng sổ kể về việc không xảy ra.
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
    refundAmount?: string,
  ): Promise<DecideCancellationResult> {
    const bookingId = request.booking.id;

    // MỌI gate + ledger + gateway + ghi nằm TRONG advisory lock (BK-R1
    // cross-path, ADR-0009) — serialize với refundByAdmin/approve đồng thời trên
    // cùng booking. Đọc booking TƯƠI trong lock (không xài request.booking cũ).
    const result = await withBookingRefundLock(bookingId, async (tx) => {
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      const ledger = await tx.refund.aggregate({
        where: { bookingId: booking.id },
        _sum: { amount: true },
      });
      const alreadyRefunded = ledger._sum.amount ?? new Prisma.Decimal(0);

      // Mức CHÍNH SÁCH tính VÔ ĐIỀU KIỆN từ dữ liệu tươi trong lock (ADR-0029
      // AMEND 5 + ADR-0030 §5b): nó vừa là mặc định khi client bỏ trống
      // `refundAmount`, vừa là mốc so cho luật vượt-bậc-phải-ghi-lý-do. Cùng
      // `policyRefundAmount` mà admin và web dùng — "khớp bậc" ở ba nơi là
      // cùng một phép tính.
      // Badge đọc từ SNAPSHOT trên request (ADR-0029 AMEND 6); chỉ row cũ
      // trước migration (null) mới rơi về badge hiện tại của tour.
      const freeCancellationDays =
        request.freeCancellationDays ??
        (
          await tx.tour.findUnique({
            where: { id: booking.tourId },
            select: { freeCancellationDays: true },
          })
        )?.freeCancellationDays ??
        null;
      const percent = refundPercentForRequest({
        requestedAt: request.createdAt,
        paidAt: booking.paidAt?.toISOString() ?? null,
        departureStartDate: calendarDate(booking.departureStartDate),
        freeCancellationDays,
      });
      const policyAmount = policyRefundAmount({
        percent,
        totalAmount: booking.totalAmount.toFixed(2),
        refundedTotal: alreadyRefunded.toFixed(2),
      });

      // Sổ đã settle: KHÔNG còn gì để chuyển (ADR-0029 §2). Approve vẫn chạy —
      // "chấp thuận yêu cầu huỷ" là một quyết định, và tiền đã hoàn hết từ
      // trước chỉ nghĩa là bước tiền không còn việc, chứ không phải lý do từ
      // chối cả lệnh. Đây là đường chữa cho booking đã hoàn đủ qua W3 trong
      // lúc request còn mở — trước ADR-0029 chúng kẹt vĩnh viễn ở 422 và ghế
      // không bao giờ được nhả.
      const settled = booking.totalAmount.sub(alreadyRefunded).lessThanOrEqualTo(0);
      // AMEND 5: vắng `refundAmount` = MỨC CHÍNH SÁCH — không còn "trọn phần
      // dư" (cửa hậu audit 05/09: bậc 0% mà bỏ trống trường này là được hoàn
      // 100% không dấu vết). policyRefundAmount đã kẹp theo phần dư nên sổ
      // settle cho ra 0.
      const requested = refundAmount ?? policyAmount;
      // Duyệt với mức hoàn BẰNG 0 (ADR-0029 §AMEND 3): bậc chính sách trả 0%
      // cho yêu cầu gửi sát ngày khởi hành, và đó là kết cục HỢP LỆ chứ không
      // phải lỗi. Trước AMEND này con số 0 rơi vào `classifyRefundAmount` và ăn
      // 422 ZERO_OR_NEGATIVE, tức chính ca huỷ muộn — ca thường gặp nhất —
      // không approve được, và GHẾ KHÔNG BAO GIỜ ĐƯỢC NHẢ. Đúng cái bug mà
      // §2 vừa chữa cho một ca khác.
      const approvedZero = new Prisma.Decimal(requested).isZero();
      // Sổ đã settle mà client vẫn gửi một số KHÁC 0 là hai bên đang nhìn hai
      // sổ khác nhau (trang admin render trước khi W3 hoàn đủ). Nuốt con số ấy
      // rồi trả 200 là để admin tin 50$ vừa đi trong khi sổ không có dòng nào
      // (vòng vá review 05/09) — phải nói ra bằng NOTHING_LEFT.
      if (settled && refundAmount !== undefined && !approvedZero) {
        throw new RefundNothingLeftError();
      }
      /** Không có đồng nào phải chuyển — dù vì sổ đã settle hay vì bậc cho 0%. */
      const noMoneyToMove = settled || approvedZero;

      // Gate CHỈ áp khi thật sự phải chuyển tiền: hết tiền để chuyển thì trạng
      // thái booking không còn là điều kiện của việc đóng request + nhả ghế.
      if (!noMoneyToMove) {
        const refundableStatus =
          booking.status === BookingStatus.PAID ||
          booking.status === BookingStatus.PARTIALLY_REFUNDED;
        if (!refundableStatus || !booking.providerPaymentId) {
          throw new BookingNotRefundableError(booking.status, booking.providerPaymentId != null);
        }
      }

      // Mọi lỗi tiền vẫn do `classifyRefundAmount` canh: ≤ 0, vượt phần dư,
      // hay sổ đã settle — server không tin con số client gửi.
      const amount = noMoneyToMove
        ? new Prisma.Decimal(0)
        : classifyRefundAmount({
            requested,
            total: booking.totalAmount,
            alreadyRefunded,
          }).amount;

      // ADR-0030 §5 cưỡng chế ở SERVER, mở rộng bởi ADR-0029 AMEND 5: MỌI lệch
      // giữa số sẽ hoàn và mức chính sách đòi lý do — bất kể client có gửi số
      // hay không (vắng thì bằng nhau theo cách dựng, tự qua). Server KHÔNG
      // khoá số (đường vượt bậc là hợp lệ: công ty huỷ chuyến, bất khả kháng);
      // nó chỉ đòi đúng thứ §5 hứa.
      if (note === null && !amount.equals(new Prisma.Decimal(policyAmount))) {
        throw new OffPolicyNoteRequiredError(policyAmount);
      }

      // Provider idempotency key `cancel-refund:<requestId>`: một request được
      // approve nhiều nhất một lần (append-only, flip gate trên REQUESTED), nên
      // request id đặt tên cho refund attempt này một cách deterministic (W5).
      // Gọi TRONG tx của lock (ngoại lệ ADR-0009) để lock giữ suốt read→gateway→ledger.
      // Sổ đã settle thì KHÔNG gọi gateway: không có đồng nào để chuyển.
      const providerRefundId = noMoneyToMove
        ? null
        : await this.refunds.executeGatewayRefund(
            { ...booking, providerPaymentId: booking.providerPaymentId as string },
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
          -- Amount 0 KHÔNG ghi row nào: sổ refund là append-only cho tiền THẬT
          -- SỰ chuyển đi (ADR-0002). Một row 0.00 không có provider_refund_id
          -- là một dòng sổ kể về việc không xảy ra. provider_payment_id =
          -- capture được hoàn vào (ADR-0006 AMEND 1b — nguồn cho guard
          -- dup-capture của auto-refund).
          INSERT INTO refunds (id, booking_id, amount, currency, provider_refund_id,
                               provider_payment_id, admin_id)
          SELECT gen_random_uuid(), r.booking_id, ${amount.toFixed(2)}::numeric,
                 ${booking.currency}::text, ${providerRefundId}::text,
                 ${booking.providerPaymentId}::text, ${adminUserId}::uuid
          FROM req_flip r
          WHERE ${amount.toFixed(2)}::numeric > 0
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
      include: { booking: { include: { tour: bookingTourInclude } } },
    });
    const [tourImage, refunded] = await Promise.all([
      resolveTourCover(this.media, row.booking.tourId),
      prisma.refund.aggregate({
        where: { bookingId: row.booking.id },
        _sum: { amount: true },
      }),
    ]);
    return {
      request: toAdminCancellationRequest({ ...row, booking: row.booking }, refunded._sum.amount),
      booking: toBooking(row.booking, null, tourImage),
    };
  }
}
