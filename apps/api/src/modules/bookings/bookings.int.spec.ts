import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  BookingDetailSchema,
  BookingSchema,
  cancellationDeadline,
  PagedSchema,
  vietnamToday,
} from '@tourism/contract';
import * as catalog from '../../../prisma/fixtures/catalog/index.js';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  BookingStatus,
  CancellationRequestStatus,
  DepartureStatus,
  MediaOwnerType,
} from '../../generated/prisma/enums.js';
import { FakeGateway } from '../payments/fake.gateway.js';
import { BookingsService } from './bookings.service.js';

/**
 * Integration (Docker PG, db tourism_test — xem vitest.int.config.ts).
 * Money-path W1: create PENDING qua API thật với FakeGateway (NODE_ENV=test →
 * PaymentsModule provide fake), snapshot đúng, ghế KHÔNG bị trừ (bất biến #1).
 */

const PUBLISHED_SLUG = 'hoi-an-lantern-evening'; // basePrice 39.00 USD
// Roster mới (spec 2026-07-31-tours-catalogue-api-design §3) không còn tour
// nào isPublished:false — mượn tour published thật rồi ép cờ cục bộ (xem
// `unpublishedTour` bên dưới), KHÔNG đụng file fixtures dùng chung cho db:seed.
const UNPUBLISHED_SLUG = 'hanoi-old-quarter-food-night';
const PASSWORD = 'password-123';

const pick = (slug: string) => {
  const tour = catalog.tours.find((t) => t.slug === slug);
  if (!tour) throw new Error(`fixture tour missing: ${slug}`);
  return tour;
};

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

describe('bookings integration (create PENDING + FakeGateway)', () => {
  let app: NestFastifyApplication;
  let fake: FakeGateway;

  const dayTour = pick(PUBLISHED_SLUG);
  const unpublishedTour = { ...pick(UNPUBLISHED_SLUG), isPublished: false };
  const tourIds = new Set([dayTour.id, unpublishedTour.id]);

  const dep = (
    id: string,
    start: Date,
    patch: Partial<Prisma.TourDepartureCreateManyInput> = {},
  ) => ({
    id: `e9100001-0000-4000-8000-00000000000${id}`,
    tourId: dayTour.id,
    startDate: start,
    endDate: new Date(start.getTime() + 86_400_000),
    seatsTotal: 8,
    seatsBooked: 3, // còn 5 — seat đã book sẵn để chứng minh create không đụng vào chúng
    status: DepartureStatus.OPEN,
    ...patch,
  });
  const future60 = new Date(Date.now() + 60 * 86_400_000);
  const future90 = new Date(Date.now() + 90 * 86_400_000);
  const past10 = new Date(Date.now() - 10 * 86_400_000);
  const depOpen = dep('1', future60);
  const depOverride = dep('2', future90, {
    priceOverride: '59.00',
    seatsTotal: 10,
    seatsBooked: 0,
  });
  const depClosed = dep('3', future60, { status: DepartureStatus.CLOSED });
  const depPast = dep('4', past10);
  const depUnpublished = dep('5', future60, { tourId: unpublishedTour.id });
  // Chốt chặn hạn chót (ADR-0041 §3). Ngày tính từ "hôm nay" GIỜ VIỆT NAM vì
  // `start_date` là ngày lịch VN và server so bằng đúng thước ấy; `vnDay(n)` là
  // 00:00 UTC của ngày VN hôm nay + n, khuôn Prisma dùng cho cột `@db.Date`.
  // Ba ca dưới vẫn đúng nếu file chạy vắt qua nửa đêm giờ VN (mọi ngày lùi một).
  const vnDay = (offset: number) =>
    new Date(Date.parse(`${vietnamToday(new Date())}T00:00:00.000Z`) + offset * 86_400_000);
  // L = 1 → N = 1: khởi hành hôm nay, hạn chót là hôm qua.
  const depToday1d = dep('6', vnDay(0), { endDate: vnDay(0) });
  // L = 4 → N = 7: khởi hành sau 5 ngày, hạn chót đã qua 2 ngày.
  const depLong4d = dep('7', vnDay(5), { endDate: vnDay(8) });
  // L = 2 → N = 3: khởi hành sau 4 ngày, hạn chót là ngày mai.
  const depShort2d = dep('8', vnDay(4), { endDate: vnDay(5) });
  const departures = [
    depOpen,
    depOverride,
    depClosed,
    depPast,
    depUnpublished,
    depToday1d,
    depLong4d,
    depShort2d,
  ];

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE media_assets, tour_categories, destinations, users CASCADE',
    );
    await prisma.tourCategory.createMany({ data: catalog.tourCategories });
    await prisma.destination.createMany({ data: catalog.destinations });
    await prisma.tour.createMany({
      data: [dayTour, unpublishedTour] as unknown as Prisma.TourCreateManyInput[],
    });
    await prisma.tourDestination.createMany({
      data: catalog.tourDestinations.filter((row) => tourIds.has(row.tourId)),
    });
    await prisma.tourDeparture.createMany({ data: departures });
    // Cover cho dayTour (Task 1: tourImage) — role hero, cùng khuôn seed của
    // `posts.int.spec.ts`. unpublishedTour cố ý KHÔNG có media: nó không bao
    // giờ được book (rejected ở create), nên không cần cover.
    await prisma.mediaAsset.create({
      data: {
        publicId: 'tours/hoi-an-hero',
        type: 'IMAGE',
        ownerType: MediaOwnerType.TOUR,
        ownerId: dayTour.id,
        role: 'hero',
      },
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    fake = app.get(FakeGateway);
  });

  beforeEach(async () => {
    // `payment_events` phải kể tên: bảng không có khoá ngoại tới `bookings`
    // (`booking_id` là cột trần) nên CASCADE không với tới. Ca huỷ ghi vào đó
    // dòng `fake_re_N`, mà id của FakeGateway lặp lại ở mọi lượt chạy (bộ đếm
    // về 0 ở mỗi `reset()`) — dòng sót của lượt trước làm lệnh huỷ nổ trùng
    // khoá (provider, event_id) → 500.
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, sessions, accounts, verifications, bookings, payment_events CASCADE',
    );
    fake.reset();
  });

  afterAll(async () => {
    // Ảnh bìa seed ở beforeAll không nằm trong TRUNCATE của file khác
    // (`ownerId` đa hình, không FK) — dọn ở đây để thứ tự file không ảnh
    // hưởng spec chạy sau (vòng vá review 06/09).
    await prisma.$executeRawUnsafe('TRUNCATE TABLE media_assets CASCADE');
    await app.close();
    await prisma.$disconnect();
  });

  /** Sign-up (autoSignIn) → session cookie. */
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

  const createPayload = {
    departureId: depOpen.id,
    numAdults: 2,
    numChildren: 1,
    contactName: 'Alice Nguyen',
    contactEmail: 'alice@example.com',
    paymentProvider: 'STRIPE',
  };

  async function createBooking(cookie: string, payload: Record<string, unknown> = createPayload) {
    return app.inject({
      method: 'POST',
      url: '/api/bookings',
      headers: { cookie },
      payload,
    });
  }

  it('POST /api/bookings creates a PENDING booking with snapshots + checkoutUrl, seats untouched', async () => {
    const cookie = await signUpUser('alice@example.com', 'Alice');
    const res = await createBooking(cookie);
    expect(res.statusCode).toBe(200);

    const body = BookingSchema.parse(res.json());
    expect(body).toMatchObject({
      status: 'PENDING',
      tourTitle: dayTour.title,
      tourSlug: dayTour.slug,
      departureStartDate: future60.toISOString().slice(0, 10),
      currency: 'USD',
      numAdults: 2,
      numChildren: 1,
      contactPhone: null,
      specialRequests: null,
      paymentProvider: 'STRIPE',
      paidAt: null,
      cancelledAt: null,
    });
    // Task 1 (khu Trips T6/T7): tourImage = cover role hero đã seed cho dayTour.
    expect(body.tourImage?.role).toBe('hero');
    expect(body.tourImage?.url).toContain('/image/upload/f_auto,q_auto/tours/hoi-an-hero');
    // Passport (spec 11/08 §3.1): snapshot đích đến từ seed — dayTour gắn đúng
    // MỘT destination Hội An primary, assert GIÁ TRỊ chứ không chỉ shape.
    expect(body.tourDestinations).toEqual([{ slug: 'hoi-an', name: 'Hội An', isPrimary: true }]);
    expect(Number(body.unitPrice)).toBe(39);
    expect(Number(body.totalAmount)).toBe(117); // 39.00 × (2 người lớn + 1 trẻ em)
    // Money API response phải là chuỗi 2 chữ số thập phân ("117.00", KHÔNG "117")
    // — khớp serializer money toàn repo. So-bằng-Number ở trên không thấy mất format.
    expect(body.totalAmount).toMatch(/^\d+\.\d{2}$/);

    // checkoutUrl đến từ session của FakeGateway, sinh ra với số tiền chính xác.
    const session = fake.sessionFor(body.id);
    expect(session).toBeDefined();
    expect(body.checkoutUrl).toBe(session?.checkoutUrl);
    expect(session?.input).toMatchObject({
      code: body.code,
      amount: '117.00',
      currency: 'USD',
    });

    // DB row: PENDING, snapshot đã đóng băng, provider session được lưu.
    const row = await prisma.booking.findUnique({ where: { code: body.code } });
    expect(row).toMatchObject({
      status: BookingStatus.PENDING,
      tourId: dayTour.id,
      departureId: depOpen.id,
      tourTitle: dayTour.title,
      providerSessionId: session?.sessionId,
      providerPaymentId: null,
    });
    expect(row?.unitPrice.toFixed(2)).toBe('39.00');
    expect(row?.totalAmount.toFixed(2)).toBe('117.00');

    // Invariant #1 (spec §4): PENDING KHÔNG giữ seat nào.
    const after = await prisma.tourDeparture.findUnique({
      where: { id: depOpen.id },
    });
    expect(after?.seatsBooked).toBe(3);
  });

  it('W1: provider chưa cấu hình → 502 CHECKOUT_FAILED, KHÔNG có PENDING mồ côi', async () => {
    // Env test chỉ đăng ký FakeGateway STRIPE — PAYPAL là provider "chưa cấu
    // hình". Trước W1 resolveGateway đứng SAU insert: khách nhận 500 mù và một
    // booking PENDING mồ côi nằm lại DB.
    const cookie = await signUpUser('no-paypal@example.com');
    const res = await createBooking(cookie, { ...createPayload, paymentProvider: 'PAYPAL' });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ code: 'CHECKOUT_FAILED' });
    expect(await prisma.booking.count()).toBe(0);
  });

  it('BK-1: gateway lỗi lúc create → 502 CHECKOUT_FAILED, booking PENDING; re-checkout mint session', async () => {
    const cookie = await signUpUser('bk1@example.com');
    fake.failCheckout = true;
    const failed = await createBooking(cookie);
    expect(failed.statusCode).toBe(502);
    expect(failed.json()).toMatchObject({ code: 'CHECKOUT_FAILED' });

    // Booking PENDING đã tồn tại (owner thấy được) nhưng chưa có session.
    const list = await app.inject({ method: 'GET', url: '/api/bookings', headers: { cookie } });
    const code = list.json().items[0].code;
    expect(list.json().items[0].status).toBe('PENDING');

    // Re-checkout mint lại session cho PENDING của chính chủ.
    fake.failCheckout = false;
    const retry = await app.inject({
      method: 'POST',
      url: `/api/bookings/${code}/checkout`,
      headers: { cookie },
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.json().checkoutUrl).toMatch(/^https:\/\/checkout\.fake\.local\//);

    // Re-checkout trên booking KHÔNG PENDING → 422 NOT_PENDING; người khác → 404.
    const paid = await createBooking(cookie);
    const paidCode = paid.json().code;
    await prisma.booking.update({
      where: { code: paidCode },
      data: { status: BookingStatus.PAID },
    });
    const onPaid = await app.inject({
      method: 'POST',
      url: `/api/bookings/${paidCode}/checkout`,
      headers: { cookie },
    });
    expect(onPaid.statusCode).toBe(422);
    expect(onPaid.json()).toMatchObject({ code: 'NOT_PENDING' });

    const mallory = await signUpUser('mallory-bk1@example.com');
    const foreign = await app.inject({
      method: 'POST',
      url: `/api/bookings/${code}/checkout`,
      headers: { cookie: mallory },
    });
    expect(foreign.statusCode).toBe(404);
  });

  /**
   * ADR-0006 AMEND 1a — reCheckout không mint chồng session: mỗi booking chỉ
   * một session SỐNG. Hai session sống là cửa double charge (khách mở hai tab,
   * cả hai trang thanh toán cùng thu được tiền).
   */
  describe('vòng đời checkout session (ADR-0006 AMEND 1a)', () => {
    const postCheckout = (cookie: string, code: string) =>
      app.inject({ method: 'POST', url: `/api/bookings/${code}/checkout`, headers: { cookie } });

    it('create lưu URL + hạn session; reCheckout khi session còn sống → trả LẠI session hiện có, không mint', async () => {
      const cookie = await signUpUser('session-reuse@example.com');
      const body = (await createBooking(cookie)).json();
      expect(fake.sessions).toHaveLength(1);
      const s1 = fake.sessions[0];

      // Mint lúc create phải persist đủ bộ url + hạn — không lưu thì "trả
      // session hiện có" là bất khả thi hành.
      const created = await prisma.booking.findUniqueOrThrow({ where: { code: body.code } });
      expect(created.checkoutSessionUrl).toBe(s1?.checkoutUrl);
      expect(created.checkoutSessionExpiresAt?.getTime()).toBeGreaterThan(Date.now());

      const retry = await postCheckout(cookie, body.code);
      expect(retry.statusCode).toBe(200);
      expect(retry.json().checkoutUrl).toBe(s1?.checkoutUrl);
      expect(fake.sessions).toHaveLength(1); // KHÔNG mint session thứ hai
      expect(fake.expiredSessions).toHaveLength(0);
      const row = await prisma.booking.findUniqueOrThrow({ where: { code: body.code } });
      expect(row.providerSessionId).toBe(s1?.sessionId);
    });

    it('session HẾT HẠN → expireSession session cũ ở provider rồi mới mint session mới', async () => {
      const cookie = await signUpUser('session-expired@example.com');
      const body = (await createBooking(cookie)).json();
      const s1 = fake.sessions[0];
      // Lùi hạn về quá khứ — như thể khách quay lại sau 61 phút.
      await prisma.booking.update({
        where: { code: body.code },
        data: { checkoutSessionExpiresAt: new Date(Date.now() - 1000) },
      });

      const retry = await postCheckout(cookie, body.code);
      expect(retry.statusCode).toBe(200);
      expect(fake.expiredSessions).toEqual([s1?.sessionId]);
      expect(fake.sessions).toHaveLength(2);
      const s2 = fake.sessions[1];
      expect(retry.json().checkoutUrl).toBe(s2?.checkoutUrl);
      const row = await prisma.booking.findUniqueOrThrow({ where: { code: body.code } });
      expect(row.providerSessionId).toBe(s2?.sessionId);
      expect(row.checkoutSessionUrl).toBe(s2?.checkoutUrl);
      expect(row.checkoutSessionExpiresAt?.getTime()).toBeGreaterThan(Date.now());
    });

    it('session còn dưới lề 5′ → coi như hết sống: mint mới, không trả một trang thanh toán sắp chết', async () => {
      const cookie = await signUpUser('session-margin@example.com');
      const body = (await createBooking(cookie)).json();
      await prisma.booking.update({
        where: { code: body.code },
        data: { checkoutSessionExpiresAt: new Date(Date.now() + 2 * 60_000) },
      });
      const retry = await postCheckout(cookie, body.code);
      expect(retry.statusCode).toBe(200);
      expect(fake.sessions).toHaveLength(2);
      expect(retry.json().checkoutUrl).toBe(fake.sessions[1]?.checkoutUrl);
    });

    it('expireSession NÉM (Stripe từ chối session không còn open) → vẫn mint, best-effort đúng nghĩa', async () => {
      const cookie = await signUpUser('session-expire-fails@example.com');
      const body = (await createBooking(cookie)).json();
      await prisma.booking.update({
        where: { code: body.code },
        data: { checkoutSessionExpiresAt: new Date(Date.now() - 1000) },
      });
      fake.failExpireSession = true;
      const retry = await postCheckout(cookie, body.code);
      expect(retry.statusCode).toBe(200);
      expect(fake.sessions).toHaveLength(2);
      const row = await prisma.booking.findUniqueOrThrow({ where: { code: body.code } });
      expect(row.providerSessionId).toBe(fake.sessions[1]?.sessionId);
    });

    it('ADR-0009 AMEND 2: reCheckout trên chuyến đã CLOSED → 400 DEPARTURE_NOT_AVAILABLE, không mint', async () => {
      // Mint trang thanh toán cho booking mà claim chắc chắn từ chối là mời
      // khách trả một khoản sẽ bị auto-refund.
      const cookie = await signUpUser('session-closed-dep@example.com');
      const body = (await createBooking(cookie)).json();
      await prisma.booking.update({
        where: { code: body.code },
        data: { checkoutSessionExpiresAt: new Date(Date.now() - 1000) },
      });
      await prisma.tourDeparture.update({
        where: { id: depOpen.id },
        data: { status: DepartureStatus.CLOSED },
      });
      try {
        const retry = await postCheckout(cookie, body.code);
        expect(retry.statusCode).toBe(400);
        expect(retry.json()).toMatchObject({ code: 'DEPARTURE_NOT_AVAILABLE' });
        expect(fake.sessions).toHaveLength(1);
      } finally {
        await prisma.tourDeparture.update({
          where: { id: depOpen.id },
          data: { status: DepartureStatus.OPEN },
        });
      }
    });

    it('booking cũ trước migration (không có URL/hạn) → coi như hết sống: expire best-effort + mint mới', async () => {
      const cookie = await signUpUser('session-legacy@example.com');
      const body = (await createBooking(cookie)).json();
      const s1 = fake.sessions[0];
      await prisma.booking.update({
        where: { code: body.code },
        data: { checkoutSessionUrl: null, checkoutSessionExpiresAt: null },
      });

      const retry = await postCheckout(cookie, body.code);
      expect(retry.statusCode).toBe(200);
      expect(fake.expiredSessions).toEqual([s1?.sessionId]);
      expect(fake.sessions).toHaveLength(2);
      expect(retry.json().checkoutUrl).toBe(fake.sessions[1]?.checkoutUrl);
    });
  });

  it('BK-2: chủ tự hủy PENDING → CANCELLED (không refund); lặp lại/PAID → 422; non-owner → 404', async () => {
    const alice = await signUpUser('bk2@example.com');
    const code = (await createBooking(alice)).json().code;

    const res = await app.inject({
      method: 'POST',
      url: `/api/bookings/${code}/cancel-pending`,
      headers: { cookie: alice },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('CANCELLED');
    expect(res.json().cancelledAt).not.toBeNull();
    // AMEND 2b: huỷ là vô hiệu luôn session ở provider và xoá URL — tab Stripe
    // còn mở không được thu tiền của một booking đã huỷ.
    expect(fake.expiredSessions).toEqual([fake.sessions[0]?.sessionId]);
    const cancelledRow = await prisma.booking.findUniqueOrThrow({ where: { code } });
    expect(cancelledRow.checkoutSessionUrl).toBeNull();
    expect(cancelledRow.checkoutSessionExpiresAt).toBeNull();

    // Hủy lại (đã CANCELLED) → 422 NOT_PENDING.
    const again = await app.inject({
      method: 'POST',
      url: `/api/bookings/${code}/cancel-pending`,
      headers: { cookie: alice },
    });
    expect(again.statusCode).toBe(422);
    expect(again.json()).toMatchObject({ code: 'NOT_PENDING' });

    // Booking PAID → 422 (không phải đường tự-hủy PENDING).
    const paidCode = (await createBooking(alice)).json().code;
    await prisma.booking.update({
      where: { code: paidCode },
      data: { status: BookingStatus.PAID },
    });
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/bookings/${paidCode}/cancel-pending`,
          headers: { cookie: alice },
        })
      ).statusCode,
    ).toBe(422);

    // Người khác → 404 (owner-or-404, không lộ tồn tại).
    const foreignCode = (await createBooking(alice)).json().code;
    const mallory = await signUpUser('mallory-bk2@example.com');
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/bookings/${foreignCode}/cancel-pending`,
          headers: { cookie: mallory },
        })
      ).statusCode,
    ).toBe(404);
  });

  it('departure priceOverride wins over tour basePrice in the snapshot', async () => {
    const cookie = await signUpUser('override@example.com');
    const res = await createBooking(cookie, {
      ...createPayload,
      departureId: depOverride.id,
      numChildren: 0,
    });
    expect(res.statusCode).toBe(200);
    const body = BookingSchema.parse(res.json());
    expect(Number(body.unitPrice)).toBe(59);
    expect(Number(body.totalAmount)).toBe(118); // 59.00 × 2 người lớn
  });

  it('CLOSED / past / unpublished-tour departures → 400 DEPARTURE_NOT_AVAILABLE', async () => {
    const cookie = await signUpUser('deny@example.com');
    for (const departureId of [
      depClosed.id,
      depPast.id,
      depUnpublished.id,
      'e9100001-dead-4000-8000-000000000000', // không tồn tại
    ]) {
      const res = await createBooking(cookie, {
        ...createPayload,
        departureId,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'DEPARTURE_NOT_AVAILABLE' });
    }
    expect(await prisma.booking.count()).toBe(0);
    expect(fake.sessions).toHaveLength(0);
  });

  describe('chốt chặn hạn chót đặt chỗ (ADR-0041 §3)', () => {
    const postCheckout = (cookie: string, code: string) =>
      app.inject({ method: 'POST', url: `/api/bookings/${code}/checkout`, headers: { cookie } });

    it('create chặn chuyến đã qua hạn chót: tour 1 ngày khởi hành hôm nay, tour 4 ngày còn 5 ngày', async () => {
      const cookie = await signUpUser('deadline-passed@example.com');
      for (const departureId of [depToday1d.id, depLong4d.id]) {
        const res = await createBooking(cookie, { ...createPayload, departureId });
        expect(res.statusCode, departureId).toBe(400);
        expect(res.json()).toMatchObject({ code: 'DEPARTURE_NOT_AVAILABLE' });
      }
      // Chặn TRƯỚC insert và trước khi gọi provider: không PENDING, không session.
      expect(await prisma.booking.count()).toBe(0);
      expect(fake.sessions).toHaveLength(0);
    });

    it('create vẫn nhận chuyến còn trong hạn: tour 2 ngày còn 4 ngày, hạn chót ngày mai', async () => {
      const cookie = await signUpUser('deadline-open@example.com');
      const res = await createBooking(cookie, { ...createPayload, departureId: depShort2d.id });
      expect(res.statusCode).toBe(200);
      expect(BookingSchema.parse(res.json()).status).toBe('PENDING');
    });

    it('"Pay again" trên PENDING khi chuyến đã qua hạn chót → 400, kể cả session cũ còn sống', async () => {
      const cookie = await signUpUser('deadline-checkout@example.com');
      const body = (
        await createBooking(cookie, { ...createPayload, departureId: depShort2d.id })
      ).json();
      // Như thể hai ngày đã trôi: dời chuyến lại gần thay vì chỉnh đồng hồ —
      // L = 2 → N = 3, khởi hành sau 2 ngày thì hạn chót là hôm qua.
      await prisma.tourDeparture.update({
        where: { id: depShort2d.id },
        data: { startDate: vnDay(2), endDate: vnDay(3) },
      });
      try {
        const retry = await postCheckout(cookie, body.code);
        expect(retry.statusCode).toBe(400);
        expect(retry.json()).toMatchObject({ code: 'DEPARTURE_NOT_AVAILABLE' });
        // Session của lần create chưa hết hạn, nhưng chốt chặn đứng TRƯỚC nhánh
        // trả lại session: sau hạn chót không mở lại trang thanh toán nào.
        expect(fake.sessions).toHaveLength(1);
      } finally {
        await prisma.tourDeparture.update({
          where: { id: depShort2d.id },
          data: { startDate: depShort2d.startDate, endDate: depShort2d.endDate },
        });
      }
    });

    it('"Pay again" cũng chặn khi tour đã gỡ publish — cùng một chốt chặn với create', async () => {
      const cookie = await signUpUser('unpublished-checkout@example.com');
      const body = (await createBooking(cookie)).json();
      await prisma.tour.update({ where: { id: dayTour.id }, data: { isPublished: false } });
      try {
        const retry = await postCheckout(cookie, body.code);
        expect(retry.statusCode).toBe(400);
        expect(retry.json()).toMatchObject({ code: 'DEPARTURE_NOT_AVAILABLE' });
        expect(fake.sessions).toHaveLength(1);
      } finally {
        await prisma.tour.update({ where: { id: dayTour.id }, data: { isPublished: true } });
      }
    });

    it('claim vẫn nhận thanh toán của PENDING đã qua hạn chót khi chuyến chưa khởi hành (spec §3.2)', async () => {
      // Chốt chặn chỉ đứng ở create/checkout. Thanh toán đang dở lúc hạn chót
      // trôi qua vẫn được nhận — nới cho khách thay vì thu tiền rồi tự hoàn.
      const cookie = await signUpUser('deadline-claim@example.com');
      const body = (
        await createBooking(cookie, { ...createPayload, departureId: depShort2d.id })
      ).json();
      // Dời NGÀY CỦA CHUYẾN là cách duy nhất giả lập "hạn chót đã trôi qua" mà
      // không phải vặn đồng hồ — nhưng phải dời CẢ bản sao trên booking, nếu
      // không thì ta đang giả lập nhầm một chuyện KHÁC: chuyến bị dời ngày
      // (ADR-0009 AMEND 4), và gate claim sẽ trả `departure-moved` đúng như nó
      // phải làm. §3.2 nói về ĐỒNG HỒ chạy tới, không nói về lịch bị sửa.
      const newStart = vnDay(2);
      const newEnd = vnDay(3);
      await prisma.tourDeparture.update({
        where: { id: depShort2d.id },
        data: { startDate: newStart, endDate: newEnd },
      });
      await prisma.booking.update({
        where: { id: body.id },
        data: { departureStartDate: newStart, departureEndDate: newEnd },
      });
      try {
        const outcome = await app
          .get(BookingsService)
          .claimSeatsForPaid(body.id, 'pi_after_deadline');
        expect(outcome).toBe('claimed');
        const row = await prisma.booking.findUniqueOrThrow({ where: { id: body.id } });
        expect(row.status).toBe(BookingStatus.PAID);
      } finally {
        // Trả chuyến về nguyên trạng cho các test sau (ngày, ghế vừa claim) và gỡ
        // dòng outbox xác nhận mà claim vừa xếp — file này không truncate outbox.
        await prisma.tourDeparture.update({
          where: { id: depShort2d.id },
          data: {
            startDate: depShort2d.startDate,
            endDate: depShort2d.endDate,
            seatsBooked: depShort2d.seatsBooked,
          },
        });
        await prisma.outbox.deleteMany({ where: { dedupeKey: `booking-confirmed:${body.id}` } });
      }
    });
  });

  it('W1: party vượt maxGroupSize của tour → 422 PARTY_TOO_LARGE (trước cả soft seat check)', async () => {
    // dayTour.maxGroupSize = 16 (fixture). Trước W1 trần này chỉ ép ở trình
    // duyệt — một POST thẳng book được cả đoàn 30 người lên tour 16 chỗ nếu
    // departure còn ghế.
    const cookie = await signUpUser('party-too-large@example.com');
    const res = await createBooking(cookie, {
      ...createPayload,
      numAdults: 17,
      numChildren: 0,
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ code: 'PARTY_TOO_LARGE' });
    expect(await prisma.booking.count()).toBe(0); // không PENDING mồ côi
    // Trẻ em TÍNH VÀO trần nhóm: 10 + 7 = 17 > 16.
    const withChildren = await createBooking(cookie, {
      ...createPayload,
      numAdults: 10,
      numChildren: 7,
    });
    expect(withChildren.statusCode).toBe(422);
    expect(withChildren.json()).toMatchObject({ code: 'PARTY_TOO_LARGE' });

    // Đúng trần (16) thì không bị luật này chặn — nó rơi tiếp xuống seat
    // check (departure chỉ còn 5 ghế → SEATS_UNAVAILABLE, không phải 422).
    const atCap = await createBooking(cookie, {
      ...createPayload,
      numAdults: 16,
      numChildren: 0,
    });
    expect(atCap.statusCode).toBe(409);
    expect(atCap.json()).toMatchObject({ code: 'SEATS_UNAVAILABLE' });
  });

  it('party larger than seats left → 409 SEATS_UNAVAILABLE (soft check)', async () => {
    const cookie = await signUpUser('greedy@example.com');
    const res = await createBooking(cookie, {
      ...createPayload,
      numAdults: 5,
      numChildren: 1,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'SEATS_UNAVAILABLE' });
    expect(await prisma.booking.count()).toBe(0);
  });

  it('invalid input (0 adults / bad provider) → 400 before any business logic', async () => {
    const cookie = await signUpUser('invalid@example.com');
    expect((await createBooking(cookie, { ...createPayload, numAdults: 0 })).statusCode).toBe(400);
    expect(
      (
        await createBooking(cookie, {
          ...createPayload,
          paymentProvider: 'BITCOIN',
        })
      ).statusCode,
    ).toBe(400);
    expect(fake.sessions).toHaveLength(0);
  });

  it('unauthenticated calls → 401 on all three procedures', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/bookings',
      payload: createPayload,
    });
    expect(create.statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/bookings' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/bookings/BK-AAAA1111' })).statusCode).toBe(
      401,
    );
    expect(await prisma.booking.count()).toBe(0);
  });

  it('GET /api/bookings returns OWN bookings only, paged, with status filter', async () => {
    const alice = await signUpUser('alice2@example.com', 'Alice');
    const bob = await signUpUser('bob@example.com', 'Bob');
    const first = BookingSchema.parse((await createBooking(alice)).json());
    const second = BookingSchema.parse(
      (
        await createBooking(alice, {
          ...createPayload,
          departureId: depOverride.id,
        })
      ).json(),
    );
    BookingSchema.parse((await createBooking(bob)).json());

    const res = await app.inject({
      method: 'GET',
      url: '/api/bookings',
      headers: { cookie: alice },
    });
    expect(res.statusCode).toBe(200);
    const paged = PagedSchema(BookingSchema).parse(res.json());
    expect(paged).toMatchObject({
      page: 1,
      limit: 12,
      total: 2,
      totalPages: 1,
    });
    expect(paged.items.map((b) => b.code).sort()).toEqual([first.code, second.code].sort());
    // Read không bao giờ phơi lại checkout redirect.
    expect(paged.items.every((b) => b.checkoutUrl === null)).toBe(true);
    // Task 1 (khu Trips T6/T7): mỗi item mang đúng tourSlug + tourImage của
    // dayTour (cover role hero đã seed) — batch resolve, không N+1.
    expect(paged.items.every((b) => b.tourSlug === dayTour.slug)).toBe(true);
    expect(
      paged.items.every((b) => b.tourImage?.url.includes('/f_auto,q_auto/tours/hoi-an-hero')),
    ).toBe(true);
    // Passport: đường LIST cũng mang snapshot đích đến đúng giá trị seed
    // (đi qua cùng bookingTourInclude — không lệch với byCode).
    expect(
      paged.items.every(
        (b) =>
          b.tourDestinations.length === 1 &&
          b.tourDestinations[0]?.slug === 'hoi-an' &&
          b.tourDestinations[0]?.isPrimary === true,
      ),
    ).toBe(true);

    const paid = PagedSchema(BookingSchema).parse(
      (
        await app.inject({
          method: 'GET',
          url: '/api/bookings?status=PAID',
          headers: { cookie: alice },
        })
      ).json(),
    );
    expect(paid.total).toBe(0);
  });

  it('GET /api/bookings/{code} is owner-or-404', async () => {
    const alice = await signUpUser('alice3@example.com', 'Alice');
    const bob = await signUpUser('bob3@example.com', 'Bob');
    const created = BookingSchema.parse((await createBooking(alice)).json());

    const own = await app.inject({
      method: 'GET',
      url: `/api/bookings/${created.code}`,
      headers: { cookie: alice },
    });
    expect(own.statusCode).toBe(200);
    const body = BookingSchema.parse(own.json());
    expect(body.code).toBe(created.code);
    expect(body.checkoutUrl).toBeNull();
    // Task 1 (khu Trips T6/T7): byCode cũng mang tourSlug + tourImage.
    expect(body.tourSlug).toBe(dayTour.slug);
    expect(body.tourImage?.url).toContain('/f_auto,q_auto/tours/hoi-an-hero');

    // Code của user khác → 404 (không lộ sự tồn tại), code bịa ra cũng vậy.
    for (const [cookie, code] of [
      [bob, created.code],
      [alice, 'BK-ZZZZ9999'],
    ] as const) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/bookings/${code}`,
        headers: { cookie },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({
        code: 'NOT_FOUND',
        message: 'Booking not found',
      });
    }
  });

  // Task 6a (A2, user duyệt 06/08): byCode trả kèm `cancellationStatus` —
  // request MỚI NHẤT theo booking, null nếu chưa từng xin.
  it('GET /api/bookings/{code}: cancellationStatus null trước khi huỷ, REFUNDED sau khi khách tự huỷ (ADR-0041)', async () => {
    const alice = await signUpUser('alice-cancel-status@example.com', 'Alice');
    const created = (await createBooking(alice)).json();
    // Mô phỏng claim PAID như webhook thật: có capture để hoàn vào (lõi huỷ chặn
    // booking không có provider_payment_id) và ghế đã được đếm — để lượt nhả
    // ghế khi huỷ trả depOpen về đúng 3 cho các test sau.
    await prisma.booking.update({
      where: { code: created.code },
      data: {
        status: BookingStatus.PAID,
        paidAt: new Date(),
        providerPaymentId: 'fake_pi_cancel_status',
      },
    });
    await prisma.tourDeparture.update({
      where: { id: depOpen.id },
      data: { seatsBooked: { increment: 3 } },
    });

    const beforeJson = (
      await app.inject({
        method: 'GET',
        url: `/api/bookings/${created.code}`,
        headers: { cookie: alice },
      })
    ).json() as { cancellation: { refundAmount: string } | null };
    const before = BookingSchema.parse(beforeJson);
    expect(before.cancellationStatus).toBeNull();

    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/bookings/${created.code}/cancel`,
      headers: { cookie: alice },
      // Số hộp xác nhận in — y như web gửi kèm lệnh huỷ.
      payload: {
        reason: 'Change of plans',
        expectedRefundAmount: beforeJson.cancellation?.refundAmount,
      },
    });
    expect(cancelRes.statusCode).toBe(200);

    const after = BookingSchema.parse(
      (
        await app.inject({
          method: 'GET',
          url: `/api/bookings/${created.code}`,
          headers: { cookie: alice },
        })
      ).json(),
    );
    expect(after.status).toBe('CANCELLED');
    // Huỷ ngay vẫn ghi MỘT dòng yêu cầu đã giải quyết (REFUNDED), kể cả khi hoàn 0.
    expect(after.cancellationStatus).toBe('REFUNDED');
    const departure = await prisma.tourDeparture.findUniqueOrThrow({ where: { id: depOpen.id } });
    expect(departure.seatsBooked).toBe(3);
  });

  it('GET /api/bookings/{code}: cancellationStatus phản ánh request MỚI NHẤT (DENIED rồi REQUESTED)', async () => {
    const alice = await signUpUser('alice-cancel-denied@example.com', 'Alice');
    const created = (await createBooking(alice)).json();
    await prisma.booking.update({
      where: { code: created.code },
      data: { status: BookingStatus.PAID },
    });
    const aliceRow = await prisma.user.findUniqueOrThrow({
      where: { email: 'alice-cancel-denied@example.com' },
    });

    // `bookings.cancel` không còn tạo yêu cầu REQUESTED/DENIED (ADR-0041), nhưng
    // dữ liệu cũ kiểu này vẫn nằm trên prod tới lượt seed lại — dựng thẳng bằng
    // Prisma. Lùi createdAt để dòng DENIED CHẮC CHẮN là dòng cũ nhất.
    const denied = await prisma.cancellationRequest.create({
      data: {
        bookingId: created.id as string,
        userId: aliceRow.id,
        reason: 'Change of plans',
        status: CancellationRequestStatus.DENIED,
        decidedAt: new Date(),
        createdAt: new Date(Date.now() - 60_000),
      },
    });

    const afterDeny = BookingSchema.parse(
      (
        await app.inject({
          method: 'GET',
          url: `/api/bookings/${created.code}`,
          headers: { cookie: alice },
        })
      ).json(),
    );
    expect(afterDeny.cancellationStatus).toBe('DENIED');

    // Booking giờ có HAI dòng: DENIED cũ + REQUESTED mới (createdAt = now). Đây là
    // bằng chứng khoá mệnh đề `orderBy createdAt desc` trong
    // `bookings.service.ts#byCode` — đảo thành `asc` thì `findFirst` trả dòng
    // DENIED và assertion `toBe('REQUESTED')` bên dưới phải ĐỎ.
    const reopened = await prisma.cancellationRequest.create({
      data: { bookingId: created.id as string, userId: aliceRow.id, reason: 'Asking again' },
    });
    expect(reopened.id).not.toBe(denied.id);

    const rows = await prisma.cancellationRequest.findMany({
      where: { bookingId: created.id as string },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows.map((r) => r.status)).toEqual([
      CancellationRequestStatus.DENIED,
      CancellationRequestStatus.REQUESTED,
    ]);

    const afterReRequest = BookingSchema.parse(
      (
        await app.inject({
          method: 'GET',
          url: `/api/bookings/${created.code}`,
          headers: { cookie: alice },
        })
      ).json(),
    );
    expect(afterReRequest.cancellationStatus).toBe('REQUESTED');
  });

  it('ADR-0041: byCode trả cancellation do SERVER tính — PENDING/CANCELLED null, trong hạn hoàn đủ, PARTIALLY_REFUNDED phần còn lại, ngày khởi hành hết huỷ', async () => {
    const cookie = await signUpUser('cancellation-shape@example.com');
    const created = (await createBooking(cookie)).json() as { id: string; code: string };
    const read = async () =>
      BookingDetailSchema.parse(
        (
          await app.inject({
            method: 'GET',
            url: `/api/bookings/${created.code}`,
            headers: { cookie },
          })
        ).json(),
      );

    // Mọi booking mang ngày chót, tính từ snapshot ngày đi/ngày về.
    const pending = await read();
    expect(pending.cancellationDeadline).toBe(
      cancellationDeadline(pending.departureStartDate, pending.departureEndDate),
    );
    // PENDING: chưa trả tiền → luật huỷ không áp dụng.
    expect(pending.cancellation).toBeNull();

    // PAID trên depOpen (+60 ngày) → còn trong hạn: hoàn đủ, có nút huỷ.
    await prisma.booking.update({
      where: { id: created.id },
      data: { status: BookingStatus.PAID, paidAt: new Date(), providerPaymentId: 'fake_pi_shape' },
    });
    const paid = await read();
    expect(paid.cancellation).toEqual({
      deadline: paid.cancellationDeadline,
      withinDeadline: true,
      refundAmount: '117.00',
      canCancel: true,
    });

    // PARTIALLY_REFUNDED: số hoàn là phần CÒN LẠI của sổ, không phải tổng tiền.
    await prisma.refund.create({
      data: {
        bookingId: created.id,
        amount: '17.00',
        currency: 'USD',
        providerRefundId: 'fake_re_shape',
        providerPaymentId: 'fake_pi_shape',
      },
    });
    await prisma.booking.update({
      where: { id: created.id },
      data: { status: BookingStatus.PARTIALLY_REFUNDED },
    });
    expect((await read()).cancellation?.refundAmount).toBe('100.00');

    // Không có capture thì không có chỗ hoàn vào → không bày nút huỷ.
    await prisma.booking.update({ where: { id: created.id }, data: { providerPaymentId: null } });
    expect((await read()).cancellation?.canCancel).toBe(false);

    // Đúng ngày khởi hành theo giờ Việt Nam: quá hạn, hoàn 0, hết huỷ online.
    const today = vietnamToday(new Date());
    await prisma.booking.update({
      where: { id: created.id },
      data: {
        providerPaymentId: 'fake_pi_shape',
        departureStartDate: new Date(`${today}T00:00:00.000Z`),
        departureEndDate: new Date(`${today}T00:00:00.000Z`),
      },
    });
    expect((await read()).cancellation).toEqual({
      deadline: cancellationDeadline(today, today),
      withinDeadline: false,
      refundAmount: '0.00',
      canCancel: false,
    });

    // CANCELLED: ngoài luật huỷ online → null.
    await prisma.booking.update({
      where: { id: created.id },
      data: { status: BookingStatus.CANCELLED },
    });
    expect((await read()).cancellation).toBeNull();
  });

  /**
   * Đóng băng giá vốn vào booking (ADR-0033 §3).
   *
   * Cùng lý do với `unit_price` ngay cạnh nó trong cùng khối snapshot (audit
   * H3): join sống thì sửa giá thuê xe hôm nay sẽ VIẾT LẠI lợi nhuận của báo
   * cáo tháng trước, và một báo cáo đọc lại ra số khác là một báo cáo vô dụng.
   */
  describe('snapshot giá vốn', () => {
    const COST_IDS = [
      'e9700001-0000-4000-8000-000000000001',
      'e9700001-0000-4000-8000-000000000002',
      'e9700001-0000-4000-8000-000000000003',
    ];

    async function giveTourCosts(): Promise<void> {
      await prisma.tourCostItem.createMany({
        data: [
          {
            id: COST_IDS[0] as string,
            tourId: dayTour.id,
            category: 'MEALS',
            label: 'Meals and drinks',
            amount: '30.00',
            basis: 'PER_PERSON',
          },
          {
            id: COST_IDS[1] as string,
            tourId: dayTour.id,
            category: 'ACTIVITIES',
            label: 'Entrance tickets',
            amount: '55.00',
            basis: 'PER_PERSON',
          },
          // Vế theo CHUYẾN: KHÔNG được lọt vào snapshot của booking, nó sống ở
          // `tour_departures.fixed_cost_amount`.
          {
            id: COST_IDS[2] as string,
            tourId: dayTour.id,
            category: 'TRANSPORT',
            label: 'Vehicle hire',
            amount: '400.00',
            basis: 'PER_DEPARTURE',
          },
        ],
      });
    }

    afterEach(async () => {
      await prisma.tourCostItem.deleteMany({ where: { tourId: dayTour.id } });
    });

    it('chụp tổng dòng PER_PERSON, KHÔNG cộng vế theo chuyến', async () => {
      await giveTourCosts();
      const alice = await signUpUser('costs-a@tourism.test');
      const created = BookingSchema.parse((await createBooking(alice)).json());

      const row = await prisma.booking.findUniqueOrThrow({
        where: { code: created.code },
        select: { costPerPerson: true },
      });
      // 30.00 + 55.00 = 85.00. Tiền thuê xe 400.00 KHÔNG có mặt.
      expect(row.costPerPerson?.toFixed(2)).toBe('85.00');
    });

    it('sửa giá vốn tour SAU khi đặt không đổi snapshot của booking cũ', async () => {
      await giveTourCosts();
      const alice = await signUpUser('costs-b@tourism.test');
      const created = BookingSchema.parse((await createBooking(alice)).json());

      await prisma.tourCostItem.updateMany({
        where: { tourId: dayTour.id, basis: 'PER_PERSON' },
        data: { amount: '999.00' },
      });

      const row = await prisma.booking.findUniqueOrThrow({
        where: { code: created.code },
        select: { costPerPerson: true },
      });
      expect(row.costPerPerson?.toFixed(2)).toBe('85.00');
    });

    it('tour chưa khai giá vốn thì snapshot NULL, không phải 0', async () => {
      // `0.00` sẽ tự nhận là "tour này không tốn gì" và biến một lỗ hổng dữ
      // liệu thành lợi nhuận; báo cáo đếm null rồi nói ra (ADR-0033 §6).
      const alice = await signUpUser('costs-c@tourism.test');
      const created = BookingSchema.parse((await createBooking(alice)).json());

      const row = await prisma.booking.findUniqueOrThrow({
        where: { code: created.code },
        select: { costPerPerson: true },
      });
      expect(row.costPerPerson).toBeNull();
    });
  });
});
