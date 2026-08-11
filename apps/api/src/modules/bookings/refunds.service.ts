import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AdminRefundResult, Refund as RefundView } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus, EmailType, type PaymentProvider } from '../../generated/prisma/enums.js';
import { MediaService } from '../media/media.service.js';
import { PAYMENT_GATEWAYS, type PaymentGateway, resolveGateway } from '../payments/gateway.js';
import { bookingTourInclude, resolveTourCover, toBooking } from './bookings.service.js';
import { withBookingRefundLock } from './refund-lock.js';
import {
  classifyRefundAmount,
  deriveStatusAfterRefund,
  RefundNothingLeftError,
} from './refund-math.js';

/** Không có booking với code này (admin surface: 404 trơn, không có gì phải giấu). */
export class BookingNotFoundError extends Error {
  constructor(code: string) {
    super(`Booking "${code}" not found`);
  }
}

/**
 * Refund gate fail: status nằm ngoài PAID/PARTIALLY_REFUNDED, hoặc không có
 * captured payment nào để refund vào. Port từ gate `BOOKING_NOT_REFUNDABLE`
 * (chỉ PAID) của Nexora và MỞ RỘNG thêm PARTIALLY_REFUNDED — ledger cho phép
 * partial refund cộng dồn (spec P2 §4 invariant #5), nên một booking đã refund
 * một phần vẫn còn refundable cho tới khi ledger cộng đủ total.
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

/** Provider từ chối/lỗi lời gọi refund — không có gì được ghi ledger. */
export class ProviderRefundFailedError extends Error {
  constructor(detail: string) {
    super(`Provider refund failed: ${detail}`);
  }
}

type RefundRow = Prisma.RefundModel;

/** Refund ledger row → contract shape (money dạng string, cùng quy ước). */
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
 * Refund ledger service (spec P2 §3, W3 — bản nâng cấp audit-H1): các Refund
 * row là APPEND-ONLY và là source of truth; `Booking.status` là projection
 * được lưu, derive từ SUM(refunds) so với totalAmount, và mọi transition liên
 * quan refund đều đi qua đây (hoặc các đường auto-refund W2 trong
 * PaymentsService, vốn theo cùng ledger semantics).
 */
@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    @Inject(PAYMENT_GATEWAYS) private readonly gateways: PaymentGateway[],
    private readonly media: MediaService,
  ) {}

  /**
   * Refund (một phần) do admin phát, port từ `refundByAdmin` của Nexora sang
   * ledger. Thứ tự thao tác theo nguyên tắc W2:
   *
   *  1. Gate + classify theo ledger (`classifyRefundAmount` trên total vs
   *     SUM(refunds) — ném các domain error 422 có kiểu).
   *  2. Provider refund TRƯỚC, ngoài mọi transaction — ta không bao giờ ledger
   *     một refund chưa xảy ra, và latency HTTP của provider không bao giờ giữ
   *     một DB connection.
   *  3. MỘT transaction: append Refund row (set adminId) → re-derive
   *     Booking.status qua {@link deriveStatusAfterRefund} → enqueue outbox row
   *     BOOKING_REFUNDED. dedupeKey `refund:<bookingId>:<refundRowId>` — refund
   *     lặp lại hợp lệ theo từng booking, và refund row id là unique theo mỗi
   *     refund, thỏa quy tắc repeat-event của quy ước
   *     (docs/conventions/outbox-dedupe-key.md).
   *
   * `reason` CHỈ được mang trong outbox payload — Refund model cố ý không có
   * cột reason (audit: ledger lưu money fact; context free-text thuộc về
   * notification, schema giữ đúng như đã audit).
   *
   * Khác với Nexora, một FULL admin refund ở đây KHÔNG release seat hay set
   * cancelledAt: seat release thuộc về cancellation flow (W4 approve →
   * refund); một goodwill refund của admin trên booking vẫn đang du lịch không
   * được giải phóng seat của nó.
   */
  async refundByAdmin(
    adminUserId: string,
    bookingCode: string,
    input: { amount?: string; reason?: string },
  ): Promise<AdminRefundResult> {
    // Đọc id trước (ngoài lock) để có khoá; MỌI validation + read-ledger + gateway
    // + ghi-ledger nằm TRONG advisory lock (BK-R1, ADR-0009) — serialize refund/
    // cancel đồng thời: flow thứ hai đọc ledger đã cập nhật, không double-refund.
    const pre = await prisma.booking.findUnique({
      where: { code: bookingCode },
      select: { id: true },
    });
    if (!pre) throw new BookingNotFoundError(bookingCode);

    const updated = await withBookingRefundLock(pre.id, async (tx) => {
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: pre.id } });
      // REFUNDED nhận error chính xác (ledger đã settle), đặt trước generic
      // status gate — cùng lớp 422, nhưng tín hiệu cho operator tốt hơn.
      if (booking.status === BookingStatus.REFUNDED) throw new RefundNothingLeftError();
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
      const alreadyRefunded = ledger._sum.amount ?? new Prisma.Decimal(0);
      const { kind, amount } = classifyRefundAmount({
        requested: input.amount ?? null,
        total: booking.totalAmount,
        alreadyRefunded,
      });

      // Provider refund TRƯỚC ghi ledger. Chạy TRONG tx (ngoại lệ có chủ đích của
      // "gateway ngoài tx" — ADR-0009) để advisory lock giữ suốt read→gateway→ledger.
      // Idempotency key theo attempt-state (ledger sum): retry cùng attempt tái dùng key.
      const providerRefundId = await this.executeGatewayRefund(
        { ...booking, providerPaymentId: booking.providerPaymentId },
        amount,
        `refund:${booking.id}:${alreadyRefunded.toFixed(2)}`,
      );

      const nextStatus = deriveStatusAfterRefund(alreadyRefunded.add(amount), booking.totalAmount);
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
        include: { tour: bookingTourInclude },
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
      this.logger.log(
        `Admin ${adminUserId} refunded ${amount.toFixed(2)} ${booking.currency} on booking ${booking.code} (${kind} → ${nextStatus})`,
      );
      return row;
    });

    const tourImage = await resolveTourCover(this.media, updated.tourId);
    return {
      booking: toBooking(updated, null, tourImage),
      refunds: await this.historyForBooking(bookingCode),
    };
  }

  /**
   * Bước provider-refund được DÙNG CHUNG bởi admin refund phía trên và W4
   * cancellation-approve flow (spec: reuse, đừng nhân bản logic gateway):
   * resolve gateway của booking và refund `amount` theo currency của BOOKING —
   * invariant #6 theo thiết kế, một currency mismatch là bất khả biểu diễn.
   * Chạy NGOÀI mọi transaction một cách cố ý (latency HTTP của provider không
   * bao giờ giữ DB connection; ta không bao giờ ledger một refund chưa xảy ra
   * — caller ledger SAU khi hàm này trả về). Fail thì bọc vào
   * {@link ProviderRefundFailedError} (→ 502), chưa có gì được ghi.
   *
   * `idempotencyKey` (W5): deterministic theo mỗi refund ATTEMPT, được các
   * gateway thật forward làm provider idempotency header (Stripe
   * `Idempotency-Key` / `PayPal-Request-Id`) — một crash-retry của cùng attempt
   * không bao giờ double-refund ở provider. Xem RefundInput cho key theo từng
   * flow.
   */
  async executeGatewayRefund(
    booking: {
      code: string;
      currency: string;
      paymentProvider: PaymentProvider;
      providerPaymentId: string;
    },
    amount: Prisma.Decimal,
    idempotencyKey: string,
  ): Promise<string> {
    try {
      const gateway = resolveGateway(this.gateways, booking.paymentProvider);
      const { providerRefundId } = await gateway.refund({
        providerPaymentId: booking.providerPaymentId,
        amount: amount.toFixed(2),
        currency: booking.currency,
        idempotencyKey,
      });
      return providerRefundId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      this.logger.error(`Provider refund failed for booking ${booking.code}: ${message}`);
      throw new ProviderRefundFailedError(message);
    }
  }

  /**
   * Refund ledger của một booking, cũ nhất trước (append order). Đã ở dạng
   * contract — admin detail view sẽ có sau (P4); int test gọi thẳng hàm này.
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
