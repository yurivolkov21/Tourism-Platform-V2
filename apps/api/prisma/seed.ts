/**
 * Database seed — v2 port of Nexora's seed, adapted to schema v2.
 *
 * What it seeds (catalog essentials + functional overlay):
 *   1. Catalog fixtures (`./fixtures/catalog.ts`, ported from Nexora): tour
 *      categories, destinations, tours (+ M:N destinations, itinerary, FAQs,
 *      policies, departures). `createMany({ skipDuplicates })` → re-runnable.
 *   2. Site media slots — the 9 brand-chrome slot keys (Nexora seeded these by
 *      migration; here the seed upserts them).
 *   3. A login-able CUSTOMER (`customer@tourism.test`) + an ADMIN (first entry
 *      of `ADMIN_EMAILS`, default `admin@tourism.test`) — plain User rows;
 *      Better Auth reads the same table, register with the same email to link.
 *   4. One self-signed PAID booking (`BK-SEEDPAID`) owned by that customer,
 *      with the v2 snapshot columns (tourTitle/departure dates/unitPrice), so
 *      reviews / "my bookings" flows are exercisable without a live payment.
 *
 * NOT ported from Nexora (user-dependent fixtures that assumed Supabase
 * identities): sample users, bookings, payment events, reviews, wishlist,
 * enquiries, posts, outbox, media assets/garbage.
 *
 * Run: pnpm --filter @tourism/api db:seed  (compiled via swc, see package.json)
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { type Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import {
  BookingStatus,
  DepartureStatus,
  PaymentProvider,
  UserRole,
} from '../src/generated/prisma/enums.js';
import * as catalog from './fixtures/catalog.js';

/** Self-signed PAID booking code (owned by the overlay customer). */
const PAID_BOOKING_CODE = 'BK-SEEDPAID';
/** Attach the PAID booking to this tour when it qualifies; else the soonest qualifying departure. */
const PREFERRED_PAID_TOUR_SLUG = 'hoi-an-walking-tour';
const PAID_SEATS = 2;

/** Brand-chrome slot keys — mirror of the API slot catalog (site-media). */
const SITE_SLOT_KEYS = [
  'home-hero',
  'home-experiences',
  'home-why-choose',
  'home-trust',
  'cta-band',
  'content-hero',
  'destinations-hero',
  'auth-panel',
  'about-story',
] as const;

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://tourism:tourism@localhost:5432/tourism';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/**
 * Coerce a bare `YYYY-MM-DD` fixture value to a `Date` — Prisma 7 `createMany`
 * rejects date-only strings for `@db.Date` columns. `new Date('2026-07-31')`
 * parses as UTC midnight, so the stored calendar date is unchanged.
 */
const toDate = (value: string): Date => new Date(value);

async function insertCatalog(): Promise<number> {
  const steps: Array<[string, () => Promise<{ count: number }>]> = [
    [
      'tourCategories',
      () =>
        prisma.tourCategory.createMany({
          data: catalog.tourCategories,
          skipDuplicates: true,
        }),
    ],
    [
      'destinations',
      () =>
        prisma.destination.createMany({
          data: catalog.destinations,
          skipDuplicates: true,
        }),
    ],
    [
      'tours',
      () =>
        prisma.tour.createMany({
          // Fixture arrays are plain JSON strings; the generated catalog module
          // already uses valid enum values (difficulty/suitableFor/badges).
          data: catalog.tours as unknown as Prisma.TourCreateManyInput[],
          skipDuplicates: true,
        }),
    ],
    [
      'tourDestinations',
      () =>
        prisma.tourDestination.createMany({
          data: catalog.tourDestinations,
          skipDuplicates: true,
        }),
    ],
    [
      'tourItineraryDays',
      () =>
        prisma.tourItineraryDay.createMany({
          data: catalog.tourItineraryDays,
          skipDuplicates: true,
        }),
    ],
    ['tourFaqs', () => prisma.tourFaq.createMany({ data: catalog.tourFaqs, skipDuplicates: true })],
    [
      'tourPolicies',
      () =>
        prisma.tourPolicy.createMany({
          data: catalog.tourPolicies as unknown as Prisma.TourPolicyCreateManyInput[],
          skipDuplicates: true,
        }),
    ],
    [
      'tourDepartures',
      () =>
        prisma.tourDeparture.createMany({
          // @db.Date columns → coerce the date-only strings (see toDate).
          data: catalog.tourDepartures.map((d) => ({
            ...d,
            startDate: toDate(d.startDate),
            endDate: toDate(d.endDate),
          })) as unknown as Prisma.TourDepartureCreateManyInput[],
          skipDuplicates: true,
        }),
    ],
  ];

  let total = 0;
  for (const [label, run] of steps) {
    const { count } = await run();
    total += count;
    console.log(`  ${label.padEnd(20)} +${count}`);
  }
  return total;
}

/**
 * Picks an OPEN departure (on a published tour) with at least `seats` free.
 * Prefers {@link PREFERRED_PAID_TOUR_SLUG} when it qualifies, else the soonest
 * qualifying departure. Prisma can't compare two columns in a `where`, so free
 * seats are filtered in JS.
 */
async function pickPaidDeparture(seats: number) {
  const candidates = await prisma.tourDeparture.findMany({
    where: { status: DepartureStatus.OPEN, tour: { isPublished: true } },
    orderBy: { startDate: 'asc' },
    select: {
      id: true,
      tourId: true,
      startDate: true,
      endDate: true,
      seatsTotal: true,
      seatsBooked: true,
      priceOverride: true,
      tour: { select: { slug: true, title: true, basePrice: true, currency: true } },
    },
  });
  const free = candidates.filter((d) => d.seatsTotal - d.seatsBooked >= seats);
  return free.find((d) => d.tour.slug === PREFERRED_PAID_TOUR_SLUG) ?? free[0] ?? null;
}

async function main(): Promise<void> {
  // 1. Catalog fixtures.
  console.log('[seed] loading catalog fixtures...');
  const inserted = await insertCatalog();
  console.log(`[seed] catalog: ${inserted} rows inserted (duplicates skipped).`);

  // 2. Site media slots — stable uuid per key so assets can attach later.
  for (const key of SITE_SLOT_KEYS) {
    await prisma.siteMediaSlot.upsert({ where: { key }, create: { key }, update: {} });
  }
  console.log(`[seed] site media slots: ${SITE_SLOT_KEYS.length} keys upserted.`);

  // 3. Functional overlay — a known CUSTOMER + an ADMIN (upsert by citext-unique
  //    email). Plain rows in the Better Auth `users` table: registering through
  //    Better Auth with the same email links to the row (no supabaseId in v2).
  const adminEmail = process.env.ADMIN_EMAILS?.split(',')[0]?.trim() || 'admin@tourism.test';
  const customer = await prisma.user.upsert({
    where: { email: 'customer@tourism.test' },
    create: {
      email: 'customer@tourism.test',
      name: 'Seed Customer',
      emailVerified: true,
      phone: '+84900000001',
      role: UserRole.CUSTOMER,
    },
    update: { name: 'Seed Customer', role: UserRole.CUSTOMER },
  });
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: 'Seed Admin',
      emailVerified: true,
      role: UserRole.ADMIN,
    },
    update: { role: UserRole.ADMIN },
  });
  console.log(`[seed] overlay users: customer=${customer.email} admin=${admin.email}`);

  // 4. Self-signed PAID booking with the v2 create-time snapshots (audit H3):
  //    tourTitle + departure dates + unitPrice are frozen on the row. Created
  //    once; seats claimed atomically so it can't overbook.
  const existing = await prisma.booking.findUnique({
    where: { code: PAID_BOOKING_CODE },
    select: { id: true, tourTitle: true },
  });
  if (existing) {
    console.log(`[seed] PAID booking ${PAID_BOOKING_CODE} already exists — skipped`);
  } else {
    const departure = await pickPaidDeparture(PAID_SEATS);
    if (!departure) {
      throw new Error('[seed] no OPEN fixture departure with free seats for the PAID booking');
    }
    const unitPrice = departure.priceOverride ?? departure.tour.basePrice; // Prisma.Decimal
    await prisma.$transaction(async (tx) => {
      await tx.booking.create({
        data: {
          code: PAID_BOOKING_CODE,
          userId: customer.id,
          tourId: departure.tourId,
          departureId: departure.id,
          numAdults: PAID_SEATS,
          numChildren: 0,
          totalAmount: unitPrice.mul(PAID_SEATS),
          currency: departure.tour.currency,
          status: BookingStatus.PAID,
          // v2 snapshots (audit H3)
          tourTitle: departure.tour.title,
          departureStartDate: departure.startDate,
          departureEndDate: departure.endDate,
          unitPrice,
          contactName: 'Seed Customer',
          contactEmail: customer.email,
          contactPhone: '+84900000001',
          paymentProvider: PaymentProvider.STRIPE,
          providerSessionId: 'cs_seed_paid_1',
          providerPaymentId: 'pi_seed_paid_1',
          paidAt: new Date(),
        },
      });
      await tx.tourDeparture.update({
        where: { id: departure.id },
        data: { seatsBooked: { increment: PAID_SEATS } },
      });
    });
    console.log(
      `[seed] created PAID booking ${PAID_BOOKING_CODE} on ${departure.tour.slug} (${PAID_SEATS} seats)`,
    );
  }

  console.log('[seed] done.');
}

main()
  .catch((err: unknown) => {
    console.error('[seed] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
