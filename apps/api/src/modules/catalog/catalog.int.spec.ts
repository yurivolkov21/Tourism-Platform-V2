import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  DestinationSchema,
  PagedSchema,
  TourCardSchema,
  TourCategorySchema,
  TourDetailSchema,
} from '@tourism/contract';
import * as catalog from '../../../prisma/fixtures/catalog.js';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { DepartureStatus } from '../../generated/prisma/enums.js';

/**
 * Integration (Docker PG, db tourism_test — xem vitest.int.config.ts).
 * Fixture subset từ prisma/fixtures/catalog.ts: 2 tour published (khác
 * category để test filter) + 1 tour UNPUBLISHED; departures thì tự dựng với
 * ngày ĐỘNG (quá khứ / tương lai / CLOSED) để test "upcoming OPEN only" không
 * thối theo thời gian thực.
 */

const PUBLISHED_DAY_SLUG = 'hoi-an-walking-tour'; // category `day`, isFeatured
const PUBLISHED_CRUISE_SLUG = 'halong-bay-2d1n'; // category `cruise`
const UNPUBLISHED_SLUG = 'hanoi-street-food-walk'; // isPublished: false in fixtures

const PagedCards = PagedSchema(TourCardSchema);

const pick = (slug: string) => {
  const tour = catalog.tours.find((t) => t.slug === slug);
  if (!tour) throw new Error(`fixture tour missing: ${slug}`);
  return tour;
};

describe('catalog integration (oRPC @Implement over Fastify)', () => {
  let app: NestFastifyApplication;

  const dayTour = pick(PUBLISHED_DAY_SLUG);
  const cruiseTour = pick(PUBLISHED_CRUISE_SLUG);
  const unpublishedTour = pick(UNPUBLISHED_SLUG);
  const fixtureTours = [dayTour, cruiseTour, unpublishedTour];
  const tourIds = new Set(fixtureTours.map((t) => t.id));

  // Dynamic departures on the day tour: only `open60` + `openOverride90`
  // should surface (upcoming + OPEN).
  const dep = (id: string, start: Date, patch: Partial<Prisma.TourDepartureCreateManyInput>) => ({
    id: `e9000001-0000-4000-8000-00000000000${id}`,
    tourId: dayTour.id,
    startDate: start,
    endDate: start,
    seatsTotal: 8,
    seatsBooked: 0,
    status: DepartureStatus.OPEN,
    ...patch,
  });
  const future60 = new Date(Date.now() + 60 * 86_400_000);
  const future90 = new Date(Date.now() + 90 * 86_400_000);
  const past10 = new Date(Date.now() - 10 * 86_400_000);
  const departures = [
    dep('1', future60, { seatsBooked: 3 }), // upcoming OPEN → seatsLeft 5
    dep('2', future90, {
      priceOverride: '59.00',
      compareAtPrice: '75.00',
      seatsTotal: 10,
    }),
    dep('3', past10, {}), // past → invisible
    dep('4', future60, { status: DepartureStatus.CLOSED }), // CLOSED → invisible
  ];

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE tour_categories, destinations CASCADE');
    await prisma.tourCategory.createMany({ data: catalog.tourCategories });
    await prisma.destination.createMany({ data: catalog.destinations });
    await prisma.tour.createMany({
      data: fixtureTours as unknown as Prisma.TourCreateManyInput[],
    });
    await prisma.tourDestination.createMany({
      data: catalog.tourDestinations.filter((row) => tourIds.has(row.tourId)),
    });
    await prisma.tourItineraryDay.createMany({
      data: catalog.tourItineraryDays.filter((row) => tourIds.has(row.tourId)),
    });
    await prisma.tourFaq.createMany({
      data: catalog.tourFaqs.filter((row) => tourIds.has(row.tourId)),
    });
    await prisma.tourPolicy.createMany({
      data: catalog.tourPolicies.filter((row) =>
        tourIds.has(row.tourId),
      ) as unknown as Prisma.TourPolicyCreateManyInput[],
    });
    await prisma.tourDeparture.createMany({ data: departures });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/tours returns published cards conforming to TourCardSchema', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tours' });
    expect(res.statusCode).toBe(200);

    const paged = PagedCards.parse(res.json());
    expect(paged).toMatchObject({
      page: 1,
      limit: 12,
      total: 2,
      totalPages: 1,
    });
    const slugs = paged.items.map((item) => item.slug);
    expect(slugs).toContain(PUBLISHED_DAY_SLUG);
    expect(slugs).toContain(PUBLISHED_CRUISE_SLUG);
    // Unpublished tour is invisible in the list.
    expect(slugs).not.toContain(UNPUBLISHED_SLUG);

    const card = paged.items.find((item) => item.slug === PUBLISHED_DAY_SLUG);
    expect(card).toMatchObject({
      id: dayTour.id,
      title: dayTour.title,
      currency: dayTour.currency,
      durationDays: dayTour.durationDays,
      isFeatured: dayTour.isFeatured,
      category: { slug: 'day', name: 'Day Tours' },
    });
    expect(Number(card?.basePrice)).toBe(Number(dayTour.basePrice));
    expect(card?.primaryDestination).not.toBeNull();
  });

  it('filters by category slug', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/tours?category=cruise',
    });
    expect(res.statusCode).toBe(200);
    const paged = PagedCards.parse(res.json());
    expect(paged.total).toBe(1);
    expect(paged.items[0]?.slug).toBe(PUBLISHED_CRUISE_SLUG);
  });

  it('filters by case-insensitive search on title/summary', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/tours?search=WALKING',
    });
    expect(res.statusCode).toBe(200);
    const paged = PagedCards.parse(res.json());
    expect(paged.total).toBe(1);
    expect(paged.items[0]?.slug).toBe(PUBLISHED_DAY_SLUG);

    const none = PagedCards.parse(
      (
        await app.inject({
          method: 'GET',
          url: '/api/tours?search=no-such-tour-xyz',
        })
      ).json(),
    );
    expect(none.total).toBe(0);
    expect(none.items).toEqual([]);
  });

  it('filters by destination slug (any linked destination, not just primary)', async () => {
    // The cruise links Hà Nội as a NON-primary destination; the only other
    // hanoi-linked fixture tour is unpublished → exactly the cruise matches.
    const res = await app.inject({
      method: 'GET',
      url: '/api/tours?destination=hanoi',
    });
    expect(res.statusCode).toBe(200);
    const paged = PagedCards.parse(res.json());
    expect(paged.total).toBe(1);
    expect(paged.items[0]?.slug).toBe(PUBLISHED_CRUISE_SLUG);
  });

  it('coerces query-string pagination + sorts (ZodSmartCoercionPlugin)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/tours?limit=1&page=2&sort=basePrice&order=asc',
    });
    expect(res.statusCode).toBe(200);
    const paged = PagedCards.parse(res.json());
    expect(paged).toMatchObject({ page: 2, limit: 1, total: 2, totalPages: 2 });
    expect(paged.items).toHaveLength(1);
    // basePrice asc, page 2 of 1/page → the more expensive of the two tours.
    const expensiveSlug = [dayTour, cruiseTour].sort(
      (a, b) => Number(a.basePrice) - Number(b.basePrice),
    )[1]?.slug;
    expect(paged.items[0]?.slug).toBe(expensiveSlug);

    const outOfRange = await app.inject({
      method: 'GET',
      url: '/api/tours?limit=999',
    });
    expect(outOfRange.statusCode).toBe(400); // input validation from the contract
  });

  it('GET /api/tours/{slug} returns detail with upcoming OPEN departures only', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/tours/${PUBLISHED_DAY_SLUG}`,
    });
    expect(res.statusCode).toBe(200);

    const detail = TourDetailSchema.parse(res.json());
    expect(detail.slug).toBe(PUBLISHED_DAY_SLUG);
    expect(detail.meetingPoint).toBe(dayTour.meetingPoint);
    expect(detail.suitableFor).toEqual(dayTour.suitableFor);
    expect(detail.badges).toEqual(dayTour.badges);
    expect(detail.highlights).toEqual(dayTour.highlights);
    expect(detail.itinerary).toHaveLength(
      catalog.tourItineraryDays.filter((row) => row.tourId === dayTour.id).length,
    );
    expect(detail.faqs).toHaveLength(
      catalog.tourFaqs.filter((row) => row.tourId === dayTour.id).length,
    );
    expect(detail.policies).toHaveLength(
      catalog.tourPolicies.filter((row) => row.tourId === dayTour.id).length,
    );

    // Past + CLOSED filtered out; ordered by startDate asc.
    expect(detail.departures).toHaveLength(2);
    const [first, second] = detail.departures;
    expect(first).toMatchObject({
      id: departures[0]?.id,
      startDate: future60.toISOString().slice(0, 10),
      seatsLeft: 5, // 8 total − 3 booked
      compareAtPrice: null,
    });
    expect(Number(first?.effectivePrice)).toBe(Number(dayTour.basePrice)); // no override
    expect(second).toMatchObject({
      id: departures[1]?.id,
      startDate: future90.toISOString().slice(0, 10),
      seatsLeft: 10,
    });
    expect(Number(second?.effectivePrice)).toBe(59); // priceOverride wins
    expect(Number(second?.compareAtPrice)).toBe(75);
  });

  it('unpublished tour is invisible via bySlug; missing slug → oRPC NOT_FOUND shape', async () => {
    for (const slug of [UNPUBLISHED_SLUG, 'does-not-exist']) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/tours/${slug}`,
      });
      expect(res.statusCode).toBe(404);
      // oRPC OpenAPI error body: { defined, code, status, message, data }.
      expect(res.json()).toMatchObject({
        code: 'NOT_FOUND',
        message: 'Tour not found',
      });
    }
  });

  it('GET /api/destinations lists active destinations with published tourCount', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/destinations' });
    expect(res.statusCode).toBe(200);

    const destinations = DestinationSchema.array().parse(res.json());
    expect(destinations.length).toBeGreaterThan(0);

    const primaryJoin = catalog.tourDestinations.find(
      (row) => row.tourId === dayTour.id && row.isPrimary,
    );
    const hoiAn = catalog.destinations.find((d) => d.id === primaryJoin?.destinationId);
    const entry = destinations.find((d) => d.slug === hoiAn?.slug);
    expect(entry?.tourCount).toBeGreaterThanOrEqual(1);

    // Hà Nội: linked to the UNPUBLISHED street-food tour (doesn't count) and
    // to the published cruise via a non-primary join (counts) → exactly 1.
    const hanoi = destinations.find((d) => d.slug === 'hanoi');
    expect(hanoi?.tourCount).toBe(1);
  });

  it('GET /api/categories lists active categories ordered by `order`', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/categories' });
    expect(res.statusCode).toBe(200);

    const categories = TourCategorySchema.array().parse(res.json());
    const slugs = categories.map((c) => c.slug);
    expect(slugs).toContain('day');
    expect(slugs).toContain('cruise');
    expect(slugs).not.toContain('seasonal-classics'); // isActive: false
    expect(categories.map((c) => c.order)).toEqual(
      [...categories.map((c) => c.order)].sort((a, b) => a - b),
    );
  });
});
