import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { BookingSchema } from '@tourism/contract';
import * as catalog from '../../../prisma/fixtures/catalog.js';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { BookingStatus, DepartureStatus, EmailType } from '../../generated/prisma/enums.js';
import { BookingsService } from '../bookings/bookings.service.js';
import { FAKE_SIGNATURE_HEADER, FAKE_VALID_SIGNATURE, FakeGateway } from './fake.gateway.js';
import type { VerifiedEvent } from './gateway.js';

/**
 * Integration (Docker PG, db tourism_test) — money-path W2: bộ test invariant
 * cho luồng webhook → idempotency PaymentEvent → CTE claim PAID nguyên tử
 * (spec P2 §4 invariant 1–4, 7). App boot với `{ rawBody: true }` — webhook
 * controller verify signature dựa trên RAW bytes.
 */

const PUBLISHED_SLUG = 'hoi-an-walking-tour'; // basePrice 39.00 USD
const PASSWORD = 'password-123';

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

describe('payments integration (webhooks + PAID atomic claim)', () => {
  let app: NestFastifyApplication;
  let fake: FakeGateway;

  const future45 = new Date(Date.now() + 45 * 86_400_000);
  // depMain: seat đã book sẵn để chứng minh claim tăng ĐÚNG party size.
  const depMain = {
    id: 'e9200001-0000-4000-8000-000000000001',
    tourId: tour.id,
    startDate: future45,
    endDate: new Date(future45.getTime() + 86_400_000),
    seatsTotal: 8,
    seatsBooked: 3,
    status: DepartureStatus.OPEN,
  } satisfies Prisma.TourDepartureCreateManyInput;
  // depTight: khởi đầu rỗng để một create party-6 qua được soft check; test sau
  // đó đổ đầy gần hết để ép ra outcome overbook tại thời điểm claim.
  const depTight = {
    ...depMain,
    id: 'e9200001-0000-4000-8000-000000000002',
    seatsBooked: 0,
  } satisfies Prisma.TourDepartureCreateManyInput;
  // depBig: rộng rãi — vòng lặp concurrency book liên tục mà không đầy.
  const depBig = {
    ...depMain,
    id: 'e9200001-0000-4000-8000-000000000003',
    seatsTotal: 1000,
    seatsBooked: 0,
  } satisfies Prisma.TourDepartureCreateManyInput;
  const departures = [depMain, depTight, depBig];

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
    // rawBody: true — cùng wiring như main.ts; thiếu nó thì `req.rawBody` là
    // undefined và mọi lần verify signature sẽ 400.
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      rawBody: true,
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
    await prisma.tourDeparture.createMany({ data: departures });
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

  /** Tạo một booking PENDING qua API thật; trả về đúng shape của contract. */
  async function createBooking(cookie: string, payload: Record<string, unknown> = {}) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/bookings',
      headers: { cookie },
      payload: {
        departureId: depMain.id,
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

  /** POST một event provider đã ký (bằng Fake) vào route webhook raw-body. */
  async function postWebhook(event: VerifiedEvent, signature: string = FAKE_VALID_SIGNATURE) {
    return app.inject({
      method: 'POST',
      url: '/api/webhooks/stripe',
      headers: {
        'content-type': 'application/json',
        [FAKE_SIGNATURE_HEADER]: signature,
      },
      payload: JSON.stringify(event),
    });
  }

  const seatsOf = async (id: string) =>
    (await prisma.tourDeparture.findUniqueOrThrow({ where: { id } })).seatsBooked;

  it('happy path: payment.completed → PAID, seats claimed once, outbox + PaymentEvent audit row', async () => {
    const cookie = await signUpUser('alice@example.com', 'Alice');
    const booking = await createBooking(cookie); // party 3, 117.00 USD

    const event = fake.emitPaymentCompleted(booking.id);
    const res = await postWebhook(event);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      received: true,
      eventId: event.eventId,
      status: 'processed',
      outcome: 'claimed',
    });

    // Booking đã lật sang PAID kèm paidAt + payment handle đã capture.
    const row = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(row.status).toBe(BookingStatus.PAID);
    expect(row.paidAt).not.toBeNull();
    expect(row.providerPaymentId).toBe(event.providerPaymentId);

    // Seat được claim ĐÚNG bằng party size (3 book sẵn + 3).
    expect(await seatsOf(depMain.id)).toBe(6);

    // Outbox được enqueue nguyên tử bên trong claim CTE (invariant #7).
    const outbox = await prisma.outbox.findMany({
      where: { type: { not: EmailType.EMAIL_VERIFICATION } },
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      type: EmailType.BOOKING_CONFIRMATION,
      dedupeKey: `booking-confirmed:${booking.id}`,
    });
    expect(outbox[0]?.payload).toMatchObject({
      bookingId: booking.id,
      code: booking.code,
      email: 'alice@example.com',
      name: 'Alice Nguyen',
      title: tour.title,
      startDate: booking.departureStartDate,
      endDate: booking.departureEndDate,
      amount: '117.00',
      currency: 'USD',
    });

    // Row audit PaymentEvent (H4): các cột money denormalized + processedAt.
    const pe = await prisma.paymentEvent.findUniqueOrThrow({
      where: {
        provider_eventId: { provider: 'STRIPE', eventId: event.eventId },
      },
    });
    expect(pe.type).toBe('payment.completed');
    expect(pe.amount?.toFixed(2)).toBe('117.00');
    expect(pe.currency).toBe('USD');
    expect(pe.bookingId).toBe(booking.id);
    expect(pe.processedAt).not.toBeNull();
  });

  it('duplicate delivery (same eventId) → 200 duplicate, ONE seat claim, ONE outbox row', async () => {
    const cookie = await signUpUser('dup@example.com');
    const booking = await createBooking(cookie);

    const event = fake.emitPaymentCompleted(booking.id, {
      eventId: 'evt_pinned_1',
    });
    expect((await postWebhook(event)).statusCode).toBe(200);
    const replay = await postWebhook(
      fake.emitPaymentCompleted(booking.id, { eventId: 'evt_pinned_1' }),
    );
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toMatchObject({ status: 'duplicate' });

    expect(await seatsOf(depMain.id)).toBe(6); // chỉ tăng MỘT LẦN
    expect(
      await prisma.outbox.count({ where: { type: { not: EmailType.EMAIL_VERIFICATION } } }),
    ).toBe(1);
    expect(await prisma.paymentEvent.count()).toBe(1);
  });

  it('provider retry with a NEW eventId for a PAID booking → already-paid, no double claim', async () => {
    const cookie = await signUpUser('retry@example.com');
    const booking = await createBooking(cookie);

    expect((await postWebhook(fake.emitPaymentCompleted(booking.id))).statusCode).toBe(200);
    const second = await postWebhook(fake.emitPaymentCompleted(booking.id));
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({
      status: 'processed',
      outcome: 'already-paid',
    });

    expect(await seatsOf(depMain.id)).toBe(6);
    expect(
      await prisma.outbox.count({ where: { type: { not: EmailType.EMAIL_VERIFICATION } } }),
    ).toBe(1);
    // Cả hai event đều được log và hoàn tất — cái THỨ HAI không đổi gì.
    const events = await prisma.paymentEvent.findMany();
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.processedAt !== null)).toBe(true);
  });

  it('overbook: seats no longer fit at claim time → auto-refund + CANCELLED (invariant #3)', async () => {
    const cookie = await signUpUser('late@example.com');
    // Party 6 qua được soft check (8 seat trống lúc create)…
    const booking = await createBooking(cookie, {
      departureId: depTight.id,
      numAdults: 6,
      numChildren: 0,
    });
    // …rồi departure đầy lên 7/8 trong lúc người mua còn ngồi ở checkout.
    await prisma.tourDeparture.update({
      where: { id: depTight.id },
      data: { seatsBooked: 7 },
    });

    const event = fake.emitPaymentCompleted(booking.id);
    const res = await postWebhook(event);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'processed',
      outcome: 'overbooked',
    });

    const row = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(row.status).toBe(BookingStatus.CANCELLED);
    expect(row.cancelledAt).not.toBeNull();
    expect(row.paidAt).toBeNull();
    expect(await seatsOf(depTight.id)).toBe(7); // untouched

    // Auto-refund toàn phần: gọi gateway + một row ledger Refund (adminId null).
    expect(fake.refunds).toHaveLength(1);
    expect(fake.refunds[0]).toMatchObject({
      providerPaymentId: event.providerPaymentId,
      amount: '234.00', // 39.00 × 6
      currency: 'USD',
      idempotencyKey: `overbook-refund:${booking.id}`, // idempotency provider W5
    });
    const refunds = await prisma.refund.findMany({
      where: { bookingId: booking.id },
    });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]?.amount.toFixed(2)).toBe('234.00');
    expect(refunds[0]?.adminId).toBeNull();
    expect(refunds[0]?.providerRefundId).toBe(fake.refunds[0]?.providerRefundId);

    // Email refund enqueue một lần mỗi booking — và KHÔNG có email confirmation.
    const outbox = await prisma.outbox.findMany({
      where: { type: { not: EmailType.EMAIL_VERIFICATION } },
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      type: EmailType.BOOKING_REFUNDED,
      dedupeKey: `overbook-refund:${booking.id}`,
    });
  });

  it('PAY-R1: overbook-cancelled rồi capture redelivery (eventId MỚI) → GIỮ CANCELLED, không refund/email lần 2', async () => {
    const cookie = await signUpUser('pay-r1@example.com');
    // Overbook y như test trên: party 6 qua soft-check rồi departure đầy 7/8 lúc claim.
    const booking = await createBooking(cookie, {
      departureId: depTight.id,
      numAdults: 6,
      numChildren: 0,
    });
    await prisma.tourDeparture.update({
      where: { id: depTight.id },
      data: { seatsBooked: 7 },
    });

    // Webhook #1 → overbooked → auto-refund + CANCELLED (paid_at NULL, ledger 234).
    const first = await postWebhook(fake.emitPaymentCompleted(booking.id));
    expect(first.json()).toMatchObject({ outcome: 'overbooked' });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
      BookingStatus.CANCELLED,
    );
    expect(fake.refunds).toHaveLength(1);

    // Webhook #2: CÙNG booking, eventId MỚI (beginEvent không dedupe theo eventId) →
    // claim thấy CANCELLED → route sang refundOrphanedCapture. Đây là ca PAY-R1: booking
    // đã có refund từ overbook-path → issueFullAutoRefund trả 'already-refunded'.
    const retry = await postWebhook(
      fake.emitPaymentCompleted(booking.id, { eventId: 'evt_pay_r1_retry' }),
    );
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toMatchObject({ outcome: 'cancelled' });

    // GIỮ CANCELLED — KHÔNG sống dậy thành REFUNDED (overbook chưa từng là doanh thu).
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(row.status).toBe(BookingStatus.CANCELLED);

    // Không refund lần 2 ở gateway; ledger vẫn đúng 1 row (overbook); email refund 1 lần
    // (re-derive bị chặn → không chèn thêm outbox `orphan-refund:`).
    expect(fake.refunds).toHaveLength(1);
    expect(await prisma.refund.count({ where: { bookingId: booking.id } })).toBe(1);
    expect(await prisma.outbox.count({ where: { type: EmailType.BOOKING_REFUNDED } })).toBe(1);
  });

  it('orphaned capture: completed AFTER cancel → auto-refund + ledger-derived REFUNDED (invariant #4)', async () => {
    const cookie = await signUpUser('orphan@example.com');
    const booking = await createBooking(cookie);
    const cancelledAt = new Date();
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.CANCELLED, cancelledAt },
    });

    const res = await postWebhook(fake.emitPaymentCompleted(booking.id));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'processed',
      outcome: 'cancelled',
    });

    // W3 chốt: tiền đã refund + ghi ledger, rồi status được SUY RA từ ledger —
    // SUM(refunds) == totalAmount ⇒ REFUNDED (không còn CANCELLED; trái với path
    // overbook ở trên vốn không bao giờ tính là doanh thu).
    const row = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(row.status).toBe(BookingStatus.REFUNDED);
    expect(fake.refunds).toHaveLength(1);
    // Key idempotency provider W5 cho luồng auto-refund orphan.
    expect(fake.refunds[0]?.idempotencyKey).toBe(`orphan-refund:${booking.id}`);
    const refunds = await prisma.refund.findMany({
      where: { bookingId: booking.id },
    });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]?.amount.toFixed(2)).toBe('117.00');
    expect(refunds[0]?.adminId).toBeNull(); // tự động, không phải admin phát hành
    expect(await seatsOf(depMain.id)).toBe(3); // chưa bao giờ được claim

    // W3 chịu trách nhiệm email refund cho path này: một lần mỗi booking.
    const outbox = await prisma.outbox.findMany({
      where: { type: { not: EmailType.EMAIL_VERIFICATION } },
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      type: EmailType.BOOKING_REFUNDED,
      dedupeKey: `orphan-refund:${booking.id}`,
    });
    expect(outbox[0]?.payload).toMatchObject({
      amount: '117.00',
      reason: 'orphaned capture',
    });
  });

  it('bad signature → 400, NO PaymentEvent row, nothing processed', async () => {
    const cookie = await signUpUser('sig@example.com');
    const booking = await createBooking(cookie);

    const res = await postWebhook(fake.emitPaymentCompleted(booking.id), 'totally-wrong');
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: 'WEBHOOK_SIGNATURE_INVALID' });

    expect(await prisma.paymentEvent.count()).toBe(0);
    expect(await seatsOf(depMain.id)).toBe(3);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
      BookingStatus.PENDING,
    );
  });

  it('payment.failed → booking stays PENDING (no seats held), event recorded + processed', async () => {
    const cookie = await signUpUser('failed@example.com');
    const booking = await createBooking(cookie);

    const event = fake.emitPaymentFailed(booking.id);
    const res = await postWebhook(event);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'processed' });
    expect(res.json()).not.toHaveProperty('outcome');

    const row = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(row.status).toBe(BookingStatus.PENDING);
    expect(row.paidAt).toBeNull();
    expect(await seatsOf(depMain.id)).toBe(3);
    expect(
      await prisma.outbox.count({ where: { type: { not: EmailType.EMAIL_VERIFICATION } } }),
    ).toBe(0);

    const pe = await prisma.paymentEvent.findUniqueOrThrow({
      where: {
        provider_eventId: { provider: 'STRIPE', eventId: event.eventId },
      },
    });
    expect(pe.processedAt).not.toBeNull();
    expect(pe.bookingId).toBe(booking.id);
  });

  it('unknown bookingId in a signed event → 200 not-found (log-and-skip, provider stops retrying)', async () => {
    const event = fake.emitPaymentCompleted('e9200001-dead-4000-8000-000000000000');
    const res = await postWebhook(event);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'processed',
      outcome: 'not-found',
    });
    expect(await prisma.paymentEvent.count()).toBe(1);
  });

  it('CONCURRENT duplicate claims (same booking, 2 connections) → exactly one claimed, seats once — ×10', async () => {
    // Race EPQ mà lead đã cảnh báo: hai lần giao payment.completed với eventId
    // KHÁC NHAU (beginEvent không dedupe được) cùng claim MỘT booking đồng thời.
    // Claim theo kiểu bookings-first đặt status qual lên chính row đích của
    // UPDATE, nên lần re-check EPQ của kẻ thua bắt buộc phải fail. 10 booking mới
    // để cho race đủ chỗ mà cắn; pool của prisma (max 10) chạy hai call trên hai
    // connection riêng.
    const bookings = app.get(BookingsService);
    const cookie = await signUpUser('race@example.com');

    for (let i = 0; i < 10; i++) {
      const booking = await createBooking(cookie, { departureId: depBig.id }); // party 3
      const [a, b] = await Promise.all([
        bookings.claimSeatsForPaid(booking.id, `pay_race_${i}_a`),
        bookings.claimSeatsForPaid(booking.id, `pay_race_${i}_b`),
      ]);

      expect([a, b].sort()).toEqual(['already-paid', 'claimed']);
      // Seat tăng ĐÚNG một lần mỗi booking qua cả hai racer.
      expect(await seatsOf(depBig.id)).toBe(3 * (i + 1));
      // Một row outbox mỗi booking (dedupe key + một lần flip).
      expect(
        await prisma.outbox.count({
          where: { dedupeKey: `booking-confirmed:${booking.id}` },
        }),
      ).toBe(1);
      const row = await prisma.booking.findUniqueOrThrow({
        where: { id: booking.id },
      });
      expect(row.status).toBe(BookingStatus.PAID);
    }
    expect(
      await prisma.outbox.count({ where: { type: { not: EmailType.EMAIL_VERIFICATION } } }),
    ).toBe(10);
  });

  it('direct claim on an overfull departure → CHECK abort: overbooked, booking STAYS PENDING, zero partial effects', async () => {
    // Quan sát claim một cách biệt lập (test overbook qua webhook đã bao path
    // refund đầy đủ tới CANCELLED): việc abort toàn statement phải để lần flip
    // PAID, seat và outbox TẤT CẢ không được áp dụng.
    const bookings = app.get(BookingsService);
    const cookie = await signUpUser('abort@example.com');
    const booking = await createBooking(cookie, {
      departureId: depTight.id,
      numAdults: 6,
      numChildren: 0,
    });
    await prisma.tourDeparture.update({
      where: { id: depTight.id },
      data: { seatsBooked: 7 },
    });

    const outcome = await bookings.claimSeatsForPaid(booking.id, 'pay_abort_1');
    expect(outcome).toBe('overbooked');

    const row = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(row.status).toBe(BookingStatus.PENDING); // KHÔNG flip — cả statement bị abort
    expect(row.paidAt).toBeNull();
    expect(row.providerPaymentId).toBeNull();
    expect(await seatsOf(depTight.id)).toBe(7);
    expect(
      await prisma.outbox.count({ where: { type: { not: EmailType.EMAIL_VERIFICATION } } }),
    ).toBe(0);
  });

  it('unconfigured provider route (paypal before W5) → 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/paypal',
      headers: {
        'content-type': 'application/json',
        [FAKE_SIGNATURE_HEADER]: FAKE_VALID_SIGNATURE,
      },
      payload: JSON.stringify(fake.emitPaymentCompleted('e9200001-dead-4000-8000-000000000000')),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({
      code: 'WEBHOOK_PROVIDER_NOT_CONFIGURED',
    });
  });
});
