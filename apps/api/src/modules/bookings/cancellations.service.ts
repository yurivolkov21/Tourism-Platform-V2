import { Injectable, Logger } from '@nestjs/common';
import type {
  CancelBookingResult,
  CancellationRequest as CancellationRequestView,
} from '@tourism/contract';
import { cancellationDeadline } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { calendarDate } from '../../lib/calendar-date.js';
import { MediaService } from '../media/media.service.js';
import { cancellationBlocker, refundOnCancelForBooking } from './booking-cancellation.js';
import { bookingTourInclude, resolveTourCover, toBooking } from './bookings.service.js';
import { withBookingRefundLock } from './refund-lock.js';
import { BookingNotFoundError, RefundsService } from './refunds.service.js';

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

type CancellationRow = Prisma.CancellationRequestModel;

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
    // Khách tự huỷ ghi `decided_by` = chính khách (ADR-0041 §4); luồng duyệt cũ
    // ghi id admin. So với `user_id` của CHÍNH dòng này, không tra bảng users.
    decidedByCustomer: row.decidedById !== null && row.decidedById === row.userId,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Huỷ booking (ADR-0041 §4): khách tự huỷ qua lõi huỷ dùng chung, chạy trong
 * advisory lock của booking — gọi cổng thanh toán trước, một CTE ghi sau. Mỗi
 * lần huỷ để lại đúng MỘT dòng `cancellation_requests` REFUNDED (append-only,
 * D1-B). Luồng khách gửi yêu cầu, admin duyệt đã bỏ theo ADR-0041.
 *
 * Semantics của terminal-state nằm ở docs/conventions/booking-states.md:
 * Refund ledger ghi câu chuyện MONEY, Booking.status ghi câu chuyện
 * SEAT/TRAVEL — huỷ set CANCELLED tường minh (khách ngừng du lịch, ghế được trả
 * lại), KHÔNG phải REFUNDED suy từ ledger.
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
}
