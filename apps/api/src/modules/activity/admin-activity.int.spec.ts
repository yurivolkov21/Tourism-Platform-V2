import { INTERCEPTORS_METADATA } from '@nestjs/common/constants.js';
import { ModulesContainer } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  ACTIVITY_LOGGED_PROCEDURES,
  type AdminActivityItem,
  AdminActivityListResultSchema,
  AdminActivityRecordExportResultSchema,
  type AdminProcedureKey,
  listAdminProcedures,
} from '@tourism/contract';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { sessionCookie } from '../../test/session-cookie.js';
import { AdminActivityInterceptor } from './admin-activity.interceptor.js';

/**
 * Integration (Docker PG, db tourism_test) — nhật ký thao tác admin (ADR-0061, spec §8).
 *
 * Đi qua HTTP thật để đo đúng thứ người dùng thấy: interceptor nằm trong `ImplementInterceptor`,
 * ghi SAU khi handler thành công, đọc người làm từ phiên. Mô tả từng thủ tục (nhãn, chi tiết)
 * đã có unit test riêng; ở đây mỗi khu vực rẻ dựng được một đại diện, cộng một lưới quét MỌI
 * controller để không thủ tục `log` nào thiếu interceptor.
 */

const PASSWORD = 'password-123';
const OWNER = 'owner-activity@tourism.test';
const STAFF = 'staff-activity@tourism.test';
const CUSTOMER = 'customer-activity@tourism.test';

const CATEGORY_ID = 'a6100001-0000-4000-8000-000000000001';
const TOUR_ID = 'a6100002-0000-4000-8000-000000000001';
const ENQUIRY_ID = 'a6100003-0000-4000-8000-000000000001';
const REVIEW_ID = 'a6100004-0000-4000-8000-000000000001';
const DEPARTURE_ID = 'a6100005-0000-4000-8000-000000000001';
const MISSING_ID = 'a6100009-0000-4000-8000-999999999999';

describe('nhật ký thao tác admin (ADR-0061)', () => {
  let app: NestFastifyApplication;
  const cookie = { owner: '', staff: '', customer: '' };
  const ids = new Map<string, string>();

  const idOf = (email: string): string => {
    const id = ids.get(email);
    if (!id) throw new Error(`fixture thiếu ${email}`);
    return id;
  };

  /** Method và path đọc từ contract, như lưới quyền — đổi path ở contract thì spec này theo. */
  const route = (key: AdminProcedureKey, id?: string) => {
    const entry = listAdminProcedures().find((row) => row.key === key);
    if (!entry) throw new Error(`không có thủ tục ${key}`);
    return {
      method: entry.method as 'GET' | 'POST',
      url: id ? entry.path.replace('{id}', id) : entry.path,
    };
  };
  const call = (
    key: AdminProcedureKey,
    who: string,
    payload: Record<string, unknown> = {},
    id?: string,
  ) => app.inject({ ...route(key, id), headers: { cookie: who }, payload });

  const list = async (query = '') => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/activity${query}`,
      headers: { cookie: cookie.owner },
    });
    expect(res.statusCode).toBe(200);
    return AdminActivityListResultSchema.parse(res.json());
  };
  const rows = () =>
    prisma.adminActivity.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });

  async function signUpAs(email: string, name: string, role: UserRole): Promise<string> {
    await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email, password: PASSWORD, name },
    });
    const user = await prisma.user.update({
      where: { email },
      data: { emailVerified: true, role },
    });
    ids.set(email, user.id);
    return sessionCookie(
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email, password: PASSWORD },
      }),
    );
  }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, sessions, accounts, verifications, admin_activity CASCADE',
    );
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      rawBody: true,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    cookie.owner = await signUpAs(OWNER, 'Owner Olive', UserRole.ADMIN);
    cookie.staff = await signUpAs(STAFF, 'Staff Sam', UserRole.STAFF);
    cookie.customer = await signUpAs(CUSTOMER, 'Cara Customer', UserRole.CUSTOMER);
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    await prisma.adminActivity.deleteMany();
    await prisma.enquiry.deleteMany();
    await prisma.userEvent.deleteMany();
    await prisma.mediaAsset.deleteMany();
    await prisma.tour.deleteMany();
    await prisma.tourCategory.deleteMany();
    await prisma.tourCategory.create({
      data: { id: CATEGORY_ID, slug: 'activity-day-trips', name: 'Day trips', order: 1 },
    });
    await prisma.tour.create({
      data: {
        id: TOUR_ID,
        slug: 'activity-ha-long',
        title: 'Ha Long Bay Cruise',
        categoryId: CATEGORY_ID,
        durationDays: 2,
        basePrice: '99.00',
        isPublished: true,
      },
    });
    await prisma.enquiry.create({
      data: {
        id: ENQUIRY_ID,
        name: 'Linh Tran',
        email: 'linh@example.com',
        phone: '+84 90 000 0000',
        message: 'Is there a family discount?',
      },
    });
    await prisma.user.update({ where: { email: CUSTOMER }, data: { role: UserRole.CUSTOMER } });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, sessions, accounts, verifications, admin_activity CASCADE',
    );
    await app?.close();
  });

  it('mọi thủ tục `log` có đúng một interceptor nhật ký trên handler của nó', () => {
    const seen: string[] = [];
    for (const module of app.get(ModulesContainer).values()) {
      for (const wrapper of module.controllers.values()) {
        const proto = (wrapper.metatype as { prototype?: object } | null)?.prototype;
        if (!proto) continue;
        for (const name of Object.getOwnPropertyNames(proto)) {
          const method = (proto as Record<string, unknown>)[name];
          if (typeof method !== 'function') continue;
          const interceptors: unknown[] = Reflect.getMetadata(INTERCEPTORS_METADATA, method) ?? [];
          for (const item of interceptors) {
            if (item instanceof AdminActivityInterceptor) seen.push(item.key);
          }
        }
      }
    }
    expect(seen.sort()).toEqual([...ACTIVITY_LOGGED_PROCEDURES].sort());
  });

  describe('ghi sau lệnh ghi thành công', () => {
    it('gỡ bán tour: một dòng có người làm, nhãn tour và chi tiết; lặp lại không đổi gì thì không ghi', async () => {
      const res = await call('tours.setPublished', cookie.owner, { isPublished: false }, TOUR_ID);
      expect(res.statusCode).toBe(200);
      const again = await call('tours.setPublished', cookie.owner, { isPublished: false }, TOUR_ID);
      expect(again.statusCode).toBe(200);
      expect(again.json()).toMatchObject({ changed: false });

      const all = await rows();
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({
        actorId: idOf(OWNER),
        actorLabel: 'Owner Olive',
        actorRole: UserRole.ADMIN,
        action: 'tours.setPublished',
        area: 'tours',
        targetType: 'tour',
        targetId: TOUR_ID,
        targetLabel: 'Ha Long Bay Cruise',
        details: { published: false },
      });
    });

    it('lệnh lỗi (404) và input sai (400) không ghi', async () => {
      const missing = await call(
        'tours.setPublished',
        cookie.owner,
        { isPublished: false },
        MISSING_ID,
      );
      expect(missing.statusCode).toBe(404);
      const bad = await call('tours.setPublished', cookie.owner, { isPublished: 'no' }, TOUR_ID);
      expect(bad.statusCode).toBe(400);
      expect(await rows()).toEqual([]);
    });

    it('xoá tour giữ nhãn đọc trước khi xoá; list trả ref null vì tour không còn', async () => {
      const res = await call('tours.delete', cookie.owner, {}, TOUR_ID);
      expect(res.statusCode).toBe(200);
      const [row] = await rows();
      expect(row).toMatchObject({ action: 'tours.delete', targetLabel: 'Ha Long Bay Cruise' });

      const page = await list();
      expect(page.items[0]?.target).toEqual({
        type: 'tour',
        id: TOUR_ID,
        label: 'Ha Long Bay Cruise',
        ref: null,
      });
    });

    it('Staff làm thì dòng mang tên và bậc Staff; danh mục mới lấy tên từ output', async () => {
      const res = await call('categories.create', cookie.staff, {
        name: 'Cruises',
        slug: 'activity-cruises',
      });
      expect(res.statusCode).toBe(200);
      const [row] = await rows();
      expect(row).toMatchObject({
        actorLabel: 'Staff Sam',
        actorRole: UserRole.STAFF,
        action: 'categories.create',
        area: 'categories',
        targetType: 'category',
        targetLabel: 'Cruises',
        details: null,
      });
    });

    it('slug trùng (409) không ghi', async () => {
      const res = await call('categories.create', cookie.owner, {
        name: 'Dup',
        slug: 'activity-day-trips',
      });
      expect(res.statusCode).toBe(409);
      expect(await rows()).toEqual([]);
    });

    it('enquiry: đổi trạng thái ghi tên khách, không chép email hay số điện thoại; giữ nguyên trạng thái thì không ghi', async () => {
      const same = await call('enquiries.setStatus', cookie.owner, { status: 'NEW' }, ENQUIRY_ID);
      expect(same.statusCode).toBe(200);
      const res = await call(
        'enquiries.setStatus',
        cookie.owner,
        { status: 'CONTACTED' },
        ENQUIRY_ID,
      );
      expect(res.statusCode).toBe(200);

      const all = await rows();
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({
        area: 'enquiries',
        targetLabel: 'Linh Tran',
        details: { status: 'CONTACTED' },
      });
      const stored = JSON.stringify(all[0]);
      expect(stored).not.toContain('linh@example.com');
      expect(stored).not.toContain('+84');
    });

    // Hai lệnh dưới không trả cờ `changed`, nên mô tả so một dấu đọc trước khi chạy (review
    // L5-17, A2-20): lệnh trùng hiện trạng từ một tab cũ không được thành dòng "đã duyệt" hay
    // "đã đóng chuyến" thứ hai.
    it('duyệt review hai lần từ hai tab: lần trùng hiện trạng không ghi', async () => {
      const review = await prisma.review.create({
        data: {
          id: REVIEW_ID,
          tourId: TOUR_ID,
          rating: 5,
          body: 'Lovely crew and a calm bay.',
          authorName: 'Mai',
          source: 'CURATED',
        },
      });
      // Hai tab mở cùng lúc nên cùng mang một phiên bản. API chưa đọc `version` thì bỏ qua nó.
      const payload = { verdict: 'approve', version: review.updatedAt.toISOString() };
      expect((await call('reviews.moderate', cookie.owner, payload, REVIEW_ID)).statusCode).toBe(
        200,
      );
      expect((await call('reviews.moderate', cookie.staff, payload, REVIEW_ID)).statusCode).toBe(
        200,
      );

      const all = await rows();
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({
        actorId: idOf(OWNER),
        action: 'reviews.moderate',
        targetType: 'review',
        targetId: REVIEW_ID,
        targetLabel: 'Ha Long Bay Cruise',
        details: { verdict: 'approve' },
      });
    });

    it('đóng chuyến hai lần: lần trùng trạng thái không ghi', async () => {
      await prisma.tourDeparture.create({
        data: {
          id: DEPARTURE_ID,
          tourId: TOUR_ID,
          startDate: new Date('2027-03-10'),
          endDate: new Date('2027-03-11'),
          seatsTotal: 12,
        },
      });
      const close = () =>
        call('departures.setStatus', cookie.owner, { status: 'CLOSED' }, DEPARTURE_ID);
      expect((await close()).statusCode).toBe(200);
      expect((await close()).statusCode).toBe(200);

      const all = await rows();
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({
        action: 'departures.setStatus',
        targetType: 'departure',
        targetId: DEPARTURE_ID,
        targetLabel: 'Ha Long Bay Cruise',
        details: { startDate: '2027-03-10', status: 'CLOSED' },
      });
    });

    it('cấp quyền Staff: nhãn là tên tài khoản, không bao giờ là email', async () => {
      const res = await call('users.setRole', cookie.owner, { role: 'STAFF' }, idOf(CUSTOMER));
      expect(res.statusCode).toBe(200);
      const [row] = await rows();
      expect(row).toMatchObject({
        action: 'users.setRole',
        area: 'users',
        targetType: 'account',
        targetId: idOf(CUSTOMER),
        targetLabel: 'Cara Customer',
        details: { role: 'STAFF' },
      });
      expect(JSON.stringify(row)).not.toContain(CUSTOMER);
    });

    it('ghi nhật ký lỗi thì thao tác vẫn thành công và response vẫn 200', async () => {
      vi.spyOn(prisma.adminActivity, 'create').mockRejectedValueOnce(new Error('db down'));
      const res = await call('tours.setPublished', cookie.owner, { isPublished: false }, TOUR_ID);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ isPublished: false, changed: true });
      const tour = await prisma.tour.findUniqueOrThrow({ where: { id: TOUR_ID } });
      expect(tour.isPublished).toBe(false);
      expect(await rows()).toEqual([]);
    });
  });

  describe('recordExport', () => {
    it('Staff báo lượt xuất bookings: một dòng không đối tượng, chi tiết là số dòng và cách chọn', async () => {
      const res = await call('activity.recordExport', cookie.staff, {
        kind: 'bookings',
        rows: 42,
        mode: 'selection',
        filtered: true,
      });
      expect(res.statusCode).toBe(200);
      const { id } = AdminActivityRecordExportResultSchema.parse(res.json());
      const row = await prisma.adminActivity.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({
        actorRole: UserRole.STAFF,
        action: 'bookings.export',
        area: 'bookings',
        targetType: null,
        targetId: null,
        details: { rows: 42, mode: 'selection', filtered: true },
      });
    });

    it('báo cáo tháng: chi tiết là tháng', async () => {
      const res = await call('activity.recordExport', cookie.owner, {
        kind: 'reports',
        month: '2026-09',
      });
      expect(res.statusCode).toBe(200);
      const [row] = await rows();
      expect(row).toMatchObject({
        action: 'reports.export',
        area: 'reports',
        details: { month: '2026-09' },
      });
    });

    it('input sai kiểu (400) không ghi', async () => {
      const res = await call('activity.recordExport', cookie.owner, { kind: 'reports', rows: 3 });
      expect(res.statusCode).toBe(400);
      expect(await rows()).toEqual([]);
    });
  });

  describe('list', () => {
    /** Ba dòng ở ba ngày, hai người, hai khu vực — đủ để mỗi bộ lọc loại ít nhất một dòng. */
    async function seedThree(): Promise<void> {
      await call('tours.setPublished', cookie.owner, { isPublished: false }, TOUR_ID);
      await call('categories.create', cookie.staff, { name: 'Cruises', slug: 'activity-cruises' });
      await call('enquiries.setStatus', cookie.owner, { status: 'WON' }, ENQUIRY_ID);
      const [tour, category, enquiry] = await rows();
      if (!tour || !category || !enquiry) throw new Error('seedThree thiếu dòng');
      await prisma.adminActivity.update({
        where: { id: tour.id },
        data: { createdAt: new Date('2026-09-01T08:00:00Z') },
      });
      await prisma.adminActivity.update({
        where: { id: category.id },
        data: { createdAt: new Date('2026-09-15T08:00:00Z') },
      });
      await prisma.adminActivity.update({
        where: { id: enquiry.id },
        data: { createdAt: new Date('2026-09-30T23:30:00Z') },
      });
    }

    const actions = (items: AdminActivityItem[]) => items.map((item) => item.action);

    it('mới nhất trước; ref là khoá đường hiện tại; actors liệt kê hai người theo tên', async () => {
      await seedThree();
      const page = await list();
      expect(page.total).toBe(3);
      expect(actions(page.items)).toEqual([
        'enquiries.setStatus',
        'categories.create',
        'tours.setPublished',
      ]);
      expect(page.items[2]?.target).toMatchObject({ type: 'tour', ref: 'activity-ha-long' });
      expect(page.items[0]?.target).toMatchObject({ type: 'enquiry', ref: ENQUIRY_ID });
      // Danh mục không có trang riêng: không đọc ref.
      expect(page.items[1]?.target?.ref).toBeNull();
      expect(page.actors).toEqual([
        { id: idOf(OWNER), label: 'Owner Olive', role: UserRole.ADMIN },
        { id: idOf(STAFF), label: 'Staff Sam', role: UserRole.STAFF },
      ]);
    });

    it('lọc theo người, khu vực và khoảng ngày (to tính trọn ngày)', async () => {
      await seedThree();
      expect(actions((await list(`?actorId=${idOf(STAFF)}`)).items)).toEqual(['categories.create']);
      expect(actions((await list('?area=tours')).items)).toEqual(['tours.setPublished']);
      expect(actions((await list('?from=2026-09-15&to=2026-09-30')).items)).toEqual([
        'enquiries.setStatus',
        'categories.create',
      ]);
      expect(actions((await list('?to=2026-09-14')).items)).toEqual(['tours.setPublished']);
    });

    it('phân trang: total đủ, trang 2 lấy phần còn lại', async () => {
      await seedThree();
      const second = await list('?page=2&limit=2');
      expect(second.total).toBe(3);
      expect(actions(second.items)).toEqual(['tours.setPublished']);
    });

    it('from sau to → 400', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/activity?from=2026-09-30&to=2026-09-01',
        headers: { cookie: cookie.owner },
      });
      expect(res.statusCode).toBe(400);
    });

    it('tài khoản người làm bị xoá: dòng còn, nhãn còn, actor.id null và người ấy rời ô lọc', async () => {
      await call('categories.create', cookie.staff, { name: 'Cruises', slug: 'activity-cruises' });
      const [row] = await rows();
      if (!row) throw new Error('thiếu dòng');
      // Đặt null thẳng: đúng thứ khoá ngoại SetNull làm khi tài khoản bị xoá cứng (đường xoá tài
      // khoản thật là tombstone, tài khoản vẫn còn).
      await prisma.adminActivity.update({ where: { id: row.id }, data: { actorId: null } });
      const page = await list();
      expect(page.items[0]?.actor).toEqual({ id: null, label: 'Staff Sam', role: UserRole.STAFF });
      expect(page.actors).toEqual([]);
    });
  });

  describe('quyền', () => {
    const getList = (who: string) =>
      app.inject({ method: 'GET', url: '/api/admin/activity', headers: { cookie: who } });

    it('list: chỉ Owner; Staff và khách 403, chưa đăng nhập 401', async () => {
      expect((await getList(cookie.owner)).statusCode).toBe(200);
      expect((await getList(cookie.staff)).statusCode).toBe(403);
      expect((await getList(cookie.customer)).statusCode).toBe(403);
      expect((await getList('')).statusCode).toBe(401);
    });

    it('recordExport: khách 403, chưa đăng nhập 401, không ghi dòng nào', async () => {
      const payload = { kind: 'subscribers', rows: 1, mode: 'all', filtered: false };
      expect((await call('activity.recordExport', cookie.customer, payload)).statusCode).toBe(403);
      expect((await call('activity.recordExport', '', payload)).statusCode).toBe(401);
      expect(await rows()).toEqual([]);
    });
  });
});
