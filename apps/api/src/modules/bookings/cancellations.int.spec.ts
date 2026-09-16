import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  AdminBookingDetailSchema,
  AdminCancellationRequestSchema,
  CancelBookingResultSchema,
  cancellationDeadline,
  DecideCancellationResultSchema,
  PagedSchema,
  vietnamToday,
} from '@tourism/contract';
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
import { CancellationsService } from './cancellations.service.js';

/**
 * Integration (Docker PG, db tourism_test) — money-path huỷ booking.
 *
 * Từ ADR-0041 `bookings.cancel` là khách tự huỷ NGAY: trong một advisory lock,
 * gọi cổng thanh toán trước rồi một CTE ghi booking CANCELLED + yêu cầu REFUNDED
 * + dòng sổ (khi có tiền) + trả chỗ + outbox BOOKING_CANCELLED. Phần approve/deny
 * của D1-B (spec P2 §2) còn sống tới plan 15/09 Task 8, nên test của nó dựng yêu
 * cầu REQUESTED bằng `openRequest`. Ngữ nghĩa terminal-state được test ở đây là
 * những gì ghi trong docs/conventions/booking-states.md.
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

  /**
   * Mở một yêu cầu huỷ REQUESTED thẳng bằng Prisma. Từ ADR-0041 `bookings.cancel`
   * huỷ ngay chứ không tạo dòng này nữa, nhưng approve/deny và vùng admin còn
   * sống tới plan 15/09 Task 8 — test của chúng tự dựng dữ liệu kiểu cũ (prod vẫn
   * còn loại dòng này tới lượt seed lại). Chụp badge `freeCancellationDays` của
   * tour như `request()` cũ từng làm (ADR-0029 AMEND 6).
   */
  async function openRequest(bookingId: string, reason = 'Change of plans') {
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { userId: true, tour: { select: { freeCancellationDays: true } } },
    });
    return prisma.cancellationRequest.create({
      data: {
        bookingId,
        userId: booking.userId,
        reason,
        freeCancellationDays: booking.tour.freeCancellationDays,
      },
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

    it('W1 + ADR-0041: lý do toàn khoảng trắng → 400, không ghi gì; vắng lý do → reason NULL, admin list vẫn 200', async () => {
      const admin = await signUpAdmin();
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

      // Dòng lý do NULL không được làm nổ output validation của hàng đợi admin
      // (Task 2 nới CancellationRequestSchema.reason).
      const list = await app.inject({
        method: 'GET',
        url: '/api/admin/cancellations',
        headers: { cookie: admin },
      });
      expect(list.statusCode).toBe(200);
      expect(
        PagedSchema(AdminCancellationRequestSchema).parse(list.json()).items[0]?.reason,
      ).toBeNull();
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

  it('deny → DENIED + audit fields + outbox; booking stays PAID, seats stay held', async () => {
    const admin = await signUpAdmin();
    const alice = await signUpUser('alice3@example.com');
    const booking = await createPaidBooking(alice);
    const request = await openRequest(booking.id);

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

  it('admin detail: lịch sử yêu cầu append-only — dòng DENIED cũ còn nguyên cạnh dòng mở mới, cũ nhất trước', async () => {
    const admin = await signUpAdmin();
    const alice = await signUpUser('alice4@example.com');
    const booking = await createPaidBooking(alice);

    const first = await openRequest(booking.id, 'first ask');
    expect((await postDecide(admin, first.id, { approve: false })).statusCode).toBe(200);

    const second = await openRequest(booking.id, 'second ask');
    expect(second.id).not.toBe(first.id); // append-only: một row MỚI, không tái dùng

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
    const request = await openRequest(booking.id);

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
    // ADR-0006 AMEND 1b: mọi đường ghi sổ điền capture được hoàn vào — nguồn
    // cho guard dup-capture của auto-refund.
    expect(refunds[0]?.providerPaymentId).toBe(fake.refunds[0]?.providerPaymentId);

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
    const request = await openRequest(booking.id);
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

  it('non-admin decide/list → 403; anonymous → 401', async () => {
    const alice = await signUpUser('alice8@example.com');
    const booking = await createPaidBooking(alice);
    const request = await openRequest(booking.id);

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

  /**
   * ADR-0029 — ba nới của money-path. Đây là số admin đem so sổ và là ghế thật
   * của một chuyến, nên mỗi nới có test riêng chạy trên Postgres thật.
   */
  describe('ADR-0029 — approve với mức hoàn theo chính sách', () => {
    it('§1 approve MỘT PHẦN: hoàn đúng số đã gửi, request đóng, booking CANCELLED, ghế NHẢ', async () => {
      const admin = await signUpAdmin();
      const alice = await signUpUser('adr29-partial@example.com', 'Alice');
      const booking = await createPaidBooking(alice); // 117.00, 3 ghế
      const request = await openRequest(booking.id);
      expect(await seatsBooked()).toBe(3);

      const res = await postDecide(admin, request.id, {
        approve: true,
        refundAmount: '50.00',
        decisionNote: 'Off-policy split agreed with the customer.',
      });
      expect(res.statusCode).toBe(200);

      const rows = await prisma.refund.findMany({ where: { bookingId: booking.id } });
      expect(rows.map((r) => r.amount.toFixed(2))).toEqual(['50.00']);
      const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(after.status).toBe('CANCELLED');
      expect(after.cancelledAt).not.toBeNull();
      expect(
        (await prisma.cancellationRequest.findUniqueOrThrow({ where: { id: request.id } })).status,
      ).toBe(CancellationRequestStatus.REFUNDED);
      // Ghế nhả BẤT KỂ hoàn bao nhiêu — khách ngừng đi là ngừng đi.
      expect(await seatsBooked()).toBe(0);
    });

    it('AMEND 5: vắng refundAmount = MỨC CHÍNH SÁCH — trong ân hạn 24h là 100%, tức trọn phần dư', async () => {
      // Flow tạo-rồi-huỷ-ngay nằm trong cửa sổ ân hạn (ADR-0030 §3c) → chính
      // sách 100% → mức mặc định trùng "trọn phần dư" cũ. Cái ĐÃ đổi là căn
      // cứ của con số: nó đến từ bảng bậc, không còn là mặc-định-vô-điều-kiện.
      const admin = await signUpAdmin();
      const alice = await signUpUser('adr29-full@example.com', 'Alice');
      const booking = await createPaidBooking(alice);
      const request = await openRequest(booking.id);

      expect((await postDecide(admin, request.id, { approve: true })).statusCode).toBe(200);
      const rows = await prisma.refund.findMany({ where: { bookingId: booking.id } });
      expect(rows.map((r) => r.amount.toFixed(2))).toEqual(['117.00']);
    });

    it('AMEND 5: vắng refundAmount trên bậc 0% → hoàn 0 (KHÔNG 100%), không gateway, ghế vẫn nhả', async () => {
      // Cửa hậu audit 05/09 (cụm 3, Cao): yêu cầu gửi 3 ngày trước khởi hành
      // (bậc 0%) mà caller BỎ TRỐNG refundAmount thì trước AMEND 5 được hoàn
      // TRỌN 117.00 không cần lý do, không dấu vết.
      const admin = await signUpAdmin();
      const alice = await signUpUser('adr29-policy-zero@example.com', 'Alice');
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        headers: { cookie: alice },
        payload: {
          departureId: depSoon.id,
          numAdults: 2,
          numChildren: 1,
          contactName: 'Alice Nguyen',
          contactEmail: 'alice@example.com',
          paymentProvider: 'STRIPE',
        },
      });
      expect(createRes.statusCode).toBe(200);
      const booking = createRes.json() as { id: string; code: string };
      await payBooking(booking.id);
      // Ra khỏi cửa sổ ân hạn 24h — không thì grace phủ 100% lên bậc.
      await prisma.booking.update({
        where: { id: booking.id },
        data: { paidAt: new Date(Date.now() - 2 * 86_400_000) },
      });
      const request = await openRequest(booking.id);

      const res = await postDecide(admin, request.id, { approve: true });
      expect(res.statusCode).toBe(200);

      // Chính sách 0% → không đồng nào chuyển: không gateway, không dòng sổ.
      expect(fake.refunds).toHaveLength(0);
      expect(await prisma.refund.count({ where: { bookingId: booking.id } })).toBe(0);
      // Ba hệ quả còn lại vẫn chạy (đường noMoneyToMove của AMEND 3).
      expect(
        (await prisma.cancellationRequest.findUniqueOrThrow({ where: { id: request.id } })).status,
      ).toBe(CancellationRequestStatus.REFUNDED);
      const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(after.status).toBe('CANCELLED');
      const soon = await prisma.tourDeparture.findUniqueOrThrow({
        where: { id: depSoon.id },
        select: { seatsBooked: true },
      });
      expect(soon.seatsBooked).toBe(0);
    });

    it('AMEND 6: badge freeCancellationDays CHỤP lúc khách gửi — sửa tour sau đó không làm khách rớt bậc', async () => {
      const admin = await signUpAdmin();
      const alice = await signUpUser('adr29-snapshot@example.com', 'Alice');
      // Tour có badge 60 ngày → yêu cầu gửi 45 ngày trước khởi hành là 100%.
      await prisma.tour.update({ where: { id: tour.id }, data: { freeCancellationDays: 60 } });
      try {
        const booking = await createPaidBooking(alice);
        await prisma.booking.update({
          where: { id: booking.id },
          data: { paidAt: new Date(Date.now() - 2 * 86_400_000) }, // ra khỏi ân hạn
        });
        const request = await openRequest(booking.id);
        expect(request.freeCancellationDays).toBe(60);
        // Content-admin gỡ badge NGAY SAU khi khách gửi.
        await prisma.tour.update({ where: { id: tour.id }, data: { freeCancellationDays: null } });
        // Vắng refundAmount = mức chính sách — tính theo SNAPSHOT 60 ngày → 100%,
        // không phải bậc theo ngày (45 ngày → 75%) của tour vừa sửa.
        expect((await postDecide(admin, request.id, { approve: true })).statusCode).toBe(200);
        const rows = await prisma.refund.findMany({ where: { bookingId: booking.id } });
        expect(rows.map((r) => r.amount.toFixed(2))).toEqual(['117.00']);
      } finally {
        await prisma.tour.update({ where: { id: tour.id }, data: { freeCancellationDays: null } });
      }
    });

    it('§1 số tiền VƯỢT phần dư bị server chặn — không tin con số client gửi', async () => {
      const admin = await signUpAdmin();
      const alice = await signUpUser('adr29-over@example.com', 'Alice');
      const booking = await createPaidBooking(alice);
      const request = await openRequest(booking.id);

      const res = await postDecide(admin, request.id, { approve: true, refundAmount: '999.00' });
      expect(res.statusCode).toBe(422);
      expect(fake.refunds).toHaveLength(0);
      expect(
        (await prisma.cancellationRequest.findUniqueOrThrow({ where: { id: request.id } })).status,
      ).toBe(CancellationRequestStatus.REQUESTED);
    });

    it('§AMEND 3 approve với mức hoàn BẰNG 0: không gọi gateway, không ghi sổ, GHẾ VẪN NHẢ', async () => {
      // Ca huỷ sát ngày khởi hành — bậc chính sách cho 0%. Trước AMEND 3 con
      // số 0 rơi vào `classifyRefundAmount` và ăn 422 ZERO_OR_NEGATIVE, tức
      // chính ca thường gặp nhất KHÔNG approve được và ghế rò y như bug cũ.
      const admin = await signUpAdmin();
      const alice = await signUpUser('adr29-zero@example.com', 'Alice');
      const booking = await createPaidBooking(alice); // 117.00, 3 ghế
      const request = await openRequest(booking.id);
      expect(await seatsBooked()).toBe(3);

      const res = await postDecide(admin, request.id, {
        approve: true,
        refundAmount: '0.00',
        decisionNote: 'Tour cancelled by us — no refund due, closing the request.',
      });
      expect(res.statusCode).toBe(200);

      // Không đồng nào chuyển, nên gateway không được gọi và sổ append-only
      // không có dòng nào — sổ chỉ kể tiền thật sự đi.
      expect(fake.refunds).toHaveLength(0);
      expect(await prisma.refund.count({ where: { bookingId: booking.id } })).toBe(0);
      // Ba hệ quả còn lại VẪN xảy ra: đóng request, huỷ booking, nhả ghế.
      expect(
        (await prisma.cancellationRequest.findUniqueOrThrow({ where: { id: request.id } })).status,
      ).toBe(CancellationRequestStatus.REFUNDED);
      const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(after.status).toBe('CANCELLED');
      expect(after.cancelledAt).not.toBeNull();
      expect(await seatsBooked()).toBe(0);
    });

    /**
     * Sổ đã settle TRONG LÚC request còn mở. Từ ADR-0029 AMEND 4 đường W3 bị
     * server chặn khi có request mở, nên ca này chỉ còn tới được từ dữ liệu
     * cũ (trước AMEND) hoặc một khoản đối soát ghi thẳng vào sổ — mô phỏng
     * bằng một row `refunds` chèn tay, không qua gateway.
     */
    async function settleLedgerDirectly(bookingId: string) {
      await prisma.refund.create({
        data: {
          bookingId,
          amount: new Prisma.Decimal('117.00'),
          currency: 'USD',
          providerRefundId: 'reconciled-outside',
          // `adminId` null: khoản đối soát ngoài hệ, không ai bấm nút.
        },
      });
      await prisma.booking.update({ where: { id: bookingId }, data: { status: 'REFUNDED' } });
    }

    it('§2 booking ĐÃ hoàn đủ: approve vẫn chạy, KHÔNG gọi gateway, ghế được NHẢ', async () => {
      // Đây là ca từng kẹt vĩnh viễn ở 422 và làm rò ghế — lý do ADR-0029 ra đời.
      const admin = await signUpAdmin();
      const alice = await signUpUser('adr29-settled@example.com', 'Alice');
      const booking = await createPaidBooking(alice);
      const request = await openRequest(booking.id);
      await settleLedgerDirectly(booking.id);
      expect(await seatsBooked()).toBe(3);

      const res = await postDecide(admin, request.id, { approve: true });
      expect(res.statusCode).toBe(200);

      // Không gọi gateway, và KHÔNG ghi row 0.00 vào sổ.
      expect(fake.refunds).toHaveLength(0);
      expect(await prisma.refund.count({ where: { bookingId: booking.id } })).toBe(1);
      const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      expect(after.status).toBe('CANCELLED');
      expect(
        (await prisma.cancellationRequest.findUniqueOrThrow({ where: { id: request.id } })).status,
      ).toBe(CancellationRequestStatus.REFUNDED);
      // Chính là thứ đã rò trước ADR-0029.
      expect(await seatsBooked()).toBe(0);
    });

    it('sổ đã settle mà client gửi một số KHÁC 0 → 422, không nuốt thành 200 (vòng vá 05/09)', async () => {
      // Trang admin render `refundedTotal=0.00`, một khoản hoàn đủ đi sau đó;
      // admin submit 50.00 → server phải nói NOT_REFUNDABLE (NOTHING_LEFT), không
      // trả 200 rồi để admin tin 50$ vừa đi.
      const admin = await signUpAdmin();
      const alice = await signUpUser('adr29-settled-amount@example.com', 'Alice');
      const booking = await createPaidBooking(alice);
      const request = await openRequest(booking.id);
      await settleLedgerDirectly(booking.id);

      const res = await postDecide(admin, request.id, { approve: true, refundAmount: '50.00' });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('NOT_REFUNDABLE');
      // Không đổi gì: request còn mở, booking còn ghế.
      expect(
        (await prisma.cancellationRequest.findUniqueOrThrow({ where: { id: request.id } })).status,
      ).toBe(CancellationRequestStatus.REQUESTED);
      expect(await seatsBooked()).toBe(3);
    });

    it('ADR-0030 §5 ở server: số KHÁC mức chính sách mà không có lý do → 422; có lý do → 200', async () => {
      // Chuyến 45 ngày nữa, ngoài ân hạn → bậc 100% → mức chính sách = 117.00.
      const admin = await signUpAdmin();
      const alice = await signUpUser('adr30-offpolicy@example.com', 'Alice');
      const booking = await createPaidBooking(alice);
      const request = await openRequest(booking.id);

      const noNote = await postDecide(admin, request.id, { approve: true, refundAmount: '50.00' });
      expect(noNote.statusCode).toBe(422);
      expect(noNote.json().code).toBe('OFF_POLICY_NOTE_REQUIRED');
      expect(fake.refunds).toHaveLength(0);

      const withNote = await postDecide(admin, request.id, {
        approve: true,
        refundAmount: '50.00',
        decisionNote: 'Supplier refunded us only half — goodwill split.',
      });
      expect(withNote.statusCode).toBe(200);
      expect(fake.refunds).toHaveLength(1);
    });

    it('ADR-0030 §5: số ĐÚNG mức chính sách thì không cần lý do', async () => {
      const admin = await signUpAdmin();
      const alice = await signUpUser('adr30-onpolicy@example.com', 'Alice');
      const booking = await createPaidBooking(alice);
      const request = await openRequest(booking.id);

      const res = await postDecide(admin, request.id, { approve: true, refundAmount: '117.00' });
      expect(res.statusCode).toBe(200);
    });

    it('ADR-0029 AMEND 4: W3 `Issue refund` bị chặn khi có yêu cầu huỷ ĐANG MỞ', async () => {
      // W3 hoàn đủ rồi Deny là ghế rò vĩnh viễn — trước đây chỉ UI ẩn nút.
      const admin = await signUpAdmin();
      const alice = await signUpUser('adr29-w3-blocked@example.com', 'Alice');
      const booking = await createPaidBooking(alice);
      await openRequest(booking.id);

      const res = await postRefund(admin, booking.code, { amount: '117.00' });
      expect(res.statusCode).toBe(422);
      expect(res.json().code).toBe('CANCELLATION_OPEN');
      expect(fake.refunds).toHaveLength(0);
    });

    it('§3 booking CANCELLED còn dư: W3 hoàn nốt được, và KHÔNG ghi đè CANCELLED', async () => {
      const admin = await signUpAdmin();
      const alice = await signUpUser('adr29-remainder@example.com', 'Alice');
      const booking = await createPaidBooking(alice);
      const request = await openRequest(booking.id);
      // Approve một phần → CANCELLED nhưng sổ còn dư 67.00.
      expect(
        (
          await postDecide(admin, request.id, {
            approve: true,
            refundAmount: '50.00',
            decisionNote: 'Partial refund agreed with the customer.',
          })
        ).statusCode,
      ).toBe(200);

      const res = await postRefund(admin, booking.code, { amount: '17.00' });
      expect(res.statusCode).toBe(200);

      const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      // Travel story KHÔNG bị money story ghi đè — đây là bẫy ADR-0029 §3 nêu.
      expect(after.status).toBe('CANCELLED');
      expect(after.cancelledAt).not.toBeNull();
      const rows = await prisma.refund.findMany({ where: { bookingId: booking.id } });
      expect(rows.map((r) => r.amount.toFixed(2)).sort()).toEqual(['17.00', '50.00']);
      // Ghế KHÔNG nhả lần hai — approve đã nhả rồi.
      expect(await seatsBooked()).toBe(0);
    });

    it('§3 hoàn nốt tới đủ total thì dừng — trigger ADR-0009 vẫn là trần', async () => {
      const admin = await signUpAdmin();
      const alice = await signUpUser('adr29-cap@example.com', 'Alice');
      const booking = await createPaidBooking(alice);
      const request = await openRequest(booking.id);
      expect(
        (
          await postDecide(admin, request.id, {
            approve: true,
            refundAmount: '50.00',
            decisionNote: 'Partial refund agreed with the customer.',
          })
        ).statusCode,
      ).toBe(200);
      // Hoàn nốt = GÕ đúng phần dư 67.00 (W2: hết nhánh vắng-amount).
      expect((await postRefund(admin, booking.code, { amount: '67.00' })).statusCode).toBe(200);

      // Hoàn thêm nữa là 422 — sổ đã settle.
      expect((await postRefund(admin, booking.code, { amount: '1.00' })).statusCode).toBe(422);
      const total = await prisma.refund.aggregate({
        where: { bookingId: booking.id },
        _sum: { amount: true },
      });
      expect(total._sum.amount?.toFixed(2)).toBe('117.00');
    });
  });

  it('BK-R1 cross-path: admin refund ‖ cancel-approve ĐỒNG THỜI → đúng 1 refund + 1 lần gọi gateway (advisory lock)', async () => {
    const admin = await signUpAdmin();
    const alice = await signUpUser('cross-path@example.com', 'Alice');
    const booking = await createPaidBooking(alice); // 117.00
    const request = await openRequest(booking.id);

    fake.refundDelayMs = 100; // ép hai path cùng đọc ledger=0 trước khi bên nào ghi
    const [a, b] = await Promise.allSettled([
      postRefund(admin, booking.code, { amount: '117.00' }), // W3 refund trọn 117
      postDecide(admin, request.id, { approve: true }), // W4 cancel-approve full refund
    ]);
    const codes = [a, b]
      .map((r) => (r.status === 'fulfilled' ? r.value.statusCode : 0))
      .sort((x, y) => x - y);
    // Từ ADR-0029 AMEND 4 kết cục KHÔNG còn tuỳ thứ tự: W3 thắng lock trước
    // thì thấy request đang mở → CANCELLATION_OPEN (422), approve chạy sau và
    // hoàn đủ (200); approve thắng trước thì W3 thấy remainder 0 → NOTHING_LEFT
    // (422). Đường nào cũng đúng một 200 và một 422.
    expect(codes).toEqual([200, 422]);

    // Bất biến money cross-path KHÔNG đổi dù kết cục mã trạng thái có đổi:
    // gateway ĐÚNG một lần, ledger đúng một row, không vượt total — hai đường
    // refund khác nhau vẫn serialize trên cùng advisory lock.
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

    const aliceReq = await openRequest(aliceBooking.id);
    await openRequest(bobBooking.id);
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
    // Tiền trong queue (review F3 31/08): total + đã-hoàn THẬT để dialog
    // approve hiện phần-còn-lại — admin không bấm lệnh tiền mù.
    // Booking của Alice đã bị DENY (không refund) → refundedTotal 0.
    const aliceItem = page.items.find((r) => r.bookingCode === aliceBooking.code);
    expect(aliceItem?.totalAmount).toBe('117.00');
    expect(aliceItem?.refundedTotal).toBe('0.00');
    expect(aliceItem?.currency).toBe('USD');
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

  /**
   * Bộ lọc khoảng ngày (ADR-0028 §AMEND) — theo `createdAt`, ngày khách GỬI
   * yêu cầu. Hai điều phải khoá: biên nửa-mở cắt đúng, và hàng REQUESTED
   * (`decidedAt` null) VẪN nằm trong tập lọc — đó là lý do không dùng
   * `decidedAt` làm cột lọc.
   */
  it('admin.cancellations.list: lọc theo khoảng ngày tạo, hàng đang mở KHÔNG bị loại', async () => {
    const admin = await signUpAdmin();
    const may = await signUpUser('may@example.com', 'May');
    const june = await signUpUser('june@example.com', 'June');
    const openOld = await signUpUser('openold@example.com', 'OpenOld');

    const mayBooking = await createPaidBooking(may);
    const juneBooking = await createPaidBooking(june);
    const openBooking = await createPaidBooking(openOld);

    const mayReq = await openRequest(mayBooking.id);
    const juneReq = await openRequest(juneBooking.id);
    const openReq = await openRequest(openBooking.id);
    // Một cái đã quyết, một cái CÒN MỞ — cả hai cùng nằm trong tháng 5.
    expect((await postDecide(admin, mayReq.id, { approve: false })).statusCode).toBe(200);

    // Lùi `createdAt` về mốc cố định: chính khoảng ngày là thứ đang được kiểm,
    // nên fixture không được trôi theo đồng hồ.
    await prisma.cancellationRequest.update({
      where: { id: mayReq.id },
      data: { createdAt: new Date('2026-05-10T12:00:00.000Z') },
    });
    await prisma.cancellationRequest.update({
      where: { id: openReq.id },
      // Giây áp chót của ngày cuối kỳ — ca mà mốc `23:59:59` sẽ bỏ rơi.
      data: { createdAt: new Date('2026-05-31T23:59:59.500Z') },
    });
    await prisma.cancellationRequest.update({
      where: { id: juneReq.id },
      // 00:00 ngày 1/6 — NGOÀI kỳ, đúng mốc chặn nửa-mở.
      data: { createdAt: new Date('2026-06-01T00:00:00.000Z') },
    });

    const may5 = await app.inject({
      method: 'GET',
      url: '/api/admin/cancellations?from=2026-05-01&to=2026-05-31',
      headers: { cookie: admin },
    });
    expect(may5.statusCode).toBe(200);
    const page = PagedSchema(AdminCancellationRequestSchema).parse(may5.json());
    expect(page.items.map((r) => r.id).sort()).toEqual([mayReq.id, openReq.id].sort());
    // Hàng còn MỞ vẫn ở đây — nếu lọc theo `decidedAt` thì nó đã biến mất.
    expect(page.items.find((r) => r.id === openReq.id)?.status).toBe('REQUESTED');

    // Cộng dồn với filter status, không cái nào thay cái nào.
    const openOnly = await app.inject({
      method: 'GET',
      url: '/api/admin/cancellations?from=2026-05-01&to=2026-05-31&status=REQUESTED',
      headers: { cookie: admin },
    });
    expect(
      PagedSchema(AdminCancellationRequestSchema)
        .parse(openOnly.json())
        .items.map((r) => r.id),
    ).toEqual([openReq.id]);

    // Không tham số = KHÔNG lọc ngày (mặc định của vùng), thấy cả ba.
    const all = await app.inject({
      method: 'GET',
      url: '/api/admin/cancellations',
      headers: { cookie: admin },
    });
    expect(PagedSchema(AdminCancellationRequestSchema).parse(all.json()).total).toBe(3);

    // Khoảng ngược là 400, không phải tập rỗng im lặng.
    const reversed = await app.inject({
      method: 'GET',
      url: '/api/admin/cancellations?from=2026-05-31&to=2026-05-01',
      headers: { cookie: admin },
    });
    expect(reversed.statusCode).toBe(400);
  });
});
