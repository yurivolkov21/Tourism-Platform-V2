import { Injectable, Logger } from '@nestjs/common';
import type { AdminDepartureCancelInput, AdminDepartureRow } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus, DepartureStatus } from '../../generated/prisma/enums.js';
import { calendarDate } from '../../lib/calendar-date.js';
import type { DepartureRefundJob } from '../../worker/departure-refund.service.js';
import { enqueueDepartureRefunds } from '../../worker/departure-refund-queue.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';
import {
  AdminDeparturesService,
  DepartureNotFoundError,
  DepartureRuleError,
} from './admin-departures.service.js';
import { departureCancelBlocker } from './departure-rules.js';

/**
 * CÔNG TY huỷ chuyến (F13, ADR-0041 §6) — lệnh ghi duy nhất của vùng catalog
 * tiêu tiền thật, nên nó ở file RIÊNG thay vì nối thêm vào
 * `AdminDeparturesService`.
 *
 * ## Hình dạng: một transaction ĐỒNG BỘ, rồi tiền đi bất đồng bộ
 *
 * Trong transaction (khoá chuyến bằng `FOR UPDATE`):
 *
 *  1. chuyến đổi sang `CANCELLED` — nó phải biến khỏi web NGAY, không đợi
 *     đồng nào;
 *  2. booking `PENDING` huỷ luôn tại chỗ. Chúng chưa trả tiền nên không có gì
 *     để hoàn, và để lại thì một lượt thanh toán về sau sẽ đâm vào một chuyến
 *     đã huỷ. KHÔNG trả ghế: `PENDING` chưa từng claim ghế (bất biến #1 của
 *     ADR-0009, cùng lý lẽ `pending-sweep.service.ts`);
 *  3. chụp danh sách booking CẦN HOÀN (`PAID`, `PARTIALLY_REFUNDED`).
 *
 * Sau commit: một job cho MỖI booking cần hoàn, rồi bust cache web.
 *
 * ## Vì sao không hoàn tiền ngay trong request
 *
 * Một chuyến 30 khách là 30 lời gọi ra cổng thanh toán. Request đầu tiên hết
 * giờ chờ sẽ để lại một lượt huỷ nửa chừng mà không ai biết đã tới đâu — và
 * admin bấm lại thì lần hai bị từ chối vì chuyến đã `CANCELLED`. Hàng đợi có
 * retry riêng, idempotent riêng, và cột tiến độ ở màn admin đọc được.
 *
 * ## Chỗ dễ sai đã canh
 *
 * Đường này KHÔNG gọi `refundOnCancelForBooking` (luật của khách): số tiền do
 * `cancelByOperator` chọn bằng `refundOnOperatorCancelForBooking` — trọn phần
 * chưa hoàn, không xét hạn chót.
 */
@Injectable()
export class DepartureCancelService {
  private readonly logger = new Logger(DepartureCancelService.name);

  constructor(
    private readonly departures: AdminDeparturesService,
    private readonly webRevalidation: WebRevalidationService,
  ) {}

  async cancel(input: AdminDepartureCancelInput, adminId: string): Promise<AdminDepartureRow> {
    const now = new Date();
    const { tourSlug, toRefund, cancelledPending, startDate, endDate } = await prisma.$transaction(
      async (tx) => {
        const [locked] = await tx.$queryRaw<
          {
            id: string;
            tour_id: string;
            start_date: Date;
            end_date: Date;
            status: DepartureStatus;
          }[]
        >(Prisma.sql`
          SELECT id, tour_id, start_date, end_date, status
          FROM tour_departures WHERE id = ${input.id}::uuid FOR UPDATE
        `);
        if (!locked) throw new DepartureNotFoundError(input.id);
        // Bấm huỷ lần hai: từ chối và KHÔNG đẩy job trùng. Lượt đầu đã xếp đủ
        // job rồi; xếp thêm một bộ nữa là nhân đôi số lần gọi cổng thanh toán
        // cho cùng một khách (job idempotent nên không hoàn hai lần, nhưng
        // đốt retry và làm cột tiến độ nói dối).
        if (locked.status === DepartureStatus.CANCELLED) {
          throw new DepartureRuleError(
            'DEPARTURE_CANCELLED',
            'This departure has already been cancelled — its travellers are being refunded.',
          );
        }

        const startDate = calendarDate(locked.start_date);
        const endDate = calendarDate(locked.end_date);
        const blocked = departureCancelBlocker(startDate, endDate, now);
        if (blocked) throw new DepartureRuleError('DEPARTURE_STARTED', blocked);

        const tourRow = await tx.tour.findUniqueOrThrow({
          where: { id: locked.tour_id },
          select: { slug: true },
        });

        // Chụp TRONG khoá, trước khi đụng vào trạng thái nào: đây là danh sách
        // sẽ biến thành hàng đợi, và nó phải khớp đúng thực tại lúc khoá.
        const live = await tx.booking.findMany({
          where: {
            departureId: locked.id,
            status: {
              in: [BookingStatus.PENDING, BookingStatus.PAID, BookingStatus.PARTIALLY_REFUNDED],
            },
          },
          select: { id: true, status: true },
        });

        await tx.tourDeparture.update({
          where: { id: locked.id },
          data: {
            status: DepartureStatus.CANCELLED,
            // Sổ ở cấp CHUYẾN: một chuyến không có khách nào thì không để lại
            // vết ở `cancellation_requests`, mà đó lại là ca hay gặp nhất khi
            // dọn lịch. Lưới quét hoàn tiền sót cũng đọc `cancelledBy` ở đây.
            cancelledAt: now,
            cancelledBy: adminId,
            cancelReason: input.reason,
          },
        });

        const pendingIds = live
          .filter((row) => row.status === BookingStatus.PENDING)
          .map((row) => row.id);
        if (pendingIds.length > 0) {
          await tx.booking.updateMany({
            where: { id: { in: pendingIds } },
            data: { status: BookingStatus.CANCELLED, cancelledAt: now },
          });
        }

        return {
          tourSlug: tourRow.slug,
          startDate,
          endDate,
          cancelledPending: pendingIds.length,
          toRefund: live
            .filter((row) => row.status !== BookingStatus.PENDING)
            .map(
              (row) =>
                ({
                  bookingId: row.id,
                  departureId: locked.id,
                  adminId,
                  reason: input.reason,
                }) satisfies DepartureRefundJob,
            ),
        };
      },
    );

    // Xếp hàng SAU commit: một job trỏ vào một booking chưa CANCELLED là một
    // job chạy sớm hơn sự thật.
    const failed = await enqueueDepartureRefunds(toRefund);
    this.logger.log(
      `[admin] departure cancelled ${JSON.stringify({
        departureId: input.id,
        adminId,
        cancelledPending,
        refundJobsQueued: toRefund.length - failed.length,
        refundJobsFailed: failed.length,
      })}`,
    );

    // Bust NGAY, không đợi hàng đợi: chuyến đã biến mất khỏi lịch chạy, và để
    // web bán tiếp 300 giây nữa là bán một chuyến không còn tồn tại.
    void this.webRevalidation.revalidate(['tours', `tour:${tourSlug}`]);

    return this.departures.rowById(input.id);
  }
}
