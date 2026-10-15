import { Injectable } from '@nestjs/common';
import type {
  Destination,
  MediaItem,
  Paged,
  TourCard,
  TourCategory,
  TourDetail,
  TourNextDeparture,
  ToursListQuery,
} from '@tourism/contract';
import { cancellationDeadline, isWithinDeadline, vietnamToday } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { DepartureStatus, MediaOwnerType, MediaRole } from '../../generated/prisma/enums.js';
import { calendarDate, startOfDayUtc } from '../../lib/calendar-date.js';
import { escapeLike } from '../../lib/like.js';
import { MediaService } from '../media/media.service.js';
import { type CardDepartureCandidate, feedsTourCard, nextDepartureOf } from './card-departures.js';
import { tourOrderBy } from './tour-sort.js';

/**
 * Ảnh bìa = asset role `hero`. null khi owner chưa có ảnh nào (ADR-0020).
 * Export cho các module khác dùng chung cách chọn cover (booking Task 1 —
 * `tourImage` của khu Trips theo đúng khuôn này).
 */
export const pickCover = (media: MediaItem[] | undefined): MediaItem | null =>
  media?.find((m) => m.role === 'hero') ?? null;

/**
 * Prisma Decimal → chuỗi 2 chữ số thập phân ("39.00", KHÔNG "39"). Khớp mọi
 * serializer money khác trong repo (`.toFixed(2)`); money KHÔNG BAO GIỜ thành float.
 */
const money = (value: Prisma.Decimal): string => value.toFixed(2);

/**
 * Cận dưới cho chuyến "sắp tới" (chưa khởi hành): 00:00 UTC của ngày HÔM NAY
 * THEO GIỜ VIỆT NAM (ADR-0041 §7). `start_date` là ngày lịch VN, và 00:00 UTC là
 * khuôn Prisma dùng cho cột `@db.Date`. Thước UTC cũ để chuyến khởi hành hôm
 * qua (giờ VN) còn hiện tới 06:59 sáng nay.
 */
const startOfVietnamToday = (now: Date): Date => startOfDayUtc(vietnamToday(now));

/** Include cấp card: category + TẤT CẢ destination qua bảng join M:N (C1 —
 * primary đứng đầu, rồi theo tên). Trước đây lọc `isPrimary/take:1` làm mất
 * destination phụ; giờ trả cả mảng để client tự chọn. */
export const cardInclude = {
  category: { select: { slug: true, name: true } },
  destinations: {
    select: { isPrimary: true, destination: { select: { slug: true, name: true } } },
    orderBy: [{ isPrimary: 'desc' }, { destination: { name: 'asc' } }],
  },
} satisfies Prisma.TourInclude;

type TourCardRow = Prisma.TourGetPayload<{ include: typeof cardInclude }>;

/**
 * Giá "from" = `min(priceOverride ?? basePrice)` trên các đợt nhận vào; không có đợt nào →
 * `basePrice`. KHÔNG export: tập đợt do `cardDepartureFacts` lọc, để không chỗ gọi nào tính giá
 * "from" trên một tập khác tập của đợt kế tiếp (ADR-0058 §1).
 */
function priceFrom(
  basePrice: Prisma.Decimal,
  overrides: readonly (Prisma.Decimal | null)[],
): string {
  let min = overrides.length > 0 ? null : basePrice;
  for (const o of overrides) {
    const v = o ?? basePrice;
    if (min === null || v.lt(min)) min = v;
  }
  return money(min ?? basePrice);
}

/** Một đợt như thẻ tour đọc nó: đủ cột cho `feedsTourCard`, cộng giá riêng của đợt. */
interface CardDepartureRow extends CardDepartureCandidate {
  priceOverride: Prisma.Decimal | null;
}

/** Hàng đợt Prisma → `CardDepartureRow`; ngày `@db.Date` thành ngày lịch Việt Nam. */
const toCardDepartureRow = (row: {
  status: DepartureStatus;
  startDate: Date;
  endDate: Date;
  seatsTotal: number;
  seatsBooked: number;
  priceOverride: Prisma.Decimal | null;
}): CardDepartureRow => ({
  status: row.status,
  startDate: calendarDate(row.startDate),
  endDate: calendarDate(row.endDate),
  seatsLeft: row.seatsTotal - row.seatsBooked,
  priceOverride: row.priceOverride,
});

/** Những gì thẻ tour đọc từ các đợt của nó (ADR-0058 §1–§2). */
export interface CardDepartureFacts {
  priceFrom: string;
  nextDeparture: TourNextDeparture | null;
}

/**
 * Giá "from" và đợt kế tiếp của MỘT tour, tính trên CÙNG một tập đợt: `feedsTourCard` (OPEN,
 * còn hạn đặt, còn chỗ). Danh sách, tour liên quan của bài viết và trang chi tiết đều đi qua
 * đây, nên thẻ không in giá của đợt này cạnh ngày của đợt khác, và thẻ với hero trang tour in
 * cùng một giá "from" (ADR-0058 §1). Đợt hết chỗ không còn kéo giá "from" xuống từ 15/10.
 */
export function cardDepartureFacts(
  basePrice: Prisma.Decimal,
  departures: readonly CardDepartureRow[],
  now: Date,
): CardDepartureFacts {
  const feeding = departures.filter((departure) => feedsTourCard(departure, now));
  return {
    priceFrom: priceFrom(
      basePrice,
      feeding.map((departure) => departure.priceOverride),
    ),
    nextDeparture: nextDepartureOf(feeding, now),
  };
}

/**
 * `cardDepartureFacts` của một lô tour — MỘT query đợt cho cả lô. `listTours` và tour liên quan
 * của bài viết cùng gọi, nên một tour không bao giờ mang hai giá hay hai ngày ở hai trang (vòng
 * review P4e-4). SQL chỉ cắt thô (OPEN, chưa khởi hành theo ngày Việt Nam), cùng `where` với
 * đợt của trang chi tiết; hạn chót và số chỗ xét ở Node vì luật hạn chót N chỉ sống ở đó (spec
 * §4.1), không viết lại trong SQL.
 */
export async function cardDepartureFactsByTour(
  tours: readonly { id: string; basePrice: Prisma.Decimal }[],
  now: Date,
): Promise<Map<string, CardDepartureFacts>> {
  if (tours.length === 0) return new Map();
  const upcoming = await prisma.tourDeparture.findMany({
    where: {
      tourId: { in: tours.map((tour) => tour.id) },
      status: DepartureStatus.OPEN,
      startDate: { gte: startOfVietnamToday(now) },
    },
    select: {
      tourId: true,
      status: true,
      startDate: true,
      endDate: true,
      seatsTotal: true,
      seatsBooked: true,
      priceOverride: true,
    },
  });
  const rowsByTour = new Map<string, CardDepartureRow[]>();
  for (const d of upcoming) {
    const list = rowsByTour.get(d.tourId) ?? [];
    list.push(toCardDepartureRow(d));
    rowsByTour.set(d.tourId, list);
  }
  return new Map(
    tours.map((tour) => [
      tour.id,
      cardDepartureFacts(tour.basePrice, rowsByTour.get(tour.id) ?? [], now),
    ]),
  );
}

/**
 * `cover` là tham số chứ không tự query bên trong: hàm này chạy trong vòng lặp
 * `map()` trên cả trang kết quả, nên gọi DB ở đây là đẻ ra N+1. Chỗ gọi có
 * trách nhiệm resolve media MỘT lần cho cả lô rồi truyền xuống — cùng khuôn
 * `posts.service` đã dùng từ P3a. `facts` cũng vậy: lấy từ `cardDepartureFactsByTour`
 * (một query cho cả lô) hoặc `cardDepartureFacts` trên các đợt detail đã nạp.
 *
 * Mặc định `null` để chỗ gọi nào chưa cần ảnh vẫn biên dịch được và trả về
 * "không có ảnh" một cách tường minh, thay vì thiếu khoá. `facts` mặc định là đúng
 * thứ `cardDepartureFacts` trả cho một tour không còn đợt nào: giá base, không có đợt kế tiếp.
 */
export function toTourCard(
  tour: TourCardRow,
  cover: MediaItem | null = null,
  facts: CardDepartureFacts = { priceFrom: money(tour.basePrice), nextDeparture: null },
): TourCard {
  return {
    cover,
    id: tour.id,
    slug: tour.slug,
    title: tour.title,
    summary: tour.summary,
    basePrice: money(tour.basePrice),
    compareAtPrice: tour.compareAtPrice ? money(tour.compareAtPrice) : null,
    priceFrom: facts.priceFrom,
    currency: tour.currency,
    durationDays: tour.durationDays,
    difficulty: tour.difficulty,
    maxGroupSize: tour.maxGroupSize,
    isFeatured: tour.isFeatured,
    destinations: tour.destinations.map((d) => ({
      slug: d.destination.slug,
      name: d.destination.name,
      isPrimary: d.isPrimary,
    })),
    category: tour.category,
    // Decimal → number: rating là số hiển thị sao, không phải tiền, và
    // Decimal(2,1) biểu diễn chính xác được trong double. null giữ nguyên
    // null (chưa ai đánh giá), KHÔNG fold về 0.
    ratingAvg: tour.ratingAvg === null ? null : Number(tour.ratingAvg),
    ratingCount: tour.ratingCount,
    // Thứ tự admin lưu — thẻ lấy badge đầu mảng khi chỉ còn chỗ cho một (ADR-0058 §3).
    badges: tour.badges,
    nextDeparture: facts.nextDeparture,
  };
}

/**
 * Đọc catalog public (spec §6) — chỉ row published/active, shape map 1:1 sang
 * schema `@tourism/contract` (integration test parse response bằng chính các
 * schema đó để chứng minh conformity). Query pattern lặp theo public tours
 * service của Nexora: filter → count+page song song → include lookup.
 */
@Injectable()
export class CatalogService {
  constructor(private readonly media: MediaService) {}

  async listTours(query: ToursListQuery): Promise<Paged<TourCard>> {
    const { page, limit, category, destination, search, featured, sort, order } = query;
    // MỘT mốc cho cả lượt đọc: lọc "chưa khởi hành" và luật "còn nhận đặt" nhìn
    // cùng một khoảnh khắc.
    const now = new Date();

    const where: Prisma.TourWhereInput = {
      isPublished: true,
      ...(category ? { category: { slug: category } } : {}),
      ...(destination ? { destinations: { some: { destination: { slug: destination } } } } : {}),
      ...(featured === undefined ? {} : { isFeatured: featured }),
      ...(search
        ? {
            // escapeLike (W4 R3, cùng bài học F9 phía admin): Prisma
            // `contains` không tự escape `%`/`_` — gõ `%` là kéo TOÀN BỘ
            // bảng trong khi ô tìm nói đang lọc.
            OR: [
              { title: { contains: escapeLike(search), mode: 'insensitive' } },
              { summary: { contains: escapeLike(search), mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, tours] = await Promise.all([
      prisma.tour.count({ where }),
      prisma.tour.findMany({
        where,
        include: cardInclude,
        // Sort phụ theo id giữ pagination ổn định khi sort key bằng nhau.
        orderBy: tourOrderBy(sort, order),
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // MỘT query media cho cả trang (chống N+1) — không gọi trong `map()`.
    const ids = tours.map((t) => t.id);
    const [coverMap, facts] = await Promise.all([
      // Chỉ cần cover cho card — lọc hero ngay ở query (W4 R3).
      this.media.resolveForOwners(MediaOwnerType.TOUR, ids, [MediaRole.hero]),
      // MỘT query đợt cho cả trang → giá "from" thật và đợt kế tiếp.
      cardDepartureFactsByTour(tours, now),
    ]);

    return {
      items: tours.map((tour) =>
        toTourCard(tour, pickCover(coverMap.get(tour.id)), facts.get(tour.id)),
      ),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Detail của tour đã published, hoặc null (controller dịch thành NOT_FOUND). */
  async getTourBySlug(slug: string): Promise<TourDetail | null> {
    // MỘT mốc cho cả lượt đọc — lọc chuyến, `bookable` và giá "from" nhìn cùng
    // một khoảnh khắc.
    const now = new Date();
    const tour = await prisma.tour.findFirst({
      where: { slug, isPublished: true },
      include: {
        ...cardInclude,
        itinerary: { orderBy: { dayNumber: 'asc' } },
        faqs: { orderBy: { order: 'asc' } },
        policies: { orderBy: { order: 'asc' } },
        departures: {
          // VẪN gồm chuyến đã qua hạn đặt nhưng chưa khởi hành: trang tour hiện
          // chúng là "Booking closed" (spec §3.2), nên ở đây chỉ lọc "chưa khởi hành".
          where: {
            status: DepartureStatus.OPEN,
            startDate: { gte: startOfVietnamToday(now) },
          },
          orderBy: { startDate: 'asc' },
        },
      },
    });
    if (!tour) return null;

    // Detail cần CẢ BỘ ảnh (nuôi khảm gallery), khác list chỉ cần một tấm bìa.
    const media = (await this.media.resolveForOwners(MediaOwnerType.TOUR, [tour.id])).get(tour.id);

    // Luật hạn chót tính MỘT lần mỗi chuyến cho `bookingDeadline`/`bookable` — web không
    // tự dựng luật N hay so giờ trình duyệt (Q7). Giá "from" và đợt kế tiếp đi qua CÙNG hàm
    // của danh sách (`cardDepartureFacts`), trên đúng các đợt đã nạp ở đây.
    const departureViews = tour.departures.map((row) => {
      const startDate = calendarDate(row.startDate);
      const endDate = calendarDate(row.endDate);
      return {
        row,
        startDate,
        endDate,
        bookingDeadline: cancellationDeadline(startDate, endDate),
        bookable: isWithinDeadline(now, startDate, endDate),
      };
    });

    return {
      ...toTourCard(
        tour,
        pickCover(media),
        cardDepartureFacts(tour.basePrice, tour.departures.map(toCardDepartureRow), now),
      ),
      media: media ?? [],
      suitableFor: tour.suitableFor,
      included: tour.included,
      excluded: tour.excluded,
      highlights: tour.highlights,
      meetingPoint: tour.meetingPoint,
      // Nội dung bán hàng thêm ở ADR-0023. Bốn câu mô tả card dữ kiện — chỉ có
      // ở detail, KHÔNG lên `TourCardSchema`.
      factDurationNote: tour.factDurationNote,
      factGroupSizeNote: tour.factGroupSizeNote,
      factDifficultyNote: tour.factDifficultyNote,
      factGoodForNote: tour.factGoodForNote,
      itinerary: tour.itinerary.map((day) => ({
        dayNumber: day.dayNumber,
        title: day.title,
        description: day.description,
      })),
      faqs: tour.faqs.map((faq) => ({
        question: faq.question,
        answer: faq.answer,
      })),
      policies: tour.policies.map((policy) => ({
        kind: policy.kind,
        title: policy.title,
        body: policy.body,
      })),
      departures: departureViews.map(({ row, startDate, endDate, bookingDeadline, bookable }) => ({
        id: row.id,
        startDate,
        endDate,
        seatsLeft: row.seatsTotal - row.seatsBooked,
        effectivePrice: money(row.priceOverride ?? tour.basePrice),
        compareAtPrice: row.compareAtPrice ? money(row.compareAtPrice) : null,
        bookingDeadline,
        bookable,
      })),
    };
  }

  async listDestinations(): Promise<Destination[]> {
    const destinations = await prisma.destination.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        // Đếm relation có filter: chỉ tour đã published.
        _count: {
          select: { tours: { where: { tour: { isPublished: true } } } },
        },
      },
    });

    const coverMap = await this.media.resolveForOwners(
      MediaOwnerType.DESTINATION,
      destinations.map((d) => d.id),
      // Card destination chỉ vẽ cover (W4 R3).
      [MediaRole.hero],
    );

    return destinations.map((destination) => ({
      id: destination.id,
      slug: destination.slug,
      name: destination.name,
      country: destination.country,
      region: destination.region,
      description: destination.description,
      tourCount: destination._count.tours,
      cover: pickCover(coverMap.get(destination.id)),
    }));
  }

  async listCategories(): Promise<TourCategory[]> {
    const categories = await prisma.tourCategory.findMany({
      where: { isActive: true },
      // Khoá phụ `id`: cột `order` không unique, và hai hàng ngang số thì
      // Postgres trả theo thứ tự tuỳ kế hoạch truy vấn — chip lọc sẽ đảo chỗ
      // giữa hai lượt ISR regenerate dù admin không đụng gì. Cùng thước với
      // `CATEGORY_ORDER_BY` của bề mặt admin, để hai nơi không nói hai chuyện.
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
      // Chỉ đếm tour đã publish — cùng lý do với `listDestinations`: đếm cả
      // draft là endpoint công khai gián tiếp lộ số tour nháp.
      include: { _count: { select: { tours: { where: { isPublished: true } } } } },
    });

    return categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      order: category.order,
      toursCount: category._count.tours,
    }));
  }
}
