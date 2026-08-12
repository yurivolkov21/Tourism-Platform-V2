import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { MediaItemSchema } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { PUBLIC_WRITE_THROTTLE } from '../../config/throttle.js';
import { MediaOwnerType } from '../../generated/prisma/enums.js';
import { MediaModule } from './media.module.js';
import { MediaService } from './media.service.js';

/**
 * Integration (Docker PG, db tourism_test — xem vitest.int.config.ts).
 * `MediaAsset` KHÔNG có FK cứng (ownerId chỉ là uuid, ADR-0005) nên seed asset
 * ở đây không cần tạo Post/author thật — chỉ cần một uuid owner cố định.
 */

// Owner có 2 asset: hero + body, sortOrder lệch (hero trước theo sortOrder).
const OWNER = '0aaa0001-0000-4000-8000-000000000001';
// Owner không có asset nào.
const OWNER_NO_ASSET = '0aaa0001-0000-4000-8000-0000000000ff';
// Owner có 2 asset CÙNG sortOrder (mặc định 0) — kiểm tra sort phụ theo role.
const OWNER_TIE = '0aaa0001-0000-4000-8000-000000000002';

describe('media integration (MediaService.resolveForOwners)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE media_assets CASCADE');
    await prisma.mediaAsset.createMany({
      data: [
        {
          publicId: 'posts/body-x',
          type: 'IMAGE',
          ownerType: 'POST',
          ownerId: OWNER,
          role: 'body',
          sortOrder: 2,
        },
        {
          publicId: 'posts/hero-x',
          type: 'IMAGE',
          ownerType: 'POST',
          ownerId: OWNER,
          role: 'hero',
          sortOrder: 1,
        },
        // sortOrder bằng nhau (0) — enum MediaRole khai hero trước gallery
        // trong schema.prisma nên Postgres ORDER BY role asc trả hero trước.
        {
          publicId: 'posts/tie-gallery',
          type: 'IMAGE',
          ownerType: 'POST',
          ownerId: OWNER_TIE,
          role: 'gallery',
          sortOrder: 0,
        },
        {
          publicId: 'posts/tie-hero',
          type: 'IMAGE',
          ownerType: 'POST',
          ownerId: OWNER_TIE,
          role: 'hero',
          sortOrder: 0,
        },
      ],
    });

    // MediaModule giờ mang MediaController có ThrottlerGuard (ADR-0021);
    // guard resolve provider từ context module test nên phải đăng ký
    // ThrottlerModule ở đây y như AppModule làm, không thì DI fail.
    const moduleRef = await Test.createTestingModule({
      imports: [MediaModule, ThrottlerModule.forRoot([PUBLIC_WRITE_THROTTLE])],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('resolveForOwners trả MediaItem đã dựng URL, sort đúng, đúng shape', async () => {
    const svc = app.get(MediaService);
    const map = await svc.resolveForOwners(MediaOwnerType.POST, [OWNER]);
    const items = map.get(OWNER) ?? [];
    expect(items).toHaveLength(2);
    // sort: hero (sortOrder 1) trước body (sortOrder 2)
    expect(items[0]?.role).toBe('hero');
    for (const it of items) MediaItemSchema.parse(it); // conformity
    expect(items[0]?.url).toContain('/image/upload/f_auto,q_auto/posts/hero-x');
  });

  it('owner không có asset → không có key trong Map', async () => {
    const svc = app.get(MediaService);
    const map = await svc.resolveForOwners(MediaOwnerType.POST, [OWNER_NO_ASSET]);
    expect(map.size).toBe(0);
  });

  it('sortOrder bằng nhau → sort phụ theo role, hero đứng trước gallery', async () => {
    const svc = app.get(MediaService);
    const map = await svc.resolveForOwners(MediaOwnerType.POST, [OWNER_TIE]);
    const items = map.get(OWNER_TIE) ?? [];
    expect(items).toHaveLength(2);
    expect(items[0]?.role).toBe('hero');
    expect(items[1]?.role).toBe('gallery');
  });
});
