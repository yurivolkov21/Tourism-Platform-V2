# P3a-C — Posts · Site-media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây 2 module đọc công khai cuối của P3a — `posts` (blog: list, bySlug, tags) và `site-media` (siteMedia.list) — cùng hạ tầng media-đọc (dựng Cloudinary URL) mà v2 chưa từng có.

**Architecture:** Mỗi module một dir trong `apps/api/src/modules/` theo đúng pattern `catalog/` đã có (`*.service.ts` · `*.controller.ts` · `*.module.ts` · `*.int.spec.ts`). Media dựng URL tập trung ở một `MediaModule` dùng chung cho cả hai module (ADR-0005). Visibility bài published cưỡng chế bằng helper thuần `publishedPostWhere()` (ADR-0004). Contract oRPC khai ở `libs/shared/contract/src/schemas/`.

**Tech Stack:** NestJS 11 ESM + Fastify · Prisma 7 · oRPC + Zod 4 · Vitest (unit thuần + integration trên Docker Postgres `tourism_test`). Media: Cloudinary delivery URL dựng server-side từ `publicId` (chỉ cần cloud name công khai).

## Global Constraints

Mọi task ngầm bao gồm phần này.

- **Comment code bằng tiếng Việt**; identifier/tên biến tiếng Anh (CLAUDE.md #8).
- **ESM**: mọi import nội bộ phải có đuôi `.js`.
- **Biome**: nháy đơn, trailing comma, 100 cột. `pnpm lint:fix` trước khi commit.
- **Không `any`, không type cast để lách kiểu.**
- **TDD trên logic thuần**: test trước, chạy thấy FAIL, rồi mới implement.
- **Query list dùng `PageQuerySchema` = `page` + `pageSize`** (input). **Output `Paged<T>` = `{items, page, limit, total, totalPages}`** — field tên `limit`. Service map `limit: pageSize` (input `pageSize` → output `limit`). Đây là convention đã chốt (P3a-B); catalog P1 dùng `limit` ở query là ngoại lệ cũ, KHÔNG noi theo.
- **ADR-0003 — auth fail-closed**: `AuthGuard` chạy toàn cục. 4 endpoint ở plan này đều public → controller **PHẢI** khai `@Public()` kèm comment lý do. Quên = 401 cho khách ẩn danh.
- **ADR-0004 — post visibility**: mọi path public đọc `Post` PHẢI spread `publishedPostWhere()` vào `where`. `publishedAt=null` → ẩn. `now()` app-side.
- **ADR-0005 — media đọc**: API dựng & trả Cloudinary `url` (+ `publicId` thô). Enum owner là `MediaOwnerType.SITE` và `POST` (KHÔNG `SITE_MEDIA`). Media role: `hero` (cover) / `body` (inline) / `gallery`.
- **Related tours KHÔNG media** (ADR-0005 Hệ quả): `posts.bySlug` trả related tours bằng tour-summary hiện có, không mở rộng catalog.
- **TUYỆT ĐỐI không sửa file trong `apps/api/prisma/migrations/`** đã apply. Plan này **không cần migration** — mọi model (Post, PostTag, PostTagLink, PostTour, SiteMediaSlot, MediaAsset) đã có sẵn trong schema. Nếu phát hiện cần đổi schema → DỪNG và báo.
- **`pnpm gate:int` xanh** trước khi khai một task xong (gate trần KHÔNG chạy integration test).
- **Mutation-test hai chiều** mọi thứ liên quan visibility/bảo mật trước khi khai xanh (nếp đã cứu 6 ca ở P3a-B): phá guard → test phải đỏ → hoàn nguyên → xanh.
- **Conventional Commits**, KHÔNG AI attribution.
- Ưu tiên skill có sẵn hơn tự chế (xem `docs/skills.md`).

## File Structure

| File | Trách nhiệm |
| --- | --- |
| `apps/api/src/config/env.ts` | +`CLOUDINARY_CLOUD_NAME` (default dev, chặn prod qua superRefine) |
| `apps/api/.env.example` | +dòng `CLOUDINARY_CLOUD_NAME` |
| `apps/api/src/lib/cloudinary-url.ts` + `.spec.ts` | **Logic thuần** dựng URL — TDD, không DB |
| `libs/shared/contract/src/schemas/media.ts` | `MediaItemSchema` dùng chung posts + site-media |
| `apps/api/src/modules/media/{media.service,media.module}.ts` + `media.int.spec.ts` | Resolve batch MediaAsset → `MediaItem[]` theo owner |
| `apps/api/src/modules/posts/published-post.where.ts` + `.spec.ts` | **Logic thuần** helper ADR-0004 — TDD, không DB |
| `libs/shared/contract/src/schemas/posts.ts` | `PostCardSchema` · `PostDetailSchema` · `PostTagSchema` · `PostsListQuerySchema` |
| `apps/api/src/modules/posts/{service,controller,module}.ts` + `posts.int.spec.ts` | Module posts (list, bySlug, tags) |
| `libs/shared/contract/src/schemas/site-media.ts` | `SiteMediaEntrySchema` |
| `apps/api/src/modules/site-media/{service,controller,module}.ts` + `site-media.int.spec.ts` | Module site-media (đọc `site_media_slots` từ DB, lọc slot có media) |
| `libs/shared/contract/src/contract.ts` | Mount `posts.*` + `siteMedia.list` |
| `apps/api/src/app.module.ts` | Register `MediaModule`, `PostsModule`, `SiteMediaModule` |

**Thứ tự phụ thuộc:** Task 1 (helper URL) → Task 2 (media resolve, cần helper) → Task 3 (publishedPostWhere) → Task 4 (posts.list, cần 2+3) → Task 5 (bySlug) → Task 6 (tags) → Task 7 (site-media, cần 2). Task 3 độc lập, có thể làm song song 1–2.

---

## Task 1: Env `CLOUDINARY_CLOUD_NAME` + helper `buildCloudinaryUrl`

ADR-0005: dựng URL server-side từ `publicId`, chỉ cần cloud name công khai. Đây là logic thuần — TDD, không chạm DB/Nest.

**Files:**
- Modify: `apps/api/src/config/env.ts` (thêm field ~dòng 62; superRefine ~dòng 64)
- Modify: `apps/api/.env.example`
- Create: `apps/api/src/lib/cloudinary-url.ts`
- Test: `apps/api/src/lib/cloudinary-url.spec.ts`

**Interfaces:**
- Produces: `buildCloudinaryUrl(cloudName: string, asset: { type: MediaType; publicId: string; posterId?: string | null }): { url: string; posterUrl: string | null }` — Task 2 gọi cho mỗi asset.
- Produces: `env.CLOUDINARY_CLOUD_NAME: string` — Task 2 (MediaService) đọc.

- [ ] **Step 1: Viết test thuần (chạy FAIL trước)**

Create `apps/api/src/lib/cloudinary-url.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MediaType } from '../generated/prisma/enums.js';
import { buildCloudinaryUrl } from './cloudinary-url.js';

const CLOUD = 'demo-cloud';

describe('buildCloudinaryUrl', () => {
  it('dựng URL ảnh với transform f_auto,q_auto', () => {
    const r = buildCloudinaryUrl(CLOUD, { type: MediaType.IMAGE, publicId: 'posts/hero-a' });
    expect(r.url).toBe('https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto/posts/hero-a');
    expect(r.posterUrl).toBeNull();
  });

  it('escape-hatch: publicId là URL tuyệt đối → trả nguyên, KHÔNG bọc transform', () => {
    const abs = 'https://images.unsplash.com/photo-123';
    const r = buildCloudinaryUrl(CLOUD, { type: MediaType.IMAGE, publicId: abs });
    expect(r.url).toBe(abs);
  });

  it('video → URL video + posterUrl từ posterId', () => {
    const r = buildCloudinaryUrl(CLOUD, {
      type: MediaType.VIDEO,
      publicId: 'posts/clip',
      posterId: 'posts/clip-poster',
    });
    expect(r.url).toBe('https://res.cloudinary.com/demo-cloud/video/upload/f_auto,q_auto/posts/clip');
    expect(r.posterUrl).toBe(
      'https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto/posts/clip-poster',
    );
  });

  it('video không posterId → poster là frame đầu (so_0) của chính video', () => {
    const r = buildCloudinaryUrl(CLOUD, { type: MediaType.VIDEO, publicId: 'posts/clip' });
    expect(r.posterUrl).toBe(
      'https://res.cloudinary.com/demo-cloud/video/upload/so_0,f_auto,q_auto/posts/clip.jpg',
    );
  });
});
```

- [ ] **Step 2: Chạy test thấy FAIL**

Run: `cd apps/api && pnpm vitest run src/lib/cloudinary-url.spec.ts`
Expected: FAIL — `buildCloudinaryUrl is not a function` (file chưa tồn tại).

- [ ] **Step 3: Implement helper**

Create `apps/api/src/lib/cloudinary-url.ts`:

```ts
import { MediaType } from '../generated/prisma/enums.js';

const BASE = 'https://res.cloudinary.com';

/** publicId đã là URL tuyệt đối (seed/placeholder Unsplash) → dùng nguyên. */
function isAbsoluteUrl(publicId: string): boolean {
  return /^https?:\/\//.test(publicId);
}

/**
 * Dựng URL delivery Cloudinary từ `publicId` (ADR-0005). Thuần, không DB.
 * Ảnh: transform `f_auto,q_auto`. Video: URL video + poster riêng (posterId
 * nếu có, không thì frame đầu `so_0` của chính video). publicId tuyệt đối trả
 * nguyên (escape-hatch cho fixture).
 */
export function buildCloudinaryUrl(
  cloudName: string,
  asset: { type: MediaType; publicId: string; posterId?: string | null },
): { url: string; posterUrl: string | null } {
  if (isAbsoluteUrl(asset.publicId)) {
    return { url: asset.publicId, posterUrl: null };
  }
  const resource = asset.type === MediaType.VIDEO ? 'video' : 'image';
  const url = `${BASE}/${cloudName}/${resource}/upload/f_auto,q_auto/${asset.publicId}`;
  if (asset.type !== MediaType.VIDEO) {
    return { url, posterUrl: null };
  }
  const posterUrl =
    asset.posterId && !isAbsoluteUrl(asset.posterId)
      ? `${BASE}/${cloudName}/image/upload/f_auto,q_auto/${asset.posterId}`
      : asset.posterId && isAbsoluteUrl(asset.posterId)
        ? asset.posterId
        : `${BASE}/${cloudName}/video/upload/so_0,f_auto,q_auto/${asset.publicId}.jpg`;
  return { url, posterUrl };
}
```

- [ ] **Step 4: Chạy test thấy PASS**

Run: `cd apps/api && pnpm vitest run src/lib/cloudinary-url.spec.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Thêm env `CLOUDINARY_CLOUD_NAME`**

Trong `apps/api/src/config/env.ts`, sau `NEWSLETTER_UNSUBSCRIBE_SECRET` (~dòng 62), thêm vào object schema:

```ts
    // Cloud name Cloudinary — GIÁ TRỊ CÔNG KHAI (không phải secret upload),
    // chỉ để dựng URL delivery đọc (ADR-0005). Default dev; prod PHẢI set thật
    // qua superRefine bên dưới, nếu không URL ảnh sẽ trỏ cloud 'demo' hỏng.
    CLOUDINARY_CLOUD_NAME: z.string().min(1).default('demo'),
```

Và trong `superRefine` (khối `if (cfg.NODE_ENV !== 'production') return;`), thêm cạnh các guard prod khác:

```ts
    if (cfg.CLOUDINARY_CLOUD_NAME === 'demo') {
      ctx.addIssue({
        code: 'custom',
        path: ['CLOUDINARY_CLOUD_NAME'],
        message: 'CLOUDINARY_CLOUD_NAME must be set explicitly in production',
      });
    }
```

Trong `apps/api/.env.example`, thêm dòng:

```
# Cloud name Cloudinary (công khai) — dùng dựng URL ảnh đọc. Prod set thật.
CLOUDINARY_CLOUD_NAME=demo
```

- [ ] **Step 6: Gate + commit**

Run: `cd ~/projects/tourism-v2 && pnpm gate`
Expected: build + typecheck + unit test + lint xanh.

```bash
git add apps/api/src/lib/cloudinary-url.ts apps/api/src/lib/cloudinary-url.spec.ts apps/api/src/config/env.ts apps/api/.env.example
git commit -m "feat(api): helper dựng Cloudinary URL + env CLOUDINARY_CLOUD_NAME (P3a-C, ADR-0005)"
```

---

## Task 2: Contract `MediaItem` + `MediaService.resolveForOwners`

Resolve batch MediaAsset của nhiều owner → `MediaItem[]` (đã dựng URL), một query, không N+1 (ADR-0005). Dùng chung posts + site-media.

**Files:**
- Create: `libs/shared/contract/src/schemas/media.ts`
- Modify: `libs/shared/contract/src/index.ts` (export schema mới — theo pattern các schema hiện có)
- Create: `apps/api/src/modules/media/media.service.ts`
- Create: `apps/api/src/modules/media/media.module.ts`
- Test: `apps/api/src/modules/media/media.int.spec.ts`

**Interfaces:**
- Consumes: `buildCloudinaryUrl` (Task 1), `env.CLOUDINARY_CLOUD_NAME` (Task 1).
- Produces: `MediaItem` type + `MediaItemSchema` — Task 4/5/7 dùng trong contract output.
- Produces: `MediaService.resolveForOwners(ownerType: MediaOwnerType, ownerIds: string[]): Promise<Map<string, MediaItem[]>>` — Task 4/5/7 gọi. Mỗi list media sort theo `sortOrder` asc rồi `role` (hero trước). Owner không có asset → không có key trong Map.
- Produces: `MediaModule` (exports `MediaService`) — Task 4/7 import.

- [ ] **Step 1: Contract `MediaItemSchema`**

Create `libs/shared/contract/src/schemas/media.ts`:

```ts
import { z } from 'zod';

/**
 * Một media asset đã dựng URL (ADR-0005). `url` là thứ web render; `publicId`
 * giữ để admin (P4) re-submit item không đổi. DB-nullable → `.nullable()`.
 */
export const MediaItemSchema = z.object({
  publicId: z.string().min(1),
  url: z.url(),
  type: z.enum(['IMAGE', 'VIDEO']),
  role: z.enum(['hero', 'gallery', 'avatar', 'body']),
  posterUrl: z.url().nullable(),
  width: z.int().positive().nullable(),
  height: z.int().positive().nullable(),
  alt: z.string().nullable(),
  sortOrder: z.int().nonnegative(),
});

export type MediaItem = z.output<typeof MediaItemSchema>;
```

Thêm export vào `libs/shared/contract/src/index.ts` theo đúng cách các file schema khác được re-export (bám pattern hiện có trong file đó).

- [ ] **Step 2: Viết int test (FAIL trước)**

Create `apps/api/src/modules/media/media.int.spec.ts`. Bootstrap app + seed theo đúng pattern `catalog.int.spec.ts` (Test.createTestingModule → FastifyAdapter → init → ready; TRUNCATE + createMany). Nội dung riêng:

```ts
// Seed: 1 post owner (uuid cố định) với 2 asset — hero + body, sortOrder lệch.
const OWNER = '0aaa0001-0000-4000-8000-000000000001';
// beforeAll: tạo 1 author + 1 Post (để FK author hợp lệ nếu cần), rồi:
await prisma.mediaAsset.createMany({
  data: [
    { publicId: 'posts/body-x', type: 'IMAGE', ownerType: 'POST', ownerId: OWNER, role: 'body', sortOrder: 2 },
    { publicId: 'posts/hero-x', type: 'IMAGE', ownerType: 'POST', ownerId: OWNER, role: 'hero', sortOrder: 1 },
  ],
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
  const map = await svc.resolveForOwners(MediaOwnerType.POST, ['0aaa0001-0000-4000-8000-0000000000ff']);
  expect(map.size).toBe(0);
});
```

Run: `cd apps/api && pnpm vitest run src/modules/media/media.int.spec.ts`
Expected: FAIL — `MediaService`/`MediaModule` chưa tồn tại.

- [ ] **Step 3: Implement `MediaService` + `MediaModule`**

Create `apps/api/src/modules/media/media.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { MediaItem } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { env } from '../../config/env.js';
import type { MediaOwnerType } from '../../generated/prisma/enums.js';
import { buildCloudinaryUrl } from '../../lib/cloudinary-url.js';

@Injectable()
export class MediaService {
  /**
   * Resolve media cho NHIỀU owner trong MỘT query (chống N+1, ADR-0005). Trả
   * Map ownerId → MediaItem[] đã dựng URL, sort theo sortOrder asc. Owner
   * không có asset không xuất hiện trong Map.
   */
  async resolveForOwners(
    ownerType: MediaOwnerType,
    ownerIds: string[],
  ): Promise<Map<string, MediaItem[]>> {
    const map = new Map<string, MediaItem[]>();
    if (ownerIds.length === 0) return map;

    const assets = await prisma.mediaAsset.findMany({
      where: { ownerType, ownerId: { in: ownerIds } },
      orderBy: { sortOrder: 'asc' },
    });

    const cloudName = env.CLOUDINARY_CLOUD_NAME;
    for (const asset of assets) {
      const { url, posterUrl } = buildCloudinaryUrl(cloudName, {
        type: asset.type,
        publicId: asset.publicId,
        posterId: asset.posterId,
      });
      const item: MediaItem = {
        publicId: asset.publicId,
        url,
        type: asset.type,
        role: asset.role,
        posterUrl,
        width: asset.width,
        height: asset.height,
        alt: asset.alt,
        sortOrder: asset.sortOrder,
      };
      const list = map.get(asset.ownerId);
      if (list) list.push(item);
      else map.set(asset.ownerId, [item]);
    }
    return map;
  }
}
```

Create `apps/api/src/modules/media/media.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MediaService } from './media.service.js';

@Module({ providers: [MediaService], exports: [MediaService] })
export class MediaModule {}
```

- [ ] **Step 4: Chạy int test thấy PASS**

Run: `cd apps/api && pnpm vitest run src/modules/media/media.int.spec.ts`
Expected: PASS (2 test).

- [ ] **Step 5: Gate + commit**

```bash
cd ~/projects/tourism-v2 && pnpm gate:int
git add libs/shared/contract/src/schemas/media.ts libs/shared/contract/src/index.ts apps/api/src/modules/media
git commit -m "feat(api,contract): MediaService resolve batch + MediaItem schema (P3a-C, ADR-0005)"
```

---

## Task 3: `publishedPostWhere()` (ADR-0004)

Helper thuần trả `where` fragment cho mọi path public đọc Post. TDD, không DB.

**Files:**
- Create: `apps/api/src/modules/posts/published-post.where.ts`
- Test: `apps/api/src/modules/posts/published-post.where.spec.ts`

**Interfaces:**
- Produces: `publishedPostWhere(now?: Date): Prisma.PostWhereInput` — Task 4/5/6 spread vào `where`.

- [ ] **Step 1: Viết test thuần (FAIL trước)**

Create `apps/api/src/modules/posts/published-post.where.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PostStatus } from '../../generated/prisma/enums.js';
import { publishedPostWhere } from './published-post.where.js';

describe('publishedPostWhere', () => {
  it('trả điều kiện status PUBLISHED + publishedAt <= now đã bơm', () => {
    const now = new Date('2026-07-21T00:00:00.000Z');
    expect(publishedPostWhere(now)).toEqual({
      status: PostStatus.PUBLISHED,
      publishedAt: { lte: now },
    });
  });

  it('không truyền now → dùng thời điểm gọi (lte là Date)', () => {
    // Dùng `expect.any(Date)` thay vì cast — tuân luật không-cast (kể cả test).
    expect(publishedPostWhere()).toEqual({
      status: PostStatus.PUBLISHED,
      publishedAt: { lte: expect.any(Date) },
    });
  });
});
```

- [ ] **Step 2: Chạy test thấy FAIL**

Run: `cd apps/api && pnpm vitest run src/modules/posts/published-post.where.spec.ts`
Expected: FAIL — file chưa tồn tại.

- [ ] **Step 3: Implement helper**

Create `apps/api/src/modules/posts/published-post.where.ts`:

```ts
import type { Prisma } from '../../generated/prisma/client.js';
import { PostStatus } from '../../generated/prisma/enums.js';

/**
 * Điều kiện "bài đã công bố và tới giờ hiển thị" cho MỌI path public đọc Post
 * (ADR-0004). Nhận `now` để test bơm mốc cố định. `publishedAt: null` tự bị
 * loại vì null không thoả `lte` — bài PUBLISHED chưa đặt ngày sẽ KHÔNG hiện.
 */
export function publishedPostWhere(now: Date = new Date()): Prisma.PostWhereInput {
  return { status: PostStatus.PUBLISHED, publishedAt: { lte: now } };
}
```

- [ ] **Step 4: Chạy test thấy PASS**

Run: `cd apps/api && pnpm vitest run src/modules/posts/published-post.where.spec.ts`
Expected: PASS (2 test).

- [ ] **Step 5: Gate + commit**

```bash
cd ~/projects/tourism-v2 && pnpm gate
git add apps/api/src/modules/posts/published-post.where.ts apps/api/src/modules/posts/published-post.where.spec.ts
git commit -m "feat(api): publishedPostWhere() helper visibility bài blog (P3a-C, ADR-0004)"
```

---

## Task 4: Contract posts + `posts.list`

Card gọn (LƯỢC `content` — chỉ list mới; content chỉ ở detail) + cover role hero. Sort tie-breaker. Lọc tag. Search title.

**Files:**
- Create: `libs/shared/contract/src/schemas/posts.ts`
- Modify: `libs/shared/contract/src/index.ts` (export) + `libs/shared/contract/src/contract.ts` (mount `posts.list`)
- Create: `apps/api/src/modules/posts/posts.service.ts` · `posts.controller.ts` · `posts.module.ts`
- Modify: `apps/api/src/app.module.ts` (register `PostsModule`)
- Test: `apps/api/src/modules/posts/posts.int.spec.ts`

**Interfaces:**
- Consumes: `publishedPostWhere` (Task 3), `MediaService` (Task 2), `MediaItemSchema` (Task 2).
- Produces: `PostCard`, `PostDetail`, `PostTag`, `PostsListQuery` types; `PostsService.listPosts(query)` — Task 5/6 mở rộng cùng service.

- [ ] **Step 1: Contract schemas posts**

Create `libs/shared/contract/src/schemas/posts.ts`:

```ts
import { z } from 'zod';
import { MediaItemSchema } from './media.js';
import { PageQuerySchema } from './common.js';

import { TourCardSchema } from './catalog.js';

const PostTagRefSchema = z.object({ slug: z.string(), name: z.string() });
// `User.name` nullable trong schema (VarChar(120)?) → author.name nullable.
const PostAuthorSchema = z.object({ name: z.string().nullable(), avatarUrl: z.url().nullable() });

/** Item của list — card GỌN: KHÔNG có `content` (chỉ detail mới có). */
export const PostCardSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  excerpt: z.string().max(300).nullable(),
  publishedAt: z.iso.datetime(),
  cover: MediaItemSchema.nullable(),
  tags: z.array(PostTagRefSchema),
  author: PostAuthorSchema,
});
export type PostCard = z.output<typeof PostCardSchema>;

/** Detail — thêm content markdown, SEO meta thô (nullable), full media, related tours. */
export const PostDetailSchema = PostCardSchema.extend({
  content: z.string(),
  metaTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
  media: z.array(MediaItemSchema),
  // Tour-summary hiện có của catalog — KHÔNG media (ADR-0005). Tái dùng
  // TourCardSchema (import ở đầu file) để một nguồn sự thật duy nhất.
  relatedTours: z.array(TourCardSchema),
});
export type PostDetail = z.output<typeof PostDetailSchema>;

/** Tag toàn cục kèm số bài published. */
export const PostTagSchema = PostTagRefSchema.extend({ count: z.int().nonnegative() });
export type PostTag = z.output<typeof PostTagSchema>;

export const PostsListQuerySchema = PageQuerySchema.extend({
  sort: z.enum(['publishedAt', 'createdAt', 'updatedAt', 'title']).default('publishedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  tag: z.string().min(1).max(60).optional(),
  search: z.string().trim().max(160).optional(),
});
export type PostsListQuery = z.output<typeof PostsListQuerySchema>;
```


- [ ] **Step 2: Mount `posts.list` vào contract**

Trong `libs/shared/contract/src/contract.ts`, thêm nhánh `posts` (bám pattern `reviews`/`wishlist`):

```ts
  posts: {
    list: oc
      .route({ method: 'GET', path: '/api/posts', summary: 'List published blog posts' })
      .input(PostsListQuerySchema)
      .output(PagedSchema(PostCardSchema)),
    // bySlug (Task 5) + tags (Task 6) thêm sau, cùng nhánh này.
  },
```

Import các schema mới ở đầu file theo pattern hiện có.

- [ ] **Step 3: Viết int test list (FAIL trước)**

Create `apps/api/src/modules/posts/posts.int.spec.ts`. Bootstrap + seed theo pattern `catalog.int.spec.ts`. Seed 3 bài + tags + cover:

```ts
// author cố định; 3 post: published quá khứ (hiện), published tương lai (ẩn), DRAFT (ẩn).
const now = Date.now();
const pubPast = { id: P1, slug: 'bai-a', title: 'Bài A', status: 'PUBLISHED', publishedAt: new Date(now - 86_400_000), authorId: AUTHOR, content: 'noi dung A' };
const pubFuture = { id: P2, slug: 'bai-tuong-lai', title: 'Bài tương lai', status: 'PUBLISHED', publishedAt: new Date(now + 86_400_000), authorId: AUTHOR, content: 'x' };
const draft = { id: P3, slug: 'bai-nhap', title: 'Bài nháp', status: 'DRAFT', publishedAt: null, authorId: AUTHOR, content: 'x' };
// cover cho pubPast: MediaAsset ownerType POST role hero.

it('GET /api/posts chỉ trả bài published-quá-khứ, đúng PostCardSchema, KHÔNG content', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/posts' });
  expect(res.statusCode).toBe(200);
  const paged = PagedSchema(PostCardSchema).parse(res.json());
  expect(paged.items.map((p) => p.slug)).toEqual(['bai-a']);
  expect(paged.total).toBe(1);
  // card gọn: parse bằng PostCardSchema đã đảm bảo không có key lạ; khẳng định thêm:
  expect((paged.items[0] as Record<string, unknown>).content).toBeUndefined();
  expect(paged.items[0]?.cover?.role).toBe('hero');
});

it('tie-breaker: 2 bài cùng publishedAt sort ổn định theo id desc', async () => {
  // seed thêm 2 bài cùng publishedAt; assert thứ tự id desc ổn định giữa 2 lần gọi.
});

it('lọc theo ?tag=slug', async () => { /* seed tag gắn pubPast; ?tag → chỉ bài đó */ });
```

Run: `cd apps/api && pnpm vitest run src/modules/posts/posts.int.spec.ts`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 4: Implement service + controller + module**

Create `apps/api/src/modules/posts/posts.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { Paged, PostCard, PostsListQuery } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { MediaOwnerType } from '../../generated/prisma/enums.js';
import { MediaService } from '../media/media.service.js';
import { publishedPostWhere } from './published-post.where.js';

const SORT_COLUMN = {
  publishedAt: 'publishedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  title: 'title',
} as const satisfies Record<PostsListQuery['sort'], keyof Prisma.PostOrderByWithRelationInput>;

const postCardInclude = {
  tags: { select: { tag: { select: { slug: true, name: true } } } },
  author: { select: { name: true, image: true } },
} satisfies Prisma.PostInclude;

@Injectable()
export class PostsService {
  constructor(private readonly media: MediaService) {}

  async listPosts(query: PostsListQuery): Promise<Paged<PostCard>> {
    const { page, pageSize, sort, order, tag, search } = query;
    const where: Prisma.PostWhereInput = {
      ...publishedPostWhere(),
      ...(tag ? { tags: { some: { tag: { slug: tag } } } } : {}),
      ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
    };

    const [total, posts] = await Promise.all([
      prisma.post.count({ where }),
      prisma.post.findMany({
        where,
        include: postCardInclude,
        // Tie-breaker id desc → pagination ổn định khi trùng sort key.
        orderBy: [{ [SORT_COLUMN[sort]]: order }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // Cover: một query media cho cả trang (chống N+1), pick role hero.
    const coverMap = await this.media.resolveForOwners(
      MediaOwnerType.POST,
      posts.map((p) => p.id),
    );

    const items = posts.map((p): PostCard => {
      const media = coverMap.get(p.id) ?? [];
      const cover = media.find((m) => m.role === 'hero') ?? null;
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        // publishedAt đã lọc non-null bởi publishedPostWhere → an toàn.
        publishedAt: (p.publishedAt as Date).toISOString(),
        cover,
        tags: p.tags.map((t) => t.tag),
        author: { name: p.author.name, avatarUrl: p.author.image ?? null },
      };
    });

    // Input `pageSize` → output field tên `limit` (convention Paged).
    return { items, page, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }
}
```

Create `apps/api/src/modules/posts/posts.controller.ts`:

```ts
import { Controller } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { Public } from '../../auth/public.decorator.js';
import { PostsService } from './posts.service.js';

// Blog công khai (spec §4.6): khách chưa đăng nhập đọc được. AuthGuard toàn
// cục nên thiếu @Public() là 401 chết cả blog (ADR-0003).
@Public()
@Controller()
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Implement(contract.posts.list)
  list() {
    return implement(contract.posts.list).handler(({ input }) => this.posts.listPosts(input));
  }
}
```

Create `apps/api/src/modules/posts/posts.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';

@Module({ imports: [MediaModule], controllers: [PostsController], providers: [PostsService] })
export class PostsModule {}
```

Register `PostsModule` trong `apps/api/src/app.module.ts` (thêm vào mảng `imports` cạnh các module khác).

- [ ] **Step 5: Chạy int test thấy PASS**

Run: `cd apps/api && pnpm vitest run src/modules/posts/posts.int.spec.ts`
Expected: PASS.

- [ ] **Step 6: Mutation-test visibility (ADR-0004)**

Tạm bỏ `...publishedPostWhere()` khỏi `where` trong `listPosts`, chạy lại int test:
Expected: ĐỎ — bài tương lai + draft lọt vào list. Hoàn nguyên → xanh. Ghi kết quả vào commit body.

- [ ] **Step 7: Gate + commit**

```bash
cd ~/projects/tourism-v2 && pnpm gate:int
git add libs/shared/contract/src apps/api/src/modules/posts apps/api/src/app.module.ts
git commit -m "feat(api,contract): posts.list — card gọn, cover hero, tie-breaker, lọc tag (P3a-C W5)"
```

---

## Task 5: `posts.bySlug`

Detail đầy đủ + full media + related tours (không media). Draft/future → `POST_NOT_FOUND` 404 (không phân biệt với không tồn tại — ADR-0004).

**Files:**
- Modify: `libs/shared/contract/src/contract.ts` (thêm `posts.bySlug`)
- Modify: `apps/api/src/modules/posts/posts.service.ts` (+`getPostBySlug`) · `posts.controller.ts` (+handler)
- Modify: `apps/api/src/modules/posts/posts.int.spec.ts` (thêm case)

**Interfaces:**
- Consumes: `publishedPostWhere`, `MediaService`, và **`toTourCard` + `cardInclude` export từ `catalog.service.ts`** (xem Step 0) để map related tours sang `TourCard` — một nguồn sự thật, không viết lại mapper.
- Produces: `PostsService.getPostBySlug(slug): Promise<PostDetail | null>`.

- [ ] **Step 0: Export mapper dùng chung từ catalog**

Trong `apps/api/src/modules/catalog/catalog.service.ts`, đổi `const cardInclude` và `function toTourCard` từ module-private thành **export** (thêm `export` trước cả hai; không đổi thân). Đây là để `posts.service` map related tours sang đúng `TourCard` mà không nhân bản logic.

Run: `cd apps/api && pnpm typecheck` → Expected: sạch (chỉ thêm `export`, không đổi hành vi).

- [ ] **Step 1: Thêm `posts.bySlug` vào contract**

Trong nhánh `posts` của `contract.ts`:

```ts
    bySlug: oc
      .route({ method: 'GET', path: '/api/posts/{slug}', summary: 'Get a published post by slug' })
      .input(z.object({ slug: z.string().min(1).max(80) }))
      .output(PostDetailSchema)
      .errors({ POST_NOT_FOUND: { status: 404, message: 'Post not found' } }),
```

- [ ] **Step 2: Viết int test bySlug (FAIL trước)**

Thêm vào `posts.int.spec.ts`:

```ts
it('GET /api/posts/:slug trả detail đầy đủ + media + related tours (không media)', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/posts/bai-a' });
  expect(res.statusCode).toBe(200);
  const detail = PostDetailSchema.parse(res.json());
  expect(detail.content).toBe('noi dung A');
  expect(detail.media.length).toBeGreaterThanOrEqual(1);
  // related tours là TourCard (không có field media) — parse đã đảm bảo.
});

it('bài DRAFT hoặc hẹn-giờ-tương-lai → 404 POST_NOT_FOUND (như không tồn tại)', async () => {
  expect((await app.inject({ method: 'GET', url: '/api/posts/bai-nhap' })).statusCode).toBe(404);
  expect((await app.inject({ method: 'GET', url: '/api/posts/bai-tuong-lai' })).statusCode).toBe(404);
});

it('related tour bị unpublish → rớt âm thầm khỏi mảng, không 500', async () => {
  // seed pubPast + 2 PostTour; unpublish 1 tour → related còn 1, đúng order.
});
```

Run: FAIL (chưa có handler bySlug).

- [ ] **Step 3: Implement `getPostBySlug` + handler**

Thêm vào `PostsService`:

```ts
async getPostBySlug(slug: string): Promise<PostDetail | null> {
  const post = await prisma.post.findFirst({
    where: { slug, ...publishedPostWhere() },
    include: {
      tags: { select: { tag: { select: { slug: true, name: true } } } },
      author: { select: { name: true, image: true } },
      // Related tours: chỉ tour đã published (unpublish → rớt âm thầm), giữ
      // đúng thứ tự pick. cardInclude (import từ catalog) đủ field cho TourCard.
      relatedTours: {
        orderBy: { order: 'asc' },
        where: { tour: { isPublished: true } },
        include: { tour: { include: tourCardInclude } },
      },
    },
  });
  if (!post) return null;

  const media = (await this.media.resolveForOwners(MediaOwnerType.POST, [post.id])).get(post.id) ?? [];
  const cover = media.find((m) => m.role === 'hero') ?? null;
  // Map sang TourCard bằng mapper dùng chung (KHÔNG media — ADR-0005).
  const relatedTours = post.relatedTours.map((rt) => toTourCard(rt.tour));

  return {
    id: post.id, slug: post.slug, title: post.title, excerpt: post.excerpt,
    publishedAt: (post.publishedAt as Date).toISOString(),
    cover, tags: post.tags.map((t) => t.tag),
    author: { name: post.author.name, avatarUrl: post.author.image ?? null },
    content: post.content, metaTitle: post.metaTitle, metaDescription: post.metaDescription,
    media, relatedTours,
  };
}
```

> Import ở đầu `posts.service.ts`: `import { cardInclude as tourCardInclude, toTourCard } from '../catalog/catalog.service.js';` (đã export ở Step 0; alias để không đụng `postCardInclude` của Task 4). `where` trên `relatedTours` lọc tour unpublish TRƯỚC khi map nên `toTourCard` không bao giờ nhận tour ẩn.

Thêm handler vào `PostsController`:

```ts
  @Implement(contract.posts.bySlug)
  bySlug() {
    return implement(contract.posts.bySlug).handler(async ({ input, errors }) => {
      const post = await this.posts.getPostBySlug(input.slug);
      if (!post) throw errors.POST_NOT_FOUND();
      return post;
    });
  }
```

- [ ] **Step 4: Chạy int test thấy PASS**

Run: `cd apps/api && pnpm vitest run src/modules/posts/posts.int.spec.ts`
Expected: PASS.

- [ ] **Step 5: Mutation-test bySlug visibility**

Bỏ `...publishedPostWhere()` khỏi `findFirst` → test "draft/future → 404" phải ĐỎ. Hoàn nguyên → xanh.

- [ ] **Step 6: Gate + commit**

```bash
cd ~/projects/tourism-v2 && pnpm gate:int
git add libs/shared/contract/src apps/api/src/modules/posts
git commit -m "feat(api,contract): posts.bySlug — detail + media + related tours, 404 cho chưa-công-bố (P3a-C W5)"
```

---

## Task 6: `posts.tags`

Tag toàn cục CÓ ≥1 bài published, kèm count, order name asc. Một query `_count` với nested where (KHÔNG N+1). Tag chỉ-chứa-draft/future bị loại.

**Files:**
- Modify: `libs/shared/contract/src/contract.ts` (thêm `posts.tags`)
- Modify: `apps/api/src/modules/posts/posts.service.ts` (+`listTags`) · `posts.controller.ts` (+handler)
- Modify: `apps/api/src/modules/posts/posts.int.spec.ts` (thêm case)

**Interfaces:**
- Produces: `PostsService.listTags(): Promise<PostTag[]>`.

- [ ] **Step 1: Thêm `posts.tags` vào contract**

```ts
    tags: oc
      .route({ method: 'GET', path: '/api/posts-tags', summary: 'List blog tags with published-post counts' })
      .output(z.array(PostTagSchema)),
```

> Path `/api/posts-tags` (KHÔNG `/api/posts/tags`) — tránh nhầm với `bySlug` `/api/posts/{slug}` ở tầng path (oRPC procedure-based nên không thực sự đụng, nhưng đặt tách cho rõ; đừng tạo post slug tên "tags").

- [ ] **Step 2: Viết int test tags (FAIL trước)**

```ts
it('GET /api/posts-tags: chỉ tag có ≥1 bài published, kèm count, order name asc', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/posts-tags' });
  expect(res.statusCode).toBe(200);
  const tags = z.array(PostTagSchema).parse(res.json());
  // tag gắn pubPast xuất hiện với count>=1; tag chỉ-gắn-draft KHÔNG xuất hiện.
  const slugs = tags.map((t) => t.slug);
  expect(slugs).toContain('tag-published');
  expect(slugs).not.toContain('tag-chi-draft');
});
```

Seed: `tag-published` gắn `pubPast`; `tag-chi-draft` gắn `draft`.

Run: FAIL.

- [ ] **Step 3: Implement `listTags` + handler**

Thêm vào `PostsService`:

```ts
async listTags(): Promise<PostTag[]> {
  // Đếm bài published PER tag trong MỘT query bằng _count có nested where
  // (chống N+1). Tag count 0 (chỉ có draft/future) bị loại ở tầng JS.
  const rows = await prisma.postTag.findMany({
    orderBy: { name: 'asc' },
    select: {
      slug: true,
      name: true,
      _count: { select: { posts: { where: { post: publishedPostWhere() } } } },
    },
  });
  return rows
    .filter((r) => r._count.posts > 0)
    .map((r) => ({ slug: r.slug, name: r.name, count: r._count.posts }));
}
```

> ⚠️ `_count.posts.where` nhét helper qua RELATION (`post: publishedPostWhere()`), KHÔNG phải where phẳng. Kiểm tên relation thực tế trên `PostTag` (`posts` là `PostTagLink[]`; điều kiện lọc theo `post` bên trong link). Điều chỉnh path cho khớp schema khi implement.

Handler:

```ts
  @Implement(contract.posts.tags)
  tags() {
    return implement(contract.posts.tags).handler(() => this.posts.listTags());
  }
```

- [ ] **Step 4: Chạy int test thấy PASS**

Run: `cd apps/api && pnpm vitest run src/modules/posts/posts.int.spec.ts`
Expected: PASS.

- [ ] **Step 5: Mutation-test tags visibility**

Bỏ `where: { post: publishedPostWhere() }` khỏi `_count` → test "tag-chi-draft không xuất hiện" phải ĐỎ (tag draft lọt ra + count sai). Hoàn nguyên → xanh.

- [ ] **Step 6: Gate + commit**

```bash
cd ~/projects/tourism-v2 && pnpm gate:int
git add libs/shared/contract/src apps/api/src/modules/posts
git commit -m "feat(api,contract): posts.tags — tag có bài published + count, một query _count (P3a-C W5)"
```

---

## Task 7: `siteMedia.list`

Đọc `site_media_slots` từ DB; chỉ trả slot CÓ media. Shape `{key, media[]}`.

> **YAGNI:** không tạo `slot-catalog.ts` (danh mục 9 key + kind + role) ở đây — nó chỉ cần cho admin **validate/sync** khi GHI media vào slot (P4). Public read chỉ liệt kê slot đang có trong DB và có ≥1 media. Seed 9 slot vào DB là việc của seed script/admin, không phải read-path.

**Files:**
- Create: `libs/shared/contract/src/schemas/site-media.ts`
- Modify: `libs/shared/contract/src/index.ts` (export) + `contract.ts` (mount `siteMedia.list`)
- Create: `apps/api/src/modules/site-media/site-media.service.ts` · `site-media.controller.ts` · `site-media.module.ts`
- Modify: `apps/api/src/app.module.ts` (register `SiteMediaModule`)
- Test: `apps/api/src/modules/site-media/site-media.int.spec.ts`

**Interfaces:**
- Consumes: `MediaService` (Task 2).
- Produces: `SiteMediaEntry` type; `SiteMediaService.listSiteMedia(): Promise<SiteMediaEntry[]>`.

- [ ] **Step 1: Contract `SiteMediaEntrySchema`**

Create `libs/shared/contract/src/schemas/site-media.ts`:

```ts
import { z } from 'zod';
import { MediaItemSchema } from './media.js';

/** Một slot brand-chrome public: key ổn định + media đã dựng URL. */
export const SiteMediaEntrySchema = z.object({
  key: z.string().min(1).max(60),
  media: z.array(MediaItemSchema),
});
export type SiteMediaEntry = z.output<typeof SiteMediaEntrySchema>;
```

Mount vào `contract.ts`:

```ts
  siteMedia: {
    list: oc
      .route({ method: 'GET', path: '/api/site-media', summary: 'List site brand-chrome media slots (only slots with media)' })
      .output(z.array(SiteMediaEntrySchema)),
  },
```

- [ ] **Step 2: Viết int test site-media (FAIL trước)**

Create `apps/api/src/modules/site-media/site-media.int.spec.ts` (bootstrap theo pattern chung). Seed: 2 slot row (`site_media_slots`) — một có 1 asset hero, một rỗng.

```ts
it('GET /api/site-media chỉ trả slot CÓ media, shape {key, media[]}', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/site-media' });
  expect(res.statusCode).toBe(200);
  const entries = z.array(SiteMediaEntrySchema).parse(res.json());
  const keys = entries.map((e) => e.key);
  expect(keys).toContain('home-hero');       // slot có media
  expect(keys).not.toContain('cta-band');    // slot rỗng → vắng mặt
  expect(entries.find((e) => e.key === 'home-hero')?.media.length).toBeGreaterThanOrEqual(1);
});
```

Run: FAIL.

- [ ] **Step 3: Implement service + controller + module**

Create `apps/api/src/modules/site-media/site-media.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { SiteMediaEntry } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { MediaOwnerType } from '../../generated/prisma/enums.js';
import { MediaService } from '../media/media.service.js';

@Injectable()
export class SiteMediaService {
  constructor(private readonly media: MediaService) {}

  /** Chỉ trả slot CÓ media (ADR-0005). Owner của asset là slot.id (ownerType SITE). */
  async listSiteMedia(): Promise<SiteMediaEntry[]> {
    const slots = await prisma.siteMediaSlot.findMany();
    const mediaMap = await this.media.resolveForOwners(
      MediaOwnerType.SITE,
      slots.map((s) => s.id),
    );
    return slots
      .map((s) => ({ key: s.key, media: mediaMap.get(s.id) ?? [] }))
      .filter((e) => e.media.length > 0);
  }
}
```

Create `site-media.controller.ts` (@Public, @Implement `siteMedia.list`), `site-media.module.ts` (imports `MediaModule`). Register `SiteMediaModule` trong `app.module.ts`.

- [ ] **Step 4: Chạy int test thấy PASS**

Run: `cd apps/api && pnpm vitest run src/modules/site-media/site-media.int.spec.ts`
Expected: PASS.

- [ ] **Step 5: Gate + commit**

```bash
cd ~/projects/tourism-v2 && pnpm gate:int
git add libs/shared/contract/src apps/api/src/modules/site-media apps/api/src/app.module.ts
git commit -m "feat(api,contract): siteMedia.list — slot brand-chrome có media (P3a-C W6)"
```

---

## Closeout (sau khi 7 task xong)

Không nằm trong task execution — theo nếp cụm P3a-A/B:

1. **Final review toàn nhánh** (`superpowers:requesting-code-review`, model mạnh nhất). Soi kỹ: visibility 3 path (mutation-test đã đỏ chưa), N+1 media/tags, `MediaOwnerType.SITE` đúng chưa, `@Public()` đủ 2 controller, related tours không rò field media.
2. **Docs sweep** (CLAUDE.md #13): entry `docs/CHANGELOG.md` (ngày · hash · findings · số test) · cập nhật `docs/README` (Plans row P3a-C → đã merge; specs P3a → xong) · `./scripts/docs-freshness.sh` xanh.
3. **Merge** (`superpowers:finishing-a-development-branch`): rebase + `git merge --ff-only` → push → xoá branch, sau khi `./scripts/ci-wait.sh` xanh.

## Ghi chú kế thừa (không thuộc P3a-C — cho P3b/P4)

- SEO fallback (`metaTitle→title`, `metaDescription→excerpt`) làm ở **web P3b**, KHÔNG ở API (API chỉ passthrough nullable thô).
- Related tours **chưa có media** cho tới khi catalog thêm media (P3b/P4) — lúc đó related tự có, không phải sửa posts.
- Nợ P3a-B mang sang: link unsubscribe/GDPR chờ `apps/web`; I1 resubscribe reachability; `OutboxStatus.SKIPPED`.
```
