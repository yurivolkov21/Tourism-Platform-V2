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
import { buildRefundEventRow } from '../payments/refund-event.js';
import {
  cancellationBlocker,
  isCancellableStatus,
  refundOnCancelForBooking,
  refundOnOperatorCancelForBooking,
} from './booking-cancellation.js';
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
 * Số server sắp hoàn khác số khách đã xác nhận (409): hạn chót trôi qua, hoặc sổ đổi
 * (admin hoàn thiện chí), giữa lúc trang in hộp xác nhận và lúc khách bấm. Không huỷ
 * với con số khách chưa đồng ý — web đọc lại trang và hỏi lại (review nhánh ADR-0041).
 */
export class RefundAmountChangedError extends Error {
  constructor(expected: string, current: string) {
    super(`Refund amount changed: confirmed ${expected}, the booking now refunds ${current}`);
  }
}

/** Phần khách gửi kèm lệnh huỷ (contract `CancelBookingInputSchema`). */
export interface CustomerCancelInput {
  reason: string | null;
  /** Số tiền hoàn khách vừa thấy trong hộp xác nhận. */
  expectedRefundAmount: string;
}

/**
 * Đầu vào lõi huỷ dùng chung (plan 15/09 Hợp đồng C). Người gọi đã giữ advisory
 * lock của booking và tính `refundAmount` trên sổ đọc TRONG khoá.
 *
 * HAI đường vào, hai cách tính tiền (ADR-0041 §4 và §6):
 *
 * - `'customer'` — khách đổi ý. Số tiền theo hạn chót
 *   ({@link refundOnCancelForBooking}): trong hạn hoàn trọn phần chưa hoàn, quá
 *   hạn hoàn 0, vì chỗ đó không bán lại được nữa.
 * - `'operator'` — CÔNG TY bỏ chuyến (F13). Số tiền là trọn phần chưa hoàn
 *   ({@link refundOnOperatorCancelForBooking}), KHÔNG xét hạn chót: khách chẳng
 *   đổi ý gì cả, và giữ tiền của một chuyến sẽ không bao giờ chạy là sai.
 *
 * Lõi huỷ KHÔNG tự chọn con số — người gọi tính rồi đưa vào, vì chỉ người gọi
 * biết mình là đường nào. Ở đây `initiator` chỉ còn hai việc: vào payload email
 * (câu chữ hai đường khác nhau) và làm tài liệu cho người đọc kế tiếp.
 *
 * {@link cancellationBlocker} áp dụng cho CẢ HAI đường, không nới: chuyến đã
 * tới ngày khởi hành thì không còn là huỷ, mà là chuyện sau chuyến đi.
 */
export interface CancelInLockInput {
  /** Người quyết: chính khách với 'customer', admin bấm nút với 'operator'. */
  decidedById: string;
  refundAmount: Prisma.Decimal;
  /** SUM(refunds) đọc TRONG khoá — trạng thái sổ mà `refundAmount` tính từ, vào khoá chống trùng. */
  refundedTotal: Prisma.Decimal;
  /**
   * Số khách đã xác nhận, hoặc — ở đường `'operator'` — chính `refundAmount`:
   * không có hộp xác nhận nào in số cho từng khách, nên phép so này thành
   * no-op. Giữ trường thay vì cho optional để không ai quên nó ở đường mới.
   */
  expectedRefundAmount: Prisma.Decimal;
  reason: string | null;
  initiator: 'customer' | 'operator';
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
   * đã tới ngày khởi hành), RefundAmountChangedError (số hoàn đã khác số khách xác
   * nhận — không ghi gì), ProviderRefundFailedError (cổng lỗi — không ghi gì,
   * khách thử lại được).
   *
   * `now` là tham số để test tất định; route truyền đồng hồ thật.
   */
  async cancelByCustomer(
    userId: string,
    bookingCode: string,
    input: CustomerCancelInput,
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
        refundedTotal: ledger._sum.amount ?? new Prisma.Decimal(0),
        expectedRefundAmount: new Prisma.Decimal(input.expectedRefundAmount),
        reason: input.reason,
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
   * CÔNG TY huỷ chuyến: huỷ MỘT booking của chuyến ấy và hoàn trọn phần chưa
   * hoàn (ADR-0041 §6, F13). Người gọi là job hoàn tiền của worker, mỗi booking
   * một job.
   *
   * Trả về số tiền đã hoàn, hoặc `null` khi booking không còn ở trạng thái huỷ
   * được — nghĩa là **đã xong rồi**. Đó là toàn bộ cơ chế idempotent của hàng
   * đợi: pg-boss giao lại một job (worker chết giữa chừng, job hết hạn rồi
   * retry) thì lượt sau đọc trạng thái TRONG KHOÁ, thấy `CANCELLED`, và dừng
   * TRƯỚC cổng thanh toán chứ không phải sau. Không cần bảng chống trùng riêng.
   *
   * `null` chứ không ném, vì "đã hoàn rồi" là kết cục THÀNH CÔNG của job: ném ở
   * đây sẽ đốt hết `retryLimit` rồi báo lỗi cho một việc đã xong.
   *
   * KHÔNG dùng lại `refundOnCancelForBooking`: hạn chót là luật cho khách đổi
   * ý, mà đây là chuyến bị bỏ — xem {@link CancelInLockInput}.
   */
  async cancelByOperator(
    bookingId: string,
    adminId: string,
    reason: string | null,
    now: Date = new Date(),
  ): Promise<string | null> {
    return withBookingRefundLock(bookingId, async (tx) => {
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      // Đọc TRONG khoá rồi mới quyết. HAI kết cục khác nhau, và gộp chúng
      // lại là cách đánh mất tiền của khách một cách im lặng:
      //
      //  ① trạng thái đã đóng (`CANCELLED`/`REFUNDED`, hoặc chính khách vừa
      //     huỷ trước) → việc ĐÃ XONG. Trả `null`, job ack thành công.
      //  ② còn lại (thiếu capture để hoàn vào) → CẦN NGƯỜI NHÌN. Ném, để
      //     pg-boss retry rồi lượt quét còn kêu tiếp; im lặng ở đây là hứa
      //     một lượt hoàn không bao giờ xảy ra.
      //
      // Chốt ngày khởi hành KHÔNG nằm trong cả hai: xem `cancellationBlocker`.
      if (!isCancellableStatus(booking.status)) return null;
      const blocked = cancellationBlocker(booking, now, 'operator');
      if (blocked !== null) throw new BookingNotCancellableError(blocked);

      const ledger = await tx.refund.aggregate({
        where: { bookingId: booking.id },
        _sum: { amount: true },
      });
      const refundAmount = new Prisma.Decimal(
        refundOnOperatorCancelForBooking(booking, ledger._sum.amount),
      );
      await this.cancelInLock(tx, booking, {
        decidedById: adminId,
        refundAmount,
        refundedTotal: ledger._sum.amount ?? new Prisma.Decimal(0),
        // Không có hộp xác nhận nào in số cho TỪNG khách — admin xác nhận huỷ
        // cả chuyến, không xác nhận từng con số. Phép so thành no-op.
        expectedRefundAmount: refundAmount,
        reason,
        initiator: 'operator',
        now,
      });
      this.logger.log(
        `Booking ${booking.code} cancelled by the operator: refunded ${refundAmount.toFixed(2)} ${booking.currency}`,
      );
      return refundAmount.toFixed(2);
    });
  }

  /**
   * Lõi huỷ dùng chung (ADR-0041 §4, plan 15/09 Hợp đồng C) — CHẠY TRONG
   * `withBookingRefundLock` mà người gọi đang giữ; `tx` là giao dịch của khoá ấy.
   *
   *  1. Kiểm lại booking vừa đọc trong khoá: trạng thái PAID/PARTIALLY_REFUNDED,
   *     có capture, chưa tới ngày khởi hành (giờ Việt Nam). Lệnh huỷ thứ hai chờ
   *     khoá rồi thấy CANCELLED → BookingNotCancellableError. Rồi số tiền sắp hoàn
   *     phải đúng số người gọi đã xác nhận → không thì RefundAmountChangedError.
   *  2. Tiền > 0 thì gọi cổng thanh toán TRƯỚC (ADR-0009: không ghi sổ thứ chưa
   *     xảy ra), khoá chống trùng `cancel:<bookingId>:<tổng đã hoàn>` — cùng khuôn
   *     `refund:<bookingId>:<tổng đã hoàn>` của hoàn thiện chí. Số tiền lần thử là
   *     phần còn lại của sổ, nên hai lần thử cùng trạng thái sổ gửi cùng tham số và
   *     cổng trả lại kết quả cũ (thử lại sau crash hay hết giờ chờ không hoàn hai
   *     lần). Sổ đổi giữa hai lần thử (admin vừa hoàn thiện chí) thì số tiền đổi và
   *     khoá đổi theo — giữ khoá cũ với tham số mới là cổng từ chối vì trùng khoá.
   *     Cổng lỗi thì ProviderRefundFailedError bay ra, giao dịch rollback, không ghi gì.
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
    // Chốt áp THEO ĐƯỜNG: chốt ngày khởi hành là luật của khách, không phải
    // của lượt hoàn tiền chạy muộn sau khi công ty đã bỏ chuyến.
    const blocker = cancellationBlocker(booking, input.now, input.initiator);
    if (blocker) throw new BookingNotCancellableError(blocker);

    const amount = input.refundAmount;
    const amountText = amount.toFixed(2);
    // Sau chốt trạng thái (booking không huỷ được thì lỗi đó đúng hơn), TRƯỚC cổng: khách
    // chỉ đồng ý huỷ với đúng con số hộp xác nhận đã in.
    if (!amount.equals(input.expectedRefundAmount)) {
      throw new RefundAmountChangedError(input.expectedRefundAmount.toFixed(2), amountText);
    }
    const deadline = cancellationDeadline(
      calendarDate(booking.departureStartDate),
      calendarDate(booking.departureEndDate),
    );
    // `cancellationBlocker` đã loại booking không có capture, nên ép kiểu an toàn.
    const providerRefundId = amount.greaterThan(0)
      ? await this.refunds.executeGatewayRefund(
          { ...booking, providerPaymentId: booking.providerPaymentId as string },
          amount,
          `cancel:${booking.id}:${input.refundedTotal.toFixed(2)}`,
        )
      : null;

    const written = await tx.$queryRaw<
      { id: string; released: bigint; refundId: string | null; refundCreatedAt: Date | null }[]
    >(Prisma.sql`
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
        RETURNING id, created_at
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
      SELECT c.id,
             (SELECT count(*) FROM seat_release) AS released,
             -- ADR-0043 §3: mốc của dòng sổ là đồng hồ TRANSACTION, không phải
             -- đồng hồ tiến trình Node. Null khi hoàn 0 (không có dòng sổ).
             (SELECT id FROM refund_insert) AS "refundId",
             (SELECT created_at FROM refund_insert) AS "refundCreatedAt"
      FROM cancel c
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
    // ADR-0043 §3: vết ở sổ sự kiện tiền, vẫn trong tx của khoá. Đi THEO dòng
    // sổ — huỷ quá hạn hoàn 0 không ghi dòng nào thì cũng không có row này.
    if (providerRefundId && flip.refundId && flip.refundCreatedAt) {
      await tx.paymentEvent.create({
        data: buildRefundEventRow({
          provider: booking.paymentProvider,
          bookingId: booking.id,
          refundId: flip.refundId,
          providerRefundId,
          providerPaymentId: booking.providerPaymentId as string,
          amount,
          currency: booking.currency,
          cause: 'cancel',
          at: flip.refundCreatedAt,
        }),
      });
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
