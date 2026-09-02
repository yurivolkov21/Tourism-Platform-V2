import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  AdminBookingsListQuery,
  Booking,
  BookingsListQuery,
  CreateBookingInput,
  MediaItem,
  Paged,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { env } from '../../config/env.js';
import { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus, DepartureStatus, MediaOwnerType } from '../../generated/prisma/enums.js';
import { toPaged } from '../../lib/paged.js';
import { pickCover } from '../catalog/catalog.service.js';
import { MediaService } from '../media/media.service.js';
import {
  type CheckoutSession,
  PAYMENT_GATEWAYS,
  type PaymentGateway,
  resolveGateway,
} from '../payments/gateway.js';
import { mintBookingCode } from './booking-code.js';
import { createdAtRange } from './bookings-date-range.js';
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

/** BK-1: gateway lỗi lúc mint checkout session (create/re-checkout) → 502
 * retry-able. Booking ở lại PENDING không session; khách retry qua re-checkout. */
export class CheckoutFailedError extends Error {
  constructor() {
    super('Checkout could not be started, please retry');
  }
}

/** BK-1/BK-2: thao tác chỉ hợp lệ trên PENDING (re-checkout / self-cancel) nhưng
 * booking không còn PENDING → 422. */
export class BookingNotPendingError extends Error {
  constructor() {
    super('Only a PENDING booking is valid for this operation');
  }
}

/** Prisma Decimal → string không mất mát ("39.00"). Money KHÔNG BAO GIỜ thành float. */
const money = (value: Prisma.Decimal): string => value.toFixed(2);

/** Prisma `@db.Date` (Date nửa đêm UTC) → calendar date "YYYY-MM-DD".
 * Export cho cancellation surface (cùng quy ước serialize). */
export const calendarDate = (value: Date): string => value.toISOString().slice(0, 10);

type BookingRow = Prisma.BookingModel;

/**
 * Quan hệ `tour` phải join ở MỌI câu đọc booking: slug (link ngược về trang
 * tour) + destinations (tem/bản đồ hộ chiếu — spec 11/08 §3.1, primary đứng
 * đầu cùng quy tắc C1 của catalog). Dùng hằng số này thay vì viết inline để 9
 * call site không lệch nhau; kiểu intersection của `toBooking` ép compile-error
 * chỗ nào quên.
 */
export const bookingTourInclude = {
  select: {
    slug: true,
    destinations: {
      select: { isPrimary: true, destination: { select: { slug: true, name: true } } },
      orderBy: [{ isPrimary: 'desc' }, { destination: { name: 'asc' } }],
    },
  },
} satisfies Prisma.TourDefaultArgs;

/** Shape row `tour` sau join `bookingTourInclude` — nguồn kiểu cho `toBooking`. */
export type BookingTourJoin = {
  slug: string;
  destinations: Array<{ isPrimary: boolean; destination: { slug: string; name: string } }>;
};

/**
 * Phần ĐỌC KÈM của một booking: dữ liệu không nằm trên chính row `Booking` mà
 * phải truy thêm bảng khác (đơn xin hủy, sổ refund).
 *
 * Gom thành object thay vì nối thêm tham số vị trí: từ cụm C có bốn giá trị
 * đọc-kèm, và bốn tham số nullable liên tiếp là chỗ rất dễ truyền lộn thứ tự mà
 * TypeScript không cứu được (hai trong số đó cùng kiểu `string | null`).
 */
export interface BookingReadExtras {
  /** Trạng thái đơn-xin-hủy MỚI NHẤT (theo `createdAt desc`), null nếu chưa từng xin. */
  cancellationStatus?: Booking['cancellationStatus'];
  cancellationRequestedAt?: Date | null;
  cancellationDecidedAt?: Date | null;
  /** `SUM(refunds.amount)` của booking. Bỏ trống = chưa đọc → trả `'0.00'`. */
  refundedTotal?: Prisma.Decimal | null;
  /** Mốc khách đã viết review cho booking này. Bỏ trống = chưa đọc → `null`. */
  reviewedAt?: Date | null;
}

/**
 * Ảnh bìa tour cho MỘT booking (Task 1, khu Trips T6/T7) — dùng ở các đường
 * đọc ĐƠN LẺ (create/reCheckout/cancelPending/byCode/adminByCode). Các đường
 * BATCH (mine/adminList) tự gọi `MediaService.resolveForOwners` một lần cho cả
 * trang rồi `pickCover` từng row, tránh N query cho N booking (N+1).
 */
export async function resolveTourCover(
  media: MediaService,
  tourId: string,
): Promise<MediaItem | null> {
  const map = await media.resolveForOwners(MediaOwnerType.TOUR, [tourId]);
  return pickCover(map.get(tourId));
}

/** Row → contract shape. `checkoutUrl` chỉ non-null ngay sau khi create.
 * Phần đọc-kèm mặc định RỖNG — CHỈ `bookings.byCode` truyền giá trị thật (trang
 * chi tiết là nơi duy nhất cần); mọi call site khác (create/mine/adminList/
 * adminByCode/cancelPending/refunds/cancellations) bỏ qua tham số này để list
 * không phải gánh thêm query cho mỗi row. Export cho admin surface
 * (RefundsService trả về cùng shape).
 *
 * `row.tour.slug` là intersection type BẮT BUỘC (không optional) — ép mọi call
 * site phải join quan hệ `tour` trong câu Prisma select của nó, biên dịch fail
 * nếu quên (Task 1: tourSlug/tourImage giờ là field bắt buộc trên contract,
 * không có sentinel "chưa đọc" hợp lệ như refundedTotal/reviewedAt). */
export function toBooking(
  row: BookingRow & { tour: BookingTourJoin },
  checkoutUrl: string | null,
  tourImage: MediaItem | null,
  extras: BookingReadExtras = {},
): Booking {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    tourTitle: row.tourTitle,
    tourSlug: row.tour.slug,
    tourImage,
    // Snapshot đích đến lúc đọc (spec passport 11/08 §3.1) — primary đứng đầu
    // nhờ orderBy trong `bookingTourInclude`, map về đúng DestinationLinkSchema.
    tourDestinations: row.tour.destinations.map((d) => ({
      slug: d.destination.slug,
      name: d.destination.name,
      isPrimary: d.isPrimary,
    })),
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
    cancellationStatus: extras.cancellationStatus ?? null,
    cancellationRequestedAt: extras.cancellationRequestedAt?.toISOString() ?? null,
    cancellationDecidedAt: extras.cancellationDecidedAt?.toISOString() ?? null,
    // Chưa đọc sổ refund (mọi call site trừ byCode) → '0.00', KHÔNG phải null:
    // contract khai `DecimalStringSchema` không nullable vì "chưa hoàn đồng nào"
    // và "chưa đọc" đối với khách là cùng một câu trả lời.
    refundedTotal: extras.refundedTotal ? money(extras.refundedTotal) : '0.00',
    // Chưa đọc (mọi call site trừ byCode) → null, KHÁC `refundedTotal` ở trên:
    // ở đây "chưa đọc" và "chưa review" KHÔNG cùng một câu trả lời, nhưng web
    // chỉ dùng field này ở trang chi tiết nên null ở list là vô hại — và thà
    // ẩn form review còn hơn hiện nhầm cho một booking đã review.
    reviewedAt: extras.reviewedAt ? extras.reviewedAt.toISOString() : null,
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

  constructor(
    @Inject(PAYMENT_GATEWAYS) private readonly gateways: PaymentGateway[],
    private readonly media: MediaService,
  ) {}

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
            slug: true,
            title: true,
            currency: true,
            basePrice: true,
            isPublished: true,
            // Đích đến cho snapshot `tourDestinations` của booking vừa tạo —
            // cùng shape/orderBy với `bookingTourInclude` (primary đứng đầu).
            destinations: {
              select: { isPrimary: true, destination: { select: { slug: true, name: true } } },
              orderBy: [{ isPrimary: 'desc' as const }, { destination: { name: 'asc' as const } }],
            },
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

    // Lời gọi provider NGOÀI mọi transaction (latency HTTP không giữ connection).
    // BK-1 (ADR-0006): gateway lỗi → ném CheckoutFailedError (502 typed) thay vì
    // 500 opaque; booking ở lại PENDING không session — vô hại (không giữ seat),
    // khách phục hồi qua `reCheckout`, và cron sweep (WRK-1) dọn nếu bỏ luôn.
    const gateway = resolveGateway(this.gateways, input.paymentProvider);
    let session: CheckoutSession;
    try {
      session = await gateway.createCheckoutSession({
        bookingId: booking.id,
        code: booking.code,
        amount: total.toFixed(2),
        currency: booking.currency,
        description: `${booking.tourTitle} (${calendarDate(booking.departureStartDate)} – ${calendarDate(booking.departureEndDate)})`,
        successUrl: `${env.FRONTEND_URL}/checkout/success?code=${booking.code}`,
        cancelUrl: `${env.FRONTEND_URL}/checkout/cancel?code=${booking.code}`,
      });
    } catch (err) {
      this.logger.error(
        `Checkout mint failed for ${booking.code}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw new CheckoutFailedError();
    }
    const withSession = await prisma.booking.update({
      where: { id: booking.id },
      data: { providerSessionId: session.sessionId },
    });

    this.logger.log(
      `Created booking ${withSession.code} (departure=${departure.id}, seats=${seats}, provider=${input.paymentProvider})`,
    );
    const tourImage = await resolveTourCover(this.media, departure.tour.id);
    return toBooking(
      {
        ...withSession,
        tour: { slug: departure.tour.slug, destinations: departure.tour.destinations },
      },
      session.checkoutUrl,
      tourImage,
    );
  }

  /**
   * BK-1 (ADR-0006): mint LẠI checkout session cho một PENDING của CHÍNH CHỦ —
   * phục hồi sau khi `create` gặp gateway lỗi, hoặc thanh toán lại trước khi
   * hết hạn. Owner-or-404 (trả null → controller map NOT_FOUND, không lộ tồn
   * tại); chỉ PENDING (BookingNotPendingError → 422); gateway lỗi →
   * CheckoutFailedError (502). Idempotent: mỗi lần mint một session mới hợp lệ.
   */
  async reCheckout(userId: string, code: string): Promise<Booking | null> {
    const booking = await prisma.booking.findUnique({
      where: { code },
      include: { tour: bookingTourInclude },
    });
    if (!booking || booking.userId !== userId) return null;
    if (booking.status !== BookingStatus.PENDING) throw new BookingNotPendingError();

    const gateway = resolveGateway(this.gateways, booking.paymentProvider);
    let session: CheckoutSession;
    try {
      session = await gateway.createCheckoutSession({
        bookingId: booking.id,
        code: booking.code,
        amount: booking.totalAmount.toFixed(2),
        currency: booking.currency,
        description: `${booking.tourTitle} (${calendarDate(booking.departureStartDate)} – ${calendarDate(booking.departureEndDate)})`,
        successUrl: `${env.FRONTEND_URL}/checkout/success?code=${booking.code}`,
        cancelUrl: `${env.FRONTEND_URL}/checkout/cancel?code=${booking.code}`,
      });
    } catch (err) {
      this.logger.error(
        `Re-checkout mint failed for ${booking.code}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw new CheckoutFailedError();
    }
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { providerSessionId: session.sessionId },
      include: { tour: bookingTourInclude },
    });
    const tourImage = await resolveTourCover(this.media, booking.tourId);
    return toBooking(updated, session.checkoutUrl, tourImage);
  }

  /**
   * BK-2 (ADR-0006): chủ tự hủy một PENDING chưa trả (không refund — chưa
   * charge). Owner-or-404 (null → NOT_FOUND); flip atomic gate `status='PENDING'`
   * → PAID/CANCELLED cho 0 row → BookingNotPendingError (422). Không đụng
   * `seats_booked` (PENDING không giữ ghế). Tách khỏi cancellation-request (PAID).
   */
  async cancelPending(userId: string, code: string): Promise<Booking | null> {
    const booking = await prisma.booking.findUnique({ where: { code } });
    if (!booking || booking.userId !== userId) return null;
    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      UPDATE bookings
      SET status = 'CANCELLED'::"BookingStatus", cancelled_at = now(), updated_at = now()
      WHERE id = ${booking.id}::uuid AND status = 'PENDING'::"BookingStatus"
      RETURNING id
    `);
    if (rows.length === 0) throw new BookingNotPendingError();
    const updated = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: { tour: bookingTourInclude },
    });
    this.logger.log(`Booking ${booking.code} self-cancelled by owner (PENDING → CANCELLED, BK-2)`);
    const tourImage = await resolveTourCover(this.media, booking.tourId);
    return toBooking(updated, null, tourImage);
  }

  /** Booking của chính user, mới nhất trước (id làm tiebreak ổn định), status
   * filter optional. `cancellationStatus` cố ý giữ null (default của
   * `toBooking`) — list này phục vụ trang danh sách nhiều row, thêm một query
   * cancellation MỚI NHẤT cho mỗi row (N+1) không đáng giá cho một field chỉ
   * trang chi tiết (`byCode`) cần (Task 6a, A2). */
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
        include: { tour: bookingTourInclude },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // MỘT query media cho cả trang (chống N+1, cùng khuôn `catalog.listTours`).
    const coverMap = await this.media.resolveForOwners(
      MediaOwnerType.TOUR,
      rows.map((row) => row.tourId),
    );

    return {
      items: rows.map((row) => toBooking(row, null, pickCover(coverMap.get(row.tourId)))),
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
   *
   * Task 6a (A2, user duyệt 06/08): kèm `cancellationStatus` — request MỚI
   * NHẤT theo `createdAt desc` (không phải trạng thái máy trạng thái booking,
   * chỉ đọc — KHÔNG đổi hành vi/ghi gì). Trang chi tiết (nơi duy nhất gọi
   * `byCode`) cần field này để biết có nên hiện nút "xin hủy" hay không; `mine`
   * (list) cố ý không trả (xem comment ở đó).
   */
  async byCode(userId: string, code: string): Promise<Booking | null> {
    const booking = await prisma.booking.findUnique({
      where: { code },
      include: { tour: bookingTourInclude },
    });
    if (!booking || booking.userId !== userId) return null;
    const latestCancellation = await prisma.cancellationRequest.findFirst({
      where: { bookingId: booking.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { status: true, createdAt: true, decidedAt: true },
    });
    // Tổng đã hoàn: một aggregate trên `Refund` (bảng có @@index([bookingId])).
    // Đọc ở ĐÂY chứ không ở `mine` — cùng lý do tránh N+1 đã ghi ở `mine`.
    const refunded = await prisma.refund.aggregate({
      where: { bookingId: booking.id },
      _sum: { amount: true },
    });
    // Đã review chưa: `Review.bookingId` là @unique nên đây là một lookup khoá
    // duy nhất, không phải quét. Đọc ở ĐÂY chứ không ở `mine` — cùng lý do
    // tránh N+1 đã ghi ở trên.
    const review = await prisma.review.findUnique({
      where: { bookingId: booking.id },
      select: { createdAt: true },
    });
    const tourImage = await resolveTourCover(this.media, booking.tourId);
    return toBooking(booking, null, tourImage, {
      cancellationStatus: latestCancellation?.status ?? null,
      cancellationRequestedAt: latestCancellation?.createdAt ?? null,
      cancellationDecidedAt: latestCancellation?.decidedAt ?? null,
      refundedTotal: refunded._sum.amount,
      reviewedAt: review?.createdAt ?? null,
    });
  }

  /**
   * List quản trị cho admin (spec P2 W3, port nhẹ từ admin list của Nexora):
   * TẤT CẢ booking, mới nhất trước, status filter optional + `search`
   * free-text khớp case-insensitive theo code / contact email / contact name.
   * Được guard bằng @Roles('ADMIN') ở controller.
   *
   * F6 thêm khoảng ngày `from`/`to` theo `createdAt` — biên NỬA-MỞ, cả hai
   * đầu tính vào khoảng ngày lịch; phép đổi ngày → mốc và lý do dùng `lt`
   * thay vì `lte 23:59:59` nằm ở `bookings-date-range.ts`. Ba bộ lọc CỘNG
   * dồn (AND), không cái nào thay thế cái nào.
   */
  async adminList(query: AdminBookingsListQuery): Promise<Paged<Booking>> {
    const { page, limit, status, search, from, to, includeMedia } = query;
    const term = search?.trim();
    const createdAt = createdAtRange(from, to);
    const where: Prisma.BookingWhereInput = {
      ...(status ? { status } : {}),
      ...(createdAt ? { createdAt } : {}),
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
        include: { tour: bookingTourInclude },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // MỘT query media cho cả trang (chống N+1, cùng khuôn `catalog.listTours`)
    // — và KHÔNG query nào khi caller nói không cần ảnh (`includeMedia=false`,
    // vòng vá review F6): đường export CSV gom tới 20 trang liên tiếp, mỗi
    // trang một query media trả cùng một tập ảnh chỉ để bị vứt.
    const coverMap = includeMedia
      ? await this.media.resolveForOwners(
          MediaOwnerType.TOUR,
          rows.map((row) => row.tourId),
        )
      : null;

    return toPaged(
      rows.map((row) => toBooking(row, null, pickCover(coverMap?.get(row.tourId)))),
      { page, limit, total },
    );
  }

  /** Bất kỳ booking nào theo code — admin surface, cố ý KHÔNG scope theo owner. */
  async adminByCode(code: string): Promise<Booking | null> {
    const booking = await prisma.booking.findUnique({
      where: { code },
      include: { tour: bookingTourInclude },
    });
    if (!booking) return null;
    // `refundedTotal` THẬT (review F2 31/08 — trước đây để '0.00' mặc định):
    // admin dùng nó làm trần validate refund (total − đã hoàn), số sai là
    // validate sai. Cùng aggregate với `byCode` khách phía trên.
    const refunded = await prisma.refund.aggregate({
      where: { bookingId: booking.id },
      _sum: { amount: true },
    });
    const tourImage = await resolveTourCover(this.media, booking.tourId);
    return toBooking(booking, null, tourImage, { refundedTotal: refunded._sum.amount });
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
