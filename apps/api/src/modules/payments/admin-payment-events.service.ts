import { Injectable } from '@nestjs/common';
import type {
  AdminPaymentEventsListQuery,
  Paged,
  PaymentEventDetail,
  PaymentEventRow,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { toPaged } from '../../lib/paged.js';
import { toPaymentEventDetail, toPaymentEventRow } from './payment-event-row.js';

export class PaymentEventNotFoundError extends Error {
  constructor(id: string) {
    super(`Payment event ${id} not found`);
    this.name = 'PaymentEventNotFoundError';
  }
}

/**
 * Bề mặt payment events cho admin (spec P4c §3-F8): ĐỌC sổ webhook
 * `payment_events` mà `PaymentsService.beginEvent`/`finishEvent` ghi. Không
 * có hành vi ghi nào (§2.2) — kẻ duy nhất đổi row là chính webhook.
 *
 * Service RIÊNG chứ không phải method trên `PaymentsService` (quyết định tự
 * chọn F8, cùng khuôn `AdminOutboxService`): PaymentsService là lớp money-path
 * có bất biến idempotency để canh và bị `payments.int.spec.ts` pin từng nhánh;
 * một mapper đọc-thuần chen vào đó là mở rộng bề mặt của thứ không nên đụng.
 * Cùng module (`PaymentsModule`) theo §2.1 — không mở module thứ hai cho
 * cùng một bảng.
 */
@Injectable()
export class AdminPaymentEventsService {
  /**
   * Một trang event, MỚI NHẤT trước (`receivedAt desc` — index sẵn
   * `[provider, receivedAt]` phủ khi có filter provider; `id` phụ để thứ tự
   * ổn định khi hai delivery cùng mili-giây). Bỏ trống filter → mọi row.
   *
   * `unprocessed = true` → chỉ `processedAt` null (đã nhận, handler chưa
   * xong — provider sẽ retry); `false`/vắng → không lọc (cờ là "chỉ hàng
   * chưa xong", không phải "trạng thái = đã xong").
   *
   * `search` khớp `eventId` contains không phân biệt hoa/thường — LIKE trên
   * cột có unique index composite `[provider, eventId]` (không phủ contains);
   * bảng ghi một row mỗi webhook nên còn nhỏ, ghi sổ cùng ngưỡng ~10k của
   * StatsService.
   *
   * KHÔNG SELECT `payload` (spec §3-F8): mỗi event Stripe ~3KB JSON, trang
   * 100 dòng là 300KB chỉ để đọc bảy cột. Drawer gọi `byId`.
   *
   * `bookingCode` join TAY bằng một query thứ ba: cột `bookingId` không có FK
   * (giá trị đến từ metadata provider — có thể là id "chết"), nên `include`
   * không dùng được và LEFT JOIN thủ công là cách nói thật "không còn booking
   * nào mang id này" bằng null thay vì 500.
   */
  async list(query: AdminPaymentEventsListQuery): Promise<Paged<PaymentEventRow>> {
    const { page, limit, provider, type, search, unprocessed } = query;
    const where: Prisma.PaymentEventWhereInput = {
      ...(provider ? { provider } : {}),
      ...(type ? { type } : {}),
      ...(search ? { eventId: { contains: search, mode: 'insensitive' } } : {}),
      ...(unprocessed ? { processedAt: null } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.paymentEvent.count({ where }),
      prisma.paymentEvent.findMany({
        where,
        omit: { payload: true },
        orderBy: [{ receivedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const codes = await this.bookingCodes(rows.map((row) => row.bookingId));
    return toPaged(
      rows.map((row) => toPaymentEventRow(row, codes.get(row.bookingId ?? '') ?? null)),
      { page, limit, total },
    );
  }

  /** Một event kèm payload (đã redact ở mapper). Không có → NOT_FOUND. */
  async byId(id: string): Promise<PaymentEventDetail> {
    const row = await prisma.paymentEvent.findUnique({ where: { id } });
    if (!row) throw new PaymentEventNotFoundError(id);
    const codes = await this.bookingCodes([row.bookingId]);
    return toPaymentEventDetail(row, codes.get(row.bookingId ?? '') ?? null);
  }

  /** `bookingId` → `code` cho các id có thật; id chết đơn giản không có trong map. */
  private async bookingCodes(ids: Array<string | null>): Promise<Map<string, string>> {
    const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
    if (wanted.length === 0) return new Map();
    const bookings = await prisma.booking.findMany({
      where: { id: { in: wanted } },
      select: { id: true, code: true },
    });
    return new Map(bookings.map((booking) => [booking.id, booking.code]));
  }
}
