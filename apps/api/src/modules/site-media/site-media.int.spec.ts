import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { SiteMediaEntrySchema } from '@tourism/contract';
import { z } from 'zod';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import { MediaOwnerType } from '../../generated/prisma/enums.js';

/**
 * Integration (Docker PG, db tourism_test — xem vitest.int.config.ts).
 * Chốt `GET /api/site-media` (spec P3a-C W6): chỉ trả slot CÓ media, shape
 * `{ key, media[] }`; slot rỗng vắng mặt hoàn toàn.
 */

const HERO_SLOT_ID = '0dddd001-0000-4000-8000-000000000001';
const EMPTY_SLOT_ID = '0dddd001-0000-4000-8000-000000000002';

describe('site-media integration (oRPC @Implement over Fastify) — GET /api/site-media', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // media_assets không FK cứng (ADR-0005) nên truncate riêng cùng
    // site_media_slots — hai bảng này độc lập, không kéo bảng nào khác.
    await prisma.$executeRawUnsafe('TRUNCATE TABLE media_assets, site_media_slots CASCADE');
    await prisma.siteMediaSlot.createMany({
      data: [
        { id: HERO_SLOT_ID, key: 'home-hero' },
        { id: EMPTY_SLOT_ID, key: 'cta-band' },
      ],
    });
    // Slot home-hero CÓ 1 asset; cta-band cố tình để rỗng.
    await prisma.mediaAsset.create({
      data: {
        publicId: 'site/home-hero-1',
        type: 'IMAGE',
        ownerType: MediaOwnerType.SITE,
        ownerId: HERO_SLOT_ID,
        role: 'hero',
      },
    });
  });

  it('GET /api/site-media chỉ trả slot CÓ media, shape {key, media[]}', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/site-media' });
    expect(res.statusCode).toBe(200);
    const entries = z.array(SiteMediaEntrySchema).parse(res.json());
    const keys = entries.map((e) => e.key);
    expect(keys).toContain('home-hero'); // slot có media
    expect(keys).not.toContain('cta-band'); // slot rỗng → vắng mặt
    expect(entries.find((e) => e.key === 'home-hero')?.media.length).toBeGreaterThanOrEqual(1);
  });
});
