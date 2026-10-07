import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AdminCategoryRowSchema } from '@tourism/contract';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';
import { CATEGORY_ORDER_LOCK_KEY } from './admin-categories.service.js';

/**
 * Integration (Docker PG, db `tourism_test`) — sáu thao tác quản trị danh mục
 * tour (spec P4e-2 F14, lệnh xoá theo ADR-0053).
 *
 * Ba ca đắt nhất ở đây:
 *
 *  ① `list` của admin trả CẢ hàng đã tắt, còn endpoint công khai thì không —
 *    đó là toàn bộ khác biệt giữa hai bề mặt;
 *  ② slug trùng ra 409 chứ không phải 500 của `P2002` (bài học F12: 500 làm
 *    kit đóng dialog và admin mất cả form vừa gõ);
 *  ③ **các ca ĐỒNG THỜI** — hai lượt `move` trên hai cặp GIAO NHAU, và hai
 *    lượt `create` bắn cùng lúc — không bao giờ để lại hai hàng cùng `order`.
 *
 * Về ③: vòng review 22/09 chỉ ra ca đồng thời bản đầu không thể đỏ, vì nó bắn
 * `move(2,'down')` + `move(3,'up')` — hai lệnh ấy là CÙNG MỘT phép đổi chỗ nên
 * mọi interleaving đều cho một kết quả. Ca hiện tại chọn hai cặp giao nhau, và
 * đã đo: gỡ khoá advisory khỏi `move` hay `create` thì đỏ 3/3 lượt.
 */

const PASSWORD = 'password-123';
const ADMIN_EMAIL = 'bootstrap-admin@tourism.test';
const CUSTOMER_EMAIL = 'cat-customer@example.com';

/** Bốn danh mục dựng sẵn, `order` 1..4 — vừa đủ để thử đổi chỗ ở giữa và ở biên. */
const catId = (n: number) => `c1400001-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SEED = [
  { id: catId(1), slug: 'day-trips', name: 'Day trips', order: 1, isActive: true },
  { id: catId(2), slug: 'packages', name: 'Packages', order: 2, isActive: true },
  { id: catId(3), slug: 'cruises', name: 'Cruises', order: 3, isActive: true },
  { id: catId(4), slug: 'retired', name: 'Retired', order: 4, isActive: false },
] satisfies Prisma.TourCategoryCreateManyInput[];

/**
 * Bọc `prisma.$transaction` để đếm transaction đang mở; trả hàm đọc số đếm (review S3). Ca "bust
 * SAU commit" đọc nó NGAY lúc bust được gọi: 0 nghĩa là transaction xoá đã commit. Đọc DB trong
 * mock thôi KHÔNG đủ: lượt đọc đi qua một kết nối khác của pool và thường tới Postgres sau câu
 * COMMIT, nên dời bust vào trong transaction vẫn xanh (đo 07/10: 3/3 lượt).
 */
function trackOpenTransactions(): () => number {
  let open = 0;
  const run = prisma.$transaction.bind(prisma) as (...args: unknown[]) => Promise<unknown>;
  vi.spyOn(prisma, '$transaction').mockImplementation(((...args: unknown[]) => {
    open += 1;
    return run(...args).finally(() => {
      open -= 1;
    });
  }) as never);
  return () => open;
}

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

describe('admin categories integration (P4e-2 F14)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let customerCookie: string;
  let web: WebRevalidationService;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE tour_categories, users CASCADE');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      rawBody: true,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    web = moduleRef.get(WebRevalidationService);

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
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    // Tour trỏ vào danh mục bằng FK RESTRICT — xoá tour TRƯỚC.
    await prisma.tour.deleteMany();
    await prisma.tourCategory.deleteMany();
    await prisma.tourCategory.createMany({ data: SEED });
  });

  afterAll(async () => {
    await app?.close();
  });

  const list = (cookie: string) =>
    app.inject({ method: 'GET', url: '/api/admin/categories', headers: { cookie } });

  const create = (payload: Record<string, unknown>, cookie: string) =>
    app.inject({ method: 'POST', url: '/api/admin/categories', headers: { cookie }, payload });

  const update = (id: string, payload: Record<string, unknown>, cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/categories/${id}`,
      headers: { cookie },
      payload,
    });

  const setActive = (id: string, isActive: boolean, cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/categories/${id}/active`,
      headers: { cookie },
      payload: { isActive },
    });

  const move = (id: string, direction: 'up' | 'down', cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/categories/${id}/move`,
      headers: { cookie },
      payload: { direction },
    });

  const remove = (id: string, cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/categories/${id}/delete`,
      headers: { cookie },
      payload: {},
    });

  const listOk = async () => {
    const res = await list(adminCookie);
    expect(res.statusCode).toBe(200);
    return AdminCategoryRowSchema.array().parse(res.json());
  };

  const slugsInOrder = async () => (await listOk()).map((row) => row.slug);

  describe('guard', () => {
    it('khách thường không chạm được endpoint nào', async () => {
      expect((await list(customerCookie)).statusCode).toBe(403);
      expect((await create({ name: 'X', slug: 'x' }, customerCookie)).statusCode).toBe(403);
      // `update` phải có mặt ở đây: nó là lệnh đổi TÊN, thứ hiện thẳng ra chip
      // công khai. Bỏ sót một đường là khối này đếm năm trên sáu.
      expect((await update(catId(1), { name: 'X' }, customerCookie)).statusCode).toBe(403);
      expect((await setActive(catId(1), false, customerCookie)).statusCode).toBe(403);
      expect((await move(catId(1), 'down', customerCookie)).statusCode).toBe(403);
      expect((await remove(catId(4), customerCookie)).statusCode).toBe(403);
    });

    it('chưa đăng nhập thì cả sáu đường đều 401', async () => {
      const anon = '';
      expect((await list(anon)).statusCode).toBe(401);
      expect((await create({ name: 'X', slug: 'x' }, anon)).statusCode).toBe(401);
      expect((await update(catId(1), { name: 'X' }, anon)).statusCode).toBe(401);
      expect((await setActive(catId(1), false, anon)).statusCode).toBe(401);
      expect((await move(catId(1), 'down', anon)).statusCode).toBe(401);
      expect((await remove(catId(4), anon)).statusCode).toBe(401);
    });
  });

  describe('list', () => {
    it('trả CẢ hàng đã tắt, sắp theo `order`', async () => {
      const rows = await listOk();

      expect(rows.map((row) => row.slug)).toEqual(['day-trips', 'packages', 'cruises', 'retired']);
      expect(rows.find((row) => row.slug === 'retired')?.isActive).toBe(false);
    });

    it('hai hàng NGANG SỐ vẫn xếp tất định, theo `id`', async () => {
      // Sau bản vá khoá advisory, API không sinh ra được hai hàng cùng `order`
      // nữa. Nhưng cột ấy là `Int @default(0)` không unique, nên một hàng chèn
      // ngoài service này — seed, SQL tay — vẫn ngang số được. Không có khoá
      // phụ thì Postgres trả hai hàng ấy theo thứ tự tuỳ kế hoạch truy vấn, mà
      // `canMoveUp`/`canMoveDown` phía client suy THUẦN theo chỉ số mảng.
      // Cho hàng 2 ngang số với hàng 3, KHÔNG phải ngược lại: `UPDATE` của
      // Postgres ghi một phiên bản tuple MỚI ở cuối heap, nên hàng vừa sửa
      // đứng sau trong thứ tự quét. Chọn chiều này thì thứ tự heap (3 rồi 2)
      // NGƯỢC với thứ tự id (2 rồi 3) — và ca test mới phân biệt được có khoá
      // phụ hay không. Chiều kia cho hai thứ tự trùng nhau, test xanh cả khi
      // gỡ khoá phụ (đã đo).
      await prisma.tourCategory.update({ where: { id: catId(2) }, data: { order: 3 } });

      const rows = await listOk();
      const tied = rows.filter((row) => row.order === 3).map((row) => row.id);

      expect(tied).toEqual([catId(2), catId(3)]);
    });

    it('endpoint CÔNG KHAI thì không — đó là khác biệt duy nhất giữa hai bề mặt', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/categories' });

      expect(res.statusCode).toBe(200);
      const slugs = (res.json() as { slug: string }[]).map((row) => row.slug);
      expect(slugs).not.toContain('retired');
    });

    it('`tourCount` đếm tour ĐÃ ĐĂNG, không đếm nháp', async () => {
      // Con số này nuôi câu cảnh báo lúc tắt danh mục, nên nó phải đếm đúng thứ
      // khách đang nhìn thấy — tour nháp thì không ai thấy.
      await prisma.tour.createMany({
        data: [
          {
            slug: 'published-one',
            title: 'Published one',
            categoryId: catId(1),
            durationDays: 1,
            basePrice: '39.00',
            currency: 'USD',
            isPublished: true,
          },
          {
            slug: 'draft-one',
            title: 'Draft one',
            categoryId: catId(1),
            durationDays: 1,
            basePrice: '39.00',
            currency: 'USD',
            isPublished: false,
          },
        ] as unknown as Prisma.TourCreateManyInput[],
      });

      const rows = await listOk();

      expect(rows.find((row) => row.slug === 'day-trips')?.tourCount).toBe(1);
      expect(rows.find((row) => row.slug === 'packages')?.tourCount).toBe(0);
      // ADR-0053 §5: số MỌI trạng thái quyết nút Delete — tour nháp vẫn chặn xoá.
      expect(rows.find((row) => row.slug === 'day-trips')?.linkedTourCount).toBe(2);
      expect(rows.find((row) => row.slug === 'packages')?.linkedTourCount).toBe(0);
    });
  });

  describe('create', () => {
    it('thêm vào CUỐI danh sách — `order` = max + 1', async () => {
      const res = await create({ name: 'Trekking', slug: 'trekking' }, adminCookie);

      expect(res.statusCode).toBe(200);
      expect(AdminCategoryRowSchema.parse(res.json()).order).toBe(5);
      expect(await slugsInOrder()).toEqual([
        'day-trips',
        'packages',
        'cruises',
        'retired',
        'trekking',
      ]);
    });

    it('slug TRÙNG → 409 SLUG_TAKEN, không phải 500 của P2002', async () => {
      // 500 trần thì admin phân loại `GENERIC`, mà `GENERIC` nằm trong nhóm
      // "kết cục KHÔNG RÕ" — kit ĐÓNG dialog và người ta mất cả form vừa gõ.
      const res = await create({ name: 'Another', slug: 'day-trips' }, adminCookie);

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('SLUG_TAKEN');
      expect((await listOk()).length).toBe(4);
    });

    it('trùng với một danh mục ĐÃ TẮT cũng là trùng', async () => {
      // Slug `@unique` không quan tâm hàng đang bật hay tắt, và nếu ta bỏ sót
      // thì lệnh ghi rơi xuống P2002 đúng như ca trên.
      expect((await create({ name: 'X', slug: 'retired' }, adminCookie)).statusCode).toBe(409);
    });

    it('mô tả bỏ trống vào DB là `null`, không phải chuỗi rỗng', async () => {
      const res = await create({ name: 'Trekking', slug: 'trekking' }, adminCookie);

      expect(AdminCategoryRowSchema.parse(res.json()).description).toBeNull();
    });

    it('mô tả TOÀN KHOẢNG TRẮNG cũng thành `null`', async () => {
      // Server action không phải cổng duy nhất tới endpoint này; chuỗi rỗng lọt
      // vào cột nullable thì bảng in một dòng trắng thay vì câu "No description".
      const res = await create(
        { name: 'Trekking', slug: 'trekking', description: '   ' },
        adminCookie,
      );

      expect(AdminCategoryRowSchema.parse(res.json()).description).toBeNull();
    });

    it('hai lượt tạo CÙNG SLUG bắn cùng lúc: một 200, một 409 — không lượt nào 500', async () => {
      // `assertSlugFree` là SELECT pre-flight; ở READ COMMITTED nó không chặn
      // được hai INSERT song song, nên trước bản vá lượt thua ăn `P2002` trần
      // rồi rơi thành 500 → admin phân loại `GENERIC` → kit đóng dialog và mất
      // cả form. Đây là ca duy nhất chạm nhánh đó.
      const results = await Promise.all([
        create({ name: 'Trekking A', slug: 'trekking' }, adminCookie),
        create({ name: 'Trekking B', slug: 'trekking' }, adminCookie),
      ]);
      const codes = results.map((res) => res.statusCode).sort();

      expect(codes).toEqual([200, 409]);
      const conflict = results.find((res) => res.statusCode === 409);
      expect(conflict?.json().code).toBe('SLUG_TAKEN');
      expect((await listOk()).filter((row) => row.slug === 'trekking')).toHaveLength(1);
    });

    it('hai lượt tạo KHÁC SLUG bắn cùng lúc: hai `order` khác nhau', async () => {
      // `max + 1` đọc bằng `aggregate` không giữ khoá nào: hai lượt cùng đọc
      // max = 4 thì cùng ghi 5, và `order` không unique nên không gì từ chối.
      await Promise.all([
        create({ name: 'Trekking', slug: 'trekking' }, adminCookie),
        create({ name: 'Honeymoon', slug: 'honeymoon' }, adminCookie),
      ]);

      const orders = (await listOk()).map((row) => row.order);
      expect(new Set(orders).size).toBe(orders.length);
    });
  });

  describe('update', () => {
    it('đổi tên và mô tả, KHÔNG đụng slug', async () => {
      const res = await update(
        catId(1),
        { name: 'Day tours', description: 'Back by dinner.' },
        adminCookie,
      );

      expect(res.statusCode).toBe(200);
      const row = AdminCategoryRowSchema.parse(res.json());
      expect(row.name).toBe('Day tours');
      expect(row.description).toBe('Back by dinner.');
      expect(row.slug).toBe('day-trips');
    });

    it('gửi kèm slug cũng không đổi được — contract đã bỏ khoá ấy', async () => {
      await update(catId(1), { name: 'X', description: null, slug: 'hacked' }, adminCookie);

      expect((await slugsInOrder())[0]).toBe('day-trips');
    });

    it('sửa và ẩn/hiện trả hai con số tour: tour nháp tính vào `linkedTourCount`, không vào `tourCount` (review SI3)', async () => {
      // Trước review SI3 không ca nào khoá hai con số ở đường ghi — chỉ `list` có.
      await prisma.tour.createMany({
        data: [
          {
            slug: 'published-one',
            title: 'Published one',
            categoryId: catId(1),
            durationDays: 1,
            basePrice: '39.00',
            currency: 'USD',
            isPublished: true,
          },
          {
            slug: 'draft-one',
            title: 'Draft one',
            categoryId: catId(1),
            durationDays: 1,
            basePrice: '39.00',
            currency: 'USD',
            isPublished: false,
          },
        ] as unknown as Prisma.TourCreateManyInput[],
      });
      const counts = { tourCount: 1, linkedTourCount: 2 };

      const updated = await update(catId(1), { name: 'Day tours', description: null }, adminCookie);
      const hidden = await setActive(catId(1), false, adminCookie);

      expect(AdminCategoryRowSchema.parse(updated.json())).toMatchObject(counts);
      expect(AdminCategoryRowSchema.parse(hidden.json())).toMatchObject({
        isActive: false,
        ...counts,
      });
    });

    it('id lạ → 404', async () => {
      const res = await update(
        'c1400001-0000-4000-8000-999999999999',
        { name: 'X', description: null },
        adminCookie,
      );

      expect(res.statusCode).toBe(404);
    });
  });

  describe('setActive', () => {
    it('tắt rồi bật lại, không đụng tour nào', async () => {
      await prisma.tour.create({
        data: {
          slug: 'in-day-trips',
          title: 'In day trips',
          categoryId: catId(1),
          durationDays: 1,
          basePrice: '39.00',
          currency: 'USD',
          isPublished: true,
        } as unknown as Prisma.TourCreateInput,
      });

      expect((await setActive(catId(1), false, adminCookie)).statusCode).toBe(200);
      expect((await listOk()).find((row) => row.slug === 'day-trips')?.isActive).toBe(false);
      // Tour vẫn còn và vẫn thuộc danh mục ấy — đây là điều câu cảnh báo ở màn
      // admin phải nói đúng.
      expect(await prisma.tour.count({ where: { categoryId: catId(1) } })).toBe(1);

      expect((await setActive(catId(1), true, adminCookie)).statusCode).toBe(200);
      expect((await listOk()).find((row) => row.slug === 'day-trips')?.tourCount).toBe(1);
    });

    it('id lạ → 404', async () => {
      const res = await setActive('c1400001-0000-4000-8000-999999999999', false, adminCookie);
      expect(res.statusCode).toBe(404);
    });
  });

  describe('delete (ADR-0053)', () => {
    const draftIn = (categoryId: string) =>
      prisma.tour.create({
        data: {
          slug: 'draft-only',
          title: 'Draft only',
          categoryId,
          durationDays: 1,
          basePrice: '39.00',
          currency: 'USD',
          isPublished: false,
        } as unknown as Prisma.TourCreateInput,
      });

    /**
     * Số yêu cầu CHƯA được cấp đang xếp hàng sau khoá thứ tự danh mục. `pg_locks` hiện khoá
     * advisory một số `bigint` thành `classid` (32 bit cao) và `objid` (32 bit thấp) với
     * `objsubid = 1`. Lọc theo DB vì bảng này nhìn thấy cả cụm Postgres — một session song
     * song chạy int test trên DB khác cũng có thể đang chờ một khoá cùng số.
     */
    const orderLockWaiters = async () => {
      const [row] = await prisma.$queryRaw<{ waiting: number }[]>`
        SELECT count(*)::int AS waiting
        FROM pg_locks
        WHERE locktype = 'advisory'
          AND NOT granted
          AND objsubid = 1
          AND ((classid::bigint << 32) | objid::bigint) = ${CATEGORY_ORDER_LOCK_KEY}
          AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
      `;
      return row?.waiting ?? 0;
    };

    it('0 tour → 200 trả slug, hàng biến khỏi bảng', async () => {
      const res = await remove(catId(3), adminCookie);

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ slug: 'cruises' });
      expect(await slugsInOrder()).toEqual(['day-trips', 'packages', 'retired']);
    });

    it('còn tour NHÁP → 409 IN_USE, hàng còn nguyên', async () => {
      await draftIn(catId(2));

      const res = await remove(catId(2), adminCookie);

      expect(res.statusCode).toBe(409);
      expect((res.json() as { code: string }).code).toBe('IN_USE');
      expect(await slugsInOrder()).toContain('packages');
    });

    it('id lạ → 404 NOT_FOUND', async () => {
      const res = await remove(catId(999), adminCookie);
      expect(res.statusCode).toBe(404);
      expect((res.json() as { code: string }).code).toBe('NOT_FOUND');
    });

    it('xoá chen với move ở hai hàng kề: không lượt nào 500, `order` không trùng', async () => {
      // Ca khói: gỡ khoá khỏi `delete` thì ca này vẫn xanh (đã đo 5/5) — cửa sổ hỏng của
      // `move` chỉ dài vài vòng DB, `Promise.all` không ép trúng được. Khoá do ca kế dưới canh.
      const results = await Promise.all([
        remove(catId(3), adminCookie),
        move(catId(2), 'down', adminCookie),
        move(catId(4), 'up', adminCookie),
      ]);

      for (const res of results) expect(res.statusCode).toBeLessThan(500);
      expect(results[0]?.statusCode).toBe(200);
      const orders = (await listOk()).map((row) => row.order);
      expect(new Set(orders).size).toBe(orders.length);
    });

    it('câu xoá xếp hàng sau khoá thứ tự: đang có người giữ khoá thì hàng còn nguyên', async () => {
      // ADR-0053 §2: câu xoá chạy trong `withCategoryOrderLock`. Ca này GIỮ chính khoá ấy trong
      // một transaction của test, nên câu xoá đi qua khoá thì phải đứng chờ — thấy được ở
      // `pg_locks` là một yêu cầu CHƯA được cấp. Gỡ khoá khỏi `delete` thì câu xoá chạy xong
      // ngay trong lúc test còn giữ khoá, và ca này đỏ (đã đo).
      let taken!: () => void;
      const lockTaken = new Promise<void>((resolve) => {
        taken = resolve;
      });
      let release!: () => void;
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      const holding = prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CATEGORY_ORDER_LOCK_KEY})`;
          taken();
          await released;
        },
        { timeout: 15_000 },
      );

      let deleting!: ReturnType<typeof remove>;
      try {
        await lockTaken;
        deleting = remove(catId(3), adminCookie);
        await vi.waitFor(async () => expect(await orderLockWaiters()).toBe(1), {
          timeout: 5_000,
          interval: 50,
        });
        expect(await slugsInOrder()).toContain('cruises');
      } finally {
        // Nhả khoá ở MỌI kết cục rồi chờ câu xoá chạy hết: ca hỏng giữa chừng không được để
        // khoá treo, hay một câu xoá còn đang bay, lọt sang ca sau.
        release();
        await holding;
        await deleting;
      }

      const res = await deleting;
      expect(res.statusCode).toBe(200);
      expect(await slugsInOrder()).not.toContain('cruises');
    });

    it('xoá hàng đang hiện bust `tours` đúng một lần, SAU commit — lúc bust hàng đã mất (review S3)', async () => {
      // Bust trong transaction thì web regenerate đọc bản còn danh mục rồi giữ nó 300 giây ISR
      // (ADR-0016 §3). Mock đọc DB như ca bust của điểm đến, NHƯNG chứng cứ thứ tự là số
      // transaction còn mở ngay lúc bust được gọi — xem `trackOpenTransactions`.
      const openTransactions = trackOpenTransactions();
      const seen: Array<{ tags: string[]; open: number; remaining: number }> = [];
      const revalidate = vi.spyOn(web, 'revalidate').mockImplementation(async (tags) => {
        const open = openTransactions();
        const remaining = await prisma.tourCategory.count({ where: { id: catId(3) } });
        seen.push({ tags, open, remaining });
      });

      expect((await remove(catId(3), adminCookie)).statusCode).toBe(200);

      expect(revalidate).toHaveBeenCalledTimes(1);
      await vi.waitFor(() => expect(seen).toHaveLength(1));
      expect(seen[0]).toEqual({ tags: ['tours'], open: 0, remaining: 0 });
    });

    it('xoá hàng đang ẨN không bust — web không hiện hàng ẩn nên không trang nào đổi (EF4)', async () => {
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      expect((await remove(catId(4), adminCookie)).statusCode).toBe(200);

      expect(await slugsInOrder()).not.toContain('retired');
      expect(revalidate).not.toHaveBeenCalled();
    });

    it('xoá hỏng thì không bust', async () => {
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      await draftIn(catId(2));
      await remove(catId(2), adminCookie);
      await remove(catId(999), adminCookie);

      expect(revalidate).not.toHaveBeenCalled();
    });
  });

  describe('move', () => {
    it('xuống một bậc: đổi chỗ với hàng ngay sau', async () => {
      const res = await move(catId(1), 'down', adminCookie);

      expect(res.statusCode).toBe(200);
      expect(await slugsInOrder()).toEqual(['packages', 'day-trips', 'cruises', 'retired']);
    });

    it('lên một bậc: đổi chỗ với hàng ngay trước', async () => {
      await move(catId(3), 'up', adminCookie);

      expect(await slugsInOrder()).toEqual(['day-trips', 'cruises', 'packages', 'retired']);
    });

    it('hàng ĐẦU bấm lên → 409 CANNOT_MOVE, thứ tự không đổi', async () => {
      const res = await move(catId(1), 'up', adminCookie);

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('CANNOT_MOVE');
      expect(await slugsInOrder()).toEqual(['day-trips', 'packages', 'cruises', 'retired']);
    });

    it('hàng CUỐI bấm xuống → 409 CANNOT_MOVE', async () => {
      const res = await move(catId(4), 'down', adminCookie);

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('CANNOT_MOVE');
    });

    it('hàng đã TẮT vẫn sắp được — thứ tự là thuộc tính của hàng, không phải của trạng thái', async () => {
      await move(catId(4), 'up', adminCookie);

      expect(await slugsInOrder()).toEqual(['day-trips', 'packages', 'retired', 'cruises']);
    });

    it('hai lượt trên hai cặp GIAO NHAU không sinh `order` trùng', async () => {
      // Ca này thay cho một ca cũ bắn `move(2,'down')` + `move(3,'up')`: hai
      // lệnh ấy là CÙNG MỘT phép đổi chỗ, nên mọi interleaving đều cho cùng kết
      // quả và ca đó không thể đỏ dù khoá có bị gỡ sạch.
      //
      // Hai cặp giao nhau thì khác: (2,3) và (3,4) dùng chung hàng 3. Nếu lệnh
      // thứ hai ghi bằng giá trị đã đọc TRƯỚC khi lệnh đầu commit, hai hàng
      // cùng số — im lặng và vĩnh viễn, vì cột `order` không unique.
      const results = await Promise.all([
        move(catId(2), 'down', adminCookie),
        move(catId(3), 'down', adminCookie),
      ]);

      // Không lượt nào được rơi xuống 500 (deadlock hay lỗi trần).
      for (const res of results) expect(res.statusCode).toBeLessThan(500);

      const orders = (await listOk()).map((row) => row.order);
      expect(new Set(orders).size).toBe(orders.length);
    });

    it('hàng nào cũng chỉ đứng một chỗ: `order` không bao giờ trùng sau một loạt lệnh', async () => {
      // Bốn lượt bắn cùng lúc, chạm cả bốn hàng theo nhiều hướng.
      const results = await Promise.all([
        move(catId(1), 'down', adminCookie),
        move(catId(2), 'down', adminCookie),
        move(catId(3), 'down', adminCookie),
        move(catId(4), 'up', adminCookie),
      ]);

      for (const res of results) expect(res.statusCode).toBeLessThan(500);

      const rows = await listOk();
      expect(new Set(rows.map((row) => row.order)).size).toBe(rows.length);
      // Và danh sách vẫn đủ bốn hàng, không mất không thêm.
      expect(rows.map((row) => row.slug).sort()).toEqual([
        'cruises',
        'day-trips',
        'packages',
        'retired',
      ]);
    });

    it('trả về CẢ danh sách đã sắp lại, không phải một hàng', async () => {
      // Đổi chỗ động tới hai hàng, nên trả một hàng là bắt client tự đoán hàng
      // kia — hoặc tự gọi `list` thêm một lượt.
      const res = await move(catId(1), 'down', adminCookie);

      expect(AdminCategoryRowSchema.array().parse(res.json())).toHaveLength(4);
    });
  });
});
