# P3a-B — Wishlist · Enquiry · Newsletter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây 3 module ghi phía khách (wishlist, enquiry, newsletter) cùng hạ tầng rate limiting mà v2 đang thiếu so với Nexora.

**Architecture:** Mỗi module một dir trong `apps/api/src/modules/` theo đúng pattern `catalog/`+`reviews/` đã có: `*.service.ts` · `*.controller.ts` · `*.module.ts` · `*.int.spec.ts`. Contract oRPC khai ở `libs/shared/contract/src/schemas/`. Rate limiting dùng `@nestjs/throttler` gắn **per-controller** (không global) — chỉ chặn đúng endpoint ghi công khai, giống lựa chọn của Nexora.

**Tech Stack:** NestJS 11 ESM + Fastify · Prisma 7 · oRPC + Zod 4 · pg-boss outbox · Vitest (unit + integration trên Docker Postgres `tourism_test`).

## Global Constraints

Mọi task ngầm bao gồm phần này.

- **Comment code bằng tiếng Việt**; identifier/tên biến tiếng Anh (CLAUDE.md #8).
- **ESM**: mọi import nội bộ phải có đuôi `.js`.
- **Biome**: nháy đơn, trailing comma, 100 cột. `pnpm lint:fix` trước khi commit.
- **Không `any`, không type cast để lách kiểu.**
- **TDD trên logic thuần**: test trước, chạy thấy FAIL, rồi mới implement.
- **`PagedSchema` dùng field `limit`**, KHÔNG phải `pageSize`. Query dùng `PageQuerySchema` (`page` + `pageSize`).
- **ADR-0003 — auth fail-closed**: `AuthGuard` chạy toàn cục. Endpoint public **PHẢI** khai `@Public()` kèm comment lý do. Quên = 401 cho khách ẩn danh.
- **TUYỆT ĐỐI không sửa file trong `apps/api/prisma/migrations/`** đã apply — kể cả comment. Muốn đổi thì viết migration MỚI.
- **`pnpm gate:int` xanh** trước khi khai một task xong (gate trần KHÔNG chạy integration test).
- **Conventional Commits**, KHÔNG AI attribution.
- Ưu tiên skill có sẵn hơn tự chế (xem `docs/skills.md`).

## File Structure

| File | Trách nhiệm |
| --- | --- |
| `apps/api/prisma/migrations/*_p3a_b_enquiry_alert/migration.sql` | Thêm `ENQUIRY_ADMIN_ALERT` vào enum `EmailType` |
| `apps/api/src/worker/resend.deliverer.ts` | +1 case render email alert admin |
| `apps/api/src/config/throttle.ts` | Hằng số cấu hình throttle dùng chung |
| `libs/shared/contract/src/schemas/wishlist.ts` | Schema wishlist |
| `apps/api/src/modules/wishlist/{service,controller,module,int.spec}` | Module wishlist |
| `libs/shared/contract/src/schemas/enquiries.ts` | Schema enquiry |
| `apps/api/src/modules/enquiries/{service,controller,module,int.spec}` | Module enquiry |
| `libs/shared/contract/src/schemas/newsletter.ts` | Schema newsletter |
| `apps/api/src/modules/newsletter/unsubscribe-token.ts` + `.spec.ts` | **Logic thuần** HMAC — TDD, test không cần DB |
| `apps/api/src/modules/newsletter/{service,controller,module,int.spec}` | Module newsletter |
| `apps/api/src/config/env.ts` | +`NEWSLETTER_UNSUBSCRIBE_SECRET` |

---

## Task 1: Migration `ENQUIRY_ADMIN_ALERT` + deliverer

Spec §4.3 (A13) yêu cầu enquiry ghi **hai** outbox: ack cho khách + alert cho admin. Enum `EmailType` hiện chưa có giá trị thứ hai.

**Files:**
- Create: `apps/api/prisma/migrations/<timestamp>_p3a_b_enquiry_alert/migration.sql` (do `prisma migrate dev` sinh)
- Modify: `apps/api/prisma/schema.prisma` (enum `EmailType`, ~dòng 140)
- Modify: `apps/api/src/worker/resend.deliverer.ts` (switch ~dòng 88–176)
- Test: `apps/api/src/worker/resend.deliverer.spec.ts`

**Interfaces:**
- Produces: `EmailType.ENQUIRY_ADMIN_ALERT` — Task 4 enqueue giá trị này.

> ⚠️ Thứ tự bắt buộc: switch trong `resend.deliverer.ts` là **exhaustive** (có nhánh `default` chặn `never`). Thêm enum value mà chưa thêm case sẽ **vỡ typecheck ngay**. Hai việc phải nằm cùng một commit.

- [ ] **Step 1: Thêm giá trị vào enum trong schema**

Trong `apps/api/prisma/schema.prisma`, enum `EmailType`, thêm sau `ENQUIRY_RECEIVED`:

```prisma
  ENQUIRY_RECEIVED
  /// Alert nội bộ cho admin khi có lead mới (A13 — Nexora chỉ gửi ack cho
  /// khách nên lead mới không ai biết cho tới khi mở CRM).
  ENQUIRY_ADMIN_ALERT
```

- [ ] **Step 2: Sinh migration**

Run: `cd apps/api && pnpm prisma migrate dev --name p3a_b_enquiry_alert`
Expected: tạo thư mục migration mới, apply sạch, in `Your database is now in sync with your schema.`

- [ ] **Step 3: Chạy typecheck để THẤY nó vỡ**

Run: `cd apps/api && pnpm typecheck`
Expected: FAIL ở `resend.deliverer.ts` — nhánh `default` không gán được `ENQUIRY_ADMIN_ALERT` vào `never`. Đây là bằng chứng exhaustiveness đang bảo vệ đúng.

- [ ] **Step 4: Thêm test cho case mới**

Trong `apps/api/src/worker/resend.deliverer.spec.ts`, mảng `cases` (~dòng 27), thêm:

```ts
    [EmailType.ENQUIRY_ADMIN_ALERT, /New enquiry from Jane/],
```

- [ ] **Step 5: Thêm case vào deliverer**

Trong `apps/api/src/worker/resend.deliverer.ts`, thêm ngay sau case `ENQUIRY_RECEIVED`:

```ts
    // Alert nội bộ: gửi tới hộp thư admin, KHÔNG gửi cho khách. Payload mang
    // sẵn mọi thứ admin cần để phân loại lead mà không phải mở CRM.
    case EmailType.ENQUIRY_ADMIN_ALERT:
      return {
        subject: `New enquiry from ${p.name}`,
        html: `<p>New enquiry received.</p>
<p><strong>Name:</strong> ${p.name}<br/>
<strong>Email:</strong> ${p.email}<br/>
<strong>Tour:</strong> ${p.tourTitle ?? 'General enquiry'}</p>
<p>${p.message}</p>`,
      };
```

> Lưu ý: mọi field string trong payload đã được `escapeHtml` ở tầng trên (xem đầu file) — đừng escape lần hai.

- [ ] **Step 6: Chạy test + typecheck**

Run: `cd apps/api && pnpm typecheck && pnpm vitest run src/worker/resend.deliverer.spec.ts`
Expected: typecheck sạch; test PASS, số case tăng đúng 1.

- [ ] **Step 7: Gate + commit**

```bash
cd ~/projects/tourism-v2 && pnpm gate:int
git add -A
git commit -m "feat(api): thêm EmailType ENQUIRY_ADMIN_ALERT + template deliverer (P3a-W3)"
```

---

## Task 2: Hạ tầng rate limiting

v2 thiếu hoàn toàn rate limiting trong khi Nexora có — thụt lùi đã ghi ở `docs/analysis/2026-07-19-infra-parity-nexora.md` lỗ #5.

**Files:**
- Create: `apps/api/src/config/throttle.ts`
- Create: `apps/api/src/config/throttle.e2e.spec.ts`
- Modify: `apps/api/package.json` (thêm `@nestjs/throttler`)
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Produces: `PUBLIC_WRITE_THROTTLE` — object `{ limit: number; ttl: number }`, Task 4 và 5 dùng trong `@Throttle()`.

- [ ] **Step 1: Cài package**

Run: `cd apps/api && pnpm add @nestjs/throttler`

- [ ] **Step 2: Viết hằng số cấu hình**

Create `apps/api/src/config/throttle.ts`:

```ts
/**
 * Trần tần suất cho endpoint GHI CÔNG KHAI (không cần đăng nhập).
 *
 * 5 request / 60 giây / IP — khớp giá trị Nexora dùng cho form enquiry và
 * newsletter. Người thật không bao giờ gửi form 6 lần trong một phút; bot
 * thì có.
 *
 * Cố ý KHÔNG gắn throttle toàn cục: endpoint đọc (catalogue) và endpoint đã
 * auth (booking, admin) có mô hình sử dụng khác hẳn, gắn chung một trần sẽ
 * chặn nhầm người dùng thật.
 *
 * ttl tính bằng MILLISECOND (@nestjs/throttler v6+), không phải giây.
 */
export const PUBLIC_WRITE_THROTTLE = { limit: 5, ttl: 60_000 } as const;
```

- [ ] **Step 3: Đăng ký ThrottlerModule**

Trong `apps/api/src/app.module.ts`, thêm import và vào mảng `imports` (đặt ngay sau `ORPCModule.forRoot({...})`):

```ts
import { ThrottlerModule } from '@nestjs/throttler';
import { PUBLIC_WRITE_THROTTLE } from './config/throttle.js';
```

```ts
    /**
     * Rate limiting (lỗ #5 trong infra-parity). Đăng ký module ở đây nhưng
     * KHÔNG gắn ThrottlerGuard toàn cục — từng controller công khai tự gắn
     * `@UseGuards(ThrottlerGuard)`, xem `config/throttle.ts`.
     *
     * Đếm theo `req.ip`, mà `trustProxy: true` đã bật ở `main.ts` — thiếu nó
     * thì mọi client dùng chung IP của proxy và trần này khoá sạch cả site.
     */
    ThrottlerModule.forRoot([PUBLIC_WRITE_THROTTLE]),
```

- [ ] **Step 4: Viết test chứng minh nó THẬT SỰ chặn**

Create `apps/api/src/config/throttle.e2e.spec.ts`:

```ts
import { Controller, Post, UseGuards } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '../app.module.js';
import { Public } from '../auth/public.decorator.js';

/**
 * Canh chính cơ chế: không có test này thì ai đó gỡ ThrottlerModule mà cả
 * suite vẫn xanh — đúng loại lỗ mutation-test 19/07 đã vạch ra.
 */
@Public()
@UseGuards(ThrottlerGuard)
@Controller('test-throttled')
class ThrottledController {
  @Post()
  submit() {
    return { ok: true };
  }
}

describe('rate limiting endpoint ghi công khai', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ThrottledController],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('cho qua 5 request đầu rồi chặn request thứ 6 bằng 429', async () => {
    const call = () =>
      app.inject({
        method: 'POST',
        url: '/test-throttled',
        payload: {},
        headers: { 'x-forwarded-for': '203.0.113.10' },
      });

    for (let i = 1; i <= 5; i++) {
      const res = await call();
      expect(res.statusCode, `request thứ ${i} phải qua`).toBe(201);
    }
    const blocked = await call();
    expect(blocked.statusCode).toBe(429);
  });

  it('đếm theo IP — client khác không bị vạ lây', async () => {
    // Nếu trần bị đếm toàn cục thay vì theo IP thì test này đỏ, và đó chính
    // là kịch bản "một bot khoá sạch cả site".
    const res = await app.inject({
      method: 'POST',
      url: '/test-throttled',
      payload: {},
      headers: { 'x-forwarded-for': '198.51.100.20' },
    });
    expect(res.statusCode).toBe(201);
  });
});
```

- [ ] **Step 5: Chạy test**

Run: `cd apps/api && pnpm vitest run src/config/throttle.e2e.spec.ts`
Expected: 2 PASS.

- [ ] **Step 6: Mutation-test — tự kiểm test có canh thật không**

Tạm sửa `PUBLIC_WRITE_THROTTLE.limit` từ `5` thành `500`, chạy lại test.
Expected: test đầu FAIL (request thứ 6 trả 201 thay vì 429). Khôi phục lại `5`, xác nhận `git diff` sạch.

- [ ] **Step 7: Gate + commit**

```bash
cd ~/projects/tourism-v2 && pnpm gate:int
git add -A
git commit -m "feat(api): hạ tầng rate limiting cho endpoint ghi công khai"
```

---

## Task 3: Wishlist

Spec §4.5. `set({tourId, wished})` idempotent thay cặp add/remove; `list` trả cờ `unavailable`; `check` batch.

**Files:**
- Create: `libs/shared/contract/src/schemas/wishlist.ts`
- Modify: `libs/shared/contract/src/contract.ts`, `libs/shared/contract/src/index.ts`
- Create: `apps/api/src/modules/wishlist/wishlist.service.ts`, `wishlist.controller.ts`, `wishlist.module.ts`, `wishlist.int.spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `PageQuerySchema` từ `schemas/common.js`; `prisma` từ `../../auth/auth.config.js`.
- Produces: `WishlistItemSchema`, contract `wishlist.{set,list,check}`.

> Toàn bộ endpoint wishlist **CẦN AUTH** — không khai `@Public()`. Model `Wishlist` có khoá composite `@@id([userId, tourId])`, không có cột id riêng.

- [ ] **Step 1: Viết schema contract**

Create `libs/shared/contract/src/schemas/wishlist.ts`:

```ts
import { z } from 'zod';

export const WishlistItemSchema = z.object({
  tourId: z.uuid(),
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  basePrice: z.string(),
  currency: z.string().length(3),
  durationDays: z.int().positive(),
  ratingAvg: z.number().min(0).max(5).nullable(),
  ratingCount: z.int().nonnegative(),
  addedAt: z.iso.datetime(),
  // Tour đã bị unpublish sau khi khách lưu. Nexora rò rỉ thẳng cột
  // `isPublished` rồi để FE tự suy diễn — hậu quả là item chết, bấm vào 404.
  // Ở đây trả cờ ngữ nghĩa để FE hiển thị "không còn khả dụng" tử tế.
  unavailable: z.boolean(),
});
export type WishlistItem = z.output<typeof WishlistItemSchema>;

/** `wished: true` thêm, `false` bỏ — một endpoint, gọi lại bao nhiêu lần cũng cùng kết quả. */
export const SetWishlistInputSchema = z.object({
  tourId: z.uuid(),
  wished: z.boolean(),
});

export const SetWishlistResultSchema = z.object({ tourId: z.uuid(), wished: z.boolean() });

/** Batch (A11): trang danh sách tour hỏi MỘT lần cho cả trang, không N+1. */
export const CheckWishlistInputSchema = z.object({
  tourIds: z.array(z.uuid()).min(1).max(100),
});

export const CheckWishlistResultSchema = z.object({
  wishedTourIds: z.array(z.uuid()),
});
```

- [ ] **Step 2: Khai contract**

Trong `libs/shared/contract/src/contract.ts`, thêm nhánh `wishlist` (đặt sau `reviews`):

```ts
  /**
   * Wishlist — MỌI procedure đều CẦN AUTH (AuthGuard chạy toàn cục theo
   * ADR-0003; không khai @Public() nghĩa là cần đăng nhập).
   */
  wishlist: {
    set: oc
      .route({ method: 'POST', path: '/api/wishlist', summary: 'Add/remove a tour (idempotent)' })
      .input(SetWishlistInputSchema)
      .output(SetWishlistResultSchema)
      .errors({ TOUR_NOT_FOUND: { status: 404, message: 'Tour not found' } }),
    list: oc
      .route({ method: 'GET', path: '/api/wishlist', summary: 'List own wishlist, newest first' })
      .input(PageQuerySchema)
      .output(PagedSchema(WishlistItemSchema)),
    check: oc
      .route({
        method: 'POST',
        path: '/api/wishlist/check',
        summary: 'Which of these tours are wished (batch)',
      })
      .input(CheckWishlistInputSchema)
      .output(CheckWishlistResultSchema),
  },
```

Nhớ thêm import ở đầu file và export schema mới trong `libs/shared/contract/src/index.ts`.

- [ ] **Step 3: Viết integration test TRƯỚC**

Create `apps/api/src/modules/wishlist/wishlist.int.spec.ts` với 6 test:

1. `set({wished:true})` hai lần liên tiếp → cả hai 200, DB đúng **một** row (idempotent, không P2002)
2. `set({wished:false})` cho tour chưa từng lưu → 200, không 404 (xoá thứ không tồn tại là no-op)
3. `set` với tour chưa publish → `TOUR_NOT_FOUND`
4. `list` chỉ trả wishlist của chính mình, không lẫn của user khác, mới nhất trước
5. `list` trả `unavailable: true` cho tour đã bị unpublish sau khi lưu
6. `check` batch trả đúng tập con đã lưu; gọi ẩn danh mọi endpoint → 401

- [ ] **Step 4: Chạy test để thấy FAIL**

Run: `cd apps/api && pnpm vitest run --config vitest.int.config.ts src/modules/wishlist/`
Expected: FAIL — chưa có module.

- [ ] **Step 5: Implement service**

Create `apps/api/src/modules/wishlist/wishlist.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { WishlistItem } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';

export class TourNotFoundError extends Error {}

@Injectable()
export class WishlistService {
  /**
   * Idempotent theo thiết kế: `wished: true` dùng upsert (thêm lại tour đã
   * có → no-op, KHÔNG 409), `wished: false` dùng deleteMany (xoá thứ không
   * tồn tại → no-op, KHÔNG 404). Cả hai đều tránh phải "kiểm tra rồi ghi",
   * nên không có khe hở race giữa hai request song song của cùng một người.
   */
  async set(
    userId: string,
    tourId: string,
    wished: boolean,
  ): Promise<{ tourId: string; wished: boolean }> {
    if (wished) {
      // Chỉ cho lưu tour đang publish — lưu tour nháp là rò rỉ sự tồn tại
      // của nội dung chưa phát hành.
      const tour = await prisma.tour.findFirst({
        where: { id: tourId, isPublished: true },
        select: { id: true },
      });
      if (!tour) throw new TourNotFoundError();

      await prisma.wishlist.upsert({
        where: { userId_tourId: { userId, tourId } },
        create: { userId, tourId },
        update: {}, // đã có thì để yên, giữ nguyên createdAt gốc
      });
      return { tourId, wished: true };
    }

    await prisma.wishlist.deleteMany({ where: { userId, tourId } });
    return { tourId, wished: false };
  }

  async list(userId: string, page: number, pageSize: number) {
    const where = { userId };
    const [rows, total] = await Promise.all([
      prisma.wishlist.findMany({
        where,
        // Tie-breaker `tourId`: createdAt là timestamp(3), hai item lưu trùng
        // millisecond sẽ có thứ tự không ổn định giữa các trang.
        orderBy: [{ createdAt: 'desc' }, { tourId: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          tour: {
            select: {
              id: true,
              slug: true,
              title: true,
              basePrice: true,
              currency: true,
              durationDays: true,
              ratingAvg: true,
              ratingCount: true,
              isPublished: true,
            },
          },
        },
      }),
      prisma.wishlist.count({ where }),
    ]);

    const items: WishlistItem[] = rows.map((row) => ({
      tourId: row.tourId,
      slug: row.tour.slug,
      title: row.tour.title,
      basePrice: row.tour.basePrice.toString(),
      currency: row.tour.currency,
      durationDays: row.tour.durationDays,
      ratingAvg: row.tour.ratingAvg === null ? null : Number(row.tour.ratingAvg),
      ratingCount: row.tour.ratingCount,
      addedAt: row.createdAt.toISOString(),
      // Cờ ngữ nghĩa thay vì tuồn `isPublished` ra ngoài.
      unavailable: !row.tour.isPublished,
    }));

    return { items, page, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  /** Batch: một query cho cả trang danh sách tour, thay vì hỏi từng tour. */
  async check(userId: string, tourIds: string[]): Promise<{ wishedTourIds: string[] }> {
    const rows = await prisma.wishlist.findMany({
      where: { userId, tourId: { in: tourIds } },
      select: { tourId: true },
    });
    return { wishedTourIds: rows.map((r) => r.tourId) };
  }
}
```

- [ ] **Step 6: Implement controller + module**

Create `apps/api/src/modules/wishlist/wishlist.controller.ts`:

```ts
import { Controller } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import type { SessionUser } from '../../auth/auth.config.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { TourNotFoundError, WishlistService } from './wishlist.service.js';

// KHÔNG có @Public(): AuthGuard toàn cục (ADR-0003) sẽ chặn khách ẩn danh.
// Wishlist là dữ liệu cá nhân, mặc định fail-closed đúng là thứ ta muốn.
@Controller()
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Implement(contract.wishlist.set)
  set(@CurrentUser() user: SessionUser) {
    return implement(contract.wishlist.set).handler(async ({ input, errors }) => {
      try {
        return await this.wishlist.set(user.id, input.tourId, input.wished);
      } catch (err) {
        if (err instanceof TourNotFoundError) throw errors.TOUR_NOT_FOUND();
        throw err;
      }
    });
  }

  @Implement(contract.wishlist.list)
  list(@CurrentUser() user: SessionUser) {
    return implement(contract.wishlist.list).handler(({ input }) =>
      this.wishlist.list(user.id, input.page, input.pageSize),
    );
  }

  @Implement(contract.wishlist.check)
  check(@CurrentUser() user: SessionUser) {
    return implement(contract.wishlist.check).handler(({ input }) =>
      this.wishlist.check(user.id, input.tourIds),
    );
  }
}
```

Create `apps/api/src/modules/wishlist/wishlist.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { WishlistController } from './wishlist.controller.js';
import { WishlistService } from './wishlist.service.js';

@Module({
  controllers: [WishlistController],
  providers: [WishlistService],
})
export class WishlistModule {}
```

Rồi thêm `WishlistModule` vào mảng `imports` của `apps/api/src/app.module.ts`.

- [ ] **Step 7: Chạy test tới xanh**

Run: `cd apps/api && pnpm vitest run --config vitest.int.config.ts src/modules/wishlist/`
Expected: 6 PASS.

- [ ] **Step 8: Gate + commit**

```bash
cd ~/projects/tourism-v2 && pnpm gate:int
git add -A
git commit -m "feat(api,contract): wishlist set/list/check idempotent + cờ unavailable (P3a-W2)"
```

---

## Task 4: Enquiry

Spec §4.3. Honeypot **không reject**, throttle 5/60s, **hai** outbox trong một transaction.

**Files:**
- Create: `libs/shared/contract/src/schemas/enquiries.ts`
- Modify: `libs/shared/contract/src/contract.ts`, `index.ts`
- Create: `apps/api/src/modules/enquiries/enquiries.service.ts`, `enquiries.controller.ts`, `enquiries.module.ts`, `enquiries.int.spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `PUBLIC_WRITE_THROTTLE` (Task 2), `EmailType.ENQUIRY_ADMIN_ALERT` (Task 1).

- [ ] **Step 1: Schema contract**

Create `libs/shared/contract/src/schemas/enquiries.ts`:

```ts
import { z } from 'zod';

export const CreateEnquiryInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(200),
  phone: z.string().trim().max(30).optional(),
  // min 10: chặn "hi"/"test" — ngưỡng Nexora dùng, giữ nguyên.
  message: z.string().trim().min(10).max(2000),
  tourId: z.uuid().optional(),
  nationality: z.string().trim().max(80).optional(),
  travelDate: z.iso.date().optional(),
  groupSize: z.int().min(1).max(100).optional(),
  budgetTier: z.string().trim().max(40).optional(),
  interests: z.array(z.string().trim().max(40)).max(20).default([]),
  /**
   * HONEYPOT — field ẩn trong form, người thật không bao giờ điền.
   *
   * Cố ý `.optional()` KHÔNG refine reject: nếu trả lỗi validate thì bot
   * biết ngay mình bị phát hiện rồi đổi chiến thuật. Controller sẽ trả 201
   * giả và KHÔNG ghi DB — bot tưởng thành công, ta không tốn một dòng nào.
   */
  website: z.string().optional(),
});

export const EnquiryResultSchema = z.object({ id: z.uuid().nullable() });
```

> `id: null` khi bị honeypot bắt — response vẫn 201 nên bot không phân biệt được, còn phía ta thì log được.

- [ ] **Step 2: Khai contract**

```ts
  enquiries: {
    create: oc
      .route({ method: 'POST', path: '/api/enquiries', summary: 'Submit a contact enquiry' })
      .input(CreateEnquiryInputSchema)
      .output(EnquiryResultSchema)
      .errors({ TOUR_NOT_FOUND: { status: 404, message: 'Tour not found' } }),
  },
```

- [ ] **Step 3: Integration test TRƯỚC (7 test)**

1. Tạo enquiry hợp lệ → 201, DB có 1 row `status: NEW`, response trả `id` khác null
2. **Cùng transaction sinh ĐÚNG 2 outbox**: `ENQUIRY_RECEIVED` (dedupeKey `enquiry-received:<id>`) và `ENQUIRY_ADMIN_ALERT` (`enquiry-admin-alert:<id>`)
3. **Alert đi tới ADMIN, không tới khách**: payload của `ENQUIRY_ADMIN_ALERT` phải có `to` = `adminEmails[0]`, và `to` ≠ email khách. Đây là lỗi đã suýt lọt: `deliver()` mặc định lấy người nhận từ `payload.email`
3. **Honeypot**: gửi kèm `website: 'http://spam'` → **201**, `id: null`, và DB **không có row nào mới** (đếm trước/sau)
4. `message` 9 ký tự → lỗi validate
5. `tourId` trỏ tour chưa publish → `TOUR_NOT_FOUND`, và **không** ghi enquiry lẫn outbox nào
6. Email lưu dạng citext: gửi `Jane@X.com` rồi query `jane@x.com` phải khớp
7. **Throttle**: gửi 6 lần liên tiếp cùng IP → lần thứ 6 trả 429, và DB chỉ có 5 row

- [ ] **Step 4: Chạy để thấy FAIL**

Run: `cd apps/api && pnpm vitest run --config vitest.int.config.ts src/modules/enquiries/`

- [ ] **Step 5: Implement service**

Điểm cốt lõi — hai outbox phải nằm **trong cùng transaction** với insert enquiry:

```ts
  async create(input: CreateEnquiryInput): Promise<{ id: string }> {
    // Tour tuỳ chọn; nếu có thì phải là tour đang publish.
    let tourTitle: string | null = null;
    if (input.tourId) {
      const tour = await prisma.tour.findFirst({
        where: { id: input.tourId, isPublished: true },
        select: { title: true },
      });
      if (!tour) throw new TourNotFoundError();
      tourTitle = tour.title;
    }

    return prisma.$transaction(async (tx) => {
      const enquiry = await tx.enquiry.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone ?? null,
          message: input.message,
          tourId: input.tourId ?? null,
          nationality: input.nationality ?? null,
          travelDate: input.travelDate ? new Date(input.travelDate) : null,
          groupSize: input.groupSize ?? null,
          budgetTier: input.budgetTier ?? null,
          interests: input.interests,
        },
        select: { id: true },
      });

      // HAI outbox trong CÙNG transaction với insert: hoặc cả ba cùng có,
      // hoặc không gì cả. Ghi ngoài transaction sẽ có cửa sổ mà enquiry đã
      // lưu nhưng email không bao giờ được xếp hàng.
      //
      // dedupeKey chứa id vừa sinh nên duy nhất theo cấu tạo. Dùng
      // `createMany` cho gọn; `skipDuplicates` ở đây không bao giờ skip gì
      // — xem docs/conventions/outbox-dedupe-key.md.
      const shared = {
        name: input.name,
        email: input.email,
        message: input.message,
        tourTitle,
      };
      await tx.outbox.createMany({
        data: [
          {
            type: EmailType.ENQUIRY_RECEIVED,
            // Ack gửi cho khách → người nhận là `email` trong payload.
            payload: shared,
            dedupeKey: `enquiry-received:${enquiry.id}`,
          },
          {
            type: EmailType.ENQUIRY_ADMIN_ALERT,
            // ⚠️ Alert gửi cho ADMIN, KHÔNG phải khách. `deliver()` mặc định
            // lấy người nhận từ `payload.email` — mà ở đây `email` là địa chỉ
            // KHÁCH (để admin đọc trong nội dung). Thiếu `to` thì alert bay
            // thẳng về hộp thư khách và không admin nào biết có lead mới,
            // đúng thứ A13 sinh ra để sửa. `to` THẮNG `email` trong deliver().
            payload: { ...shared, to: adminEmails[0] },
            dedupeKey: `enquiry-admin-alert:${enquiry.id}`,
          },
        ],
      });

      return { id: enquiry.id };
    });
  }
```

- [ ] **Step 6: Controller — honeypot + throttle + @Public()**

```ts
// Form liên hệ công khai: khách chưa đăng nhập PHẢI gửi được (ADR-0003).
@Public()
@UseGuards(ThrottlerGuard)
@Controller()
export class EnquiriesController {
  // ...
  @Implement(contract.enquiries.create)
  create() {
    return implement(contract.enquiries.create).handler(async ({ input, errors }) => {
      // Honeypot: trả 201 GIẢ và không ghi gì. Không reject để bot không
      // biết mình bị phát hiện.
      if (input.website && input.website.length > 0) {
        return { id: null };
      }
      try {
        return await this.enquiries.create(input);
      } catch (err) {
        if (err instanceof TourNotFoundError) throw errors.TOUR_NOT_FOUND();
        throw err;
      }
    });
  }
}
```

- [ ] **Step 7: Chạy test tới xanh**

Run: `cd apps/api && pnpm vitest run --config vitest.int.config.ts src/modules/enquiries/`
Expected: 7 PASS.

- [ ] **Step 8: Mutation-test honeypot**

Tạm đổi nhánh honeypot thành `throw errors.TOUR_NOT_FOUND()`. Test #3 phải FAIL (nhận lỗi thay vì 201). Khôi phục.

- [ ] **Step 9: Gate + commit**

```bash
cd ~/projects/tourism-v2 && pnpm gate:int
git add -A
git commit -m "feat(api,contract): enquiry công khai — honeypot, throttle, outbox kép (P3a-W3)"
```

---

## Task 5: Newsletter subscribe

Spec §4.4, nửa đầu.

**Files:**
- Create: `libs/shared/contract/src/schemas/newsletter.ts`
- Create: `apps/api/src/modules/newsletter/newsletter.service.ts`, `newsletter.controller.ts`, `newsletter.module.ts`, `newsletter.int.spec.ts`
- Modify: `contract.ts`, `index.ts`, `app.module.ts`

- [ ] **Step 1: Schema**

```ts
export const SubscribeInputSchema = z.object({
  email: z.email().max(200),
  source: z.string().trim().max(40).optional(),
  /** Honeypot — cùng cơ chế với enquiry: không reject, trả 201 giả. */
  website: z.string().optional(),
});
export const SubscribeResultSchema = z.object({ subscribed: z.literal(true) });
```

> Output **luôn** `{subscribed: true}`, kể cả email đã tồn tại hoặc bị honeypot. Đây là chống dò email: nếu response khác nhau giữa "mới" và "đã có", ai cũng dùng endpoint này để kiểm tra một địa chỉ có trong hệ thống hay không.

- [ ] **Step 2: Integration test TRƯỚC (5 test)**

1. Đăng ký mới → 201 `{subscribed:true}`, DB có row, outbox có `NEWSLETTER_WELCOME` dedupeKey `newsletter-welcome:<email>`
2. **Đăng ký lại cùng email → response GIỐNG HỆT** (`{subscribed:true}`), DB vẫn 1 row, outbox vẫn **1** welcome (không gửi lần hai)
3. Email khác hoa/thường (`Jane@X.com` vs `jane@x.com`) → citext coi là **một** người, vẫn 1 row
4. Honeypot có giá trị → 201, DB không có row mới
5. Throttle: 6 lần → lần 6 trả 429

- [ ] **Step 3: Implement service**

```ts
  async subscribe(email: string, source?: string): Promise<void> {
    // Upsert im lặng: đăng ký lại KHÔNG báo lỗi, KHÔNG đổi response —
    // chống dò email (xem comment ở schema output).
    const subscriber = await prisma.subscriber.upsert({
      where: { email },
      create: { email, source: source ?? null },
      update: {}, // đã có thì để yên; KHÔNG reset unsubscribedAt ở đây
    });

    // dedupeKey theo EMAIL (không phải id) → "một lần vĩnh viễn cho mỗi địa
    // chỉ". Đây là ngoại lệ hợp lệ DUY NHẤT của quy ước dedupe-key, spec
    // §4.4 ghi rõ: xoá subscriber rồi đăng ký lại sẽ KHÔNG nhận welcome lần
    // hai. `skipDuplicates` ở đây là load-bearing thật sự (key ổn định).
    await prisma.outbox.createMany({
      data: [
        {
          type: EmailType.NEWSLETTER_WELCOME,
          payload: { email },
          dedupeKey: `newsletter-welcome:${email}`,
        },
      ],
      skipDuplicates: true,
    });
  }
```

- [ ] **Step 4: Implement controller**

Cùng khuôn với `EnquiriesController` ở Task 4 — `@Public()` (form đăng ký công khai) + `@UseGuards(ThrottlerGuard)` + honeypot trả kết quả giả:

```ts
@Public()
@UseGuards(ThrottlerGuard)
@Controller()
export class NewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Implement(contract.newsletter.subscribe)
  subscribe() {
    return implement(contract.newsletter.subscribe).handler(async ({ input }) => {
      // Honeypot: KHÔNG ghi gì, nhưng trả y hệt trường hợp thành công.
      if (input.website && input.website.length > 0) {
        return { subscribed: true as const };
      }
      await this.newsletter.subscribe(input.email, input.source);
      // Luôn `true` — kể cả email đã tồn tại. Response khác nhau giữa "mới"
      // và "đã có" biến endpoint này thành máy dò email.
      return { subscribed: true as const };
    });
  }
}
```

- [ ] **Step 5: Chạy test tới xanh**

Run: `cd apps/api && pnpm vitest run --config vitest.int.config.ts src/modules/newsletter/`
Expected: 5 PASS.

- [ ] **Step 6: Gate + commit**

```bash
cd ~/projects/tourism-v2 && pnpm gate:int
git add -A
git commit -m "feat(api,contract): newsletter subscribe im lặng chống dò email (P3a-W4)"
```

---

## Task 6: Newsletter unsubscribe (endpoint MỚI — A1)

Spec §4.4 nửa sau. Nexora **không có** unsubscribe công khai — rủi ro GDPR/CAN-SPAM.

**Files:**
- Create: `apps/api/src/modules/newsletter/unsubscribe-token.ts` + `unsubscribe-token.spec.ts`
- Modify: `apps/api/src/config/env.ts`, `apps/api/.env.example`
- Modify: `newsletter.service.ts`, `newsletter.controller.ts`, `newsletter.int.spec.ts`
- Modify: `apps/api/src/worker/outbox.service.ts` hoặc deliverer (bỏ qua subscriber đã huỷ)

- [ ] **Step 1: Env var mới**

Trong `apps/api/src/config/env.ts`:

```ts
const DEV_UNSUBSCRIBE_SECRET = 'dev-unsubscribe-secret-change-me';
```

```ts
    NEWSLETTER_UNSUBSCRIBE_SECRET: z.string().min(1).default(DEV_UNSUBSCRIBE_SECRET),
```

Trong `superRefine` (nhánh production), thêm:

```ts
    if (cfg.NEWSLETTER_UNSUBSCRIBE_SECRET === DEV_UNSUBSCRIBE_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['NEWSLETTER_UNSUBSCRIBE_SECRET'],
        message: 'NEWSLETTER_UNSUBSCRIBE_SECRET must be set explicitly in production',
      });
    }
```

> Cố ý **KHÔNG dùng chung `BETTER_AUTH_SECRET`**: xoay secret auth là việc bảo mật bình thường, nhưng nó sẽ làm chết mọi link huỷ đăng ký đã gửi đi — hai vòng đời khác nhau thì tách secret. (spec §4.4)

- [ ] **Step 2: TDD logic thuần HMAC**

Create `apps/api/src/modules/newsletter/unsubscribe-token.spec.ts` TRƯỚC:

```ts
import { makeUnsubscribeToken, verifyUnsubscribeToken } from './unsubscribe-token.js';

describe('unsubscribe token', () => {
  const secret = 'test-secret';
  const id = '01920000-0000-7000-8000-000000000001';

  it('token sinh ra verify được', () => {
    expect(verifyUnsubscribeToken(id, makeUnsubscribeToken(id, secret), secret)).toBe(true);
  });

  it('token của subscriber KHÁC không dùng được', () => {
    const other = '01920000-0000-7000-8000-000000000002';
    expect(verifyUnsubscribeToken(id, makeUnsubscribeToken(other, secret), secret)).toBe(false);
  });

  it('secret khác → không verify được', () => {
    expect(verifyUnsubscribeToken(id, makeUnsubscribeToken(id, 'other'), secret)).toBe(false);
  });

  it('token rác không làm hàm ném lỗi', () => {
    expect(verifyUnsubscribeToken(id, 'không-phải-hex', secret)).toBe(false);
    expect(verifyUnsubscribeToken(id, '', secret)).toBe(false);
  });
});
```

Run để thấy FAIL, rồi implement:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

/** HMAC-SHA256(subscriberId) — không cần lưu token vào DB, tự xác thực. */
export function makeUnsubscribeToken(subscriberId: string, secret: string): string {
  return createHmac('sha256', secret).update(subscriberId).digest('hex');
}

export function verifyUnsubscribeToken(
  subscriberId: string,
  token: string,
  secret: string,
): boolean {
  const expected = makeUnsubscribeToken(subscriberId, secret);
  // So sánh timing-safe: `===` rò rỉ độ dài tiền tố khớp qua thời gian chạy,
  // đủ để dò ra token hợp lệ nếu kiên nhẫn.
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(token, 'utf8');
  if (a.length !== b.length) return false; // timingSafeEqual ném lỗi nếu lệch độ dài
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 3: Contract — GET xác nhận, POST thực thi**

```ts
    unsubscribeConfirm: oc
      .route({ method: 'GET', path: '/api/newsletter/unsubscribe', summary: 'Confirmation page data' })
      .input(z.object({ id: z.uuid(), token: z.string().min(1).max(200) }))
      .output(z.object({ email: z.string(), alreadyUnsubscribed: z.boolean() }))
      .errors({ INVALID_UNSUBSCRIBE_TOKEN: { status: 400, message: 'Invalid unsubscribe link' } }),
    unsubscribe: oc
      .route({ method: 'POST', path: '/api/newsletter/unsubscribe', summary: 'Execute unsubscribe' })
      .input(z.object({ id: z.uuid(), token: z.string().min(1).max(200) }))
      .output(z.object({ unsubscribed: z.literal(true) }))
      .errors({ INVALID_UNSUBSCRIBE_TOKEN: { status: 400, message: 'Invalid unsubscribe link' } }),
```

> **Vì sao tách GET/POST:** email client (Gmail, Outlook) prefetch mọi link trong thư để quét virus. Nếu GET tự huỷ đăng ký thì người dùng bị huỷ mà chưa hề bấm. GET chỉ trả dữ liệu cho trang xác nhận; POST mới thực thi.

- [ ] **Step 4: Integration test (5 test)**

1. GET với token hợp lệ → trả email, `alreadyUnsubscribed: false`; DB **chưa** đổi (chứng minh GET không có side effect)
2. POST với token hợp lệ → `unsubscribedAt` được set
3. POST lần hai → vẫn 200 (idempotent), `unsubscribedAt` **không đổi giá trị**
4. Token sai / id không tồn tại → `INVALID_UNSUBSCRIBE_TOKEN`, DB không đổi
5. Deliverer **bỏ qua** subscriber đã huỷ: enqueue một email newsletter cho subscriber có `unsubscribedAt` ≠ null → không gửi

- [ ] **Step 5: Implement + chạy test tới xanh**

- [ ] **Step 6: Cập nhật `.env.example`**

Thêm vào nhóm 1 của `apps/api/.env.example`:

```
# Secret ký link huỷ đăng ký newsletter. Sinh: openssl rand -base64 32
# Production BẮT BUỘC đổi. Cố ý tách khỏi BETTER_AUTH_SECRET: xoay secret
# auth sẽ làm chết mọi link huỷ đăng ký đã gửi đi.
# NEWSLETTER_UNSUBSCRIBE_SECRET=
```

- [ ] **Step 7: Gate + commit**

```bash
cd ~/projects/tourism-v2 && pnpm gate:int
git add -A
git commit -m "feat(api,contract): newsletter unsubscribe self-serve — HMAC token, GET/POST tách (P3a-W4)"
```

---

## Sau khi xong 6 task

1. **Final review toàn nhánh** trên model mạnh nhất (`superpowers:requesting-code-review`).
2. **Docs sweep (CLAUDE.md #13)** — bắt buộc, CI sẽ đỏ nếu quên:
   - Entry vào `docs/CHANGELOG.md` (ngày · nội dung · review findings · số test)
   - Cập nhật `docs/README.md` nếu có doc mới
   - Chạy `./scripts/docs-freshness.sh` xác nhận xanh
3. **Merge** rebase + `git merge --ff-only`, xoá branch.
4. Đánh dấu W2–W4 xong trong `docs/README.md` bảng Plans; P3a-C (posts + site-media) là plan kế tiếp.
