import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import { createFastifyAdapter } from '../../bootstrap.js';

/**
 * Integration (Docker PG, db tourism_test — xem vitest.int.config.ts).
 * Wishlist P3a-B Task 3: set idempotent (add/remove), list với cờ
 * `unavailable`, check batch — TOÀN BỘ đều cần đăng nhập (ADR-0003, không
 * khai @Public()).
 */

const PASSWORD = 'password-123';

let app: NestFastifyApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  // Dùng createFastifyAdapter() dùng chung với main.ts (trustProxy) thay vì
  // tự new FastifyAdapter() — một nguồn sự thật cho cấu hình adapter.
  app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter(), {
    rawBody: true,
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  // Thứ tự truncate theo chiều phụ thuộc FK.
  await prisma.$executeRawUnsafe(
    'TRUNCATE wishlist, reviews, outbox, bookings, tour_departures, tours, tour_categories, destinations, users, sessions, accounts RESTART IDENTITY CASCADE',
  );
});

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

/** Đăng ký + đăng nhập một customer thường, trả về user row + cookie session. */
async function signUpAndSignIn(app: NestFastifyApplication, email: string) {
  await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: { email, password: PASSWORD, name: 'Test User' },
  });
  // requireEmailVerification (siết 20/08): verify qua DB trước khi đăng nhập.
  await prisma.user.update({ where: { email }, data: { emailVerified: true } });
  const signIn = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    payload: { email, password: PASSWORD },
  });
  const cookie = sessionCookie(signIn);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { user, cookie };
}

/** Dựng một tour đã publish, dùng slug làm khoá phân biệt giữa các test. */
async function createPublishedTour(slug: string) {
  const category = await prisma.tourCategory.create({
    data: { slug: `cat-${slug}`, name: 'Walking', order: 1 },
  });
  return prisma.tour.create({
    data: {
      slug,
      title: 'Hội An Old Town & Lantern Evening',
      categoryId: category.id,
      durationDays: 1,
      basePrice: '39.00',
      currency: 'USD',
      isPublished: true,
    },
  });
}

describe('wishlist (int)', () => {
  it('set({wished:true}) hai lần liên tiếp → cả hai 200, DB đúng MỘT row (idempotent)', async () => {
    const { user, cookie } = await signUpAndSignIn(app, 'wisher@example.com');
    const tour = await createPublishedTour('hoi-an-lantern-evening-1');

    const first = await app.inject({
      method: 'POST',
      url: '/api/wishlist',
      headers: { cookie },
      payload: { tourId: tour.id, wished: true },
    });
    // Sentinel: đẩy createdAt về mốc quá khứ xa TRƯỚC lần set thứ hai. Bất kỳ
    // field nào lọt vào `update: {}` của upsert sau này (vd `createdAt`,
    // `updatedAt`) đều kéo giá trị về NOW() — lệch hàng chục năm nên oracle
    // không phụ thuộc hai lần ghi có rơi vào hai millisecond khác nhau.
    // createdAt QUYẾT ĐỊNH thứ tự list (orderBy createdAt desc), nên ghi đè nó
    // là đẩy tour cũ lên đầu wishlist mà không ai bấm gì.
    const sentinel = new Date('2000-01-01T00:00:00.000Z');
    await prisma.$executeRaw`UPDATE wishlist SET created_at = ${sentinel} WHERE user_id = ${user.id}::uuid AND tour_id = ${tour.id}::uuid`;

    const second = await app.inject({
      method: 'POST',
      url: '/api/wishlist',
      headers: { cookie },
      payload: { tourId: tour.id, wished: true },
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(await prisma.wishlist.count({ where: { userId: user.id, tourId: tour.id } })).toBe(1);
    const row = await prisma.wishlist.findFirstOrThrow({
      where: { userId: user.id, tourId: tour.id },
    });
    expect(row.createdAt).toEqual(sentinel);
  });

  it('set({wished:false}) cho tour chưa từng lưu → 200, không 404 (no-op)', async () => {
    const { cookie } = await signUpAndSignIn(app, 'wisher2@example.com');
    const tour = await createPublishedTour('hoi-an-lantern-evening-2');

    const res = await app.inject({
      method: 'POST',
      url: '/api/wishlist',
      headers: { cookie },
      payload: { tourId: tour.id, wished: false },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ tourId: tour.id, wished: false });
  });

  it('set với tour chưa publish → TOUR_NOT_FOUND', async () => {
    const { cookie } = await signUpAndSignIn(app, 'wisher3@example.com');
    const category = await prisma.tourCategory.create({
      data: { slug: 'cat-draft', name: 'Draft', order: 1 },
    });
    const draft = await prisma.tour.create({
      data: {
        slug: 'chua-xuat-ban',
        title: 'Tour chưa xuất bản',
        categoryId: category.id,
        durationDays: 1,
        basePrice: '39.00',
        currency: 'USD',
        isPublished: false,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/wishlist',
      headers: { cookie },
      payload: { tourId: draft.id, wished: true },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('TOUR_NOT_FOUND');
  });

  it('list chỉ trả wishlist của chính mình, không lẫn của user khác, mới nhất trước', async () => {
    const mine = await signUpAndSignIn(app, 'list-mine@example.com');
    const other = await signUpAndSignIn(app, 'list-other@example.com');
    const tourA = await createPublishedTour('list-tour-a');
    const tourB = await createPublishedTour('list-tour-b');

    // Lưu tourA trước, rồi tourB sau — tourB phải lên đầu (mới nhất trước).
    await app.inject({
      method: 'POST',
      url: '/api/wishlist',
      headers: { cookie: mine.cookie },
      payload: { tourId: tourA.id, wished: true },
    });
    await app.inject({
      method: 'POST',
      url: '/api/wishlist',
      headers: { cookie: mine.cookie },
      payload: { tourId: tourB.id, wished: true },
    });
    // Wishlist của người khác — không được lẫn vào kết quả của `mine`.
    await app.inject({
      method: 'POST',
      url: '/api/wishlist',
      headers: { cookie: other.cookie },
      payload: { tourId: tourA.id, wished: true },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/wishlist',
      headers: { cookie: mine.cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0].tourId).toBe(tourB.id);
    expect(body.items[1].tourId).toBe(tourA.id);
    expect(body.total).toBe(2);
  });

  it('list trả unavailable:true cho tour đã bị unpublish sau khi lưu', async () => {
    const { cookie } = await signUpAndSignIn(app, 'list-unavail@example.com');
    const tour = await createPublishedTour('list-tour-unavail');

    await app.inject({
      method: 'POST',
      url: '/api/wishlist',
      headers: { cookie },
      payload: { tourId: tour.id, wished: true },
    });
    // Admin/hệ thống unpublish tour SAU khi khách đã lưu.
    await prisma.tour.update({ where: { id: tour.id }, data: { isPublished: false } });

    const res = await app.inject({ method: 'GET', url: '/api/wishlist', headers: { cookie } });

    const items = res.json().items;
    expect(items).toHaveLength(1);
    expect(items[0].unavailable).toBe(true);
  });

  it('check batch trả đúng tập con đã lưu; gọi ẩn danh mọi endpoint → 401', async () => {
    const { cookie } = await signUpAndSignIn(app, 'checker@example.com');
    const wished = await createPublishedTour('check-tour-wished');
    const notWished = await createPublishedTour('check-tour-not-wished');

    await app.inject({
      method: 'POST',
      url: '/api/wishlist',
      headers: { cookie },
      payload: { tourId: wished.id, wished: true },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/wishlist/check',
      headers: { cookie },
      payload: { tourIds: [wished.id, notWished.id] },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().wishedTourIds).toEqual([wished.id]);

    // Ẩn danh (không cookie) → 401 trên CẢ BA endpoint.
    const anonSet = await app.inject({
      method: 'POST',
      url: '/api/wishlist',
      payload: { tourId: wished.id, wished: true },
    });
    const anonList = await app.inject({ method: 'GET', url: '/api/wishlist' });
    const anonCheck = await app.inject({
      method: 'POST',
      url: '/api/wishlist/check',
      payload: { tourIds: [wished.id] },
    });

    expect(anonSet.statusCode).toBe(401);
    expect(anonList.statusCode).toBe(401);
    expect(anonCheck.statusCode).toBe(401);
  });
});
