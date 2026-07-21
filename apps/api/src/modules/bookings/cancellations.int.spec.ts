import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  AdminBookingDetailSchema,
  AdminCancellationRequestSchema,
  CancellationRequestSchema,
  DecideCancellationResultSchema,
  PagedSchema,
} from '@tourism/contract';
import * as catalog from '../../../prisma/fixtures/catalog.js';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  BookingStatus,
  CancellationRequestStatus,
  DepartureStatus,
  EmailType,
} from '../../generated/prisma/enums.js';
import {
  FAKE_SIGNATURE_HEADER,
  FAKE_VALID_SIGNATURE,
  FakeGateway,
} from '../payments/fake.gateway.js';
import { CancellationsService } from './cancellations.service.js';

/**
 * Integration (Docker PG, db tourism_test) — money-path W4: luồng cancellation
 * dưới D1-B (spec P2 §2): request là các history row APPEND-ONLY, "một request
 * sống mỗi booking" chính là PARTIAL unique index
 * `cancellation_requests_one_live_per_booking`, và một lần approve điều phối
 * gateway refund → [Refund row + booking CANCELLED + release seat + request
 * REFUNDED + outbox] một cách nguyên tử. Ngữ nghĩa terminal-state được test ở
 * đây là những gì ghi trong docs/conventions/booking-states.md.
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

describe('cancellations integration (W4, D1-B append-only)', () => {
  let app: NestFastifyApplication;
  let fake: FakeGateway;

  const future45 = new Date(Date.now() + 45 * 86_400_000);
  const dep = {
    id: 'e9400001-0000-4000-8000-000000000001',
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
    await prisma.tour.createMany({
      data: [tour] as unknown as Prisma.TourCreateManyInput[],
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      rawBody: true, // route webhook verify signature dựa trên raw bytes
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    fake = app.get(FakeGateway);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, sessions, accounts, verifications, bookings, refunds, cancellation_requests, payment_events, outbox CASCADE',
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
  async function createBooking(cookie: string) {
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
      },
    });
    expect(res.statusCode).toBe(200);
    return res.json() as { id: string; code: string };
  }

  /** Chuyển một booking sang PAID qua route webhook THẬT (claim 3 seat). */
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
  }

  async function createPaidBooking(cookie: string) {
    const booking = await createBooking(cookie);
    await payBooking(booking.id);
    return booking;
  }

  function postCancel(cookie: string, code: string, reason = 'Change of plans') {
    return app.inject({
      method: 'POST',
      url: `/api/bookings/${code}/cancel`,
      headers: { cookie },
      payload: { reason },
    });
  }

  function postDecide(cookie: string, id: string, payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: `/api/admin/cancellations/${id}/decide`,
      headers: { cookie },
      payload,
    });
  }

  /** Admin refund trực tiếp (W3) — dùng cho test cross-path BK-R1. */
  function postRefund(cookie: string, code: string, payload: Record<string, unknown> = {}) {
    return app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${code}/refund`,
      headers: { cookie },
      payload,
    });
  }

  async function seatsBooked(): Promise<number> {
    const row = await prisma.tourDeparture.findUniqueOrThrow({
      where: { id: dep.id },
      select: { seatsBooked: true },
    });
    return row.seatsBooked;
  }

  it('request on own PAID booking → 200 REQUESTED + outbox row keyed by requestId', async () => {
    const alice = await signUpUser('alice@example.com', 'Alice');
    const booking = await createPaidBooking(alice);

    const res = await postCancel(alice, booking.code, 'Trip cancelled by employer');
    expect(res.statusCode).toBe(200);
    const request = CancellationRequestSchema.parse(res.json());
    expect(request).toMatchObject({
      bookingCode: booking.code,
      status: 'REQUESTED',
      reason: 'Trip cancelled by employer',
      decisionNote: null,
      decidedAt: null,
    });

    // Chỉ request thôi thì booking không đổi; seat vẫn được giữ.
    const row = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(row.status).toBe(BookingStatus.PAID);
    expect(await seatsBooked()).toBe(3);

    // Outbox được enqueue trong CÙNG statement (invariant #7), key theo requestId.
    const outbox = await prisma.outbox.findMany({
      where: { type: EmailType.CANCELLATION_REQUESTED },
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.dedupeKey).toBe(`cancellation-requested:${request.id}`);
    expect(outbox[0]?.payload).toMatchObject({
      requestId: request.id,
      code: booking.code,
      email: 'alice@example.com',
      reason: 'Trip cancelled by employer',
    });
  });

  it('duplicate request while one is live → 409 ALREADY_REQUESTED (partial unique fires), no second row', async () => {
    const alice = await signUpUser('alice2@example.com');
    const booking = await createPaidBooking(alice);
    expect((await postCancel(alice, booking.code)).statusCode).toBe(200);

    const dup = await postCancel(alice, booking.code, 'asking again');
    expect(dup.statusCode).toBe(409);
    expect(dup.json()).toMatchObject({ code: 'ALREADY_REQUESTED' });
    expect(await prisma.cancellationRequest.count()).toBe(1);
    expect(
      await prisma.outbox.count({
        where: { type: EmailType.CANCELLATION_REQUESTED },
      }),
    ).toBe(1);
  });

  it('deny → DENIED + audit fields + outbox; booking stays PAID, seats stay held', async () => {
    const admin = await signUpAdmin();
    const alice = await signUpUser('alice3@example.com');
    const booking = await createPaidBooking(alice);
    const request = CancellationRequestSchema.parse((await postCancel(alice, booking.code)).json());

    const res = await postDecide(admin, request.id, {
      approve: false,
      decisionNote: 'Too late',
    });
    expect(res.statusCode).toBe(200);
    const body = DecideCancellationResultSchema.parse(res.json());
    expect(body.request).toMatchObject({
      id: request.id,
      status: 'DENIED',
      decisionNote: 'Too late',
      bookingCode: booking.code,
    });
    expect(body.request.decidedAt).not.toBeNull();
    expect(body.booking.status).toBe('PAID'); // deny không cancel

    const adminRow = await prisma.user.findUniqueOrThrow({
      where: { email: ADMIN_EMAIL },
    });
    const dbRequest = await prisma.cancellationRequest.findUniqueOrThrow({
      where: { id: request.id },
    });
    expect(dbRequest.status).toBe(CancellationRequestStatus.DENIED);
    expect(dbRequest.decidedById).toBe(adminRow.id);
    expect(await seatsBooked()).toBe(3);

    const outbox = await prisma.outbox.findMany({
      where: { type: EmailType.CANCELLATION_DENIED },
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.dedupeKey).toBe(`cancellation-denied:${request.id}`);
  });

  it('re-request after deny → NEW row; DENIED history preserved — 2 rows in DB (D1-B acceptance)', async () => {
    const admin = await signUpAdmin();
    const alice = await signUpUser('alice4@example.com');
    const booking = await createPaidBooking(alice);

    const first = CancellationRequestSchema.parse(
      (await postCancel(alice, booking.code, 'first ask')).json(),
    );
    expect((await postDecide(admin, first.id, { approve: false })).statusCode).toBe(200);

    const second = await postCancel(alice, booking.code, 'second ask');
    expect(second.statusCode).toBe(200);
    const secondRequest = CancellationRequestSchema.parse(second.json());
    expect(secondRequest.id).not.toBe(first.id); // append-only: một row MỚI, không tái dùng

    const rows = await prisma.cancellationRequest.findMany({
      where: { booking: { code: booking.code } },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.status)).toEqual([
      CancellationRequestStatus.DENIED, // audit trail của lần deny vẫn còn
      CancellationRequestStatus.REQUESTED,
    ]);
    expect(rows[0]?.reason).toBe('first ask');
    expect(rows[1]?.reason).toBe('second ask');

    // Mỗi request row có outbox email riêng (dedupe key theo id → 2 row).
    expect(
      await prisma.outbox.count({
        where: { type: EmailType.CANCELLATION_REQUESTED },
      }),
    ).toBe(2);

    // View detail của admin phơi toàn bộ trail, cũ nhất trước.
    const detail = await app.inject({
      method: 'GET',
      url: `/api/admin/bookings/${booking.code}`,
      headers: { cookie: admin },
    });
    expect(detail.statusCode).toBe(200);
    const parsed = AdminBookingDetailSchema.parse(detail.json());
    expect(parsed.cancellationRequests.map((r) => r.status)).toEqual(['DENIED', 'REQUESTED']);
  });

  it('approve → gateway refund + Refund row + booking CANCELLED/cancelledAt + seats RELEASED + request REFUNDED + outbox', async () => {
    const admin = await signUpAdmin();
    const alice = await signUpUser('alice5@example.com');
    const booking = await createPaidBooking(alice);
    expect(await seatsBooked()).toBe(3); // claim PAID đã tính cả party vào
    const request = CancellationRequestSchema.parse((await postCancel(alice, booking.code)).json());

    const res = await postDecide(admin, request.id, {
      approve: true,
      decisionNote: 'ok, refund',
    });
    expect(res.statusCode).toBe(200);
    const body = DecideCancellationResultSchema.parse(res.json());
    expect(body.request.status).toBe('REFUNDED');
    // Ngữ nghĩa terminal (booking-states.md): CANCELLED, KHÔNG phải REFUNDED
    // suy từ ledger — khách hủy, còn câu chuyện tiền nong nằm trong ledger.
    expect(body.booking.status).toBe('CANCELLED');
    expect(body.booking.cancelledAt).not.toBeNull();

    // (a) Gateway refund TOÀN BỘ phần còn lại, theo currency của booking, key
    // theo request id (W5 provider idempotency: một approve mỗi request).
    expect(fake.refunds).toHaveLength(1);
    expect(fake.refunds[0]).toMatchObject({
      amount: '117.00',
      currency: 'USD',
      idempotencyKey: `cancel-refund:${request.id}`,
    });

    // (b) Ledger row: full amount, adminId = admin ra quyết định.
    const adminRow = await prisma.user.findUniqueOrThrow({
      where: { email: ADMIN_EMAIL },
    });
    const refunds = await prisma.refund.findMany({
      where: { bookingId: booking.id },
    });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]?.amount.toFixed(2)).toBe('117.00');
    expect(refunds[0]?.adminId).toBe(adminRow.id);
    expect(refunds[0]?.providerRefundId).toMatch(/^fake_re_/);

    // (c) Booking CANCELLED + cancelledAt; seat được RELEASE trả lại pool.
    const dbBooking = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(dbBooking.status).toBe(BookingStatus.CANCELLED);
    expect(dbBooking.cancelledAt).not.toBeNull();
    expect(await seatsBooked()).toBe(0);

    // (d) Request được resolve thành REFUNDED kèm các field audit.
    const dbRequest = await prisma.cancellationRequest.findUniqueOrThrow({
      where: { id: request.id },
    });
    expect(dbRequest.status).toBe(CancellationRequestStatus.REFUNDED);
    expect(dbRequest.decidedById).toBe(adminRow.id);
    expect(dbRequest.decisionNote).toBe('ok, refund');

    // (e) Outbox approved-email trong cùng statement nguyên tử, key theo requestId.
    const outbox = await prisma.outbox.findMany({
      where: { type: EmailType.CANCELLATION_APPROVED },
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.dedupeKey).toBe(`cancellation-approved:${request.id}`);
    expect(outbox[0]?.payload).toMatchObject({
      amount: '117.00',
      currency: 'USD',
    });
  });

  it('decide on an already-decided request → 409 ALREADY_DECIDED; unknown id → 404', async () => {
    const admin = await signUpAdmin();
    const alice = await signUpUser('alice6@example.com');
    const booking = await createPaidBooking(alice);
    const request = CancellationRequestSchema.parse((await postCancel(alice, booking.code)).json());
    expect((await postDecide(admin, request.id, { approve: false })).statusCode).toBe(200);

    const again = await postDecide(admin, request.id, { approve: true });
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ code: 'ALREADY_DECIDED' });
    expect(fake.refunds).toHaveLength(0); // gate chặn TRƯỚC mọi call gateway

    const missing = await postDecide(admin, '00000000-0000-4000-8000-000000000000', {
      approve: true,
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('non-owner request → 404 (no existence leak); PENDING booking → 422 NOT_CANCELLABLE', async () => {
    const alice = await signUpUser('alice7@example.com');
    const mallory = await signUpUser('mallory@example.com');
    const paid = await createPaidBooking(alice);

    const foreign = await postCancel(mallory, paid.code);
    expect(foreign.statusCode).toBe(404);
    expect(foreign.json()).toMatchObject({ code: 'NOT_FOUND' });

    const pending = await createBooking(alice); // chưa từng pay
    const res = await postCancel(alice, pending.code);
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ code: 'NOT_CANCELLABLE' });
    expect(await prisma.cancellationRequest.count()).toBe(0);
  });

  it('non-admin decide/list → 403; anonymous → 401', async () => {
    const alice = await signUpUser('alice8@example.com');
    const booking = await createPaidBooking(alice);
    const request = CancellationRequestSchema.parse((await postCancel(alice, booking.code)).json());

    expect((await postDecide(alice, request.id, { approve: true })).statusCode).toBe(403);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/admin/cancellations',
          headers: { cookie: alice },
        })
      ).statusCode,
    ).toBe(403);
    expect((await postDecide('', request.id, { approve: true })).statusCode).toBe(401);

    // Không có gì thay đổi.
    expect(fake.refunds).toHaveLength(0);
    expect(
      (
        await prisma.cancellationRequest.findUniqueOrThrow({
          where: { id: request.id },
        })
      ).status,
    ).toBe(CancellationRequestStatus.REQUESTED);
  });

  it('BK-R1 cross-path: admin refund ‖ cancel-approve ĐỒNG THỜI → đúng 1 refund + 1 lần gọi gateway (advisory lock)', async () => {
    const admin = await signUpAdmin();
    const alice = await signUpUser('cross-path@example.com', 'Alice');
    const booking = await createPaidBooking(alice); // 117.00
    const request = CancellationRequestSchema.parse((await postCancel(alice, booking.code)).json());

    fake.refundDelayMs = 100; // ép hai path cùng đọc ledger=0 trước khi bên nào ghi
    const [a, b] = await Promise.allSettled([
      postRefund(admin, booking.code, {}), // W3 admin full refund
      postDecide(admin, request.id, { approve: true }), // W4 cancel-approve full refund
    ]);
    const codes = [a, b]
      .map((r) => (r.status === 'fulfilled' ? r.value.statusCode : 0))
      .sort((x, y) => x - y);
    // Một path thắng lock (200); path chạy sau đọc ledger đã settle / booking không
    // còn refundable → 422 (NOTHING_LEFT hoặc NOT_REFUNDABLE tùy thứ tự).
    expect(codes).toEqual([200, 422]);

    // Bất biến money cross-path: gateway ĐÚNG một lần, ledger đúng một row, không
    // vượt total — hai đường refund khác nhau vẫn serialize trên cùng advisory lock.
    expect(fake.refunds).toHaveLength(1);
    const refunds = await prisma.refund.findMany({ where: { bookingId: booking.id } });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]?.amount.toFixed(2)).toBe('117.00');
  });

  it('admin.cancellations.list: booking context + status filter; myRequests returns own history', async () => {
    const admin = await signUpAdmin();
    const alice = await signUpUser('alice9@example.com', 'Alice');
    const bob = await signUpUser('bob9@example.com', 'Bob');
    const aliceBooking = await createPaidBooking(alice);
    const bobBooking = await createPaidBooking(bob);

    const aliceReq = CancellationRequestSchema.parse(
      (await postCancel(alice, aliceBooking.code)).json(),
    );
    CancellationRequestSchema.parse((await postCancel(bob, bobBooking.code)).json());
    expect((await postDecide(admin, aliceReq.id, { approve: false })).statusCode).toBe(200);

    const all = await app.inject({
      method: 'GET',
      url: '/api/admin/cancellations',
      headers: { cookie: admin },
    });
    expect(all.statusCode).toBe(200);
    const page = PagedSchema(AdminCancellationRequestSchema).parse(all.json());
    expect(page.total).toBe(2); // qua nhiều user, mặc định mọi status
    expect(page.items.map((r) => r.bookingCode).sort()).toEqual(
      [aliceBooking.code, bobBooking.code].sort(),
    );
    expect(page.items.every((r) => r.tourTitle.length > 0 && r.contactEmail.length > 0)).toBe(true);

    const open = await app.inject({
      method: 'GET',
      url: '/api/admin/cancellations?status=REQUESTED',
      headers: { cookie: admin },
    });
    const openPage = PagedSchema(AdminCancellationRequestSchema).parse(open.json());
    expect(openPage.items.map((r) => r.bookingCode)).toEqual([bobBooking.code]);

    // myRequests (bề mặt service — UI cho khách sẽ có ở P3).
    const aliceRow = await prisma.user.findUniqueOrThrow({
      where: { email: 'alice9@example.com' },
    });
    const mine = await app.get(CancellationsService).myRequests(aliceRow.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ id: aliceReq.id, status: 'DENIED' });
  });
});
