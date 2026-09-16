import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { CancelBookingResultSchema, cancellationDeadline, vietnamToday } from '@tourism/contract';
import * as catalog from '../../../prisma/fixtures/catalog/index.js';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  BookingStatus,
  CancellationRequestStatus,
  DepartureStatus,
  EmailType,
} from '../../generated/prisma/enums.js';
import { calendarDate, startOfDayUtc } from '../../lib/calendar-date.js';
import {
  FAKE_SIGNATURE_HEADER,
  FAKE_VALID_SIGNATURE,
  FakeGateway,
} from '../payments/fake.gateway.js';

/**
 * Integration (Docker PG, db tourism_test) — money-path huỷ booking.
 *
 * Từ ADR-0041 `bookings.cancel` là khách tự huỷ NGAY: trong một advisory lock,
 * gọi cổng thanh toán trước rồi một CTE ghi booking CANCELLED + yêu cầu REFUNDED
 * + dòng sổ (khi có tiền) + trả chỗ + outbox BOOKING_CANCELLED. Luồng khách gửi
 * yêu cầu, admin duyệt đã gỡ (plan 15/09 Task 8); hoàn thiện chí trên booking đã
 * huỷ được canh ở `refunds.int.spec.ts`. Ngữ nghĩa terminal-state được test ở đây
 * là những gì ghi trong docs/conventions/booking-states.md.
 */

const PUBLISHED_SLUG = 'hoi-an-lantern-evening'; // basePrice 39.00 USD (roster mới, spec 2026-07-31-tours-catalogue-api-design §3)
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

/** Cộng `days` ngày lịch vào chuỗi `YYYY-MM-DD` — tính trên UTC, không dùng giờ máy. */
function isoPlusDays(date: string, days: number): string {
  return calendarDate(new Date(startOfDayUtc(date).getTime() + days * 86_400_000));
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
  // Chuyến khởi hành +3 ngày — cho ca bậc 0% của ADR-0029 AMEND 5 (tour
  // fixture không có freeCancellationDays nên <7 ngày rơi thẳng vào bậc 0%).
  // Chuyến MỘT ngày (endDate = startDate) là có chủ đích: N = 1 nên hạn chót đặt
  // chỗ là +2 ngày và `create` không bao giờ vướng chốt chặn ADR-0041 §3. Để 2
  // ngày thì N = 3, hạn chót rơi đúng hôm nay theo UTC và `create` bị chặn trong
  // khung 00:00–06:59 giờ Việt Nam. Viết lại file này (Task 6) phải giữ điều kiện đó.
  const future3 = new Date(Date.now() + 3 * 86_400_000);
  const depSoon = {
    ...dep,
    id: 'e9400001-0000-4000-8000-000000000002',
    startDate: future3,
    endDate: future3,
  } satisfies Prisma.TourDepartureCreateManyInput;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE tour_categories, destinations, users, payment_events, outbox CASCADE',
    );
    await prisma.tourCategory.createMany({ data: catalog.tourCategories });
    await prisma.destination.createMany({ data: catalog.destinations });
    await prisma.tour.createMany({
      // `freeCancellationDays: null` ép TẠI ĐÂY, không nhận theo fixture. Cả
      // file này dựng trên tiền đề "tour không có cửa sổ huỷ miễn phí riêng
      // nên dưới 7 ngày rơi thẳng vào bậc 0%" — mà tiền đề đó từng là một giá
      // trị TÌNH CỜ của fixture. Ngày 10/09/2026 đợt khớp chính sách huỷ với
      // `refundPercentForBooking` đặt `hoi-an-lantern-evening` thành 1 (cửa sổ
      // 24 giờ), thế là ca "bậc 0%" hoàn 100% và test đỏ. Nay test tự khai
      // điều kiện của nó, và không tour nào trong fixture còn để null nữa.
      data: [{ ...tour, freeCancellationDays: null }] as unknown as Prisma.TourCreateManyInput[],
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
    await prisma.tourDeparture.createMany({ data: [dep, depSoon] });
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
    // requireEmailVerification (siết 20/08): signup không phát session —
    // verify qua DB (test này không nhắm flow OTP) rồi đăng nhập lấy cookie.
    await prisma.user.update({ where: { email }, data: { emailVerified: true } });
    const signIn = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      payload: { email, password: PASSWORD },
    });
    expect(signIn.statusCode).toBe(200);
    return sessionCookie(signIn);
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

  /** Khách tự huỷ qua route thật (ADR-0041). `payload` vắng = không ghi lý do. */
  function postCancel(cookie: string, code: string, payload: Record<string, unknown> = {}) {
    return app.inject({
      method: 'POST',
      url: `/api/bookings/${code}/cancel`,
      headers: { cookie },
      payload,
    });
  }

  /** Admin refund trực tiếp (W3) — dùng cho test cross-path BK-R1. W2
   *  (ADR-0030 AMEND 1): reason bắt buộc ở contract — helper điền mặc định,
   *  amount thì từng test khai tường minh (hết nhánh vắng-là-trọn-phần-dư). */
  function postRefund(cookie: string, code: string, payload: Record<string, unknown> = {}) {
    return app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${code}/refund`,
      headers: { cookie },
      payload: { reason: 'int test', ...payload },
    });
  }

  async function seatsBooked(): Promise<number> {
    const row = await prisma.tourDeparture.findUniqueOrThrow({
      where: { id: dep.id },
      select: { seatsBooked: true },
    });
    return row.seatsBooked;
  }

  /**
   * ADR-0041 §4 — khách tự huỷ, xử lý ngay. Chuyến `dep` khởi hành +45 ngày, dài
   * 2 ngày nên N = 3: booking tạo qua API luôn còn trong hạn. Ca quá hạn và ca
   * đúng ngày khởi hành dời SNAPSHOT ngày trên booking (lõi huỷ đọc snapshot,
   * không join chuyến), nên ghế vẫn nhả về `dep`.
   */
  describe('ADR-0041 — bookings.cancel huỷ ngay', () => {
    it('trong hạn: hoàn đủ, booking CANCELLED, yêu cầu REFUNDED do chính khách, trả chỗ, email BOOKING_CANCELLED', async () => {
      const alice = await signUpUser('self-cancel@example.com', 'Alice');
      const booking = await createPaidBooking(alice); // 117.00, 3 ghế
      expect(await seatsBooked()).toBe(3);

      const res = await postCancel(alice, booking.code, { reason: '  Change of plans  ' });
      expect(res.statusCode).toBe(200);
      const body = CancelBookingResultSchema.parse(res.json());
      expect(body.refundedAmount).toBe('117.00');
      expect(body.booking).toMatchObject({
        code: booking.code,
        status: 'CANCELLED',
        refundedTotal: '117.00',
      });
      expect(body.booking.cancelledAt).not.toBeNull();

      // (a) Cổng: đúng một lệnh, trọn phần còn lại, khoá chống trùng theo booking.
      expect(fake.refunds).toHaveLength(1);
      expect(fake.refunds[0]).toMatchObject({
        amount: '117.00',
        currency: 'USD',
        idempotencyKey: `cancel:${booking.id}`,
      });

      // (b) Sổ: một dòng, không admin nào bấm, capture được hoàn vào (ADR-0006 AMEND 1b).
      const refunds = await prisma.refund.findMany({ where: { bookingId: booking.id } });
      expect(refunds).toHaveLength(1);
      expect(refunds[0]?.amount.toFixed(2)).toBe('117.00');
      expect(refunds[0]?.adminId).toBeNull();
      expect(refunds[0]?.providerRefundId).toBe(fake.refunds[0]?.providerRefundId);
      expect(refunds[0]?.providerPaymentId).toBe(fake.refunds[0]?.providerPaymentId);

      // (c) Một yêu cầu REFUNDED do CHÍNH khách quyết; lý do đã trim ở contract.
      const aliceRow = await prisma.user.findUniqueOrThrow({
        where: { email: 'self-cancel@example.com' },
      });
      const requests = await prisma.cancellationRequest.findMany({
        where: { bookingId: booking.id },
      });
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        status: CancellationRequestStatus.REFUNDED,
        userId: aliceRow.id,
        decidedById: aliceRow.id,
        reason: 'Change of plans',
        decisionNote: null,
      });
      expect(requests[0]?.decidedAt).not.toBeNull();

      // (d) Booking CANCELLED + ghế nhả về pool.
      const dbBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(dbBooking.status).toBe(BookingStatus.CANCELLED);
      expect(dbBooking.cancelledAt).not.toBeNull();
      expect(await seatsBooked()).toBe(0);

      // (e) Email trong CÙNG câu SQL, payload đúng Hợp đồng C, dedupe theo booking.
      const outbox = await prisma.outbox.findMany({
        where: { type: EmailType.BOOKING_CANCELLED },
      });
      expect(outbox).toHaveLength(1);
      expect(outbox[0]?.dedupeKey).toBe(`booking-cancelled:${booking.id}`);
      expect(outbox[0]?.payload).toEqual({
        bookingId: booking.id,
        code: booking.code,
        email: 'alice@example.com',
        name: 'Alice Nguyen',
        title: dbBooking.tourTitle,
        amount: '117.00',
        currency: 'USD',
        refunded: true,
        deadline: cancellationDeadline(
          calendarDate(dbBooking.departureStartDate),
          calendarDate(dbBooking.departureEndDate),
        ),
        initiator: 'customer',
      });
    });

    it('W1 + ADR-0041: lý do toàn khoảng trắng → 400, không ghi gì; vắng lý do → reason NULL', async () => {
      const alice = await signUpUser('no-reason@example.com', 'Alice');
      const booking = await createPaidBooking(alice);

      // Có gửi lý do thì vẫn phải có chữ (trim ở CONTRACT, W1).
      const blank = await postCancel(alice, booking.code, { reason: '   ' });
      expect(blank.statusCode).toBe(400);
      expect(fake.refunds).toHaveLength(0);
      expect(await prisma.cancellationRequest.count()).toBe(0);

      // Vắng hẳn là hợp lệ: dòng yêu cầu ghi NULL.
      expect((await postCancel(alice, booking.code)).statusCode).toBe(200);
      const row = await prisma.cancellationRequest.findFirstOrThrow({
        where: { bookingId: booking.id },
      });
      expect(row.reason).toBeNull();
    });

    it('quá hạn chót: vẫn huỷ, hoàn 0 — không gọi cổng, không dòng sổ, email biến thể không hoàn', async () => {
      const alice = await signUpUser('late-cancel@example.com', 'Alice');
      const booking = await createPaidBooking(alice);
      // Khởi hành sau 2 ngày, chuyến 4 ngày → N = 7: hạn chót đã qua 5 ngày nhưng
      // chưa tới ngày khởi hành, nên vẫn huỷ online được.
      const start = isoPlusDays(vietnamToday(new Date()), 2);
      const end = isoPlusDays(start, 3);
      await prisma.booking.update({
        where: { id: booking.id },
        data: { departureStartDate: startOfDayUtc(start), departureEndDate: startOfDayUtc(end) },
      });

      const res = await postCancel(alice, booking.code);
      expect(res.statusCode).toBe(200);
      const body = CancelBookingResultSchema.parse(res.json());
      expect(body.refundedAmount).toBe('0.00');
      expect(body.booking.status).toBe('CANCELLED');

      // Không đồng nào phải chuyển: không gọi cổng, sổ không có dòng 0.00.
      expect(fake.refunds).toHaveLength(0);
      expect(await prisma.refund.count({ where: { bookingId: booking.id } })).toBe(0);
      // Vẫn MỘT yêu cầu REFUNDED (nghĩa "đã giải quyết"), vẫn nhả ghế.
      const request = await prisma.cancellationRequest.findFirstOrThrow({
        where: { bookingId: booking.id },
      });
      expect(request.status).toBe(CancellationRequestStatus.REFUNDED);
      expect(await seatsBooked()).toBe(0);

      const outbox = await prisma.outbox.findFirstOrThrow({
        where: { type: EmailType.BOOKING_CANCELLED },
      });
      expect(outbox.payload).toMatchObject({
        amount: '0.00',
        refunded: false,
        deadline: cancellationDeadline(start, end),
        initiator: 'customer',
      });
    });

    it('PARTIALLY_REFUNDED: hoàn đúng phần còn lại của sổ', async () => {
      const admin = await signUpAdmin();
      const alice = await signUpUser('partial-then-cancel@example.com', 'Alice');
      const booking = await createPaidBooking(alice); // 117.00
      expect((await postRefund(admin, booking.code, { amount: '17.00' })).statusCode).toBe(200);
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
        BookingStatus.PARTIALLY_REFUNDED,
      );

      const res = await postCancel(alice, booking.code);
      expect(res.statusCode).toBe(200);
      expect(CancelBookingResultSchema.parse(res.json()).refundedAmount).toBe('100.00');

      expect(fake.refunds.map((r) => r.amount)).toEqual(['17.00', '100.00']);
      expect(fake.refunds[1]?.idempotencyKey).toBe(`cancel:${booking.id}`);
      const total = await prisma.refund.aggregate({
        where: { bookingId: booking.id },
        _sum: { amount: true },
      });
      expect(total._sum.amount?.toFixed(2)).toBe('117.00');
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
        BookingStatus.CANCELLED,
      );
    });

    it('bấm hai lần song song: một 200, một 422 NOT_CANCELLABLE — một lệnh cổng, một dòng sổ, một yêu cầu, một email', async () => {
      const alice = await signUpUser('double-click@example.com', 'Alice');
      const booking = await createPaidBooking(alice);

      fake.refundDelayMs = 100; // giữ khoá đủ lâu để lệnh thứ hai chắc chắn phải chờ
      const results = await Promise.all([
        postCancel(alice, booking.code),
        postCancel(alice, booking.code),
      ]);
      expect(results.map((r) => r.statusCode).sort((x, y) => x - y)).toEqual([200, 422]);
      expect(results.find((r) => r.statusCode === 422)?.json()).toMatchObject({
        code: 'NOT_CANCELLABLE',
      });

      // Lệnh thứ hai chờ advisory lock rồi thấy CANCELLED — không chạm cổng lần hai.
      expect(fake.refunds).toHaveLength(1);
      expect(await prisma.refund.count({ where: { bookingId: booking.id } })).toBe(1);
      expect(await prisma.cancellationRequest.count({ where: { bookingId: booking.id } })).toBe(1);
      expect(await prisma.outbox.count({ where: { type: EmailType.BOOKING_CANCELLED } })).toBe(1);
      expect(await seatsBooked()).toBe(0);
    });

    it('cổng thanh toán lỗi → 502 REFUND_FAILED, không ghi gì; thử lại chạy trọn với cùng khoá chống trùng', async () => {
      const alice = await signUpUser('gateway-down@example.com', 'Alice');
      const booking = await createPaidBooking(alice);

      fake.failRefunds = true;
      const res = await postCancel(alice, booking.code, { reason: 'Change of plans' });
      expect(res.statusCode).toBe(502);
      expect(res.json()).toMatchObject({ code: 'REFUND_FAILED' });

      // Cổng TRƯỚC, sổ SAU: lỗi ở cổng thì booking nguyên vẹn, khách thử lại được.
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
        BookingStatus.PAID,
      );
      expect(await prisma.refund.count({ where: { bookingId: booking.id } })).toBe(0);
      expect(await prisma.cancellationRequest.count({ where: { bookingId: booking.id } })).toBe(0);
      expect(await prisma.outbox.count({ where: { type: EmailType.BOOKING_CANCELLED } })).toBe(0);
      expect(await seatsBooked()).toBe(3);

      fake.failRefunds = false;
      expect((await postCancel(alice, booking.code)).statusCode).toBe(200);
      expect(fake.refunds.map((r) => r.idempotencyKey)).toEqual([`cancel:${booking.id}`]);
    });

    it('đúng ngày khởi hành (giờ Việt Nam) → 422 NOT_CANCELLABLE, booking giữ nguyên', async () => {
      const alice = await signUpUser('departure-day@example.com', 'Alice');
      const booking = await createPaidBooking(alice);
      const today = vietnamToday(new Date());
      await prisma.booking.update({
        where: { id: booking.id },
        data: { departureStartDate: startOfDayUtc(today), departureEndDate: startOfDayUtc(today) },
      });

      const res = await postCancel(alice, booking.code);
      expect(res.statusCode).toBe(422);
      expect(res.json()).toMatchObject({ code: 'NOT_CANCELLABLE' });
      expect(fake.refunds).toHaveLength(0);
      expect(await prisma.cancellationRequest.count()).toBe(0);
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
        BookingStatus.PAID,
      );
      expect(await seatsBooked()).toBe(3);
    });

    it('người khác huỷ → 404 (không lộ tồn tại); booking PENDING → 422 NOT_CANCELLABLE', async () => {
      const alice = await signUpUser('owner@example.com');
      const mallory = await signUpUser('mallory@example.com');
      const paid = await createPaidBooking(alice);

      const foreign = await postCancel(mallory, paid.code);
      expect(foreign.statusCode).toBe(404);
      expect(foreign.json()).toMatchObject({ code: 'NOT_FOUND' });

      const pending = await createBooking(alice); // chưa từng trả tiền
      const res = await postCancel(alice, pending.code);
      expect(res.statusCode).toBe(422);
      expect(res.json()).toMatchObject({ code: 'NOT_CANCELLABLE' });

      expect(fake.refunds).toHaveLength(0);
      expect(await prisma.cancellationRequest.count()).toBe(0);
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: paid.id } })).status).toBe(
        BookingStatus.PAID,
      );
    });

    it('booking REFUNDED (đã hoàn thiện chí toàn bộ) → 422, không huỷ online (spec §3.3)', async () => {
      const admin = await signUpAdmin();
      const alice = await signUpUser('fully-refunded@example.com', 'Alice');
      const booking = await createPaidBooking(alice);
      expect((await postRefund(admin, booking.code, { amount: '117.00' })).statusCode).toBe(200);

      const res = await postCancel(alice, booking.code);
      expect(res.statusCode).toBe(422);
      expect(res.json()).toMatchObject({ code: 'NOT_CANCELLABLE' });

      expect(fake.refunds).toHaveLength(1); // chỉ lệnh hoàn thiện chí trước đó
      expect(await prisma.cancellationRequest.count()).toBe(0);
      expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
        BookingStatus.REFUNDED,
      );
      expect(await seatsBooked()).toBe(3);
    });
  });
});
