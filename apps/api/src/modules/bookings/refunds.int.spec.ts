import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AdminRefundResultSchema, BookingSchema, PagedSchema } from '@tourism/contract';
import * as catalog from '../../../prisma/fixtures/catalog.js';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus, DepartureStatus, EmailType } from '../../generated/prisma/enums.js';
import {
  FAKE_SIGNATURE_HEADER,
  FAKE_VALID_SIGNATURE,
  FakeGateway,
} from '../payments/fake.gateway.js';
import { BookingNotFoundError, RefundsService } from './refunds.service.js';

/**
 * Integration (Docker PG, db tourism_test) — money-path W3: the Refund ledger
 * suite (spec P2 §4 invariants 5–6). Admin session comes from the bootstrap
 * ADMIN_EMAILS signup (vitest.int.config.ts); bookings become PAID through the
 * REAL webhook route so every refund starts from a genuine money-path state.
 *
 * Invariant #6 (currency mismatch) is enforced BY CONSTRUCTION, not by an
 * input error: the refund input carries no currency (the booking's currency is
 * implied), and the service issues + ledgers in `booking.currency` only — so
 * there is no input-path CURRENCY_MISMATCH case to test (see refund-math.ts).
 */

const PUBLISHED_SLUG = 'hoi-an-walking-tour'; // basePrice 39.00 USD
const PASSWORD = 'password-123';
const ADMIN_EMAIL = 'bootstrap-admin@tourism.test'; // ADMIN_EMAILS (int config)

const tour = catalog.tours.find((t) => t.slug === PUBLISHED_SLUG);
if (!tour) throw new Error(`fixture tour missing: ${PUBLISHED_SLUG}`);

/** Lấy cookie pair (name=value) từ set-cookie của inject response. */
function sessionCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'];
  const cookies = (Array.isArray(raw) ? raw : [raw]).filter(
    (c): c is string => typeof c === 'string',
  );
  const session = cookies.find((c) => c.includes('session_token'));
  if (!session) throw new Error(`No session cookie in: ${JSON.stringify(raw)}`);
  const pair = session.split(';')[0];
  if (!pair) throw new Error('Malformed set-cookie');
  return pair;
}

describe('refunds integration (admin refund ledger)', () => {
  let app: NestFastifyApplication;
  let fake: FakeGateway;

  const future45 = new Date(Date.now() + 45 * 86_400_000);
  const dep = {
    id: 'e9300001-0000-4000-8000-000000000001',
    tourId: tour.id,
    startDate: future45,
    endDate: new Date(future45.getTime() + 86_400_000),
    seatsTotal: 100,
    seatsBooked: 0,
    status: DepartureStatus.OPEN,
  } satisfies Prisma.TourDepartureCreateManyInput;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE tour_categories, destinations, users, payment_events, outbox CASCADE',
    );
    await prisma.tourCategory.createMany({ data: catalog.tourCategories });
    await prisma.destination.createMany({ data: catalog.destinations });
    await prisma.tour.createMany({ data: [tour] as unknown as Prisma.TourCreateManyInput[] });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      rawBody: true, // webhook route verifies signatures against raw bytes
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    fake = app.get(FakeGateway);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, sessions, accounts, verifications, bookings, refunds, payment_events, outbox CASCADE',
    );
    await prisma.tourDeparture.deleteMany();
    await prisma.tourDeparture.createMany({ data: [dep] });
    fake.reset();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function signUpUser(email: string, name = 'Test User'): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email, password: PASSWORD, name },
    });
    expect(res.statusCode).toBe(200);
    return sessionCookie(res);
  }

  /** Admin session via the ADMIN_EMAILS bootstrap grant (create.after hook). */
  const signUpAdmin = () => signUpUser(ADMIN_EMAIL, 'Boss');

  /** Create a PENDING booking through the real API (party 3 → 117.00 USD). */
  async function createBooking(cookie: string, payload: Record<string, unknown> = {}) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/bookings',
      headers: { cookie },
      payload: {
        departureId: dep.id,
        numAdults: 2,
        numChildren: 1,
        contactName: 'Alice Nguyen',
        contactEmail: 'alice@example.com',
        paymentProvider: 'STRIPE',
        ...payload,
      },
    });
    expect(res.statusCode).toBe(200);
    return BookingSchema.parse(res.json());
  }

  /** Flip a booking PAID via the REAL webhook route (records the capture id). */
  async function payBooking(bookingId: string) {
    const event = fake.emitPaymentCompleted(bookingId);
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/stripe',
      headers: {
        'content-type': 'application/json',
        [FAKE_SIGNATURE_HEADER]: FAKE_VALID_SIGNATURE,
      },
      payload: JSON.stringify(event),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ outcome: 'claimed' });
    return event;
  }

  /** Customer booking taken all the way to PAID; returns the contract shape. */
  async function createPaidBooking(cookie: string) {
    const booking = await createBooking(cookie);
    await payBooking(booking.id);
    return booking;
  }

  function postRefund(cookie: string, code: string, payload: Record<string, unknown> = {}) {
    return app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${code}/refund`,
      headers: { cookie },
      payload,
    });
  }

  it('partial 30.00 on a 117.00 PAID booking → PARTIALLY_REFUNDED + ledger row + gateway call + per-row outbox key', async () => {
    const admin = await signUpAdmin();
    const booking = await createPaidBooking(await signUpUser('alice@example.com', 'Alice'));
    const paidEvent = fake.sessionFor(booking.id); // session recorded at create
    expect(paidEvent).toBeDefined();

    const res = await postRefund(admin, booking.code, { amount: '30.00', reason: 'goodwill' });
    expect(res.statusCode).toBe(200);
    const body = AdminRefundResultSchema.parse(res.json());
    expect(body.booking.status).toBe('PARTIALLY_REFUNDED');
    expect(body.refunds).toHaveLength(1);
    expect(Number(body.refunds[0]?.amount)).toBe(30);
    expect(body.refunds[0]?.currency).toBe('USD');
    expect(body.refunds[0]?.providerRefundId).toMatch(/^fake_re_/);

    // DB: status projection + append-only ledger row with adminId set.
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(row.status).toBe(BookingStatus.PARTIALLY_REFUNDED);
    const admins = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
    const refunds = await prisma.refund.findMany({ where: { bookingId: booking.id } });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]?.amount.toFixed(2)).toBe('30.00');
    expect(refunds[0]?.adminId).toBe(admins.id);

    // Gateway refunded FIRST, in the booking's currency (invariant #6).
    expect(fake.refunds).toHaveLength(1);
    expect(fake.refunds[0]).toMatchObject({ amount: '30.00', currency: 'USD' });

    // Outbox row keyed per refund row (refunds legitimately repeat per booking).
    const outbox = await prisma.outbox.findMany({ where: { type: EmailType.BOOKING_REFUNDED } });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.dedupeKey).toBe(`refund:${booking.id}:${refunds[0]?.id}`);
    expect(outbox[0]?.payload).toMatchObject({
      code: booking.code,
      amount: '30.00',
      currency: 'USD',
      reason: 'goodwill', // reason lives ONLY here — the Refund model has no reason column
    });
  });

  it('second partial 87.00 accumulates to the total → REFUNDED, 2 ledger rows (invariant #5)', async () => {
    const admin = await signUpAdmin();
    const booking = await createPaidBooking(await signUpUser('bob@example.com'));

    expect((await postRefund(admin, booking.code, { amount: '30.00' })).statusCode).toBe(200);
    const res = await postRefund(admin, booking.code, { amount: '87.00' });
    expect(res.statusCode).toBe(200);
    const body = AdminRefundResultSchema.parse(res.json());
    expect(body.booking.status).toBe('REFUNDED');
    expect(body.refunds).toHaveLength(2);

    const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(row.status).toBe(BookingStatus.REFUNDED);
    expect(fake.refunds.map((r) => r.amount)).toEqual(['30.00', '87.00']);
    // Two refund emails with DISTINCT per-row keys (repeat-event convention).
    const keys = (
      await prisma.outbox.findMany({ where: { type: EmailType.BOOKING_REFUNDED } })
    ).map((o) => o.dedupeKey);
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
  });

  it('third attempt on a settled ledger → 422 NOTHING_LEFT, nothing changes', async () => {
    const admin = await signUpAdmin();
    const booking = await createPaidBooking(await signUpUser('carol@example.com'));
    await postRefund(admin, booking.code, { amount: '30.00' });
    await postRefund(admin, booking.code, { amount: '87.00' });

    const res = await postRefund(admin, booking.code, { amount: '1.00' });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ code: 'NOTHING_LEFT' });
    expect(fake.refunds).toHaveLength(2); // gateway NOT called again
    expect(await prisma.refund.count({ where: { bookingId: booking.id } })).toBe(2);
  });

  it('over-total partial → 422 OVER_TOTAL (fresh AND accumulated), no gateway call, no ledger row', async () => {
    const admin = await signUpAdmin();
    const booking = await createPaidBooking(await signUpUser('dave@example.com'));

    const fresh = await postRefund(admin, booking.code, { amount: '117.01' });
    expect(fresh.statusCode).toBe(422);
    expect(fresh.json()).toMatchObject({ code: 'OVER_TOTAL' });

    expect((await postRefund(admin, booking.code, { amount: '30.00' })).statusCode).toBe(200);
    const accumulated = await postRefund(admin, booking.code, { amount: '87.01' });
    expect(accumulated.statusCode).toBe(422);
    expect(accumulated.json()).toMatchObject({ code: 'OVER_TOTAL' });

    expect(fake.refunds).toHaveLength(1); // only the valid 30.00
    expect(await prisma.refund.count({ where: { bookingId: booking.id } })).toBe(1);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
      BookingStatus.PARTIALLY_REFUNDED,
    );
  });

  it('zero amount "0.00" → 422 ZERO_OR_NEGATIVE (contract regex admits it)', async () => {
    const admin = await signUpAdmin();
    const booking = await createPaidBooking(await signUpUser('erin@example.com'));

    const res = await postRefund(admin, booking.code, { amount: '0.00' });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ code: 'ZERO_OR_NEGATIVE' });
    expect(fake.refunds).toHaveLength(0);
  });

  it('amount omitted → full remainder → REFUNDED (also after a prior partial)', async () => {
    const admin = await signUpAdmin();
    const booking = await createPaidBooking(await signUpUser('frank@example.com'));
    expect((await postRefund(admin, booking.code, { amount: '30.00' })).statusCode).toBe(200);

    const res = await postRefund(admin, booking.code, {}); // no amount: remainder 87.00
    expect(res.statusCode).toBe(200);
    const body = AdminRefundResultSchema.parse(res.json());
    expect(body.booking.status).toBe('REFUNDED');
    expect(fake.refunds.map((r) => r.amount)).toEqual(['30.00', '87.00']);
  });

  it('non-PAID booking (PENDING) → 422 NOT_REFUNDABLE; unknown code → 404', async () => {
    const admin = await signUpAdmin();
    const booking = await createBooking(await signUpUser('gina@example.com')); // stays PENDING

    const res = await postRefund(admin, booking.code, { amount: '10.00' });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ code: 'NOT_REFUNDABLE' });
    expect(fake.refunds).toHaveLength(0);

    const missing = await postRefund(admin, 'BK-ZZZZ9999', { amount: '10.00' });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('non-admin session → 403 on every admin procedure; anonymous → 401', async () => {
    const customer = await signUpUser('mallory@example.com');
    const booking = await createPaidBooking(customer);

    expect((await postRefund(customer, booking.code, { amount: '1.00' })).statusCode).toBe(403);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/admin/bookings',
          headers: { cookie: customer },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/admin/bookings/${booking.code}`,
          headers: { cookie: customer },
        })
      ).statusCode,
    ).toBe(403);
    expect((await postRefund('', booking.code, { amount: '1.00' })).statusCode).toBe(401);

    // 403s changed nothing.
    expect(fake.refunds).toHaveLength(0);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
      BookingStatus.PAID,
    );
  });

  it('admin.bookings.list: sees ALL users, filters by status, searches by code (case-insensitive)', async () => {
    const admin = await signUpAdmin();
    const paid = await createPaidBooking(await signUpUser('lister-a@example.com'));
    const pending = await createBooking(await signUpUser('lister-b@example.com'));

    const all = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings',
      headers: { cookie: admin },
    });
    expect(all.statusCode).toBe(200);
    const page = PagedSchema(BookingSchema).parse(all.json());
    expect(page.total).toBe(2); // across BOTH users — not owner-scoped
    expect(page.items.map((b) => b.code).sort()).toEqual([paid.code, pending.code].sort());

    const filtered = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings?status=PAID',
      headers: { cookie: admin },
    });
    expect(
      PagedSchema(BookingSchema)
        .parse(filtered.json())
        .items.map((b) => b.code),
    ).toEqual([paid.code]);

    const searched = await app.inject({
      method: 'GET',
      url: `/api/admin/bookings?search=${pending.code.toLowerCase()}`,
      headers: { cookie: admin },
    });
    expect(
      PagedSchema(BookingSchema)
        .parse(searched.json())
        .items.map((b) => b.code),
    ).toEqual([pending.code]);
  });

  it("admin.bookings.byCode: reads ANY user's booking; unknown code → 404", async () => {
    const admin = await signUpAdmin();
    const booking = await createPaidBooking(await signUpUser('someone@example.com'));

    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/bookings/${booking.code}`,
      headers: { cookie: admin },
    });
    expect(res.statusCode).toBe(200);
    expect(BookingSchema.parse(res.json())).toMatchObject({ code: booking.code, status: 'PAID' });

    const missing = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings/BK-ZZZZ9999',
      headers: { cookie: admin },
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('historyForBooking (direct service call — admin view lands later): append order, typed not-found', async () => {
    const admin = await signUpAdmin();
    const booking = await createPaidBooking(await signUpUser('history@example.com'));
    await postRefund(admin, booking.code, { amount: '30.00' });
    await postRefund(admin, booking.code, { amount: '87.00' });

    const refunds = app.get(RefundsService);
    const history = await refunds.historyForBooking(booking.code);
    expect(history).toHaveLength(2);
    expect(history.map((r) => Number(r.amount))).toEqual([30, 87]); // oldest first
    expect(history.every((r) => r.adminId !== null)).toBe(true);

    await expect(refunds.historyForBooking('BK-ZZZZ9999')).rejects.toThrow(BookingNotFoundError);
  });
});
