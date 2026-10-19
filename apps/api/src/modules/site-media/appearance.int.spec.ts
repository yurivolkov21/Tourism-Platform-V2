import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import {
  AdminSiteSlotSchema,
  SITE_SLOT_KEYS,
  SignedUploadParamsSchema,
  type SiteSlotKey,
} from '@tourism/contract';
import { z } from 'zod';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import { sessionCookie } from '../../test/session-cookie.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';
import { siteSlotOriginal } from './site-slot-originals.js';

/**
 * Integration (Docker PG, db `tourism_test`) — Appearance (spec P4f 15/10, ADR-0059).
 * Bốn ca đắt nhất:
 *
 *  ① Hai lệnh lưu cùng một `version` bắn cùng lúc: ĐÚNG MỘT lệnh qua (`FOR UPDATE`).
 *  ② Ảnh không thuộc bốn nguồn bị từ chối và rollback trọn — kể cả dòng khe vừa tạo.
 *  ③ Thay ảnh: chỉ ảnh tải lên của chính khe vào lại hàng dọn, ảnh gốc và ảnh thư viện thì không.
 *  ④ Khe `signUpload` vừa tạo dòng vẫn nhận lần lưu đầu với `version: null`.
 */

const PASSWORD = 'password-123';
const ADMIN_EMAIL = 'bootstrap-admin@tourism.test';
const STAFF_EMAIL = 'appearance-staff@tourism.test';
const CUSTOMER_EMAIL = 'appearance-customer@example.com';

const uuid = (prefix: string, n: number) =>
  `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const slotId = (n: number) => uuid('a9590001', n);
const DEST_ID = uuid('a9590002', 1);
const DAY_MS = 86_400_000;

const ROOT = 'tourism';
const mine = (n: number, name: string) => `${ROOT}/site/${slotId(n)}/${name}`;
const LIB = `${ROOT}/catalog/destination/hoi-an/1`;
const LIB_VIDEO = `${ROOT}/catalog/destination/hoi-an/clip`;
const UPLOAD_META = {
  version: '1759000000',
  width: 2400,
  height: 1350,
  format: 'jpg',
  bytes: 523000,
};

const SlotListSchema = z.array(AdminSiteSlotSchema);

describe('admin appearance integration (P4f, ADR-0059)', () => {
  let app: NestFastifyApplication;
  let adminCookie: string;
  let staffCookie: string;
  let customerCookie: string;
  let web: WebRevalidationService;

  beforeAll(async () => {
    // Int spec chạy tuần tự (`fileParallelism: false`), nên dọn ở đây không giẫm spec khác.
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE users, destinations, media_assets, site_media_slots, media_garbage CASCADE',
    );

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      rawBody: true,
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    web = moduleRef.get(WebRevalidationService);

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
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    // media_assets là bảng đa chủ, không khoá ngoại — xoá riêng, không thì id khe dùng lại
    // nhặt nhầm ảnh của ca trước.
    await prisma.mediaAsset.deleteMany();
    await prisma.mediaGarbage.deleteMany();
    await prisma.siteMediaSlot.deleteMany();
    await prisma.destination.deleteMany();
    await prisma.destination.create({
      data: { id: DEST_ID, slug: 'hoi-an', name: 'Hội An', region: 'Central Vietnam' },
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  /** Dòng khe như seed để lại: đã lưu một lần từ hôm qua (`updatedAt ≠ createdAt`). */
  const makeSlot = (n: number, key: SiteSlotKey, saved = true) =>
    prisma.siteMediaSlot.create({
      data: {
        id: slotId(n),
        key,
        createdAt: new Date(Date.now() - 2 * DAY_MS),
        updatedAt: new Date(Date.now() - (saved ? DAY_MS : 2 * DAY_MS)),
      },
    });

  const makeSlotImage = (n: number, publicId: string, patch: { sortOrder?: number } = {}) =>
    prisma.mediaAsset.create({
      data: {
        ownerType: 'SITE',
        ownerId: slotId(n),
        publicId,
        type: 'IMAGE',
        role: 'hero',
        sortOrder: patch.sortOrder ?? 0,
        alt: 'Old alt',
        version: '1700000000',
      },
    });

  /** Ảnh gốc của khe, chép từ bảng — đúng thứ seed và script tải ảnh ghi. */
  const makeOriginal = (n: number, key: SiteSlotKey) => {
    const { alt, ...stored } = siteSlotOriginal(key);
    return prisma.mediaAsset.create({
      data: { ...stored, alt, ownerType: 'SITE', ownerId: slotId(n), role: 'hero', sortOrder: 0 },
    });
  };

  /** Ảnh thư viện CÓ đủ ghi công — ca "chép ghi công" cần nó KHÁC thứ client gửi. */
  const makeLibrary = (publicId = LIB, type: 'IMAGE' | 'VIDEO' = 'IMAGE') =>
    prisma.mediaAsset.create({
      data: {
        ownerType: 'DESTINATION',
        ownerId: DEST_ID,
        publicId,
        type,
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

  const list = (cookie = adminCookie) =>
    app.inject({ method: 'GET', url: '/api/admin/appearance', headers: { cookie } });
  const post = (url: string, payload: Record<string, unknown>, cookie = adminCookie) =>
    app.inject({ method: 'POST', url, headers: { cookie }, payload });
  const save = (
    key: string,
    version: string | null,
    image: Record<string, unknown>,
    cookie = adminCookie,
  ) => post(`/api/admin/appearance/${key}`, { key, version, image }, cookie);
  const sign = (key: string, cookie = adminCookie) =>
    post(`/api/admin/appearance/${key}/upload`, { key }, cookie);

  const versionOf = async (key: SiteSlotKey) =>
    (await prisma.siteMediaSlot.findUniqueOrThrow({ where: { key } })).updatedAt.toISOString();
  const slotRows = async (key: SiteSlotKey) => {
    const slot = await prisma.siteMediaSlot.findUniqueOrThrow({ where: { key } });
    return prisma.mediaAsset.findMany({
      where: { ownerType: 'SITE', ownerId: slot.id },
      orderBy: { sortOrder: 'asc' },
    });
  };
  const garbageIds = async () =>
    (await prisma.mediaGarbage.findMany({ orderBy: { publicId: 'asc' } })).map(
      (row) => row.publicId,
    );
  const slotOf = async (key: SiteSlotKey) => {
    const slots = SlotListSchema.parse((await list()).json());
    const slot = slots.find((s) => s.key === key);
    if (slot === undefined) throw new Error(`list thiếu khe ${key}`);
    return slot;
  };

  describe('quyền', () => {
    it('ẩn danh 401, khách 403 — trên cả đường đọc lẫn hai đường ghi', async () => {
      expect((await list('')).statusCode).toBe(401);
      expect((await list(customerCookie)).statusCode).toBe(403);
      expect((await sign('home-hero', customerCookie)).statusCode).toBe(403);
      const res = await save('home-hero', null, { publicId: LIB, alt: null }, customerCookie);
      expect(res.statusCode).toBe(403);
      expect(await prisma.siteMediaSlot.count()).toBe(0);
    });

    it('Staff đọc, ký và lưu được — ba thủ tục cùng bậc với sửa bài viết (ADR-0052)', async () => {
      vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);
      expect((await list(staffCookie)).statusCode).toBe(200);
      expect((await sign('home-hero', staffCookie)).statusCode).toBe(200);
      const original = siteSlotOriginal('cta-band');
      const res = await save(
        'cta-band',
        null,
        { publicId: original.publicId, alt: null },
        staffCookie,
      );
      expect(res.statusCode).toBe(200);
      expect(AdminSiteSlotSchema.parse(res.json()).image?.source).toBe('ORIGINAL');
    });
  });

  describe('list', () => {
    it('DB trống: đủ 47 khe theo thứ tự danh mục, không ảnh, không phiên bản, có ảnh gốc', async () => {
      const res = await list();

      expect(res.statusCode).toBe(200);
      const slots = SlotListSchema.parse(res.json());
      expect(slots.map((slot) => slot.key)).toEqual([...SITE_SLOT_KEYS]);
      for (const slot of slots) {
        expect(slot.image, slot.key).toBeNull();
        expect(slot.version, slot.key).toBeNull();
        expect(slot.original.url, slot.key).toContain(siteSlotOriginal(slot.key).publicId);
      }
      // Đọc không bao giờ tạo dòng khe.
      expect(await prisma.siteMediaSlot.count()).toBe(0);
    });

    it.each([
      ['ORIGINAL', 'original'],
      ['UPLOAD', 'upload'],
      ['LIBRARY', 'library'],
      ['OTHER', 'other'],
    ] as const)('ảnh đang dùng mang nguồn %s', async (source, kind) => {
      await makeSlot(1, 'home-hero');
      if (kind === 'original') await makeOriginal(1, 'home-hero');
      if (kind === 'upload') await makeSlotImage(1, mine(1, 'new'));
      if (kind === 'library') {
        await makeLibrary();
        await makeSlotImage(1, LIB);
      }
      if (kind === 'other') await makeSlotImage(1, 'site/home-hero-1');

      const slot = await slotOf('home-hero');

      expect(slot.image?.source).toBe(source);
      expect(slot.version).toBe(await versionOf('home-hero'));
    });

    it('ảnh gốc mang alt, cỡ và URL Cloudinary của bảng', async () => {
      const slot = await slotOf('cta-band');
      const original = siteSlotOriginal('cta-band');

      expect(slot.original).toMatchObject({
        publicId: original.publicId,
        alt: original.alt,
        width: original.width,
        height: original.height,
      });
      expect(slot.original.url).toContain(`/v${original.version}/${original.publicId}`);
    });
  });

  describe('setSlot', () => {
    it('giữ ảnh đang dùng, đổi alt: phiên bản nhích, bust site-media, hàng dọn trống', async () => {
      await makeSlot(1, 'home-hero');
      await makeSlotImage(1, mine(1, 'kept'));
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);
      const before = await versionOf('home-hero');

      const res = await save('home-hero', before, { publicId: mine(1, 'kept'), alt: 'New alt' });

      expect(res.statusCode).toBe(200);
      const slot = AdminSiteSlotSchema.parse(res.json());
      expect(slot.image).toMatchObject({ publicId: mine(1, 'kept'), alt: 'New alt' });
      expect(slot.image?.source).toBe('UPLOAD');
      expect(slot.version).not.toBe(before);
      expect(slot.version).toBe(await versionOf('home-hero'));
      expect((await slotRows('home-hero')).map((row) => [row.publicId, row.alt])).toEqual([
        [mine(1, 'kept'), 'New alt'],
      ]);
      expect(await garbageIds()).toEqual([]);
      expect(revalidate).toHaveBeenCalledExactlyOnceWith(['site-media']);
    });

    it('ảnh tải lên mới thay ảnh tải lên cũ: ghi metadata, ảnh cũ vào hàng dọn', async () => {
      await makeSlot(1, 'home-hero');
      await makeSlotImage(1, mine(1, 'old'));
      vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      const res = await save('home-hero', await versionOf('home-hero'), {
        publicId: mine(1, 'new'),
        alt: '',
        upload: UPLOAD_META,
      });

      expect(res.statusCode).toBe(200);
      expect(AdminSiteSlotSchema.parse(res.json()).image?.source).toBe('UPLOAD');
      const rows = await slotRows('home-hero');
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        publicId: mine(1, 'new'),
        role: 'hero',
        sortOrder: 0,
        alt: null,
        width: 2400,
        height: 1350,
        version: '1759000000',
        author: null,
      });
      expect(await garbageIds()).toEqual([mine(1, 'old')]);
    });

    it('khe chưa có dòng nhận ảnh gốc với version null: tạo dòng, chép cột từ bảng', async () => {
      vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);
      const original = siteSlotOriginal('cta-band');

      const res = await save('cta-band', null, { publicId: original.publicId, alt: 'Restored' });

      expect(res.statusCode).toBe(200);
      const slot = AdminSiteSlotSchema.parse(res.json());
      expect(slot.image?.source).toBe('ORIGINAL');
      expect(slot.version).not.toBeNull();
      expect(await slotRows('cta-band')).toEqual([
        expect.objectContaining({
          publicId: original.publicId,
          alt: 'Restored',
          width: original.width,
          height: original.height,
          bytes: original.bytes,
          version: original.version,
          author: original.author,
          sourceUrl: original.sourceUrl,
        }),
      ]);
    });

    it('ảnh tải lên đổi sang ảnh thư viện: chép ghi công, ảnh tải lên cũ vào hàng dọn', async () => {
      await makeSlot(1, 'home-hero');
      await makeSlotImage(1, mine(1, 'old'));
      await makeLibrary();
      vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      const res = await save('home-hero', await versionOf('home-hero'), {
        publicId: LIB,
        alt: null,
      });

      expect(res.statusCode).toBe(200);
      expect(AdminSiteSlotSchema.parse(res.json()).image).toMatchObject({
        publicId: LIB,
        source: 'LIBRARY',
        author: 'Jane Doe',
        license: 'CC BY-SA 4.0',
      });
      expect(await slotRows('home-hero')).toEqual([
        expect.objectContaining({ publicId: LIB, alt: null, version: '1700000001' }),
      ]);
      expect(await garbageIds()).toEqual([mine(1, 'old')]);
      // Dòng thư viện vẫn nguyên chỗ cũ — khe mượn, không lấy.
      expect(await prisma.mediaAsset.count({ where: { ownerType: 'DESTINATION' } })).toBe(1);
    });

    it('ảnh gốc đổi sang ảnh thư viện: ảnh gốc KHÔNG vào hàng dọn', async () => {
      await makeSlot(1, 'home-hero');
      await makeOriginal(1, 'home-hero');
      await makeLibrary();
      vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      const res = await save('home-hero', await versionOf('home-hero'), {
        publicId: LIB,
        alt: null,
      });

      expect(res.statusCode).toBe(200);
      expect(await garbageIds()).toEqual([]);
    });

    it('phiên bản cũ: 409 STALE_SLOT, không đổi gì, không bust', async () => {
      await makeSlot(1, 'home-hero');
      await makeSlotImage(1, mine(1, 'old'));
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);
      const before = await versionOf('home-hero');

      const res = await save('home-hero', new Date(Date.now() - 3 * DAY_MS).toISOString(), {
        publicId: mine(1, 'old'),
        alt: 'Changed',
      });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'STALE_SLOT' });
      expect(await versionOf('home-hero')).toBe(before);
      expect((await slotRows('home-hero')).map((row) => row.alt)).toEqual(['Old alt']);
      expect(revalidate).not.toHaveBeenCalled();
    });

    it('version null trên khe đã lưu: 409 STALE_SLOT — trang mở trước khi người khác lưu', async () => {
      await makeSlot(1, 'home-hero');
      await makeSlotImage(1, mine(1, 'old'));

      const res = await save('home-hero', null, { publicId: mine(1, 'old'), alt: 'Changed' });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ code: 'STALE_SLOT' });
    });

    it('hai lệnh lưu cùng một version bắn cùng lúc: đúng một lệnh qua', async () => {
      await makeSlot(1, 'home-hero');
      await makeSlotImage(1, mine(1, 'old'));
      vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);
      const version = await versionOf('home-hero');

      const results = await Promise.all([
        save('home-hero', version, { publicId: mine(1, 'a'), alt: 'A', upload: UPLOAD_META }),
        save('home-hero', version, { publicId: mine(1, 'b'), alt: 'B', upload: UPLOAD_META }),
      ]);

      expect(results.map((res) => res.statusCode).sort()).toEqual([200, 409]);
      expect(await slotRows('home-hero')).toHaveLength(1);
      expect(await garbageIds()).toEqual([mine(1, 'old')]);
    });

    it('hai lệnh lưu đầu tiên của một khe chưa có dòng bắn cùng lúc: đúng một lệnh qua', async () => {
      vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);
      const original = siteSlotOriginal('cta-band');

      const results = await Promise.all([
        save('cta-band', null, { publicId: original.publicId, alt: 'A' }),
        save('cta-band', null, { publicId: original.publicId, alt: 'B' }),
      ]);

      expect(results.map((res) => res.statusCode).sort()).toEqual([200, 409]);
      expect(await prisma.siteMediaSlot.count({ where: { key: 'cta-band' } })).toBe(1);
      expect(await slotRows('cta-band')).toHaveLength(1);
    });

    it.each([
      ['thư mục tải lên của khe khác', () => ({ publicId: mine(2, 'x'), upload: UPLOAD_META })],
      ['ảnh tải lên thiếu metadata', () => ({ publicId: mine(1, 'x') })],
      ['ảnh gốc của khe khác', () => ({ publicId: siteSlotOriginal('cta-band').publicId })],
      ['dòng thư viện loại video', () => ({ publicId: LIB_VIDEO })],
      ['chuỗi lạ', () => ({ publicId: `${ROOT}/catalog/tour/unknown` })],
    ])('ảnh %s: 400 PHOTO_NOT_ALLOWED, rollback trọn', async (_, image) => {
      await makeSlot(1, 'home-hero');
      await makeSlot(2, 'cta-band');
      await makeSlotImage(1, mine(1, 'old'));
      await makeLibrary(LIB_VIDEO, 'VIDEO');
      const revalidate = vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);
      const before = await versionOf('home-hero');

      const res = await save('home-hero', before, { alt: null, ...image() });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'PHOTO_NOT_ALLOWED' });
      expect(await versionOf('home-hero')).toBe(before);
      expect((await slotRows('home-hero')).map((row) => row.publicId)).toEqual([mine(1, 'old')]);
      expect(await garbageIds()).toEqual([]);
      expect(revalidate).not.toHaveBeenCalled();
    });

    it('khe chưa có dòng nhận ảnh lạ: 400 và dòng khe vừa tạo cũng rollback', async () => {
      const res = await save('cta-band', null, { publicId: LIB, alt: null });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'PHOTO_NOT_ALLOWED' });
      expect(await prisma.siteMediaSlot.count()).toBe(0);
    });

    it('khe video và khoá lạ chết ở tầng dạng: 400, không tạo dòng', async () => {
      const original = siteSlotOriginal('about-cta-video');
      const video = await save('about-cta-video', null, { publicId: original.publicId, alt: null });
      expect(video.statusCode).toBe(400);
      expect((await save('home-trust', null, { publicId: LIB, alt: null })).statusCode).toBe(400);
      expect(await prisma.siteMediaSlot.count()).toBe(0);
    });

    it('khe mang hai dòng (dữ liệu script): giữ dòng đứng sau vẫn được, dòng thừa tải lên vào hàng dọn', async () => {
      await makeSlot(1, 'home-hero');
      await makeSlotImage(1, mine(1, 'stray'), { sortOrder: 0 });
      await makeSlotImage(1, 'site/home-hero-1', { sortOrder: 1 });
      vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);

      const res = await save('home-hero', await versionOf('home-hero'), {
        publicId: 'site/home-hero-1',
        alt: 'Kept',
      });

      expect(res.statusCode).toBe(200);
      expect((await slotRows('home-hero')).map((row) => [row.publicId, row.alt])).toEqual([
        ['site/home-hero-1', 'Kept'],
      ]);
      expect(await garbageIds()).toEqual([mine(1, 'stray')]);
    });
  });

  describe('signUpload', () => {
    it('khe chưa có dòng: tạo dòng, ký vào thư mục của khe, publicId vào hàng dọn ngay', async () => {
      const res = await sign('auth-panel');

      expect(res.statusCode).toBe(200);
      const signed = SignedUploadParamsSchema.parse(res.json());
      const slot = await prisma.siteMediaSlot.findUniqueOrThrow({ where: { key: 'auth-panel' } });
      expect(signed.folder).toBe(`${ROOT}/site/${slot.id}`);
      expect(await garbageIds()).toEqual([`${signed.folder}/${signed.publicId}`]);
      // Dòng mới mang hai mốc bằng nhau — "chưa từng lưu", `list` vẫn báo không ảnh.
      expect(slot.updatedAt.getTime()).toBe(slot.createdAt.getTime());
      expect((await slotOf('auth-panel')).image).toBeNull();
    });

    it('lần lưu đầu sau khi ký: version null vẫn được nhận', async () => {
      vi.spyOn(web, 'revalidate').mockResolvedValue(undefined);
      const signed = SignedUploadParamsSchema.parse((await sign('auth-panel')).json());

      const res = await save('auth-panel', null, {
        publicId: `${signed.folder}/${signed.publicId}`,
        alt: null,
        upload: UPLOAD_META,
      });

      expect(res.statusCode).toBe(200);
      expect(AdminSiteSlotSchema.parse(res.json()).image?.source).toBe('UPLOAD');
      // Ký lần hai trên khe đã có dòng không đổi phiên bản — thư mục cũng giữ nguyên.
      const version = await versionOf('auth-panel');
      const again = SignedUploadParamsSchema.parse((await sign('auth-panel')).json());
      expect(again.folder).toBe(signed.folder);
      expect(await versionOf('auth-panel')).toBe(version);
    });

    it('khe video: 400, không tạo dòng', async () => {
      expect((await sign('about-cta-video')).statusCode).toBe(400);
      expect(await prisma.siteMediaSlot.count()).toBe(0);
    });
  });
});
