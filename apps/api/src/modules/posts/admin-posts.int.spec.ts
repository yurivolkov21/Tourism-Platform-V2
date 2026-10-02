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
const MISSING = uuid('f4e400ff', 1);
const UPLOAD_META = {
  version: '1759000000',
  width: 2000,
  height: 1333,
  format: 'jpg',
  bytes: 523000,
};

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

  const save = (n: number, payload: Record<string, unknown>, cookie = adminCookie) =>
    post(`/api/admin/posts/${postId(n)}`, payload, cookie);
  const versionOf = async (n: number) =>
    (await prisma.post.findUniqueOrThrow({ where: { id: postId(n) } })).updatedAt.toISOString();
  const coverRows = (n: number) =>
    prisma.mediaAsset.findMany({ where: { ownerType: 'POST', ownerId: postId(n) } });

  /** Lệnh lưu ĐỦ để đăng cho bài `n`, ở phiên bản hiện tại — ca nào cần khác thì đè. */
  const fullSave = async (n: number, patch: Record<string, unknown> = {}) => ({
    id: postId(n),
    version: await versionOf(n),
    title: `P4e-4 Post ${n} edited`,
    excerpt: 'A new excerpt.',
    content: '## Afternoon\n\nTea by the river.',
    status: 'PUBLISHED',
    publishedAt: new Date(Date.now() - DAY_MS).toISOString(),
    tags: [],
    relatedTourIds: [],
    cover: { publicId: mine(n, 'new'), alt: null, upload: UPLOAD_META },
    ...patch,
  });

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

  describe('update', () => {
    it('lưu đủ trường: tag mới và tag sẵn có, tour theo thứ tự gửi, ảnh bìa tải lên; bust đúng hai tag', async () => {
      await makePost(1, { status: 'DRAFT', publishedAt: null });
      await makeTour(1);
      await makeTour(2, false);
      await prisma.postTag.create({ data: { slug: 'food', name: 'Food' } });
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);
      const payload = await fullSave(1, {
        tags: ['FOOD', 'Hội An', 'Hoi An'],
        relatedTourIds: [tourId(2), tourId(1)],
        cover: { publicId: mine(1, 'new'), alt: '  Lanterns at dusk  ', upload: UPLOAD_META },
      });

      const res = await save(1, payload);

      expect(res.statusCode).toBe(200);
      const detail = AdminPostDetailSchema.parse(res.json());
      expect(detail).toMatchObject({
        title: 'P4e-4 Post 1 edited',
        excerpt: 'A new excerpt.',
        status: 'PUBLISHED',
        displayStatus: 'published',
        readiness: [],
      });
      expect(detail.version).not.toBe(payload.version);
      // Tag sẵn có giữ tên cũ dù gửi "FOOD"; "Hội An" và "Hoi An" là một tag.
      expect(detail.tags).toEqual([
        { slug: 'food', name: 'Food' },
        { slug: 'hoi-an', name: 'Hội An' },
      ]);
      expect(detail.relatedTours.map((tour) => tour.id)).toEqual([tourId(2), tourId(1)]);
      expect(detail.cover).toMatchObject({
        publicId: mine(1, 'new'),
        alt: 'Lanterns at dusk',
        source: 'UPLOAD',
      });
      const [row] = await coverRows(1);
      expect(row).toMatchObject({
        role: 'hero',
        sortOrder: 0,
        version: '1759000000',
        width: 2000,
        bytes: 523000,
        format: 'jpg',
      });
      expect(revalidate).toHaveBeenCalledWith(['posts', 'post:p4e4-post-1']);
    });

    it('phiên bản cũ: 409 STALE_POST, không đổi gì, không bust', async () => {
      await makePost(1);
      const stale = await fullSave(1);
      expect((await save(1, await fullSave(1, { title: 'First writer' }))).statusCode).toBe(200);
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      const res = await save(1, { ...stale, title: 'Second writer' });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'STALE_POST' });
      const row = await prisma.post.findUniqueOrThrow({ where: { id: postId(1) } });
      expect(row.title).toBe('First writer');
      expect(revalidate).not.toHaveBeenCalled();
    });

    it('hai lệnh cùng version bắn cùng lúc: đúng MỘT lệnh qua', async () => {
      await makePost(1);
      const payload = await fullSave(1);

      const [a, b] = await Promise.all([
        save(1, { ...payload, title: 'Writer A' }),
        save(1, { ...payload, title: 'Writer B' }),
      ]);

      expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
      const winner = a.statusCode === 200 ? 'Writer A' : 'Writer B';
      const row = await prisma.post.findUniqueOrThrow({ where: { id: postId(1) } });
      expect(row.title).toBe(winner);
    });

    it('bài không có: 404 NOT_FOUND; khách: 403', async () => {
      const ghost = {
        id: MISSING,
        version: new Date().toISOString(),
        title: 'Ghost',
        excerpt: null,
        content: '',
        status: 'DRAFT',
        publishedAt: null,
        tags: [],
        relatedTourIds: [],
        cover: null,
      };
      const res = await post(`/api/admin/posts/${MISSING}`, ghost);
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'NOT_FOUND' });
      expect((await post(`/api/admin/posts/${MISSING}`, ghost, customerCookie)).statusCode).toBe(
        403,
      );
    });

    it('đăng mà thiếu: 409 POST_NOT_READY, rollback trọn; nháp thiếu mọi thứ vẫn lưu được', async () => {
      await makePost(1, { status: 'DRAFT', publishedAt: null, excerpt: null, content: '' });
      const before = await versionOf(1);

      const res = await save(1, await fullSave(1, { excerpt: null, cover: null }));

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'POST_NOT_READY' });
      expect(await versionOf(1)).toBe(before);
      const draft = await save(
        1,
        await fullSave(1, {
          status: 'DRAFT',
          publishedAt: null,
          excerpt: null,
          content: '',
          cover: null,
        }),
      );
      expect(draft.statusCode).toBe(200);
      expect(AdminPostDetailSchema.parse(draft.json()).readiness).toEqual([
        'content',
        'excerpt',
        'cover',
      ]);
    });

    it('bài đang đăng không thể lưu thành thiếu — cùng cổng của tour đang bán', async () => {
      await makePost(1);
      await makeCover(1, mine(1, 'old'));

      const res = await save(
        1,
        await fullSave(1, { cover: { publicId: mine(1, 'old'), alt: null }, excerpt: '   ' }),
      );

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'POST_NOT_READY' });
      const row = await prisma.post.findUniqueOrThrow({ where: { id: postId(1) } });
      expect(row.excerpt).toBe('A short story.');
    });

    it('hẹn giờ: chip Scheduled, bài chưa lên đường công khai trước giờ đăng', async () => {
      await makePost(1, { status: 'DRAFT', publishedAt: null });

      const res = await save(
        1,
        await fullSave(1, { publishedAt: new Date(Date.now() + DAY_MS).toISOString() }),
      );

      expect(res.statusCode).toBe(200);
      expect(AdminPostDetailSchema.parse(res.json()).displayStatus).toBe('scheduled');
      expect((await app.inject({ method: 'GET', url: '/api/posts/p4e4-post-1' })).statusCode).toBe(
        404,
      );
      const publicList = await app.inject({ method: 'GET', url: '/api/posts' });
      expect(publicList.json().items.map((item: { slug: string }) => item.slug)).not.toContain(
        'p4e4-post-1',
      );
    });

    it('ảnh tải lên cũ đổi sang ảnh thư viện: dòng cũ đi, chép ghi công, ảnh cũ vào hàng dọn', async () => {
      await makePost(1);
      await makeCover(1, mine(1, 'old'));
      await makeLibrary();

      const res = await save(1, await fullSave(1, { cover: { publicId: LIB, alt: null } }));

      expect(res.statusCode).toBe(200);
      const rows = await coverRows(1);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        publicId: LIB,
        role: 'hero',
        alt: null,
        author: 'Jane Doe',
        license: 'CC BY-SA 4.0',
        version: '1700000001',
      });
      expect((await prisma.mediaGarbage.findMany()).map((row) => row.publicId)).toEqual([
        mine(1, 'old'),
      ]);
    });

    it('thay ảnh catalog: ảnh catalog KHÔNG vào hàng dọn', async () => {
      await makePost(1);
      await makeCover(1, CATALOG);

      expect((await save(1, await fullSave(1))).statusCode).toBe(200);

      expect(await prisma.mediaGarbage.count()).toBe(0);
    });

    it('giữ ảnh hiện có, đổi alt: dòng giữ version cũ, không gì vào hàng dọn', async () => {
      await makePost(1);
      await makeCover(1, mine(1, 'old'));

      const res = await save(
        1,
        await fullSave(1, { cover: { publicId: mine(1, 'old'), alt: 'Better alt' } }),
      );

      expect(res.statusCode).toBe(200);
      expect((await coverRows(1))[0]).toMatchObject({
        publicId: mine(1, 'old'),
        alt: 'Better alt',
        version: '1700000000',
      });
      expect(await prisma.mediaGarbage.count()).toBe(0);
    });

    it.each([
      ['ảnh lạ', { publicId: `${ROOT}/catalog/post/unknown`, alt: null }],
      ['ảnh tải lên thiếu metadata', { publicId: mine(1, 'new'), alt: null }],
      ['thư mục của bài khác', { publicId: mine(2, 'x'), alt: null, upload: UPLOAD_META }],
    ])('ảnh bìa %s: 400 PHOTO_NOT_ALLOWED, rollback trọn', async (_, cover) => {
      await makePost(1);
      await makeCover(1, mine(1, 'old'));
      const before = await versionOf(1);

      const res = await save(1, await fullSave(1, { cover }));

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'PHOTO_NOT_ALLOWED' });
      expect(await versionOf(1)).toBe(before);
      expect((await coverRows(1)).map((row) => row.publicId)).toEqual([mine(1, 'old')]);
      expect(await prisma.mediaGarbage.count()).toBe(0);
    });

    it('tour không có: 404 RELATED_TOUR_NOT_FOUND, rollback trọn', async () => {
      await makePost(1);
      await makeTour(1);
      const before = await versionOf(1);

      const res = await save(1, await fullSave(1, { relatedTourIds: [tourId(1), MISSING] }));

      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'RELATED_TOUR_NOT_FOUND' });
      expect(await versionOf(1)).toBe(before);
      expect(await prisma.postTour.count()).toBe(0);
    });

    it('danh sách rỗng gỡ hết tag và tour; tag không còn bài nào vẫn ở lại', async () => {
      await makePost(1);
      await makeTour(1);
      await save(1, await fullSave(1, { tags: ['Food'], relatedTourIds: [tourId(1)] }));

      const res = await save(1, await fullSave(1, { tags: [], relatedTourIds: [] }));

      expect(res.statusCode).toBe(200);
      expect(await prisma.postTagLink.count()).toBe(0);
      expect(await prisma.postTour.count()).toBe(0);
      expect(await prisma.postTag.count()).toBe(1);
    });

    it('thân bài có ảnh nhúng: 400 từ contract, chưa chạm DB', async () => {
      await makePost(1);
      const before = await versionOf(1);
      const res = await save(1, await fullSave(1, { content: '![x](https://example.com/x.jpg)' }));
      expect(res.statusCode).toBe(400);
      expect(await versionOf(1)).toBe(before);
    });
  });
});
