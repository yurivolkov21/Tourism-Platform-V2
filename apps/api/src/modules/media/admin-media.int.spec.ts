import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  type AdminMediaItem,
  AdminMediaItemSchema,
  AdminMediaQueueSchema,
  AdminTourDetailSchema,
} from '@tourism/contract';
import { PgBoss } from 'pg-boss';
import { z } from 'zod';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import { env } from '../../config/env.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { trackOpenTransactions } from '../../test/open-transactions.js';
import { sessionCookie } from '../../test/session-cookie.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';
import { MEDIA_GC_QUEUE } from './media-garbage.js';
import { MediaGarbageService } from './media-garbage.service.js';

/**
 * Integration (Docker PG, db `tourism_test`) — Media library (spec P4f 16/10, ADR-0060).
 * Bốn ca đắt nhất:
 *
 *  ① Một lần sửa ghi MỌI dòng của ảnh và chạm version của mọi chủ có dòng đổi — tab Photos đang
 *    mở với version cũ nhận `STALE_TOUR` thay vì âm thầm ghi đè alt vừa sửa.
 *  ② Không gì đổi thì không ghi, không chạm chủ, không bust.
 *  ③ Hai lệnh sửa cùng version bắn cùng lúc: đúng MỘT lệnh qua.
 *  ④ Handler `media-gc` chạy trên pg-boss THẬT lưu `SweepReport` làm output, và tab Cleanup
 *    queue đọc lại đúng nó.
 */

const PASSWORD = 'password-123';
const ADMIN_EMAIL = 'bootstrap-admin@tourism.test';
const STAFF_EMAIL = 'media-staff@tourism.test';
const CUSTOMER_EMAIL = 'media-customer@example.com';

const uuid = (prefix: string, n: number) =>
  `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CATEGORY_ID = uuid('a9600001', 1);
const DEST_ID = uuid('a9600002', 1);
const tourId = (n: number) => uuid('a9600003', n);
const POST_ID = uuid('a9600004', 1);
const SLOT_ID = uuid('a9600005', 1);
const DAY_MS = 86_400_000;

const ROOT = 'tourism';
const LIB = `${ROOT}/catalog/destination/hoi-an/1`;
const TOUR_HERO = `${ROOT}/catalog/tour/hoi-an-by-night/hero`;
const POST_COVER = `${ROOT}/catalog/post/a-night-market/hero`;
const SLOT_PHOTO = `${ROOT}/catalog/site/home-hero`;
const FILE = '5f0c2b1e-9d3a-4c7b-8e21-6a4f0d9b7c13';

const ItemListSchema = z.array(AdminMediaItemSchema);

describe('admin media integration (P4f, ADR-0060)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let staffCookie: string;
  let customerCookie: string;
  let customerId: string;
  let web: WebRevalidationService;
  let mediaGarbage: MediaGarbageService;

  beforeAll(async () => {
    // Int spec chạy tuần tự (`fileParallelism: false`), nên dọn ở đây không giẫm spec khác.
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, tour_categories, destinations, tours, posts, media_assets, site_media_slots, media_garbage CASCADE',
    );

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      rawBody: true,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    web = moduleRef.get(WebRevalidationService);
    mediaGarbage = moduleRef.get(MediaGarbageService);

    const roles = { [ADMIN_EMAIL]: 'ADMIN', [STAFF_EMAIL]: 'STAFF' } as const;
    for (const email of [ADMIN_EMAIL, STAFF_EMAIL, CUSTOMER_EMAIL]) {
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email, password: PASSWORD, name: 'Test User' },
      });
      await prisma.user.update({
        where: { email },
        data: {
          emailVerified: true,
          ...(email in roles ? { role: roles[email as keyof typeof roles] } : {}),
        },
      });
    }
    const signIn = (email: string) =>
      app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email, password: PASSWORD },
      });
    adminCookie = sessionCookie(await signIn(ADMIN_EMAIL));
    staffCookie = sessionCookie(await signIn(STAFF_EMAIL));
    customerCookie = sessionCookie(await signIn(CUSTOMER_EMAIL));
    customerId = (await prisma.user.findUniqueOrThrow({ where: { email: CUSTOMER_EMAIL } })).id;
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    // media_assets là bảng đa chủ, không khoá ngoại — xoá riêng.
    await prisma.mediaAsset.deleteMany();
    await prisma.mediaGarbage.deleteMany();
    await prisma.siteMediaSlot.deleteMany();
    await prisma.post.deleteMany();
    await prisma.tour.deleteMany();
    await prisma.destination.deleteMany();
    await prisma.tourCategory.deleteMany();
    await prisma.user.update({ where: { id: customerId }, data: { image: null } });

    const yesterday = new Date(Date.now() - DAY_MS);
    await prisma.tourCategory.create({
      data: { id: CATEGORY_ID, slug: 'culture', name: 'Culture' },
    });
    await prisma.destination.create({
      data: { id: DEST_ID, slug: 'hoi-an', name: 'Hoi An', updatedAt: yesterday },
    });
    for (const n of [1, 2]) {
      await prisma.tour.create({
        data: {
          id: tourId(n),
          slug: `media-tour-${n}`,
          title: `Media tour ${n}`,
          categoryId: CATEGORY_ID,
          durationDays: 1,
          basePrice: '39.00',
          currency: 'USD',
          isPublished: true,
          updatedAt: yesterday,
          destinations: { create: [{ destinationId: DEST_ID, isPrimary: true }] },
        } as unknown as Prisma.TourCreateInput,
      });
    }
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
    await prisma.post.create({
      data: {
        id: POST_ID,
        slug: 'a-night-market',
        title: 'A night market',
        excerpt: 'A short story.',
        content: '## Dusk\n\nStalls open.',
        status: 'PUBLISHED',
        publishedAt: yesterday,
        authorId: admin.id,
        updatedAt: yesterday,
      },
    });
    await prisma.siteMediaSlot.create({
      data: { id: SLOT_ID, key: 'home-hero', createdAt: yesterday, updatedAt: yesterday },
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  const old = new Date(Date.now() - 3 * DAY_MS);
  const asset = (data: Partial<Prisma.MediaAssetUncheckedCreateInput>) =>
    prisma.mediaAsset.create({
      data: {
        ownerType: 'TOUR',
        ownerId: tourId(1),
        publicId: LIB,
        type: 'IMAGE',
        role: 'gallery',
        sortOrder: 1,
        alt: 'Lanterns over the river',
        author: 'Jane Doe',
        license: 'CC BY-SA 4.0',
        createdAt: old,
        updatedAt: old,
        ...data,
      },
    });

  /** Ảnh thư viện của Hội An, tour 1 mượn nó — hai dòng, một ảnh. */
  async function libraryBorrowedByTour() {
    await asset({
      ownerType: 'DESTINATION',
      ownerId: DEST_ID,
      role: 'hero',
      sortOrder: 0,
      width: 2400,
      height: 1600,
      bytes: 512_000,
      format: 'jpg',
      version: '1786000000',
    });
    await asset({ ownerId: tourId(1) });
  }

  const get = (url: string, cookie = adminCookie) =>
    app.inject({ method: 'GET', url, headers: { cookie } });
  const list = (cookie = adminCookie) => get('/api/admin/media', cookie);
  const queue = (cookie = adminCookie) => get('/api/admin/media/queue', cookie);
  const update = (payload: Record<string, unknown>, cookie = adminCookie) =>
    app.inject({ method: 'POST', url: '/api/admin/media', headers: { cookie }, payload });

  const itemOf = async (publicId: string): Promise<AdminMediaItem> => {
    const items = ItemListSchema.parse((await list()).json());
    const item = items.find((entry) => entry.publicId === publicId);
    if (!item) throw new Error(`list thiếu ảnh ${publicId}`);
    return item;
  };
  const payloadFor = (item: AdminMediaItem, patch: Record<string, unknown> = {}) => ({
    publicId: item.publicId,
    version: item.version,
    alt: item.alt,
    author: item.author,
    license: item.license,
    licenseUrl: item.licenseUrl,
    sourceUrl: item.sourceUrl,
    ...patch,
  });
  const LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';

  describe('quyền', () => {
    it('ẩn danh 401, khách 403 — đủ ba đường', async () => {
      for (const cookie of ['', customerCookie]) {
        const expected = cookie === '' ? 401 : 403;
        expect((await list(cookie)).statusCode).toBe(expected);
        expect((await queue(cookie)).statusCode).toBe(expected);
        expect((await update({}, cookie)).statusCode).toBe(expected);
      }
    });

    it('Staff đọc và sửa được — cùng bậc sửa tour và bài viết (ADR-0052)', async () => {
      await libraryBorrowedByTour();
      const item = await itemOf(LIB);

      expect((await list(staffCookie)).statusCode).toBe(200);
      expect((await queue(staffCookie)).statusCode).toBe(200);
      const res = await update(payloadFor(item, { licenseUrl: LICENSE_URL }), staffCookie);
      expect(res.statusCode).toBe(200);
    });
  });

  describe('list', () => {
    it('gom theo publicId, bỏ REVIEW và video, số đo từ dòng thư viện, nhãn chỗ dùng', async () => {
      await libraryBorrowedByTour();
      await asset({ ownerId: tourId(2) });
      await asset({ publicId: TOUR_HERO, role: 'hero', sortOrder: 0, author: null, license: null });
      await asset({
        ownerType: 'POST',
        ownerId: POST_ID,
        publicId: POST_COVER,
        role: 'hero',
        alt: null,
        author: null,
        license: null,
        createdAt: new Date(),
      });
      await asset({ ownerType: 'SITE', ownerId: SLOT_ID, publicId: SLOT_PHOTO, role: 'hero' });
      await asset({ ownerType: 'REVIEW', ownerId: uuid('a9600006', 1), publicId: 'tourism/r/x' });
      await asset({
        ownerType: 'DESTINATION',
        ownerId: DEST_ID,
        publicId: 'tourism/v',
        type: 'VIDEO',
      });

      const res = await list();
      expect(res.statusCode).toBe(200);
      const items = ItemListSchema.parse(res.json());

      // Ảnh bìa bài viết có dòng mới nhất nên đứng đầu; REVIEW và video không có mặt.
      expect(items.map((item) => item.publicId).sort()).toEqual(
        [LIB, POST_COVER, SLOT_PHOTO, TOUR_HERO].sort(),
      );
      expect(items[0]?.publicId).toBe(POST_COVER);

      const lib = items.find((item) => item.publicId === LIB);
      expect(lib).toMatchObject({
        width: 2400,
        bytes: 512_000,
        altRequired: true,
        source: 'CATALOG',
        attention: ['CREDIT_INCOMPLETE'],
      });
      expect(lib?.url).toContain('/v1786000000/');
      expect(lib?.usages.map((usage) => [usage.ownerType, usage.label, usage.slug])).toEqual([
        ['DESTINATION', 'Hoi An', 'hoi-an'],
        ['TOUR', 'Media tour 1', 'media-tour-1'],
        ['TOUR', 'Media tour 2', 'media-tour-2'],
      ]);
      expect(items.find((item) => item.publicId === SLOT_PHOTO)?.usages).toEqual([
        expect.objectContaining({ ownerType: 'SITE', key: 'home-hero', label: null }),
      ]);
      // Chỉ bài viết: alt trống là ảnh trang trí, không phải việc cần chú ý.
      expect(items.find((item) => item.publicId === POST_COVER)).toMatchObject({
        altRequired: false,
        attention: [],
      });
    });
  });

  describe('update', () => {
    it('ghi mọi dòng, chạm version của tour và điểm đến; tab Photos mở trước đó nhận STALE_TOUR', async () => {
      await libraryBorrowedByTour();
      // Version mà tab Photos đang cầm — đọc qua đúng đường admin mở khu sửa tour.
      const photosVersion = AdminTourDetailSchema.parse(
        (await get('/api/admin/tours/media-tour-1')).json(),
      ).version;
      const destinationBefore = await prisma.destination.findUniqueOrThrow({
        where: { id: DEST_ID },
      });
      const item = await itemOf(LIB);

      const res = await update(
        payloadFor(item, { alt: '  Lanterns at dusk  ', licenseUrl: LICENSE_URL, author: '' }),
      );

      expect(res.statusCode).toBe(200);
      const saved = AdminMediaItemSchema.parse(res.json());
      expect(saved).toMatchObject({
        alt: 'Lanterns at dusk',
        author: null,
        licenseUrl: LICENSE_URL,
        altVaries: false,
        creditVaries: false,
      });
      expect(saved.version).not.toBe(item.version);
      const rows = await prisma.mediaAsset.findMany({ where: { publicId: LIB } });
      expect(rows.map((row) => [row.alt, row.author, row.licenseUrl])).toEqual([
        ['Lanterns at dusk', null, LICENSE_URL],
        ['Lanterns at dusk', null, LICENSE_URL],
      ]);
      const destinationAfter = await prisma.destination.findUniqueOrThrow({
        where: { id: DEST_ID },
      });
      expect(destinationAfter.updatedAt.getTime()).toBeGreaterThan(
        destinationBefore.updatedAt.getTime(),
      );

      // Tab Photos đang mở gửi lại alt CŨ với version cũ — phải bị từ chối, không ghi đè.
      const stale = await app.inject({
        method: 'POST',
        url: `/api/admin/tours/${tourId(1)}/photos`,
        headers: { cookie: adminCookie },
        payload: {
          id: tourId(1),
          version: photosVersion,
          photos: [{ publicId: LIB, alt: 'Lanterns over the river' }],
        },
      });
      expect(stale.statusCode).toBe(409);
      expect(stale.json()).toMatchObject({ code: 'STALE_TOUR' });
      const tourRow = await prisma.mediaAsset.findFirstOrThrow({
        where: { ownerType: 'TOUR', ownerId: tourId(1), publicId: LIB },
      });
      expect(tourRow.alt).toBe('Lanterns at dusk');
    });

    it('bust SAU commit, gộp trùng: tour, các tour gắn điểm đến, bài viết, khe', async () => {
      await libraryBorrowedByTour();
      await asset({ ownerType: 'POST', ownerId: POST_ID, role: 'hero' });
      await asset({ ownerType: 'SITE', ownerId: SLOT_ID, role: 'hero' });
      const item = await itemOf(LIB);
      const openTransactions = trackOpenTransactions();
      const bust = vi.spyOn(web, 'revalidate').mockImplementation(async () => {
        expect(openTransactions()).toBe(0);
      });

      expect((await update(payloadFor(item, { licenseUrl: LICENSE_URL }))).statusCode).toBe(200);

      expect(bust).toHaveBeenCalledTimes(1);
      expect(bust.mock.calls[0]?.[0]).toEqual([
        'tours',
        'tour:media-tour-1',
        'tour:media-tour-2',
        'posts',
        'post:a-night-market',
        'site-media',
      ]);
    });

    it('không gì đổi: không ghi dòng nào, không chạm chủ, không bust', async () => {
      await libraryBorrowedByTour();
      const item = await itemOf(LIB);
      const before = await prisma.mediaAsset.findMany({ where: { publicId: LIB } });
      const tourBefore = await prisma.tour.findUniqueOrThrow({ where: { id: tourId(1) } });
      const bust = vi.spyOn(web, 'revalidate');

      const res = await update(payloadFor(item));

      expect(res.statusCode).toBe(200);
      expect(AdminMediaItemSchema.parse(res.json()).version).toBe(item.version);
      const after = await prisma.mediaAsset.findMany({ where: { publicId: LIB } });
      expect(after.map((row) => row.updatedAt.getTime()).sort()).toEqual(
        before.map((row) => row.updatedAt.getTime()).sort(),
      );
      const tourAfter = await prisma.tour.findUniqueOrThrow({ where: { id: tourId(1) } });
      expect(tourAfter.updatedAt.getTime()).toBe(tourBefore.updatedAt.getTime());
      expect(bust).not.toHaveBeenCalled();
    });

    it('chỉ ghi dòng đang khác; chủ của dòng đã đúng không bị chạm', async () => {
      await libraryBorrowedByTour();
      await asset({ ownerId: tourId(2), licenseUrl: LICENSE_URL, alt: 'Lanterns over the river' });
      await prisma.mediaAsset.updateMany({
        where: { publicId: LIB, ownerType: 'DESTINATION' },
        data: { licenseUrl: LICENSE_URL },
      });
      const item = await itemOf(LIB);
      const tour2Before = await prisma.tour.findUniqueOrThrow({ where: { id: tourId(2) } });

      expect((await update(payloadFor(item, { licenseUrl: LICENSE_URL }))).statusCode).toBe(200);

      const tour2After = await prisma.tour.findUniqueOrThrow({ where: { id: tourId(2) } });
      expect(tour2After.updatedAt.getTime()).toBe(tour2Before.updatedAt.getTime());
      const tour1 = await prisma.tour.findUniqueOrThrow({ where: { id: tourId(1) } });
      expect(tour1.updatedAt.getTime()).toBeGreaterThan(tour2Before.updatedAt.getTime());
    });

    it('version cũ, hay một tour vừa mượn thêm ảnh: 409 STALE_MEDIA, không đổi gì', async () => {
      await libraryBorrowedByTour();
      const item = await itemOf(LIB);
      await asset({ ownerId: tourId(2) });

      const res = await update(payloadFor(item, { alt: 'Changed' }));

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'STALE_MEDIA' });
      const alts = (await prisma.mediaAsset.findMany({ where: { publicId: LIB } })).map(
        (row) => row.alt,
      );
      expect(alts).toEqual([
        'Lanterns over the river',
        'Lanterns over the river',
        'Lanterns over the river',
      ]);
    });

    it('hai lệnh cùng version bắn cùng lúc: đúng MỘT lệnh qua', async () => {
      await libraryBorrowedByTour();
      const item = await itemOf(LIB);

      const [a, b] = await Promise.all([
        update(payloadFor(item, { alt: 'Writer A' })),
        update(payloadFor(item, { alt: 'Writer B' })),
      ]);

      expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
      const winner = a.statusCode === 200 ? 'Writer A' : 'Writer B';
      const alts = new Set(
        (await prisma.mediaAsset.findMany({ where: { publicId: LIB } })).map((row) => row.alt),
      );
      expect([...alts]).toEqual([winner]);
    });

    it('alt bắt buộc khi ảnh ở tour hay thư viện; ảnh chỉ ở bài viết được để trống', async () => {
      await libraryBorrowedByTour();
      await asset({ ownerType: 'POST', ownerId: POST_ID, publicId: POST_COVER, role: 'hero' });

      const required = await update(payloadFor(await itemOf(LIB), { alt: '   ' }));
      expect(required.statusCode).toBe(400);
      expect(required.json()).toMatchObject({ code: 'ALT_REQUIRED' });

      const decorative = await update(payloadFor(await itemOf(POST_COVER), { alt: '' }));
      expect(decorative.statusCode).toBe(200);
      expect(AdminMediaItemSchema.parse(decorative.json()).alt).toBeNull();
    });

    it('ảnh không còn chỗ dùng (hay chỉ còn dòng review): 404 NOT_FOUND', async () => {
      await asset({ ownerType: 'REVIEW', ownerId: uuid('a9600006', 1), publicId: 'tourism/r/x' });
      const base = {
        version: '1:2026-10-19T00:00:00.000Z',
        alt: 'x',
        author: null,
        license: null,
        licenseUrl: null,
        sourceUrl: null,
      };

      for (const publicId of ['tourism/nowhere', 'tourism/r/x']) {
        const res = await update({ ...base, publicId });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toMatchObject({ code: 'NOT_FOUND' });
      }
    });

    it('link không phải http hay https bị từ chối ở tầng dạng (400)', async () => {
      await libraryBorrowedByTour();
      const item = await itemOf(LIB);
      const res = await update(payloadFor(item, { sourceUrl: 'javascript:alert(1)' }));
      expect(res.statusCode).toBe(400);
    });
  });

  describe('queue', () => {
    it('bốn trạng thái, vùng và chủ suy từ đường dẫn, avatar không lộ ảnh', async () => {
      const queued = new Date(Date.now() - DAY_MS);
      const tourUpload = `${ROOT}/tours/${tourId(1)}/${FILE}`;
      const usedUpload = `${ROOT}/tours/${tourId(1)}/used-${FILE}`;
      const goneTour = `${ROOT}/tours/${uuid('a9600003', 99)}/${FILE}`;
      const gaveUp = `${ROOT}/posts/${POST_ID}/${FILE}`;
      const slotUpload = `${ROOT}/site/${SLOT_ID}/${FILE}`;
      const review = `${ROOT}/reviews/BK-5YU9J339/${FILE}`;
      const avatar = `${ROOT}/avatars/${customerId}/${FILE}`;
      await prisma.mediaGarbage.createMany({
        data: [
          { publicId: tourUpload, createdAt: queued },
          { publicId: usedUpload, createdAt: queued },
          { publicId: goneTour, createdAt: queued },
          { publicId: gaveUp, createdAt: queued, attempts: 5, lastError: 'Cloudinary từ chối' },
          { publicId: slotUpload, createdAt: queued },
          { publicId: review, createdAt: queued },
          { publicId: avatar, createdAt: queued },
          { publicId: LIB, createdAt: queued, attempts: 5 },
        ],
      });
      await asset({ publicId: usedUpload });
      await prisma.user.update({
        where: { id: customerId },
        data: { image: `https://res.cloudinary.com/demo/image/upload/v1/${avatar}` },
      });

      const res = await queue();
      expect(res.statusCode).toBe(200);
      const body = AdminMediaQueueSchema.parse(res.json());
      expect(body).toMatchObject({ gcEnabled: false, graceDays: env.MEDIA_GC_GRACE_DAYS });
      const row = (publicId: string) => body.rows.find((entry) => entry.publicId === publicId);

      expect(row(tourUpload)).toMatchObject({
        zone: 'TOUR',
        ownerLabel: 'Media tour 1',
        ownerSlug: 'media-tour-1',
        ownerDeleted: false,
        state: 'WAITING',
        dueAt: new Date(queued.getTime() + env.MEDIA_GC_GRACE_DAYS * DAY_MS).toISOString(),
      });
      expect(row(usedUpload)).toMatchObject({ state: 'IN_USE', dueAt: null });
      expect(row(goneTour)).toMatchObject({ zone: 'TOUR', ownerDeleted: true, ownerLabel: null });
      expect(row(gaveUp)).toMatchObject({ zone: 'POST', state: 'GAVE_UP', attempts: 5 });
      expect(row(slotUpload)).toMatchObject({ zone: 'SITE', slotKey: 'home-hero' });
      expect(row(review)).toMatchObject({ zone: 'REVIEW', ownerLabel: 'BK-5YU9J339' });
      expect(row(avatar)).toMatchObject({ zone: 'AVATAR', state: 'IN_USE', url: null });
      expect(row(LIB)).toMatchObject({ zone: null, state: 'REFUSED' });
      // `lastError` là chữ kỹ thuật tiếng Việt — không bao giờ ra tới admin.
      expect(JSON.stringify(body)).not.toContain('Cloudinary từ chối');
    });

    it('lastSweep: null khi chưa có job; handler media-gc trên pg-boss thật lưu SweepReport', async () => {
      const boss = new PgBoss({ connectionString: env.DATABASE_URL, schema: 'pgboss' });
      await boss.start();
      try {
        // Schema `pgboss` của `tourism_test` sống qua các lượt chạy — xoá tường minh.
        await boss.deleteQueue(MEDIA_GC_QUEUE);
        expect(AdminMediaQueueSchema.parse((await queue()).json()).lastSweep).toBeNull();

        await boss.createQueue(MEDIA_GC_QUEUE, {
          policy: 'short',
          retryLimit: 0,
          expireInSeconds: 3600,
        });
        // Y HỆT handler `start-worker.ts` đăng ký — test đi lệch một chữ là hết soi. Hàng dọn
        // rỗng (beforeEach) nên lượt quét không gọi Cloudinary nào.
        await boss.work(MEDIA_GC_QUEUE, { pollingIntervalSeconds: 0.5 }, () =>
          mediaGarbage.sweep(new Date(), env.MEDIA_GC_GRACE_DAYS),
        );
        const jobId = await boss.send(MEDIA_GC_QUEUE, {});
        expect(jobId).not.toBeNull();

        const deadline = Date.now() + 20_000;
        let lastSweep = AdminMediaQueueSchema.parse((await queue()).json()).lastSweep;
        while (lastSweep?.state !== 'completed' && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          lastSweep = AdminMediaQueueSchema.parse((await queue()).json()).lastSweep;
        }

        expect(lastSweep).toMatchObject({
          state: 'completed',
          report: { resolved: 0, destroyed: 0, absent: 0, deferred: 0, failed: 0, refused: 0 },
        });
        expect(lastSweep?.finishedAt).not.toBeNull();
      } finally {
        await boss.offWork(MEDIA_GC_QUEUE);
        await boss.deleteQueue(MEDIA_GC_QUEUE);
        await boss.stop({ graceful: true, timeout: 5_000 });
      }
    });
  });
});
