import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  AdminBookingsListQuery,
  Booking,
  BookingDetail,
  BookingsListQuery,
  CreateBookingInput,
  MediaItem,
  Paged,
  RefundEstimate,
} from '@tourism/contract';
import {
  daysBeforeDeparture,
  isWithinGracePeriod,
  policyRefundAmount,
  refundPercentForRequest,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { env } from '../../config/env.js';
import { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus, DepartureStatus, MediaOwnerType } from '../../generated/prisma/enums.js';
import { calendarDate } from '../../lib/calendar-date.js';
import { createdAtRange } from '../../lib/created-at-range.js';
import { escapeLike } from '../../lib/like.js';
import { toPaged } from '../../lib/paged.js';
import { pickCover } from '../catalog/catalog.service.js';
import { perPersonTotal } from '../catalog/tour-costs.js';
import { MediaService } from '../media/media.service.js';
import {
  type CheckoutSession,
  PAYMENT_GATEWAYS,
  type PaymentGateway,
  resolveGateway,
} from '../payments/gateway.js';
import { REVIEW_MINE_INCLUDE, toMyReview } from '../reviews/reviews.service.js';
import { mintBookingCode } from './booking-code.js';
import { effectiveUnitPrice, totalAmount } from './pricing.js';
import { withBookingRefundLock } from './refund-lock.js';

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

/** Party vượt `maxGroupSize` của tour (W1 — luật tour, kiểm TRƯỚC seat check;
 * trước đây chỉ ép ở trình duyệt) → 422 PARTY_TOO_LARGE. */
export class PartyTooLargeError extends Error {
  constructor(maxGroupSize: number, requested: number) {
    super(`This tour takes at most ${maxGroupSize} traveller(s) per group, requested ${requested}`);
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
    // Khách cần biết trước mình được hoàn bao nhiêu (ADR-0030 §3b) — badge
    // nâng ngưỡng 100% nên thiếu nó thì ước tính nói thấp hơn thực tế.
    freeCancellationDays: true,
    destinations: {
      select: { isPrimary: true, destination: { select: { slug: true, name: true } } },
      orderBy: [{ isPrimary: 'desc' }, { destination: { name: 'asc' } }],
    },
  },
} satisfies Prisma.TourDefaultArgs;

/** Shape row `tour` sau join `bookingTourInclude` — nguồn kiểu cho `toBooking`. */
export type BookingTourJoin = {
  slug: string;
  freeCancellationDays: number | null;
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
    freeCancellationDays: row.tour.freeCancellationDays,
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
 * Ước tính hoàn tiền nếu khách xin huỷ NGAY BÂY GIỜ (W1, audit 05/09 cụm 3
 * mục Thấp) — tính bằng đồng hồ SERVER thay vì trình duyệt: web từng gọi
 * `new Date()` phía client nên khách ở múi giờ lệch thấy sai bậc/ân hạn ở
 * biên ngày. Chỉ có nghĩa cho booking PAID với chuyến chưa khởi hành (đúng
 * tập có nút xin huỷ); các ca khác trả null. Cùng bộ hàm chính sách mà
 * `cancellations.approve` dùng — con số khách thấy là con số admin sẽ duyệt.
 */
function estimateRefund(
  booking: Pick<BookingRow, 'status' | 'paidAt' | 'departureStartDate' | 'totalAmount'> & {
    tour: { freeCancellationDays: number | null };
  },
  refundedTotal: Prisma.Decimal | null,
): RefundEstimate | null {
  if (booking.status !== BookingStatus.PAID) return null;
  const now = new Date();
  const departureDay = calendarDate(booking.departureStartDate);
  if (departureDay < todayUtc()) return null; // chuyến đã đi
  const percent = refundPercentForRequest({
    requestedAt: now,
    paidAt: booking.paidAt?.toISOString() ?? null,
    departureStartDate: departureDay,
    freeCancellationDays: booking.tour.freeCancellationDays,
  });
  return {
    percent,
    amount: policyRefundAmount({
      percent,
      totalAmount: booking.totalAmount.toFixed(2),
      refundedTotal: (refundedTotal ?? new Prisma.Decimal(0)).toFixed(2),
    }),
    daysBeforeDeparture: daysBeforeDeparture(now, departureDay),
    inGrace: isWithinGracePeriod(booking.paidAt?.toISOString() ?? null, now),
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
 * - `departure-closed` — chuyến không còn OPEN hoặc đã khởi hành khi capture
 *                     về (ADR-0009 AMEND 1) → caller auto-refund + cancel,
 *                     cùng lý lẽ với `overbooked` (chưa từng là doanh thu).
 * - `not-found`     — không có booking id này (webhook tham chiếu thứ ta chưa
 *                     bao giờ mint) → log-and-skip.
 */
export type ClaimOutcome =
  | 'claimed'
  | 'overbooked'
  | 'cancelled'
  | 'already-paid'
  | 'departure-closed'
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
 * Lề tối thiểu để một session được coi là ĐÁNG trả lại ở reCheckout (ADR-0006
 * AMEND 1a): session sắp hết hạn trong ít phút tới thì mint mới luôn — đưa
 * khách vào một trang thanh toán chết giữa chừng còn tệ hơn một session thừa.
 */
const SESSION_REUSE_MIN_REMAINING_MS = 5 * 60_000;

/**
 * "Hôm nay" theo UTC — MỘT thước cho mọi gate "chuyến đã đi chưa" ở tầng Node
 * (`create`, `reCheckout`, phân loại claim, `estimateRefund`), khớp với
 * `(now() AT TIME ZONE 'UTC')::date` trong CTE claim (ADR-0009 AMEND 2).
 * `start_date` là `@db.Date` ngày lịch của điểm khởi hành (VN, UTC+7), nên
 * "đã đi" theo UTC rộng hơn đời thật đúng 7 giờ — cùng lề với luật walk-in
 * cùng ngày của `create`, chấp nhận có chủ đích.
 */
const todayUtc = (): string => new Date().toISOString().slice(0, 10);

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
            // Trần party theo TOUR (W1) — luật thật của PARTY_TOO_LARGE,
            // contract chỉ giữ trần sanity 99.
            maxGroupSize: true,
            // Cùng lý do với `bookingTourInclude` — khách phải biết trước mình
            // được hoàn bao nhiêu (ADR-0030 §3b).
            freeCancellationDays: true,
            // Giá vốn theo ĐẦU KHÁCH, để đóng băng vào booking (ADR-0033 §3).
            // Nạp ở ĐÂY chứ không query riêng: đường này vốn đã đọc `tour` cho
            // `basePrice`, và một join thêm trên FK có index rẻ hơn một
            // round-trip nữa bên trong transaction đang giữ advisory lock ghế.
            costItems: { select: { amount: true, basis: true } },
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
    if (
      !departure.tour.isPublished ||
      departure.status !== DepartureStatus.OPEN ||
      calendarDate(departure.startDate) < todayUtc()
    ) {
      throw new DepartureNotAvailableError();
    }

    const seats = input.numAdults + input.numChildren;
    // Luật tour TRƯỚC soft seat check: "tour này nhận tối đa N người một nhóm"
    // đúng bất kể departure còn bao nhiêu ghế.
    if (seats > departure.tour.maxGroupSize) {
      throw new PartyTooLargeError(departure.tour.maxGroupSize, seats);
    }
    const seatsLeft = departure.seatsTotal - departure.seatsBooked;
    if (seatsLeft < seats) {
      throw new SeatsUnavailableError(seatsLeft, seats);
    }

    const unitPrice = effectiveUnitPrice(departure.tour.basePrice, departure.priceOverride);
    const total = totalAmount(unitPrice, seats);
    // Tour chưa khai giá vốn → `null`, KHÔNG phải 0 (ADR-0033 §3). Báo cáo
    // đếm số booking thiếu dữ liệu rồi NÓI RA; `0.00` thì tự nhận là "tour
    // này không tốn gì" và biến một lỗ hổng dữ liệu thành lợi nhuận.
    //
    // Chỉ vế PER_PERSON vào đây. Vế PER_DEPARTURE ở cấp CHUYẾN
    // (`tour_departures.fixed_cost_amount`) vì báo cáo tính nó một lần cho
    // mỗi chuyến đã chạy, bất kể bán được bao nhiêu ghế (§4).
    const costItems = departure.tour.costItems;
    const costPerPerson = costItems.length > 0 ? perPersonTotal(costItems) : null;

    // Resolve gateway TRƯỚC khi insert (W1 — audit 05/09 cụm 2, mục Thấp):
    // provider chưa cấu hình phải là 502 CHECKOUT_FAILED typed NGAY, không phải
    // 500 mù cộng một PENDING mồ côi nằm lại DB.
    let gateway: PaymentGateway;
    try {
      gateway = resolveGateway(this.gateways, input.paymentProvider);
    } catch (err) {
      this.logger.error(
        `Checkout rejected before insert: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw new CheckoutFailedError();
    }

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
            costPerPerson,
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
      // Lưu đủ BỘ session (id + url + hạn, ADR-0006 AMEND 1a): url chỉ có ở
      // lúc mint, không lưu thì reCheckout không "trả session hiện có" được.
      data: {
        providerSessionId: session.sessionId,
        checkoutSessionUrl: session.checkoutUrl,
        checkoutSessionExpiresAt: session.expiresAt,
      },
    });

    this.logger.log(
      `Created booking ${withSession.code} (departure=${departure.id}, seats=${seats}, provider=${input.paymentProvider})`,
    );
    const tourImage = await resolveTourCover(this.media, departure.tour.id);
    return toBooking(
      {
        ...withSession,
        tour: {
          slug: departure.tour.slug,
          freeCancellationDays: departure.tour.freeCancellationDays,
          destinations: departure.tour.destinations,
        },
      },
      session.checkoutUrl,
      tourImage,
    );
  }

  /**
   * BK-1 (ADR-0006, AMEND 1a): checkout lại một PENDING của CHÍNH CHỦ —
   * phục hồi sau khi `create` gặp gateway lỗi, hoặc thanh toán lại. Owner-or-404
   * (trả null → controller map NOT_FOUND, không lộ tồn tại); chỉ PENDING
   * (BookingNotPendingError → 422); gateway lỗi → CheckoutFailedError (502).
   *
   * MỘT session sống mỗi booking: session hiện tại còn hạn (≥ lề
   * {@link SESSION_REUSE_MIN_REMAINING_MS}) thì trả LẠI nó — không mint, không
   * gọi provider; hết hạn/không rõ (booking cũ trước migration) thì vô hiệu
   * session cũ ở provider (`expireSession`, best-effort — provider không có
   * API hoặc lỗi thì log rồi vẫn mint, lưới cuối là auto-refund dup-capture)
   * rồi mới mint session mới. Mint chồng khi session cũ còn sống là cửa
   * double charge: hai trang thanh toán cùng thu được tiền.
   */
  async reCheckout(userId: string, code: string): Promise<Booking | null> {
    const probe = await prisma.booking.findUnique({
      where: { code },
      select: { id: true, userId: true },
    });
    if (!probe || probe.userId !== userId) return null;

    // TOÀN BỘ check→mint→ghi nằm trong advisory lock của booking (AMEND 2b):
    // hai request "Pay again" song song từng cùng thấy session chết, cùng mint,
    // và `update` chỉ giữ được session ghi sau — session ghi trước sống mồ côi
    // ở provider, đúng cửa double charge mà AMEND 1a hứa đóng. Provider HTTP
    // trong tx là ngoại lệ có chủ đích (cùng lẽ với đường refund, ADR-0009).
    const { row, checkoutUrl } = await withBookingRefundLock(probe.id, async (tx) => {
      const booking = await tx.booking.findUniqueOrThrow({
        where: { id: probe.id },
        include: { tour: bookingTourInclude },
      });
      if (booking.status !== BookingStatus.PENDING) throw new BookingNotPendingError();

      // Cùng gate chuyến với `create` và với claim (ADR-0009 AMEND 1/2): mint
      // trang thanh toán cho một booking mà claim chắc chắn từ chối là mời
      // khách trả một khoản sẽ bị auto-refund.
      const departure = await tx.tourDeparture.findUnique({
        where: { id: booking.departureId },
        select: { status: true, startDate: true },
      });
      if (
        !departure ||
        departure.status !== DepartureStatus.OPEN ||
        calendarDate(departure.startDate) < todayUtc()
      ) {
        throw new DepartureNotAvailableError();
      }

      const sessionAlive =
        booking.providerSessionId !== null &&
        booking.checkoutSessionUrl !== null &&
        booking.checkoutSessionExpiresAt !== null &&
        booking.checkoutSessionExpiresAt.getTime() > Date.now() + SESSION_REUSE_MIN_REMAINING_MS;
      if (sessionAlive) {
        this.logger.log(
          `Re-checkout for ${booking.code}: returning live session ${booking.providerSessionId}`,
        );
        return { row: booking, checkoutUrl: booking.checkoutSessionUrl as string };
      }

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

      // Ghi session MỚI trước, expire session CŨ sau (AMEND 2b): expire trước
      // là tự bắn một `checkout.session.expired` cho session vẫn đang là hiện
      // tại của booking — gate AMEND 1c khớp và huỷ đúng booking đang re-mint.
      // Gate `status = PENDING` ở đây vì trong lock vẫn có kẻ ghi ngoài lock
      // (webhook expired, sweep): 0 row là booking đã đổi trạng thái → thu hồi
      // session vừa mint rồi báo 422, không trả cho khách một URL thanh toán
      // của booking đã huỷ.
      const written = await tx.booking.updateMany({
        where: { id: booking.id, status: BookingStatus.PENDING },
        data: {
          providerSessionId: session.sessionId,
          checkoutSessionUrl: session.checkoutUrl,
          checkoutSessionExpiresAt: session.expiresAt,
        },
      });
      if (written.count === 0) {
        await this.expireSessionBestEffort(gateway, booking.code, session.sessionId);
        throw new BookingNotPendingError();
      }
      if (booking.providerSessionId) {
        await this.expireSessionBestEffort(gateway, booking.code, booking.providerSessionId);
      }
      const updated = await tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
        include: { tour: bookingTourInclude },
      });
      return { row: updated, checkoutUrl: session.checkoutUrl };
    });
    const tourImage = await resolveTourCover(this.media, row.tourId);
    return toBooking(row, checkoutUrl, tourImage);
  }

  /**
   * Vô hiệu một session ở provider, best-effort: session thường đã tự expired
   * ở provider (đó là lý do ta mint lại) và API expire từ chối session không
   * còn `open`; provider không có API (PayPal) thì bỏ qua. Lỗi chỉ log — lưới
   * cuối là auto-refund dup-capture ở PaymentsService.
   */
  private async expireSessionBestEffort(
    gateway: PaymentGateway,
    code: string,
    sessionId: string,
  ): Promise<void> {
    if (!gateway.expireSession) return;
    try {
      await gateway.expireSession(sessionId);
    } catch (err) {
      this.logger.warn(
        `expireSession(${sessionId}) for ${code} failed — ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
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
    // Xoá luôn URL/hạn session (AMEND 2b): booking đã huỷ không được giữ một
    // trang thanh toán còn sống — và vô hiệu nó ở provider ngay bên dưới.
    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      UPDATE bookings
      SET status = 'CANCELLED'::"BookingStatus", cancelled_at = now(), updated_at = now(),
          checkout_session_url = NULL, checkout_session_expires_at = NULL
      WHERE id = ${booking.id}::uuid AND status = 'PENDING'::"BookingStatus"
      RETURNING id
    `);
    if (rows.length === 0) throw new BookingNotPendingError();
    if (booking.providerSessionId) {
      // Khách bấm Huỷ trong lúc tab Stripe còn mở: không expire thì tab đó vẫn
      // thu được tiền → orphan refund + event rác. Best-effort, sau khi đã
      // CANCELLED (thứ tự ngược với reCheckout — ở đây không còn session nào
      // là "hiện tại" để webhook expired huỷ nhầm).
      await this.expireSessionBestEffort(
        resolveGateway(this.gateways, booking.paymentProvider),
        booking.code,
        booking.providerSessionId,
      );
    }
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
  async byCode(userId: string, code: string): Promise<BookingDetail | null> {
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
    // Review của khách: `Review.bookingId` là @unique nên đây là một lookup
    // khoá duy nhất, không phải quét. Đọc ở ĐÂY chứ không ở `mine` — cùng lý
    // do tránh N+1 đã ghi ở trên.
    //
    // Lấy TRỌN review chứ không chỉ `createdAt` (ADR-0032 §7): một mốc thời
    // gian không mang phán quyết nào, nên trang chi tiết từng nói với khách bị
    // bác rằng "bạn đã đánh giá chuyến này rồi". Nay nó nói được trạng thái +
    // lý do, và điền sẵn được form sửa mà không tốn thêm một lượt gọi.
    const review = await prisma.review.findUnique({
      where: { bookingId: booking.id },
      include: REVIEW_MINE_INCLUDE,
    });
    const reviewMedia = review
      ? ((await this.media.resolveForOwners(MediaOwnerType.REVIEW, [review.id])).get(review.id) ??
        [])
      : [];
    const tourImage = await resolveTourCover(this.media, booking.tourId);
    return {
      ...toBooking(booking, null, tourImage, {
        cancellationStatus: latestCancellation?.status ?? null,
        cancellationRequestedAt: latestCancellation?.createdAt ?? null,
        cancellationDecidedAt: latestCancellation?.decidedAt ?? null,
        refundedTotal: refunded._sum.amount,
        reviewedAt: review?.createdAt ?? null,
      }),
      review: review ? toMyReview(review, reviewMedia) : null,
      refundEstimate: estimateRefund(booking, refunded._sum.amount),
    };
  }

  /**
   * List quản trị cho admin (spec P2 W3, port nhẹ từ admin list của Nexora):
   * TẤT CẢ booking, mới nhất trước, status filter optional + `search`
   * free-text khớp case-insensitive theo code / contact email / contact name.
   * Được guard bằng @Roles('ADMIN') ở controller.
   *
   * F6 thêm khoảng ngày `from`/`to` theo `createdAt` — biên NỬA-MỞ, cả hai
   * đầu tính vào khoảng ngày lịch; phép đổi ngày → mốc và lý do dùng `lt`
   * thay vì `lte 23:59:59` nằm ở `created-at-range.ts`. Ba bộ lọc CỘNG
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
              { code: { contains: escapeLike(term), mode: 'insensitive' } },
              { contactEmail: { contains: escapeLike(term), mode: 'insensitive' } },
              { contactName: { contains: escapeLike(term), mode: 'insensitive' } },
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
      // Trong advisory lock của booking (ADR-0006 AMEND 2c): đường auto-refund
      // giữ lock suốt refund→ledger→cancel, nên một delivery thứ hai không
      // claim được PAID vào đúng khe giữa lúc tiền đã hoàn và lúc booking
      // được flip CANCELLED (admin mở lại chuyến giữa hai delivery).
      claimed = await withBookingRefundLock(bookingId, (tx) =>
        tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        WITH claim AS (
          UPDATE bookings b
          SET status = 'PAID'::"BookingStatus",
              paid_at = now(),
              provider_payment_id = ${providerPaymentId},
              updated_at = now()
          WHERE b.id = ${bookingId}::uuid AND b.status = 'PENDING'::"BookingStatus"
            -- ADR-0009 AMEND 1: không xác nhận chỗ trên chuyến đã đóng/đã đi.
            -- Qual trong subquery KHÔNG được EPQ re-check tươi như qual trên
            -- UPDATE target — chấp nhận: race "đóng chuyến đúng lúc capture về"
            -- là thao tác vận hành hiếm, không phải race tiền; race tiền
            -- (double claim) vẫn gate trên b.status ở trên.
            -- Ngày so theo UTC TƯỜNG MINH (ADR-0009 AMEND 2), cùng thước với
            -- todayUtc() phía Node — không phụ thuộc TZ session của DB.
            AND EXISTS (
              SELECT 1 FROM tour_departures dep
              WHERE dep.id = b.departure_id
                AND dep.status = 'OPEN'::"DepartureStatus"
                AND dep.start_date >= (now() AT TIME ZONE 'UTC')::date
            )
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
      `),
      );
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
      select: { status: true, departureId: true },
    });
    let outcome: ClaimOutcome;
    if (!booking) outcome = 'not-found';
    else if (booking.status === BookingStatus.CANCELLED) outcome = 'cancelled';
    else if (booking.status === BookingStatus.PENDING) {
      // ADR-0009 AMEND 1: PENDING mà claim không ăn — trước hết xem có phải vì
      // gate chuyến không (không còn OPEN / đã khởi hành) → departure-closed.
      const departure = await prisma.tourDeparture.findUnique({
        where: { id: booking.departureId },
        select: { status: true, startDate: true },
      });
      if (
        !departure ||
        departure.status !== DepartureStatus.OPEN ||
        calendarDate(departure.startDate) < todayUtc()
      ) {
        outcome = 'departure-closed';
      } else {
        // Về lý thuyết là bất khả tới: không exception + zero claim row + vẫn
        // PENDING + chuyến OPEN. Map phòng thủ: coi như overbooked — đường
        // handler của nó là đường an toàn cho một PENDING đang giữ tiền thật.
        outcome = 'overbooked';
      }
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
