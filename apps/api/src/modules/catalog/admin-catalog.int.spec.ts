import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { AdminTourRow } from '@tourism/contract';
import {
  AdminTourRowSchema,
  AdminTourSetPublishedResultSchema,
  PagedSchema,
} from '@tourism/contract';
import * as catalog from '../../../prisma/fixtures/catalog/index.js';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  BookingStatus,
  DepartureStatus,
  MediaOwnerType,
  MediaRole,
  MediaType,
  PaymentProvider,
} from '../../generated/prisma/enums.js';

/**
 * Integration (Docker PG, db tourism_test — xem vitest.int.config.ts) — vùng
 * catalog admin, tính năng F11 (spec P4e-1 §3-F11): `admin.tours.list` và
 * `admin.tours.setPublished`.
 *
 * Ba bất biến của tính năng được pin ở đây vì không tầng nào khác canh được:
 *
 * 1. `openDepartureCount` đếm theo KHOẢNG LỌC, không phải toàn bộ lịch sử
 *    chuyến của tour — và tour không có chuyến nào vẫn CÓ MẶT với số 0 (phép
 *    đếm gom nhóm không được biến thành inner join).
 * 2. Gỡ đăng một tour đang có booking SỐNG là hợp lệ, không bị chặn.
 * 3. Danh sách admin trả CẢ tour chưa đăng — khác hẳn `/api/tours` công khai.
 *
 * Ngày của chuyến neo vào một MỐC ĐỘNG (tháng thứ 3 kể từ hôm nay) nên file
 * không thối theo thời gian thực, nhưng vẫn kiểm được cửa sổ tháng tuyệt đối.
 */

const PASSWORD = 'password-123';
const ADMIN_EMAIL = 'bootstrap-admin@tourism.test'; // ADMIN_EMAILS (int config)
const CUSTOMER_EMAIL = 'catalog-customer@tourism.test';

const PagedTours = PagedSchema(AdminTourRowSchema);

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

const DAY_CATEGORY = 'b0000001-0000-4000-8000-000000000001'; // Day Tours
const PACKAGE_CATEGORY = 'b0000001-0000-4000-8000-000000000002'; // Multi-day Packages

const tourId = (n: number) => `f1100001-0000-4000-8000-${String(n).padStart(12, '0')}`;
const departureId = (n: number) => `f1100002-0000-4000-8000-${String(n).padStart(12, '0')}`;

const ALPHA = tourId(1);
const BETA = tourId(2);
const GAMMA = tourId(3);

describe('admin catalog integration (F11 — tours list + publish toggle)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let customerCookie: string;
  let customerId: string;

  // Mốc động: ngày 1 của tháng thứ 3 kể từ hôm nay — luôn nằm trong TƯƠNG LAI
  // dù file chạy ngày nào, nên hai cửa sổ ("sắp tới" và "đúng tháng này") đều
  // kiểm được mà không cần đóng băng đồng hồ.
  const now = new Date();
  const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 1));
  const anchorYear = anchor.getUTCFullYear();
  const anchorMonth = anchor.getUTCMonth();
  /** Ngày `d` của tháng neo, lệch `offset` tháng — khuôn 00:00 UTC của `@db.Date`. */
  const dayIn = (monthOffset: number, d: number) =>
    new Date(Date.UTC(anchorYear, anchorMonth + monthOffset, d));
  const asMonth = (monthOffset: number) =>
    new Date(Date.UTC(anchorYear, anchorMonth + monthOffset, 1)).toISOString().slice(0, 7);

  const MONTH_A = asMonth(0);
  const MONTH_B = asMonth(1);
  /** Chuyến đã khởi hành — ngoài cửa sổ "sắp tới", nhưng vẫn trong tháng của nó. */
  const PAST_START = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 15));
  const PAST_MONTH = PAST_START.toISOString().slice(0, 7);

  const tour = (
    id: string,
    patch: Partial<Prisma.TourCreateManyInput> & { slug: string; title: string },
  ): Prisma.TourCreateManyInput => ({
    id,
    categoryId: DAY_CATEGORY,
    durationDays: 1,
    maxGroupSize: 12,
    basePrice: '39.00',
    currency: 'USD',
    isPublished: true,
    isFeatured: false,
    ...patch,
  });

  const departure = (
    n: number,
    patch: Partial<Prisma.TourDepartureCreateManyInput> & { tourId: string; startDate: Date },
  ): Prisma.TourDepartureCreateManyInput => ({
    id: departureId(n),
    endDate: patch.startDate,
    seatsTotal: 10,
    seatsBooked: 0,
    status: DepartureStatus.OPEN,
    ...patch,
  });

  const tours = [
    tour(ALPHA, { slug: 'f11-alpha-day', title: 'Alpha Day Trip', basePrice: '39.00' }),
    tour(BETA, {
      slug: 'f11-beta-package',
      title: 'Beta Package',
      categoryId: PACKAGE_CATEGORY,
      basePrice: '199.00',
      durationDays: 3,
      isFeatured: true,
    }),
    // Chưa đăng VÀ không có chuyến nào — hai nhánh dễ hỏng trong cùng một hàng.
    tour(GAMMA, { slug: 'f11-gamma-draft', title: 'Gamma Draft', isPublished: false }),
  ];

  const departures = [
    // ALPHA: 2 OPEN trong tháng A, 1 CLOSED trong tháng A, 1 OPEN trong tháng B.
    departure(1, { tourId: ALPHA, startDate: dayIn(0, 5) }),
    departure(2, { tourId: ALPHA, startDate: dayIn(0, 20) }),
    departure(3, { tourId: ALPHA, startDate: dayIn(0, 25), status: DepartureStatus.CLOSED }),
    departure(4, { tourId: ALPHA, startDate: dayIn(1, 10) }),
    // ALPHA: chuyến đã khởi hành, vẫn OPEN — ngoài cửa sổ "sắp tới".
    departure(5, { tourId: ALPHA, startDate: PAST_START }),
    // BETA: 1 OPEN trong tháng A.
    departure(6, { tourId: BETA, startDate: dayIn(0, 12) }),
  ];

  const list = (query: string, cookie: string) =>
    app.inject({ method: 'GET', url: `/api/admin/tours${query}`, headers: { cookie } });

  const setPublished = (id: string, isPublished: boolean, cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/tours/${id}/published`,
      headers: { cookie },
      payload: { isPublished },
    });

  const listOk = async (query: string) => {
    const res = await list(query, adminCookie);
    expect(res.statusCode).toBe(200);
    return PagedTours.parse(res.json());
  };

  /** Hàng của một tour trong kết quả — ném khi vắng mặt, vì "vắng" là một lỗi thật. */
  const rowOf = (paged: { items: AdminTourRow[] }, id: string): AdminTourRow => {
    const row = paged.items.find((item) => item.id === id);
    if (!row) throw new Error(`tour ${id} vắng mặt trong kết quả`);
    return row;
  };

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, tour_categories, destinations, media_assets CASCADE',
    );
    await prisma.tourCategory.createMany({ data: catalog.tourCategories });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      rawBody: true,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    for (const email of [ADMIN_EMAIL, CUSTOMER_EMAIL]) {
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email, password: PASSWORD, name: 'Test User' },
      });
      await prisma.user.update({
        where: { email },
        data: { emailVerified: true, ...(email === ADMIN_EMAIL ? { role: 'ADMIN' } : {}) },
      });
    }
    adminCookie = sessionCookie(
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email: ADMIN_EMAIL, password: PASSWORD },
      }),
    );
    customerCookie = sessionCookie(
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email: CUSTOMER_EMAIL, password: PASSWORD },
      }),
    );
    customerId = (await prisma.user.findUniqueOrThrow({ where: { email: CUSTOMER_EMAIL } })).id;
  });

  beforeEach(async () => {
    // Mỗi test bắt đầu từ cùng một thế giới — `setPublished` là lệnh GHI nên
    // thứ tự test không được để lại dấu vết cho test sau.
    await prisma.booking.deleteMany();
    await prisma.tourDeparture.deleteMany();
    await prisma.mediaAsset.deleteMany();
    await prisma.tour.deleteMany();
    await prisma.tour.createMany({ data: tours });
    await prisma.tourDeparture.createMany({ data: departures });
  });

  afterAll(async () => {
    await app.close();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Guard
  // ───────────────────────────────────────────────────────────────────────────

  it('ẩn danh → 401, khách thường → 403, trên CẢ hai endpoint', async () => {
    const anonList = await app.inject({ method: 'GET', url: '/api/admin/tours' });
    expect(anonList.statusCode).toBe(401);
    expect((await list('', customerCookie)).statusCode).toBe(403);

    const anonWrite = await app.inject({
      method: 'POST',
      url: `/api/admin/tours/${ALPHA}/published`,
      payload: { isPublished: false },
    });
    expect(anonWrite.statusCode).toBe(401);
    expect((await setPublished(ALPHA, false, customerCookie)).statusCode).toBe(403);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // list
  // ───────────────────────────────────────────────────────────────────────────

  it('trả CẢ tour chưa đăng — khác hẳn /api/tours công khai', async () => {
    const paged = await listOk('');
    expect(paged.items.map((row) => row.id).sort()).toEqual([ALPHA, BETA, GAMMA].sort());
    expect(rowOf(paged, GAMMA).isPublished).toBe(false);

    // Bề mặt công khai KHÔNG được biết tour nháp tồn tại.
    const publicList = await app.inject({ method: 'GET', url: '/api/tours' });
    expect(publicList.statusCode).toBe(200);
    const publicSlugs = (publicList.json() as { items: Array<{ slug: string }> }).items.map(
      (t) => t.slug,
    );
    expect(publicSlugs).toContain('f11-alpha-day');
    expect(publicSlugs).not.toContain('f11-gamma-draft');
  });

  it('KHÔNG có ?month= → đếm chuyến OPEN CHƯA khởi hành, bỏ chuyến CLOSED và chuyến đã đi', async () => {
    const paged = await listOk('');
    // ALPHA có 5 chuyến; chỉ 3 vừa OPEN vừa còn ở tương lai.
    expect(rowOf(paged, ALPHA).openDepartureCount).toBe(3);
    expect(rowOf(paged, BETA).openDepartureCount).toBe(1);
  });

  it('?month= đổi KHOẢNG ĐẾM, không phải toàn bộ lịch sử chuyến', async () => {
    const monthA = await listOk(`?month=${MONTH_A}`);
    expect(rowOf(monthA, ALPHA).openDepartureCount).toBe(2); // 2 OPEN, CLOSED không tính
    expect(rowOf(monthA, BETA).openDepartureCount).toBe(1);

    const monthB = await listOk(`?month=${MONTH_B}`);
    expect(rowOf(monthB, ALPHA).openDepartureCount).toBe(1);
    expect(rowOf(monthB, BETA).openDepartureCount).toBe(0);
  });

  it('tháng ĐÃ QUA vẫn đếm được — cửa sổ tháng là tuyệt đối, không cắt theo hôm nay', async () => {
    // Câu hỏi vận hành thật: "tháng trước còn chuyến nào tôi quên đóng không?"
    const paged = await listOk(`?month=${PAST_MONTH}`);
    expect(rowOf(paged, ALPHA).openDepartureCount).toBe(1);
  });

  it('tour KHÔNG có chuyến nào trả 0 chứ không vắng mặt', async () => {
    for (const query of ['', `?month=${MONTH_A}`, `?month=${MONTH_B}`]) {
      const paged = await listOk(query);
      expect(rowOf(paged, GAMMA).openDepartureCount, query).toBe(0);
    }
  });

  it('?month= KHÔNG lọc bớt hàng — cả ba tour vẫn có mặt ở mọi tháng', async () => {
    const paged = await listOk(`?month=${MONTH_B}`);
    expect(paged.total).toBe(3);
    expect(paged.items).toHaveLength(3);
  });

  it('lọc theo danh mục và theo trạng thái đăng', async () => {
    const byCategory = await listOk(`?categoryId=${PACKAGE_CATEGORY}`);
    expect(byCategory.items.map((row) => row.id)).toEqual([BETA]);

    const drafts = await listOk('?isPublished=false');
    expect(drafts.items.map((row) => row.id)).toEqual([GAMMA]);

    const live = await listOk('?isPublished=true');
    expect(live.items.map((row) => row.id).sort()).toEqual([ALPHA, BETA].sort());
  });

  it('phân trang theo nếp admin.bookings.list (page/limit + total/totalPages)', async () => {
    const first = await listOk('?limit=2');
    expect(first).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(first.items).toHaveLength(2);

    const second = await listOk('?limit=2&page=2');
    expect(second.items).toHaveLength(1);
    // Không hàng nào xuất hiện hai lần — sort phụ phải ổn định.
    const seen = [...first.items, ...second.items].map((row) => row.id);
    expect(new Set(seen).size).toBe(3);
  });

  it('heroUrl dựng từ asset role hero; tour chưa có ảnh trả null', async () => {
    await prisma.mediaAsset.create({
      data: {
        publicId: 'tours/f11-beta',
        type: MediaType.IMAGE,
        ownerType: MediaOwnerType.TOUR,
        ownerId: BETA,
        role: MediaRole.hero,
      },
    });
    const paged = await listOk('');
    expect(rowOf(paged, BETA).heroUrl).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/tours/f11-beta',
    );
    expect(rowOf(paged, ALPHA).heroUrl).toBeNull();
  });

  it('tên danh mục và tiền đi qua dây đúng hình dạng contract', async () => {
    const paged = await listOk('');
    expect(rowOf(paged, BETA)).toMatchObject({
      slug: 'f11-beta-package',
      title: 'Beta Package',
      categoryName: 'Multi-day Packages',
      basePrice: '199.00',
      currency: 'USD',
      isFeatured: true,
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // setPublished
  // ───────────────────────────────────────────────────────────────────────────

  it('bật và tắt đăng, trả trạng thái sau khi đổi kèm changed', async () => {
    const off = await setPublished(ALPHA, false, adminCookie);
    expect(off.statusCode).toBe(200);
    expect(AdminTourSetPublishedResultSchema.parse(off.json())).toEqual({
      id: ALPHA,
      isPublished: false,
      changed: true,
    });
    expect((await prisma.tour.findUniqueOrThrow({ where: { id: ALPHA } })).isPublished).toBe(false);

    const on = await setPublished(ALPHA, true, adminCookie);
    expect(AdminTourSetPublishedResultSchema.parse(on.json())).toMatchObject({
      isPublished: true,
      changed: true,
    });
  });

  it('bấm lại đúng trạng thái đang có → changed false, không phải lỗi', async () => {
    const res = await setPublished(ALPHA, true, adminCookie); // đang published
    expect(res.statusCode).toBe(200);
    expect(AdminTourSetPublishedResultSchema.parse(res.json())).toEqual({
      id: ALPHA,
      isPublished: true,
      changed: false,
    });
  });

  it('GỠ ĐĂNG một tour đang có booking SỐNG là hợp lệ — không chặn', async () => {
    // Bất biến F11: khách đã mua vẫn đi, tour chỉ thôi được chào bán. Một
    // guard ở đây sẽ khoá đúng thao tác vận hành cần nhất — rút một tour khỏi
    // kệ ngay khi có chuyện.
    await prisma.booking.create({
      data: {
        code: 'BK-F11LIVE1',
        userId: customerId,
        tourId: ALPHA,
        departureId: departureId(1),
        numAdults: 2,
        totalAmount: '78.00',
        status: BookingStatus.PAID,
        tourTitle: 'Alpha Day Trip',
        departureStartDate: dayIn(0, 5),
        departureEndDate: dayIn(0, 5),
        unitPrice: '39.00',
        contactName: 'Ada Lovelace',
        contactEmail: 'ada@example.com',
        paymentProvider: PaymentProvider.STRIPE,
        paidAt: new Date(),
      },
    });

    const res = await setPublished(ALPHA, false, adminCookie);
    expect(res.statusCode).toBe(200);
    expect(AdminTourSetPublishedResultSchema.parse(res.json()).isPublished).toBe(false);

    // Booking KHÔNG bị đụng tới — gỡ đăng không phải là huỷ chuyến.
    const booking = await prisma.booking.findFirstOrThrow({ where: { code: 'BK-F11LIVE1' } });
    expect(booking.status).toBe(BookingStatus.PAID);
    expect(booking.cancelledAt).toBeNull();
  });

  it('id lạ → NOT_FOUND 404', async () => {
    const res = await setPublished('f1100001-0000-4000-8000-0000000000ff', false, adminCookie);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ code: 'NOT_FOUND' });
  });
});
