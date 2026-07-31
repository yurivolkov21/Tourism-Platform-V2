import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AdminRefundResultSchema, BookingSchema, PagedSchema } from '@tourism/contract';
import * as catalog from '../../../prisma/fixtures/catalog/index.js';
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
 * Integration (Docker PG, db tourism_test) — money-path W3: suite cho Refund
 * ledger (spec P2 §4 invariant 5–6). Admin session đến từ bootstrap signup
 * ADMIN_EMAILS (vitest.int.config.ts); booking chuyển PAID qua route webhook
 * THẬT nên mọi refund đều xuất phát từ một money-path state chân thực.
 *
 * Invariant #6 (currency mismatch) được đảm bảo BẰNG THIẾT KẾ, không phải qua
 * input error: input refund không mang currency (currency của booking được ngầm
 * hiểu), và service chỉ issue + ghi ledger theo `booking.currency` — nên không
 * có case CURRENCY_MISMATCH trên input-path để test (xem refund-math.ts).
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
      rawBody: true, // route webhook verify signature dựa trên raw bytes
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

  /** Admin session: signup ADMIN_EMAILS rồi promote thẳng DB (ADR-0008 — signup
   * không còn auto-promote, admin phải verify; test set role+emailVerified trực
   * tiếp). Guard đọc role tươi từ DB nên cookie signup dùng được ngay. */
  const signUpAdmin = async () => {
    const cookie = await signUpUser(ADMIN_EMAIL, 'Boss');
    await prisma.user.update({
      where: { email: ADMIN_EMAIL },
      data: { role: 'ADMIN', emailVerified: true },
    });
    return cookie;
  };

  /** Tạo một booking PENDING qua API thật (party 3 → 117.00 USD). */
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

  /** Chuyển một booking sang PAID qua route webhook THẬT (ghi lại capture id). */
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

  /** Booking của khách đi hết đến PAID; trả về shape của contract. */
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
    const paidEvent = fake.sessionFor(booking.id); // session được ghi lúc create
    expect(paidEvent).toBeDefined();

    const res = await postRefund(admin, booking.code, { amount: '30.00', reason: 'goodwill' });
    expect(res.statusCode).toBe(200);
    const body = AdminRefundResultSchema.parse(res.json());
    expect(body.booking.status).toBe('PARTIALLY_REFUNDED');
    expect(body.refunds).toHaveLength(1);
    expect(Number(body.refunds[0]?.amount)).toBe(30);
    expect(body.refunds[0]?.currency).toBe('USD');
    expect(body.refunds[0]?.providerRefundId).toMatch(/^fake_re_/);

    // DB: projection status + ledger row append-only có set adminId.
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(row.status).toBe(BookingStatus.PARTIALLY_REFUNDED);
    const admins = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
    const refunds = await prisma.refund.findMany({ where: { bookingId: booking.id } });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]?.amount.toFixed(2)).toBe('30.00');
    expect(refunds[0]?.adminId).toBe(admins.id);

    // Gateway refund TRƯỚC, theo currency của booking (invariant #6), kèm
    // idempotency key của provider W5 (attempt state = tổng ledger TRƯỚC lần
    // refund này: chưa refund gì → 0.00).
    expect(fake.refunds).toHaveLength(1);
    expect(fake.refunds[0]).toMatchObject({
      amount: '30.00',
      currency: 'USD',
      idempotencyKey: `refund:${booking.id}:0.00`,
    });

    // Outbox row key theo từng refund row (refund lặp lại hợp lệ trên mỗi booking).
    const outbox = await prisma.outbox.findMany({ where: { type: EmailType.BOOKING_REFUNDED } });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.dedupeKey).toBe(`refund:${booking.id}:${refunds[0]?.id}`);
    expect(outbox[0]?.payload).toMatchObject({
      code: booking.code,
      amount: '30.00',
      currency: 'USD',
      reason: 'goodwill', // reason CHỈ nằm ở đây — model Refund không có cột reason
    });
  });

  it('provider refund FAIL → 502 REFUND_FAILED, KHÔNG ledger/outbox, booking giữ PAID (W3: không bao giờ ghi refund chưa xảy ra)', async () => {
    const admin = await signUpAdmin();
    const booking = await createPaidBooking(await signUpUser('alice@example.com', 'Alice'));

    fake.failRefunds = true; // provider từ chối refund đúng lúc gọi gateway

    const res = await postRefund(admin, booking.code, { amount: '30.00', reason: 'goodwill' });
    // Gateway refund chạy TRƯỚC ledger + ném ProviderRefundFailedError → 502 typed.
    expect(res.statusCode).toBe(502);

    // Bất biến W3: provider fail thì KHÔNG có gì được ghi — ledger, outbox, và
    // status booking đều nguyên vẹn; admin chỉ việc retry.
    expect(fake.refunds).toHaveLength(0);
    const refunds = await prisma.refund.findMany({ where: { bookingId: booking.id } });
    expect(refunds).toHaveLength(0);
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(row.status).toBe(BookingStatus.PAID);
    const outbox = await prisma.outbox.findMany({ where: { type: EmailType.BOOKING_REFUNDED } });
    expect(outbox).toHaveLength(0);
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
    // W5 provider idempotency: mỗi ATTEMPT sinh một key riêng — lần refund thứ
    // hai thấy ledger đã tích lũy (30.00), nên crash-retry của bất kỳ attempt
    // nào cũng dedupe ở provider mà không chặn lần refund kế tiếp.
    expect(fake.refunds.map((r) => r.idempotencyKey)).toEqual([
      `refund:${booking.id}:0.00`,
      `refund:${booking.id}:30.00`,
    ]);
    // Hai refund email với key theo từng row KHÁC NHAU (quy ước repeat-event).
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
    expect(fake.refunds).toHaveLength(2); // gateway KHÔNG bị gọi lại
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

    expect(fake.refunds).toHaveLength(1); // chỉ có 30.00 hợp lệ
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

    const res = await postRefund(admin, booking.code, {}); // không amount: phần còn lại 87.00
    expect(res.statusCode).toBe(200);
    const body = AdminRefundResultSchema.parse(res.json());
    expect(body.booking.status).toBe('REFUNDED');
    expect(fake.refunds.map((r) => r.amount)).toEqual(['30.00', '87.00']);
  });

  it('non-PAID booking (PENDING) → 422 NOT_REFUNDABLE; unknown code → 404', async () => {
    const admin = await signUpAdmin();
    const booking = await createBooking(await signUpUser('gina@example.com')); // vẫn PENDING

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

    // 403 không đổi gì cả.
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
    expect(page.total).toBe(2); // qua CẢ HAI user — không giới hạn theo owner
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
    expect(history.map((r) => Number(r.amount))).toEqual([30, 87]); // cũ nhất trước
    expect(history.every((r) => r.adminId !== null)).toBe(true);

    await expect(refunds.historyForBooking('BK-ZZZZ9999')).rejects.toThrow(BookingNotFoundError);
  });

  it('trigger: insert refund làm SUM(refunds) > total → bị chặn (BK-R1 defense-in-depth)', async () => {
    const booking = await createPaidBooking(await signUpUser('sum-trigger@example.com', 'S')); // total 117.00
    await prisma.refund.create({
      data: {
        bookingId: booking.id,
        amount: '100.00',
        currency: 'USD',
        providerRefundId: 'trig-r1',
      },
    });
    // 100 + 50 = 150 > 117 → trigger phải raise.
    await expect(
      prisma.refund.create({
        data: {
          bookingId: booking.id,
          amount: '50.00',
          currency: 'USD',
          providerRefundId: 'trig-r2',
        },
      }),
    ).rejects.toThrow();
    expect(await prisma.refund.count({ where: { bookingId: booking.id } })).toBe(1);
  });

  it('BK-R1: hai admin refund full ĐỒNG THỜI → đúng 1 refund + 1 lần gọi gateway (advisory lock)', async () => {
    const admin = await signUpAdmin();
    const booking = await createPaidBooking(await signUpUser('bk-r1@example.com', 'A')); // 117.00

    fake.refundDelayMs = 100; // ép cả hai request cùng đọc ledger=0 trước khi ghi
    const [a, b] = await Promise.allSettled([
      postRefund(admin, booking.code, {}), // full
      postRefund(admin, booking.code, {}), // full — đồng thời
    ]);
    const codes = [a, b]
      .map((r) => (r.status === 'fulfilled' ? r.value.statusCode : 0))
      .sort((x, y) => x - y);
    expect(codes).toEqual([200, 422]); // một thành công, một RefundNothingLeft

    // Bất biến money: gateway gọi ĐÚNG một lần, ledger đúng một row, không vượt total.
    expect(fake.refunds).toHaveLength(1);
    const refunds = await prisma.refund.findMany({ where: { bookingId: booking.id } });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]?.amount.toFixed(2)).toBe('117.00');
  });
});
