import { Injectable, Logger } from '@nestjs/common';
import type {
  AdminDepartureCreateInput,
  AdminDepartureRow,
  AdminDepartureSetStatusInput,
  AdminDeparturesListQuery,
  AdminDeparturesListResult,
  AdminDepartureTour,
  AdminDepartureUpdateInput,
} from '@tourism/contract';
import { cancellationDeadline, vietnamToday } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus, DepartureStatus } from '../../generated/prisma/enums.js';
import { calendarDate, startOfDayUtc } from '../../lib/calendar-date.js';
import { toPaged } from '../../lib/paged.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';
import {
  type DepartureCardInput,
  dateChangeBlocker,
  departureRevalidationTags,
  reopenBlocker,
  seatsChangeBlocker,
} from './departure-rules.js';
import { perDepartureTotal } from './tour-costs.js';

export class TourNotFoundError extends Error {
  constructor(slug: string) {
    super(`Tour ${slug} not found`);
    this.name = 'TourNotFoundError';
  }
}

export class DepartureNotFoundError extends Error {
  constructor(id: string) {
    super(`Departure ${id} not found`);
    this.name = 'DepartureNotFoundError';
  }
}

/** Mã phán quyết nghiệp vụ — trùng TỪNG CHỮ với `errors` của contract. */
export type DepartureRuleCode =
  | 'INVALID_DATE_RANGE'
  | 'START_IN_PAST'
  | 'DEPARTURE_HAS_BOOKINGS'
  | 'SEATS_BELOW_BOOKED'
  | 'DEADLINE_PASSED'
  | 'DEPARTURE_CANCELLED'
  | 'DEPARTURE_STALE';

/**
 * Một lệnh ghi bị luật nghiệp vụ chặn. `code` để controller chọn đúng lỗi
 * contract, `message` là câu đã mang sẵn con số thật (xem `departure-rules.ts`).
 */
export class DepartureRuleError extends Error {
  constructor(
    readonly code: DepartureRuleCode,
    message: string,
  ) {
    super(message);
    this.name = 'DepartureRuleError';
  }
}

/**
 * Booking còn SỐNG trên một chuyến — ba trạng thái mà chỗ ngồi và tiền vẫn
 * còn ràng buộc hai bên (`docs/conventions/booking-states.md`). `CANCELLED` và
 * `REFUNDED` là hai kết cục đã đóng: chúng không giữ ghế và không còn hạn huỷ
 * nào để bảo vệ.
 */
const LIVE_BOOKING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.PAID,
  BookingStatus.PARTIALLY_REFUNDED,
];

const DEPARTURE_SELECT = {
  id: true,
  startDate: true,
  endDate: true,
  priceOverride: true,
  seatsTotal: true,
  seatsBooked: true,
  status: true,
  /** Token chống ghi đè mù — xem `version` của `AdminDepartureUpdateInputSchema`. */
  updatedAt: true,
} satisfies Prisma.TourDepartureSelect;

type DepartureRowData = Prisma.TourDepartureGetPayload<{ select: typeof DEPARTURE_SELECT }>;

const TOUR_SELECT = {
  id: true,
  slug: true,
  title: true,
  basePrice: true,
  currency: true,
} satisfies Prisma.TourSelect;

type TourData = Prisma.TourGetPayload<{ select: typeof TOUR_SELECT }>;

/** Prisma Decimal → chuỗi 2 chữ số ("39.00") — tiền không bao giờ là float. */
const money = (value: Prisma.Decimal): string => value.toFixed(2);

/**
 * Chuyến khởi hành phía admin (spec P4e-1 F12) — bề mặt GHI đầu tiên của
 * catalog: đọc bảng chuyến của một tour, thêm chuyến, sửa chuyến, đóng/mở lại.
 *
 * Service RIÊNG chứ không thêm method vào `CatalogService` (cùng nếp
 * `AdminEnquiriesService`): `CatalogService` là đường ĐỌC CÔNG KHAI, được
 * `catalog.int.spec.ts` pin từng nhánh, và bốn method ghi chen vào đó là mở
 * rộng bề mặt của thứ cả website đang đọc. Cùng module — không mở module thứ
 * hai cho cùng một bảng.
 *
 * KHÔNG có đường huỷ chuyến ở đây: huỷ kéo theo hoàn tiền cho mọi khách đã
 * trả (ADR-0041 §6) và đi qua service riêng của F13.
 */
@Injectable()
export class AdminDeparturesService {
  private readonly logger = new Logger(AdminDeparturesService.name);

  constructor(private readonly webRevalidation: WebRevalidationService) {}

  /**
   * Một trang chuyến của MỘT tour, GẦN NHẤT trước (`startDate desc`, `id` phụ
   * để thứ tự ổn định khi hai chuyến cùng ngày — index sẵn `[tourId, startDate]`).
   *
   * Vì sao desc: chuyến vừa tạo cho mùa tới hiện ngay hàng đầu, còn lịch sử
   * 2026 lùi dần xuống dưới — cùng giọng "mới nhất trước" của mọi bảng admin.
   *
   * `liveBookingCount` lấy bằng MỘT câu gom nhóm cho cả trang, không N+1 theo
   * từng hàng.
   */
  async list(query: AdminDeparturesListQuery): Promise<AdminDeparturesListResult> {
    const { slug, status, page, limit } = query;
    const tour = await prisma.tour.findUnique({ where: { slug }, select: TOUR_SELECT });
    if (!tour) throw new TourNotFoundError(slug);

    const where: Prisma.TourDepartureWhereInput = {
      tourId: tour.id,
      ...(status ? { status } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.tourDeparture.count({ where }),
      prisma.tourDeparture.findMany({
        where,
        select: DEPARTURE_SELECT,
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const counts = await bookingCounts(rows.map((row) => row.id));

    return {
      ...toPaged(
        rows.map((row) => toRow(row, tour, counts.get(row.id) ?? ZERO_COUNTS)),
        { page, limit, total },
      ),
      tour: toTour(tour),
    };
  }

  /**
   * Thêm một chuyến vào lịch của tour.
   *
   * KHÔNG transaction: đúng MỘT câu ghi, và không có bất biến nào cần canh
   * giữa lúc đọc tour và lúc chèn — tour biến mất giữa chừng thì khoá ngoại
   * nổ P2003, một chuyến mồ côi là thứ không thể ghi được (cùng tinh thần
   * "single-statement atomic claim" của ADR-0009).
   *
   * `fixedCostAmount` đóng băng từ các dòng giá vốn `PER_DEPARTURE` của tour
   * (ADR-0033 §3) — đúng việc mà seed đang làm hộ. Bỏ trống thì mọi chuyến
   * admin tạo tay sẽ vào báo cáo tháng với chi phí cố định bằng 0, tức biên
   * lợi nhuận đẹp hơn sự thật mà không ai thấy sai ở đâu.
   */
  async create(input: AdminDepartureCreateInput): Promise<AdminDepartureRow> {
    const tour = await prisma.tour.findUnique({
      where: { slug: input.slug },
      select: { ...TOUR_SELECT, costItems: { select: { amount: true, basis: true } } },
    });
    if (!tour) throw new TourNotFoundError(input.slug);

    const now = new Date();
    assertDateRange(input.startDate, input.endDate);
    assertNotInPast(input.startDate, now);

    const created = await prisma.tourDeparture.create({
      data: {
        tourId: tour.id,
        startDate: startOfDayUtc(input.startDate),
        endDate: startOfDayUtc(input.endDate),
        seatsTotal: input.seatsTotal,
        priceOverride: toDecimal(input.priceOverride),
        fixedCostAmount: tour.costItems.length > 0 ? perDepartureTotal(tour.costItems) : null,
      },
      select: DEPARTURE_SELECT,
    });
    this.logger.log(
      `[admin] departure created ${JSON.stringify({
        departureId: created.id,
        tourSlug: tour.slug,
        startDate: input.startDate,
      })}`,
    );

    // Chuyến chưa ai đặt nên `liveBookingCount` là 0 — không cần một câu đếm
    // để biết điều mình vừa tạo ra.
    const row = toRow(created, tour, ZERO_COUNTS);
    this.bust(tour.slug, null, row, now);
    return row;
  }

  /**
   * Sửa ngày · ghế · giá của một chuyến.
   *
   * ## Vì sao phải khoá row trước khi đọc
   *
   * Hai phán quyết ở đây đều là "đọc trạng thái rồi ghi theo trạng thái ấy" —
   * đúng khuôn bẫy đã cắn dự án HAI lần (`docs/conventions/read-then-write-races.md`).
   * Dưới Read Committed, mỗi statement có snapshot riêng, nên đọc trước rồi
   * ghi sau là mở một khoảng hở đủ cho một booking mới chen vào.
   *
   * Cách đúng, và là cách dùng ở đây: `SELECT … FOR UPDATE` ở MỘT statement
   * riêng để khoá chính hàng chuyến, rồi mới đếm booking ở statement SAU —
   * statement sau có snapshot MỚI nên thấy đủ mọi thứ đã commit. Khoá ấy cũng
   * chặn đường claim ghế lúc thanh toán (`UPDATE tour_departures SET
   * seats_booked = …` trên cùng hàng), nên `seatsBooked` đọc dưới khoá là con
   * số cuối cùng, không phải một ảnh cũ.
   *
   * ## Khoảng hở CÒN LẠI, nói thẳng
   *
   * Tạo booking `PENDING` KHÔNG đụng vào hàng chuyến (ghế chỉ bị claim lúc
   * capture — ADR-0006), nên khoá này không chặn nó. Một booking `PENDING`
   * commit giữa lúc đếm và lúc commit sẽ mang BẢN SAO ngày cũ. Cửa sổ ấy tính
   * bằng mili-giây, nó chỉ chạm booking CHƯA trả tiền, và đóng nó đòi đường
   * tạo booking của khách phải khoá hàng chuyến — một thay đổi trên đường
   * tiền, thuộc về một quyết định riêng chứ không phải hệ quả của màn admin.
   *
   * Ngày KHÔNG đổi thì bỏ qua cả luật ngày: sửa ghế/giá trên chuyến đã có
   * khách là thao tác hợp lệ và thường xuyên (thêm ghế vì xe to hơn).
   */
  async update(input: AdminDepartureUpdateInput): Promise<AdminDepartureRow> {
    const now = new Date();
    assertDateRange(input.startDate, input.endDate);

    const { row, tour, before } = await prisma.$transaction(async (tx) => {
      // Statement 1 — CHỈ để khoá. Đọc được gì ở đây là chốt cuối cùng của
      // hàng này cho tới khi transaction đóng.
      const [locked] = await tx.$queryRaw<
        {
          id: string;
          tour_id: string;
          start_date: Date;
          end_date: Date;
          price_override: Prisma.Decimal | null;
          seats_booked: number;
          status: DepartureStatus;
          updated_at: Date;
        }[]
      >(Prisma.sql`
        SELECT id, tour_id, start_date, end_date, price_override, seats_booked, status, updated_at
        FROM tour_departures WHERE id = ${input.id}::uuid FOR UPDATE
      `);
      if (!locked) throw new DepartureNotFoundError(input.id);
      if (locked.status === DepartureStatus.CANCELLED) {
        throw new DepartureRuleError(
          'DEPARTURE_CANCELLED',
          'This departure has been cancelled — its travellers were already refunded, so it can no longer be edited.',
        );
      }

      // Chống ghi đè mù: form gửi lại phiên bản nó ĐANG hiển thị. `FOR UPDATE`
      // tuần tự hoá hai lệnh ghi nhưng không biết cái nào cũ — giá trị "hiện
      // tại" trong payload đến từ trình duyệt chứ không từ hàng này.
      if (locked.updated_at.toISOString() !== input.version) {
        throw new DepartureRuleError(
          'DEPARTURE_STALE',
          'Someone else changed this departure while the form was open.',
        );
      }

      const currentStart = calendarDate(locked.start_date);
      const currentEnd = calendarDate(locked.end_date);
      const datesChanged = currentStart !== input.startDate || currentEnd !== input.endDate;

      if (datesChanged) {
        assertNotInPast(input.startDate, now);
        // Thước là `seats_booked` của chính hàng vừa khoá, không phải một lượt
        // đếm booking theo trạng thái — xem JSDoc của `dateChangeBlocker`. Lợi
        // thêm: con số đã nằm trong hàng nên không cần câu đọc thứ hai.
        const blocked = dateChangeBlocker(locked.seats_booked);
        if (blocked) throw new DepartureRuleError('DEPARTURE_HAS_BOOKINGS', blocked);
      }

      const seatsBlocked = seatsChangeBlocker(input.seatsTotal, locked.seats_booked);
      if (seatsBlocked) throw new DepartureRuleError('SEATS_BELOW_BOOKED', seatsBlocked);

      const updated = await tx.tourDeparture.update({
        where: { id: input.id },
        data: {
          startDate: startOfDayUtc(input.startDate),
          endDate: startOfDayUtc(input.endDate),
          seatsTotal: input.seatsTotal,
          priceOverride: toDecimal(input.priceOverride),
        },
        select: DEPARTURE_SELECT,
      });
      const tourRow = await tx.tour.findUniqueOrThrow({
        where: { id: locked.tour_id },
        select: TOUR_SELECT,
      });
      return {
        row: updated,
        tour: tourRow,
        before: {
          status: locked.status,
          startDate: currentStart,
          endDate: currentEnd,
          priceOverride: locked.price_override === null ? null : money(locked.price_override),
        } satisfies DepartureCardInput,
      };
    });

    const counts = await bookingCounts([row.id]);
    const result = toRow(row, tour, counts.get(row.id) ?? ZERO_COUNTS);
    this.bust(tour.slug, before, result, now);
    return result;
  }

  /**
   * Đóng chuyến (thôi nhận đặt) hoặc mở lại.
   *
   * Cùng khuôn khoá với `update` — trạng thái đọc ra phải là trạng thái ghi
   * đè lên, không phải một ảnh cũ: hai admin bấm gần như đồng thời thì người
   * sau phải thấy quyết định của người trước.
   *
   * Đóng lúc nào cũng được; MỞ LẠI thì không, nếu đã qua hạn chót — hạn chót
   * cũng là lúc ngừng nhận đặt (ADR-0041 §3), nên mở lại sau mốc đó là bày ra
   * một chuyến không ai đặt được.
   *
   * Trùng trạng thái = NO-OP thật sự (không ghi, không bust): `UPDATE` vẫn
   * chạm `updatedAt`, mà "có người bấm lại đúng nút cũ" không phải một thay
   * đổi của chuyến.
   */
  async setStatus(input: AdminDepartureSetStatusInput): Promise<AdminDepartureRow> {
    const now = new Date();
    const { row, tour, before, changed } = await prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<
        {
          id: string;
          tour_id: string;
          start_date: Date;
          end_date: Date;
          price_override: Prisma.Decimal | null;
          status: DepartureStatus;
        }[]
      >(Prisma.sql`
        SELECT id, tour_id, start_date, end_date, price_override, status
        FROM tour_departures WHERE id = ${input.id}::uuid FOR UPDATE
      `);
      if (!locked) throw new DepartureNotFoundError(input.id);
      if (locked.status === DepartureStatus.CANCELLED) {
        throw new DepartureRuleError(
          'DEPARTURE_CANCELLED',
          'This departure has been cancelled — its travellers were already refunded, so it can no longer change status.',
        );
      }

      const startDate = calendarDate(locked.start_date);
      const endDate = calendarDate(locked.end_date);
      if (input.status === DepartureStatus.OPEN && locked.status !== DepartureStatus.OPEN) {
        const blocked = reopenBlocker(startDate, endDate, now);
        if (blocked) throw new DepartureRuleError('DEADLINE_PASSED', blocked);
      }

      const before = {
        status: locked.status,
        startDate,
        endDate,
        priceOverride: locked.price_override === null ? null : money(locked.price_override),
      } satisfies DepartureCardInput;
      const tourRow = await tx.tour.findUniqueOrThrow({
        where: { id: locked.tour_id },
        select: TOUR_SELECT,
      });
      if (locked.status === input.status) {
        const same = await tx.tourDeparture.findUniqueOrThrow({
          where: { id: input.id },
          select: DEPARTURE_SELECT,
        });
        return { row: same, tour: tourRow, before, changed: false };
      }

      const updated = await tx.tourDeparture.update({
        where: { id: input.id },
        data: { status: input.status },
        select: DEPARTURE_SELECT,
      });
      return { row: updated, tour: tourRow, before, changed: true };
    });

    const counts = await bookingCounts([row.id]);
    const result = toRow(row, tour, counts.get(row.id) ?? ZERO_COUNTS);
    if (changed) {
      this.logger.log(
        `[admin] departure status ${JSON.stringify({
          departureId: input.id,
          toStatus: input.status,
        })}`,
      );
      this.bust(tour.slug, before, result, now);
    }
    return result;
  }

  /**
   * Bust cache web SAU khi transaction đã commit (ADR-0016 §3, tiền lệ
   * `reviews.service.ts`): bust trước commit là bảo web dựng lại từ dữ liệu
   * cũ rồi cache thêm 300 giây nữa.
   *
   * `void` có chủ đích — đường này chết thì site chỉ kém tươi, còn lệnh ghi
   * đã ăn rồi thì không được phép fail theo.
   */
  private bust(
    tourSlug: string,
    before: DepartureCardInput | null,
    after: AdminDepartureRow,
    now: Date,
  ): void {
    void this.webRevalidation.revalidate(
      departureRevalidationTags({
        tourSlug,
        before,
        after: {
          status: after.status,
          startDate: after.startDate,
          endDate: after.endDate,
          priceOverride: after.priceOverride,
        },
        now,
      }),
    );
  }
}

/** `YYYY-MM-DD` hợp lệ về NGHIỆP VỤ: về không thể trước khi đi. */
function assertDateRange(startDate: string, endDate: string): void {
  if (endDate < startDate) {
    throw new DepartureRuleError(
      'INVALID_DATE_RANGE',
      `The return date (${endDate}) is before the start date (${startDate}).`,
    );
  }
}

/**
 * Không dựng lịch cho một ngày đã trôi qua. Thước là ngày VIỆT NAM của server
 * (ADR-0041 §7) chứ không phải đồng hồ trình duyệt — ô ngày của admin ở múi
 * giờ khác sẽ không bao giờ quyết định thay server.
 */
function assertNotInPast(startDate: string, now: Date): void {
  const today = vietnamToday(now);
  if (startDate < today) {
    throw new DepartureRuleError(
      'START_IN_PAST',
      `A departure cannot start on ${startDate}, which is before today (${today}).`,
    );
  }
}

/** Chuỗi thập phân → Decimal, giữ nguyên `null` ("thừa hưởng basePrice"). */
function toDecimal(value: string | null): Prisma.Decimal | null {
  return value === null ? null : new Prisma.Decimal(value);
}

/** Hai con số của một chuyến: tổng booking sống, và phần CHƯA trả tiền. */
export interface BookingCounts {
  live: number;
  pending: number;
}

/**
 * Đếm booking của từng chuyến — MỘT câu gom nhóm cho cả trang, tách theo trạng
 * thái để chỗ gọi biết bao nhiêu trong số đó là `PENDING`.
 *
 * Vì sao phải tách: đóng một chuyến gây hai hệ quả khác hẳn nhau. Khách ĐÃ trả
 * giữ chỗ và không ai báo gì; khách ĐANG trả sẽ bị đường claim từ chối
 * (`departure-closed`) rồi hoàn tiền tự động kèm email. Một con số gộp thì hộp
 * xác nhận không thể nói đúng sự thật.
 *
 * Chuyến không có booking nào vắng mặt trong kết quả, nên chỗ gọi đọc bằng
 * `?? ZERO_COUNTS` thay vì mong đợi một hàng 0.
 */
async function bookingCounts(departureIds: string[]): Promise<Map<string, BookingCounts>> {
  if (departureIds.length === 0) return new Map();
  const groups = await prisma.booking.groupBy({
    by: ['departureId', 'status'],
    where: { departureId: { in: departureIds }, status: { in: LIVE_BOOKING_STATUSES } },
    _count: { _all: true },
  });
  const byDeparture = new Map<string, BookingCounts>();
  for (const group of groups) {
    const current = byDeparture.get(group.departureId) ?? { live: 0, pending: 0 };
    current.live += group._count._all;
    if (group.status === BookingStatus.PENDING) current.pending += group._count._all;
    byDeparture.set(group.departureId, current);
  }
  return byDeparture;
}

/** Chuyến chưa ai đặt — giá trị đọc ra khi chuyến vắng mặt trong kết quả gom nhóm. */
const ZERO_COUNTS: BookingCounts = { live: 0, pending: 0 };

function toRow(
  row: DepartureRowData,
  tour: Pick<TourData, 'basePrice' | 'currency'>,
  counts: BookingCounts,
): AdminDepartureRow {
  const startDate = calendarDate(row.startDate);
  const endDate = calendarDate(row.endDate);
  return {
    id: row.id,
    startDate,
    endDate,
    // Giá ÁP DỤNG, đúng công thức `priceOverride ?? basePrice` mà đường khách
    // dùng (`effectiveUnitPrice`) — bảng admin và trang tour không được phép
    // in hai con số khác nhau cho cùng một chuyến.
    price: money(row.priceOverride ?? tour.basePrice),
    priceOverride: row.priceOverride === null ? null : money(row.priceOverride),
    currency: tour.currency,
    seatsBooked: row.seatsBooked,
    seatsTotal: row.seatsTotal,
    status: row.status,
    // Server tính hạn chót bằng chính hàm của contract (ADR-0041 §8) — màn
    // hình IN nó, không dựng lại luật N.
    cancellationDeadline: cancellationDeadline(startDate, endDate),
    liveBookingCount: counts.live,
    pendingBookingCount: counts.pending,
    version: row.updatedAt.toISOString(),
  };
}

function toTour(tour: TourData): AdminDepartureTour {
  return {
    id: tour.id,
    slug: tour.slug,
    title: tour.title,
    basePrice: money(tour.basePrice),
    currency: tour.currency,
  };
}
