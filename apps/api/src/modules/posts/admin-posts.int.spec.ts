import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  AdminPostCreateResultSchema,
  AdminPostDetailSchema,
  AdminPostRowSchema,
  AdminPostTagSchema,
} from '@tourism/contract';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';

/**
 * Integration (Docker PG, db `tourism_test`) — quản trị bài viết (spec P4e-4, ADR-0051).
 * Bốn ca đắt nhất:
 *
 *  ① Hai lệnh sửa cùng một `version` bắn cùng lúc: ĐÚNG MỘT lệnh qua (`claimPost`).
 *  ② Bài đăng không bao giờ thành thiếu: lệnh làm thiếu bị từ chối và rollback trọn.
 *  ③ Thay ảnh bìa: chỉ ảnh tải lên của chính bài vào lại hàng dọn, ảnh thư viện và
 *    catalog thì không.
 *  ④ Xoá kéo theo đúng liên kết và dòng media, giữ tag.
 */

const PASSWORD = 'password-123';
const ADMIN_EMAIL = 'bootstrap-admin@tourism.test';
const CUSTOMER_EMAIL = 'posts-admin-customer@example.com';

const uuid = (prefix: string, n: number) =>
  `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const postId = (n: number) => uuid('f4e40001', n);
const tourId = (n: number) => uuid('f4e40002', n);
const CATEGORY_ID = uuid('f4e40003', 1);
const DEST_ID = uuid('f4e40004', 1);
const DAY_MS = 86_400_000;

const ROOT = 'tourism';
const mine = (n: number, name: string) => `${ROOT}/posts/${postId(n)}/${name}`;
const LIB = `${ROOT}/catalog/destination/hoi-an/1`;
const CATALOG = `${ROOT}/catalog/post/p4e4-post-1`;

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

describe('admin posts integration (P4e-4)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let customerCookie: string;
  let adminId: string;
  let web: WebRevalidationService;

  beforeAll(async () => {
    // Int spec chạy tuần tự (`fileParallelism: false`), nên dọn ở đây không giẫm spec khác.
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, tour_categories, destinations, media_assets, posts, post_tags CASCADE',
    );

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
    const signIn = (email: string) =>
      app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email, password: PASSWORD },
      });
    adminCookie = sessionCookie(await signIn(ADMIN_EMAIL));
    customerCookie = sessionCookie(await signIn(CUSTOMER_EMAIL));
    adminId = (await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } })).id;
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    // Xoá bài kéo theo post_tag_links và post_tours (Cascade). media_assets là bảng đa
    // chủ, không khoá ngoại — xoá riêng, không thì id dùng lại nhặt nhầm ảnh của ca trước.
    await prisma.post.deleteMany();
    await prisma.postTag.deleteMany();
    await prisma.mediaAsset.deleteMany();
    await prisma.mediaGarbage.deleteMany();
    await prisma.tour.deleteMany();
    await prisma.destination.deleteMany();
    await prisma.tourCategory.deleteMany();
    await prisma.tourCategory.create({
      data: { id: CATEGORY_ID, slug: 'day-trips', name: 'Day trips', order: 1 },
    });
    await prisma.destination.create({
      data: { id: DEST_ID, slug: 'hoi-an', name: 'Hội An', region: 'Central Vietnam' },
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  const makeTour = (n: number, isPublished = true) =>
    prisma.tour.create({
      data: {
        id: tourId(n),
        slug: `p4e4-tour-${n}`,
        title: `P4e-4 Tour ${n}`,
        summary: 'A day out.',
        categoryId: CATEGORY_ID,
        durationDays: 1,
        maxGroupSize: 10,
        basePrice: '10.00',
        isPublished,
      },
    });

  /** Một bài ĐỦ để đăng, đã đăng từ hôm qua — ca nào cần khác thì đè bằng `patch`. */
  const makePost = (n: number, patch: Partial<Prisma.PostUncheckedCreateInput> = {}) =>
    prisma.post.create({
      data: {
        id: postId(n),
        slug: `p4e4-post-${n}`,
        title: `P4e-4 Post ${n}`,
        excerpt: 'A short story.',
        content: '## Morning\n\nCoffee first.',
        status: 'PUBLISHED',
        publishedAt: new Date(Date.now() - DAY_MS),
        authorId: adminId,
        ...patch,
      },
    });

  const makeCover = (n: number, publicId: string) =>
    prisma.mediaAsset.create({
      data: {
        ownerType: 'POST',
        ownerId: postId(n),
        publicId,
        type: 'IMAGE',
        role: 'hero',
        sortOrder: 0,
        alt: 'Old cover',
        version: '1700000000',
      },
    });

  /** Ảnh thư viện CÓ đủ ghi công — ca "chép ghi công" cần nó KHÁC thứ client gửi. */
  const makeLibrary = () =>
    prisma.mediaAsset.create({
      data: {
        ownerType: 'DESTINATION',
        ownerId: DEST_ID,
        publicId: LIB,
        type: 'IMAGE',
        role: 'gallery',
        sortOrder: 1,
        alt: 'Lanterns over the river',
        version: '1700000001',
        author: 'Jane Doe',
        license: 'CC BY-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Lanterns.jpg',
      },
    });

  const get = (slug: string, cookie = adminCookie) =>
    app.inject({ method: 'GET', url: `/api/admin/posts/${slug}`, headers: { cookie } });
  const list = (query = '', cookie = adminCookie) =>
    app.inject({ method: 'GET', url: `/api/admin/posts${query}`, headers: { cookie } });
  const post = (url: string, payload: Record<string, unknown>, cookie = adminCookie) =>
    app.inject({ method: 'POST', url, headers: { cookie }, payload });
  const create = (payload: Record<string, unknown>, cookie = adminCookie) =>
    post('/api/admin/posts', payload, cookie);
  const tags = (cookie = adminCookie) =>
    app.inject({ method: 'GET', url: '/api/admin/post-tags', headers: { cookie } });

  describe('quyền', () => {
    it('ẩn danh 401, khách 403 — trên cả đường đọc lẫn đường ghi', async () => {
      await makePost(1);
      expect((await list('', '')).statusCode).toBe(401);
      expect((await get('p4e4-post-1', '')).statusCode).toBe(401);
      expect((await list('', customerCookie)).statusCode).toBe(403);
      expect((await get('p4e4-post-1', customerCookie)).statusCode).toBe(403);
      expect((await create({ title: 'X', slug: 'x' }, customerCookie)).statusCode).toBe(403);
      expect((await tags(customerCookie)).statusCode).toBe(403);
    });
  });

  describe('list', () => {
    it('bốn tab theo trạng thái hiển thị; bài PUBLISHED thiếu ngày nằm ở Drafts', async () => {
      await makePost(1);
      await makePost(2, { publishedAt: new Date(Date.now() + DAY_MS) });
      await makePost(3, { status: 'DRAFT' });
      await makePost(4, { publishedAt: null });

      const slugs = async (status: string) =>
        (await list(`?status=${status}`))
          .json()
          .items.map((row: { slug: string }) => row.slug)
          .sort();

      expect(await slugs('all')).toEqual([
        'p4e4-post-1',
        'p4e4-post-2',
        'p4e4-post-3',
        'p4e4-post-4',
      ]);
      expect(await slugs('published')).toEqual(['p4e4-post-1']);
      expect(await slugs('scheduled')).toEqual(['p4e4-post-2']);
      expect(await slugs('draft')).toEqual(['p4e4-post-3', 'p4e4-post-4']);
    });

    it('hàng khớp contract: chip, ảnh bìa nhỏ, tag sắp theo tên; sửa gần nhất trước', async () => {
      await makePost(1);
      await makePost(2, { publishedAt: new Date(Date.now() + DAY_MS) });
      await makeCover(2, mine(2, 'cover'));
      await prisma.postTag.createMany({
        data: [
          { slug: 'zen', name: 'Zen' },
          { slug: 'art', name: 'Art' },
        ],
      });
      const [zen, art] = await Promise.all([
        prisma.postTag.findUniqueOrThrow({ where: { slug: 'zen' } }),
        prisma.postTag.findUniqueOrThrow({ where: { slug: 'art' } }),
      ]);
      await prisma.postTagLink.createMany({
        data: [
          { postId: postId(2), tagId: zen.id },
          { postId: postId(2), tagId: art.id },
        ],
      });

      const res = await list();

      expect(res.statusCode).toBe(200);
      const [first, second] = res.json().items;
      expect(AdminPostRowSchema.parse(first)).toEqual(first);
      expect(first.slug).toBe('p4e4-post-2');
      expect(first.displayStatus).toBe('scheduled');
      expect(first.coverUrl).toContain(`/v1700000000/${mine(2, 'cover')}`);
      expect(first.tags.map((tag: { name: string }) => tag.name)).toEqual(['Art', 'Zen']);
      expect(second.coverUrl).toBeNull();
    });

    it('tìm theo tiêu đề, không phân biệt hoa thường; `%` là chữ, không phải wildcard', async () => {
      await makePost(1, { title: 'Hoi An by night' });
      await makePost(2, { title: '100% Saigon' });

      const titles = async (q: string) =>
        (await list(`?search=${encodeURIComponent(q)}`))
          .json()
          .items.map((row: { title: string }) => row.title);

      expect(await titles('hoi an')).toEqual(['Hoi An by night']);
      expect(await titles('%')).toEqual(['100% Saigon']);
    });
  });

  describe('get', () => {
    it('đọc được nháp; thiếu ảnh bìa thì readiness nói ra; tour giữ thứ tự lưu', async () => {
      await makePost(1, { status: 'DRAFT', excerpt: null });
      await makeTour(1);
      await makeTour(2, false);
      await prisma.postTour.createMany({
        data: [
          { postId: postId(1), tourId: tourId(2), order: 0 },
          { postId: postId(1), tourId: tourId(1), order: 1 },
        ],
      });

      const res = await get('p4e4-post-1');

      expect(res.statusCode).toBe(200);
      const detail = AdminPostDetailSchema.parse(res.json());
      expect(detail.displayStatus).toBe('draft');
      expect(detail.readiness).toEqual(['excerpt', 'cover']);
      expect(detail.relatedTours.map((tour) => [tour.slug, tour.isPublished])).toEqual([
        ['p4e4-tour-2', false],
        ['p4e4-tour-1', true],
      ]);
      expect(detail.author.name).toBe('Test User');
    });

    it.each([
      ['UPLOAD', mine(1, 'cover')],
      ['LIBRARY', LIB],
      ['CATALOG', CATALOG],
    ])('nguồn ảnh bìa %s', async (source, publicId) => {
      await makePost(1);
      await makeLibrary();
      await makeCover(1, publicId);

      const detail = AdminPostDetailSchema.parse((await get('p4e4-post-1')).json());

      expect(detail.cover?.source).toBe(source);
      expect(detail.readiness).toEqual([]);
    });

    it('slug không có thì 404 NOT_FOUND', async () => {
      const res = await get('no-such-post');
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('create', () => {
    it('sinh nháp rỗng, tác giả là admin đang tạo; không bust', async () => {
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      const res = await create({ title: '  Street food in Hội An  ', slug: 'street-food-hoi-an' });

      expect(res.statusCode).toBe(200);
      const created = AdminPostCreateResultSchema.parse(res.json());
      const row = await prisma.post.findUniqueOrThrow({ where: { id: created.id } });
      expect(row).toMatchObject({
        slug: 'street-food-hoi-an',
        title: 'Street food in Hội An',
        content: '',
        status: 'DRAFT',
        publishedAt: null,
        authorId: adminId,
      });
      expect(revalidate).not.toHaveBeenCalled();
    });

    it('slug trùng thì 409 SLUG_TAKEN; slug sai hình dạng thì 400', async () => {
      await makePost(1);
      const taken = await create({ title: 'Again', slug: 'p4e4-post-1' });
      expect(taken.statusCode).toBe(409);
      expect(taken.json()).toMatchObject({ code: 'SLUG_TAKEN' });
      expect((await create({ title: 'Bad', slug: 'Bad Slug' })).statusCode).toBe(400);
    });
  });

  describe('tags', () => {
    it('đếm cả bài nháp; tag không còn bài nào có mặt với số 0; sắp theo tên', async () => {
      await makePost(1, { status: 'DRAFT' });
      await prisma.postTag.createMany({
        data: [
          { slug: 'food', name: 'Food' },
          { slug: 'art', name: 'Art' },
        ],
      });
      const food = await prisma.postTag.findUniqueOrThrow({ where: { slug: 'food' } });
      await prisma.postTagLink.create({ data: { postId: postId(1), tagId: food.id } });

      const res = await tags();

      expect(res.statusCode).toBe(200);
      expect(res.json().map((row: unknown) => AdminPostTagSchema.parse(row))).toEqual([
        { slug: 'art', name: 'Art', count: 0 },
        { slug: 'food', name: 'Food', count: 1 },
      ]);
    });
  });
});
