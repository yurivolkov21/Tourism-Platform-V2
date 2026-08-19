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
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { DepartureStatus, MediaOwnerType } from '../../generated/prisma/enums.js';
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

/** Prisma `@db.Date` (Date nửa đêm UTC) → ngày lịch "YYYY-MM-DD". */
const calendarDate = (value: Date): string => value.toISOString().slice(0, 10);

/** Nửa đêm UTC hôm nay — cận dưới cho departure "upcoming". */
const startOfTodayUtc = (): Date => new Date(new Date().toISOString().slice(0, 10));

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
 * Giá "from" thật — `min(priceOverride ?? basePrice)` trên các đợt OPEN sắp tới
 * của tour; không có đợt → `basePrice`. Nhận MẢNG priceOverride (đã lọc theo
 * tour) để list tính một lần cho cả trang và detail dùng lại departures đã load.
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

    const where: Prisma.TourWhereInput = {
      isPublished: true,
      ...(category ? { category: { slug: category } } : {}),
      ...(destination ? { destinations: { some: { destination: { slug: destination } } } } : {}),
      ...(featured === undefined ? {} : { isFeatured: featured }),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { summary: { contains: search, mode: 'insensitive' } },
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
      this.media.resolveForOwners(MediaOwnerType.TOUR, ids),
      // MỘT query đợt cho cả trang → `priceFrom` (giá "from" thật). Chỉ lấy hai
      // cột cần, lọc đúng như detail (OPEN + chưa khởi hành).
      prisma.tourDeparture.findMany({
        where: {
          tourId: { in: ids },
          status: DepartureStatus.OPEN,
          startDate: { gte: startOfTodayUtc() },
        },
        select: { tourId: true, priceOverride: true },
      }),
    ]);
    const overridesByTour = new Map<string, (Prisma.Decimal | null)[]>();
    for (const d of upcoming) {
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
    const tour = await prisma.tour.findFirst({
      where: { slug, isPublished: true },
      include: {
        ...cardInclude,
        itinerary: { orderBy: { dayNumber: 'asc' } },
        faqs: { orderBy: { order: 'asc' } },
        policies: { orderBy: { order: 'asc' } },
        departures: {
          where: {
            status: DepartureStatus.OPEN,
            startDate: { gte: startOfTodayUtc() },
          },
          orderBy: { startDate: 'asc' },
        },
      },
    });
    if (!tour) return null;

    // Detail cần CẢ BỘ ảnh (nuôi khảm gallery), khác list chỉ cần một tấm bìa.
    const media = (await this.media.resolveForOwners(MediaOwnerType.TOUR, [tour.id])).get(tour.id);

    return {
      ...toTourCard(
        tour,
        pickCover(media),
        priceFrom(
          tour.basePrice,
          tour.departures.map((d) => d.priceOverride),
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
      departures: tour.departures.map((departure) => ({
        id: departure.id,
        startDate: calendarDate(departure.startDate),
        endDate: calendarDate(departure.endDate),
        seatsLeft: departure.seatsTotal - departure.seatsBooked,
        effectivePrice: money(departure.priceOverride ?? tour.basePrice),
        compareAtPrice: departure.compareAtPrice ? money(departure.compareAtPrice) : null,
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
