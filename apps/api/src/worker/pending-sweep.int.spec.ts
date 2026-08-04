import { Test } from '@nestjs/testing';
import { prisma } from '../auth/auth.config.js';
import type { Prisma } from '../generated/prisma/client.js';
import { BookingStatus } from '../generated/prisma/enums.js';
import { PENDING_TTL_MINUTES, PendingSweepService } from './pending-sweep.service.js';
import { WorkerModule } from './worker.module.js';

/**
 * Integration (Docker PG, db tourism_test) — WRK-1 (ADR-0006): cron sweep hủy
 * booking PENDING bỏ hoang quá TTL. Gate `status='PENDING'` + `created_at < now-TTL`
 * → chỉ chạm PENDING quá hạn, không đụng PENDING mới hay PAID.
 */

describe('pending-sweep worker integration (WRK-1)', () => {
  let sweep: PendingSweepService;
  let userId: string;
  let tourId: string;
  let departureId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
    sweep = moduleRef.get(PendingSweepService);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE bookings, tour_departures, tours, tour_categories, users RESTART IDENTITY CASCADE',
    );
    const user = await prisma.user.create({ data: { email: 'sweep@example.com', name: 'Sweep' } });
    userId = user.id;
    const category = await prisma.tourCategory.create({
      data: { slug: 'sweep-cat', name: 'Sweep', order: 1 },
    });
    const tour = await prisma.tour.create({
      data: {
        slug: 'sweep-tour',
        title: 'Sweep Tour',
        categoryId: category.id,
        durationDays: 1,
        basePrice: '39.00',
        currency: 'USD',
        isPublished: true,
      },
    });
    tourId = tour.id;
    const dep = new Date(Date.now() + 45 * 86_400_000);
    const departure = await prisma.tourDeparture.create({
      data: { tourId: tour.id, startDate: dep, endDate: dep, seatsTotal: 10, seatsBooked: 0 },
    });
    departureId = departure.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** Booking với `created_at` + `status` điều khiển được (test độc lập giờ thực). */
  async function seedBooking(opts: {
    code: string;
    minutesAgo: number;
    status: BookingStatus;
  }): Promise<string> {
    const dep = new Date(Date.now() + 45 * 86_400_000);
    const row = await prisma.booking.create({
      data: {
        code: opts.code,
        userId,
        tourId,
        departureId,
        numAdults: 1,
        totalAmount: '39.00',
        currency: 'USD',
        status: opts.status,
        tourTitle: 'Sweep Tour',
        departureStartDate: dep,
        departureEndDate: dep,
        unitPrice: '39.00',
        contactName: 'Test',
        contactEmail: 'test@example.com',
        paymentProvider: 'STRIPE',
        createdAt: new Date(Date.now() - opts.minutesAgo * 60_000),
      } satisfies Prisma.BookingUncheckedCreateInput,
    });
    return row.id;
  }

  const statusOf = async (id: string) =>
    (await prisma.booking.findUniqueOrThrow({ where: { id } })).status;

  it('hủy PENDING cũ hơn TTL, giữ PENDING mới + không đụng PAID', async () => {
    // Neo theo hằng thật (65′, xem pending-sweep.service.ts) thay vì số cứng
    // — test tự theo hằng khi hằng đổi, tránh drift như I1 (30′ trong khi
    // Stripe đã lên 60′).
    const old = await seedBooking({
      code: 'BK-SWEEPOLD',
      minutesAgo: PENDING_TTL_MINUTES + 5,
      status: BookingStatus.PENDING,
    });
    const fresh = await seedBooking({
      code: 'BK-SWEEPNEW',
      minutesAgo: 5,
      status: BookingStatus.PENDING,
    });
    const paid = await seedBooking({
      code: 'BK-SWEEPPAY',
      minutesAgo: PENDING_TTL_MINUTES + 5,
      status: BookingStatus.PAID,
    });

    const n = await sweep.sweepAbandoned(PENDING_TTL_MINUTES);
    expect(n).toBe(1);
    expect(await statusOf(old)).toBe(BookingStatus.CANCELLED);
    expect(await statusOf(fresh)).toBe(BookingStatus.PENDING);
    expect(await statusOf(paid)).toBe(BookingStatus.PAID);

    // Idempotent: chạy lại không còn gì để hủy.
    expect(await sweep.sweepAbandoned(PENDING_TTL_MINUTES)).toBe(0);
  });
});
