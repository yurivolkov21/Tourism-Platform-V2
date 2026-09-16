import { Injectable } from '@nestjs/common';
import type {
  Destination,
  MediaItem,
  Paged,
  TourCard,
  TourCategory,
  TourDetail,
  ToursListQuery,
} from '@tourism/contract';
import { cancellationDeadline, isWithinDeadline, vietnamToday } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { DepartureStatus, MediaOwnerType, MediaRole } from '../../generated/prisma/enums.js';
import { calendarDate, startOfDayUtc } from '../../lib/calendar-date.js';
import { escapeLike } from '../../lib/like.js';
import { MediaService } from '../media/media.service.js';

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

const SORT_COLUMN = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  basePrice: 'basePrice',
  durationDays: 'durationDays',
  title: 'title',
} as const satisfies Record<ToursListQuery['sort'], keyof Prisma.TourOrderByWithRelationInput>;

/**
 * `cover` là tham số chứ không tự query bên trong: hàm này chạy trong vòng lặp
 * `map()` trên cả trang kết quả, nên gọi DB ở đây là đẻ ra N+1. Chỗ gọi có
 * trách nhiệm resolve media MỘT lần cho cả lô rồi truyền xuống — cùng khuôn
 * `posts.service` đã dùng từ P3a.
 *
 * Mặc định `null` để chỗ gọi nào chưa cần ảnh vẫn biên dịch được và trả về
 * "không có ảnh" một cách tường minh, thay vì thiếu khoá.
 */
/**
 * Giá "from" thật — `min(priceOverride ?? basePrice)` trên các đợt OPEN còn nhận
 * đặt (`bookable`, ADR-0041 §3) của tour; không có đợt → `basePrice`. Nhận MẢNG
 * priceOverride ĐÃ LỌC (theo tour và theo hạn đặt) để list tính một lần cho cả
 * trang và detail dùng lại departures đã load — hai bên lọc cùng một luật.
 */
export function priceFrom(
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

export function toTourCard(
  tour: TourCardRow,
  cover: MediaItem | null = null,
  from: string = money(tour.basePrice),
): TourCard {
  return {
    cover,
    id: tour.id,
    slug: tour.slug,
    title: tour.title,
    summary: tour.summary,
    basePrice: money(tour.basePrice),
    compareAtPrice: tour.compareAtPrice ? money(tour.compareAtPrice) : null,
    priceFrom: from,
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
        orderBy: [{ [SORT_COLUMN[sort]]: order }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // MỘT query media cho cả trang (chống N+1) — không gọi trong `map()`.
    const ids = tours.map((t) => t.id);
    const [coverMap, upcoming] = await Promise.all([
      // Chỉ cần cover cho card — lọc hero ngay ở query (W4 R3).
      this.media.resolveForOwners(MediaOwnerType.TOUR, ids, [MediaRole.hero]),
      // MỘT query đợt cho cả trang → `priceFrom` (giá "from" thật). Lọc đúng như
      // detail (OPEN + chưa khởi hành theo ngày Việt Nam); lấy thêm hai cột ngày vì
      // luật hạn chót N chỉ sống ở Node (spec §4.1), không viết lại trong SQL.
      prisma.tourDeparture.findMany({
        where: {
          tourId: { in: ids },
          status: DepartureStatus.OPEN,
          startDate: { gte: startOfVietnamToday(now) },
        },
        select: { tourId: true, priceOverride: true, startDate: true, endDate: true },
      }),
    ]);
    const overridesByTour = new Map<string, (Prisma.Decimal | null)[]>();
    for (const d of upcoming) {
      // Chuyến đã qua hạn đặt không bán được nữa → không kéo giá "from" xuống
      // (ADR-0041 §3) — cùng luật với cờ `bookable` của detail.
      if (!isWithinDeadline(now, calendarDate(d.startDate), calendarDate(d.endDate))) continue;
      const list = overridesByTour.get(d.tourId) ?? [];
      list.push(d.priceOverride);
      overridesByTour.set(d.tourId, list);
    }

    return {
      items: tours.map((tour) =>
        toTourCard(
          tour,
          pickCover(coverMap.get(tour.id)),
          priceFrom(tour.basePrice, overridesByTour.get(tour.id) ?? []),
        ),
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

    // Luật hạn chót tính MỘT lần mỗi chuyến: vừa in `bookingDeadline`/`bookable`,
    // vừa lọc giá "from" — web không tự dựng luật N hay so giờ trình duyệt (Q7).
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
        priceFrom(
          tour.basePrice,
          departureViews.filter((view) => view.bookable).map((view) => view.row.priceOverride),
        ),
      ),
      media: media ?? [],
      suitableFor: tour.suitableFor,
      badges: tour.badges,
      included: tour.included,
      excluded: tour.excluded,
      highlights: tour.highlights,
      meetingPoint: tour.meetingPoint,
      // Nội dung bán hàng thêm ở ADR-0023. Bốn câu mô tả card dữ kiện và cửa
      // sổ huỷ miễn phí — chỉ có ở detail, KHÔNG lên `TourCardSchema`.
      factDurationNote: tour.factDurationNote,
      factGroupSizeNote: tour.factGroupSizeNote,
      factDifficultyNote: tour.factDifficultyNote,
      factGoodForNote: tour.factGoodForNote,
      freeCancellationDays: tour.freeCancellationDays,
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
      orderBy: { order: 'asc' },
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
