import { Injectable } from '@nestjs/common';
import type {
  Destination,
  Paged,
  TourCard,
  TourCategory,
  TourDetail,
  ToursListQuery,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { DepartureStatus } from '../../generated/prisma/enums.js';

/** Prisma Decimal → string không mất mát ("39.00"). Money KHÔNG BAO GIỜ thành float. */
const money = (value: { toString(): string }): string => value.toString();

/** Prisma `@db.Date` (Date nửa đêm UTC) → ngày lịch "YYYY-MM-DD". */
const calendarDate = (value: Date): string => value.toISOString().slice(0, 10);

/** Nửa đêm UTC hôm nay — cận dưới cho departure "upcoming". */
const startOfTodayUtc = (): Date => new Date(new Date().toISOString().slice(0, 10));

/** Include cấp card: category + primary destination qua bảng join M:N. */
const cardInclude = {
  category: { select: { slug: true, name: true } },
  destinations: {
    where: { isPrimary: true },
    select: { destination: { select: { slug: true, name: true } } },
    take: 1,
  },
} satisfies Prisma.TourInclude;

type TourCardRow = Prisma.TourGetPayload<{ include: typeof cardInclude }>;

const SORT_COLUMN = {
  createdAt: 'createdAt',
  basePrice: 'basePrice',
  durationDays: 'durationDays',
  title: 'title',
} as const satisfies Record<ToursListQuery['sort'], keyof Prisma.TourOrderByWithRelationInput>;

function toTourCard(tour: TourCardRow): TourCard {
  return {
    id: tour.id,
    slug: tour.slug,
    title: tour.title,
    summary: tour.summary,
    basePrice: money(tour.basePrice),
    compareAtPrice: tour.compareAtPrice ? money(tour.compareAtPrice) : null,
    currency: tour.currency,
    durationDays: tour.durationDays,
    difficulty: tour.difficulty,
    maxGroupSize: tour.maxGroupSize,
    isFeatured: tour.isFeatured,
    primaryDestination: tour.destinations[0]?.destination ?? null,
    category: tour.category,
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

    return {
      items: tours.map(toTourCard),
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

    return {
      ...toTourCard(tour),
      suitableFor: tour.suitableFor,
      badges: tour.badges,
      included: tour.included,
      excluded: tour.excluded,
      highlights: tour.highlights,
      meetingPoint: tour.meetingPoint,
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

    return destinations.map((destination) => ({
      id: destination.id,
      slug: destination.slug,
      name: destination.name,
      country: destination.country,
      region: destination.region,
      description: destination.description,
      tourCount: destination._count.tours,
    }));
  }

  async listCategories(): Promise<TourCategory[]> {
    const categories = await prisma.tourCategory.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    return categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      order: category.order,
    }));
  }
}
