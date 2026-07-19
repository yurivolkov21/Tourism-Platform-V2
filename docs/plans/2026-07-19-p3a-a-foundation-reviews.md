# P3a-A — Nền chung + Reviews · Kế hoạch triển khai

> **Cho agent thực thi:** BẮT BUỘC dùng sub-skill `superpowers:subagent-driven-development`
> (khuyến nghị) hoặc `superpowers:executing-plans` để làm từng task. Các bước
> dùng checkbox `- [ ]` để theo dõi.

**Goal:** Dựng nền schema/contract dùng chung cho P3a và hoàn thành module
reviews với vòng đời đầy đủ: tạo (có gate điều kiện) → duyệt (transaction
4-trong-1) → hiện ở danh sách công khai với rating tour cập nhật đúng.

**Architecture:** Zod schema dùng chung ở `@tourism/contract` làm nguồn sự thật
cho cả validate lẫn type client. Logic thuần (gate điều kiện review) tách khỏi
service để TDD được. Việc duyệt review là **một** `$transaction` gồm 4 thao tác
để rating không bao giờ lệch với trạng thái duyệt.

**Tech Stack:** NestJS 11 (ESM) · Prisma 7 · oRPC 1.14 + Zod 4 · pg-boss ·
Vitest (unit + integration trên Docker Postgres `tourism_test`).

**Spec:** [P3a — API khách hàng](../specs/2026-07-19-p3a-customer-api.md)

## Global Constraints

Áp cho MỌI task dưới đây:

- **ESM NodeNext**: mọi import tương đối PHẢI có đuôi `.js` (kể cả file `.ts`).
- **Comment tiếng Việt** (CLAUDE.md luật 8); tên biến/hàm/test description giữ tiếng Anh.
- **Biome**: nháy đơn, trailing comma, rộng 100 cột. `pnpm lint:fix` trước khi commit.
- **TDD cho logic thuần**: viết test đỏ trước, rồi mới implement.
- **Không transaction pooler** — pool trực tiếp (đã cấu hình sẵn).
- **`pnpm gate` phải xanh** trước khi khai một task là xong.
- Integration test chạy `pnpm test:int` (DB `tourism_test`, KHÔNG đụng DB dev).
- Commit theo Conventional Commits, **không AI attribution**.

## File Structure

| File | Trách nhiệm |
| --- | --- |
| `libs/shared/contract/src/schemas/common.ts` (mới) | `PageQuerySchema` · `SortQuerySchema` · `SearchQuerySchema` dùng chung mọi list |
| `libs/shared/contract/src/schemas/reviews.ts` (mới) | Schema review: public item, mine item, admin item, input tạo/duyệt |
| `libs/shared/contract/src/contract.ts` (sửa) | Thêm nhánh `reviews.*` và `admin.reviews.*` |
| `libs/shared/contract/src/index.ts` (sửa) | Re-export schema mới |
| `apps/api/prisma/schema.prisma` (sửa) | 4 delta S1/S5/S6/S7 + model `ReviewModerationEvent` |
| `apps/api/prisma/migrations/<ts>_p3a_customer/migration.sql` (mới) | Migration + CHECK không biểu diễn được bằng Prisma |
| `apps/api/src/modules/reviews/review-eligibility.ts` (mới) | **Logic thuần**: quyết định được review hay không |
| `apps/api/src/modules/reviews/review-eligibility.spec.ts` (mới) | Unit test TDD cho file trên |
| `apps/api/src/modules/reviews/reviews.service.ts` (mới) | Query + transaction duyệt 4-trong-1 |
| `apps/api/src/modules/reviews/reviews.controller.ts` (mới) | Endpoint khách (`@UseGuards(AuthGuard)` cho create/mine) |
| `apps/api/src/modules/reviews/admin-reviews.controller.ts` (mới) | Endpoint admin (`@Roles(ADMIN)`) |
| `apps/api/src/modules/reviews/reviews.module.ts` (mới) | Wiring |
| `apps/api/src/modules/reviews/reviews.int.spec.ts` (mới) | Integration: vòng đời + các bất biến |
| `apps/api/src/app.module.ts` (sửa) | Đăng ký `ReviewsModule` |

---

## Task 1: Schema query dùng chung

**Files:**
- Create: `libs/shared/contract/src/schemas/common.ts`
- Create: `libs/shared/contract/src/schemas/common.spec.ts`
- Modify: `libs/shared/contract/src/index.ts`

**Interfaces:**
- Produces: `PageQuerySchema` (`{page: number, pageSize: number}`), `SearchQuerySchema` (`{search?: string}`), `sortQuerySchema(keys)` → Zod object `{sortBy, sortOrder}`. Task 4 và 6 dùng lại.

- [ ] **Bước 1: Viết test đỏ**

```ts
// libs/shared/contract/src/schemas/common.spec.ts
import { PageQuerySchema, SearchQuerySchema, sortQuerySchema } from './common.js';

describe('PageQuerySchema', () => {
  it('applies defaults', () => {
    expect(PageQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('rejects page below 1', () => {
    expect(PageQuerySchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it('rejects pageSize above 100', () => {
    expect(PageQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });
});

describe('sortQuerySchema', () => {
  const schema = sortQuerySchema(['createdAt', 'rating'] as const);

  it('defaults to first key, desc', () => {
    expect(schema.parse({})).toEqual({ sortBy: 'createdAt', sortOrder: 'desc' });
  });

  it('rejects unknown sort key', () => {
    expect(schema.safeParse({ sortBy: 'nope' }).success).toBe(false);
  });
});

describe('SearchQuerySchema', () => {
  it('trims and allows absent', () => {
    expect(SearchQuerySchema.parse({ search: '  hoi an  ' }).search).toBe('hoi an');
    expect(SearchQuerySchema.parse({}).search).toBeUndefined();
  });
});
```

- [ ] **Bước 2: Chạy test, xác nhận ĐỎ**

Chạy: `cd libs/shared/contract && pnpm vitest run src/schemas/common.spec.ts`
Kỳ vọng: FAIL — `Failed to resolve import "./common.js"`

- [ ] **Bước 3: Implement**

```ts
// libs/shared/contract/src/schemas/common.ts
import { z } from 'zod';

/**
 * Schema query dùng chung cho MỌI list endpoint. Nexora có 3 biến thể
 * `Paginated*` gần giống nhau ở 3 module khác nhau — gom về một chỗ để client
 * chỉ phải học một hình dạng.
 */
export const PageQuerySchema = z.object({
  page: z.int().min(1).default(1),
  pageSize: z.int().min(1).max(100).default(20),
});

/** Ô tìm kiếm tự do; trim sẵn để service khỏi phải nhớ. */
export const SearchQuerySchema = z.object({
  search: z.string().trim().min(1).max(160).optional(),
});

/**
 * Sinh schema sort với danh sách key hợp lệ đóng — client gửi key lạ thì
 * Zod chặn ngay, service không bao giờ nhận `orderBy` không mong đợi.
 * Key đầu tiên là mặc định.
 */
export function sortQuerySchema<const K extends readonly [string, ...string[]]>(keys: K) {
  return z.object({
    sortBy: z.enum(keys).default(keys[0]),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  });
}

export type PageQuery = z.infer<typeof PageQuerySchema>;
```

- [ ] **Bước 4: Re-export**

Thêm vào cuối `libs/shared/contract/src/index.ts`:

```ts
export * from './schemas/common.js';
```

- [ ] **Bước 5: Chạy test, xác nhận XANH**

Chạy: `cd libs/shared/contract && pnpm vitest run src/schemas/common.spec.ts`
Kỳ vọng: PASS — 6 test

- [ ] **Bước 6: Commit**

```bash
cd ~/projects/tourism-v2
pnpm lint:fix
git add libs/shared/contract/src/schemas/common.ts libs/shared/contract/src/schemas/common.spec.ts libs/shared/contract/src/index.ts
git commit -m "feat(contract): schema query dùng chung cho list endpoint (P3a-W0)"
```

---

## Task 2: Migration `p3a_customer`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_p3a_customer/migration.sql`

**Interfaces:**
- Produces: `Tour.ratingAvg` (`Decimal?`), `Tour.ratingCount` (`Int`), `Review.featuredRank` (`Int?`), `Subscriber.unsubscribedAt` (`DateTime?`), model `ReviewModerationEvent`. Task 5 dùng tất cả.

- [ ] **Bước 1: Sửa schema.prisma — Tour**

Thêm vào `model Tour`, ngay sau `isFeatured`:

```prisma
  // Rating denormalized (audit A9): Nexora aggregate live mỗi page load
  // (`summarize()` scan toàn bảng reviews). Ở đây cập nhật trong CÙNG
  // transaction duyệt review nên không bao giờ lệch — xem ReviewsService.
  ratingAvg          Decimal?        @map("rating_avg") @db.Decimal(2, 1)
  ratingCount        Int             @default(0) @map("rating_count")
```

- [ ] **Bước 2: Sửa schema.prisma — Review**

Thêm vào `model Review`, sau `isFeatured`:

```prisma
  // Thứ tự testimonial trang chủ. Nexora sort bằng `orderBy source asc` —
  // chạy được CHỈ nhờ thứ tự alphabet enum (CURATED < VERIFIED); đổi tên
  // value là hỏng ngầm, không test nào bắt. Cột này làm ý định tường minh.
  featuredRank       Int?            @map("featured_rank")
```

và thêm quan hệ (cuối model, cạnh các quan hệ khác):

```prisma
  moderationEvents   ReviewModerationEvent[]
```

- [ ] **Bước 3: Sửa schema.prisma — Subscriber**

Thêm vào `model Subscriber`, sau `source`:

```prisma
  // Hủy đăng ký (audit A1): Nexora KHÔNG có unsubscribe công khai — rủi ro
  // pháp lý GDPR/CAN-SPAM. Soft-unsubscribe giữ được bằng chứng consent,
  // khác hẳn hard-delete của Nexora.
  unsubscribedAt     DateTime?       @map("unsubscribed_at")
  updatedAt          DateTime        @updatedAt @map("updated_at")
```

- [ ] **Bước 4: Thêm model mới**

Thêm vào cuối `schema.prisma`:

```prisma
/// Lịch sử duyệt review, append-only (audit A8). Nexora chỉ giữ
/// `moderatedById/moderatedAt` kiểu last-write-wins nên không trả lời được
/// "ai unapprove bài này 3 tuần trước và vì sao".
model ReviewModerationEvent {
  id           String   @id @default(uuid(7)) @db.Uuid
  reviewId     String   @map("review_id") @db.Uuid
  actorId      String?  @map("actor_id") @db.Uuid
  fromApproved Boolean  @map("from_approved")
  toApproved   Boolean  @map("to_approved")
  note         String?  @db.VarChar(500)
  createdAt    DateTime @default(now()) @map("created_at")

  review Review @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  actor  User?  @relation(fields: [actorId], references: [id], onDelete: SetNull)

  @@index([reviewId, createdAt])
  @@map("review_moderation_events")
}
```

Thêm quan hệ ngược vào `model User`:

```prisma
  moderationEvents      ReviewModerationEvent[]
```

- [ ] **Bước 5: Sửa `Enquiry.email` sang citext**

Trong `model Enquiry`, đổi dòng `email`:

```prisma
  // citext (audit A2): Nexora KHÔNG lowercase email nhưng repeat-lead lại
  // `groupBy(['email'])` so khớp chính xác → Jane@x.com và jane@x.com thành
  // hai lead khác nhau, tính năng phát hiện trùng hỏng âm thầm.
  email        String   @db.Citext
```

- [ ] **Bước 6: Sinh migration**

```bash
cd ~/projects/tourism-v2/apps/api
pnpm prisma migrate dev --name p3a_customer --create-only
```

Kỳ vọng: tạo `prisma/migrations/<timestamp>_p3a_customer/migration.sql`

- [ ] **Bước 7: Thêm CHECK mà Prisma không biểu diễn được**

Nối vào cuối file `migration.sql` vừa sinh:

```sql
-- Bất biến VERIFIED/CURATED (audit S5). Nexora chỉ có quy ước trong code:
-- VERIFIED phải đủ 3 FK, CURATED phải null cả 3 — không gì chặn dữ liệu lai.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_source_shape" CHECK (
  (source = 'VERIFIED' AND tour_id IS NOT NULL AND user_id IS NOT NULL AND booking_id IS NOT NULL)
  OR
  (source = 'CURATED' AND booking_id IS NULL AND user_id IS NULL)
);

-- Rating chỉ hợp lệ trong 1..5 (đã có ở hardening-v2, nhắc lại cho rõ ràng
-- nếu migration này chạy trên DB chưa áp hardening).
-- Không lặp lại nếu constraint đã tồn tại:
DO $$ BEGIN
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK (rating BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ratingCount không âm; ratingAvg nếu có thì phải trong 1..5.
ALTER TABLE "tours" ADD CONSTRAINT "tours_rating_sane" CHECK (
  rating_count >= 0 AND (rating_avg IS NULL OR (rating_avg >= 1 AND rating_avg <= 5))
);

-- RLS cho bảng mới (nhất quán với 31 bảng còn lại).
ALTER TABLE "review_moderation_events" ENABLE ROW LEVEL SECURITY;
```

- [ ] **Bước 8: Áp migration + kiểm chứng**

```bash
cd ~/projects/tourism-v2/apps/api
pnpm prisma migrate dev
```

Kỳ vọng: `Your database is now in sync with your schema.`

Kiểm CHECK thật sự chặn (phải BÁO LỖI):

```bash
docker exec tourism-v2-postgres-1 psql -U tourism -d tourism -c \
  "UPDATE tours SET rating_avg = 9.9 WHERE id = (SELECT id FROM tours LIMIT 1);"
```

Kỳ vọng: `ERROR: new row for relation "tours" violates check constraint "tours_rating_sane"`

- [ ] **Bước 9: Commit**

```bash
cd ~/projects/tourism-v2
pnpm gate
git add apps/api/prisma/
git commit -m "feat(api): migration p3a_customer — rating denormalized, featuredRank, unsubscribedAt, audit moderation (P3a-W0)"
```

---

## Task 3: Logic thuần — gate điều kiện review (TDD)

**Files:**
- Create: `apps/api/src/modules/reviews/review-eligibility.ts`
- Create: `apps/api/src/modules/reviews/review-eligibility.spec.ts`

**Interfaces:**
- Produces: `checkReviewEligibility(input: EligibilityInput): EligibilityResult` — `EligibilityInput = { bookingStatus: BookingStatus; departureEndDate: Date; now: Date; ownerId: string; callerId: string }`; `EligibilityResult = { ok: true } | { ok: false; reason: 'NOT_OWNER' | 'NOT_PAID' | 'TRIP_NOT_COMPLETED' }`. Task 4 dùng.

- [ ] **Bước 1: Viết test đỏ**

```ts
// apps/api/src/modules/reviews/review-eligibility.spec.ts
import { BookingStatus } from '../../generated/prisma/enums.js';
import { checkReviewEligibility } from './review-eligibility.js';

const NOW = new Date('2026-07-19T00:00:00Z');
const base = {
  bookingStatus: BookingStatus.PAID,
  departureEndDate: new Date('2026-07-18'), // đã kết thúc
  now: NOW,
  ownerId: 'user-1',
  callerId: 'user-1',
};

describe('checkReviewEligibility', () => {
  it('cho phép khi PAID và chuyến đã kết thúc', () => {
    expect(checkReviewEligibility(base)).toEqual({ ok: true });
  });

  it('từ chối khi caller không phải chủ booking', () => {
    expect(checkReviewEligibility({ ...base, callerId: 'user-2' })).toEqual({
      ok: false,
      reason: 'NOT_OWNER',
    });
  });

  it('từ chối khi booking chưa PAID', () => {
    expect(
      checkReviewEligibility({ ...base, bookingStatus: BookingStatus.PENDING }),
    ).toEqual({ ok: false, reason: 'NOT_PAID' });
  });

  it('từ chối khi chuyến CHƯA kết thúc — nâng cấp so với Nexora', () => {
    expect(
      checkReviewEligibility({ ...base, departureEndDate: new Date('2026-08-01') }),
    ).toEqual({ ok: false, reason: 'TRIP_NOT_COMPLETED' });
  });

  it('cho phép ngay ngày chuyến kết thúc (biên)', () => {
    expect(
      checkReviewEligibility({ ...base, departureEndDate: new Date('2026-07-19') }),
    ).toEqual({ ok: true });
  });

  it('kiểm quyền sở hữu TRƯỚC trạng thái — không rò rỉ booking người khác', () => {
    expect(
      checkReviewEligibility({
        ...base,
        callerId: 'user-2',
        bookingStatus: BookingStatus.PENDING,
      }),
    ).toEqual({ ok: false, reason: 'NOT_OWNER' });
  });
});
```

- [ ] **Bước 2: Chạy test, xác nhận ĐỎ**

Chạy: `cd apps/api && pnpm vitest run src/modules/reviews/review-eligibility.spec.ts`
Kỳ vọng: FAIL — không resolve được `./review-eligibility.js`

- [ ] **Bước 3: Implement tối thiểu**

```ts
// apps/api/src/modules/reviews/review-eligibility.ts
import { BookingStatus } from '../../generated/prisma/enums.js';

export type EligibilityInput = {
  bookingStatus: BookingStatus;
  departureEndDate: Date;
  now: Date;
  ownerId: string;
  callerId: string;
};

export type EligibilityResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_OWNER' | 'NOT_PAID' | 'TRIP_NOT_COMPLETED' };

/** So sánh theo NGÀY LỊCH (UTC), không theo thời điểm — chuyến kết thúc hôm
 * nay thì tối nay review được, không phải chờ qua nửa đêm. */
function calendarDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Quyết định một booking có được viết review không.
 *
 * Nâng cấp so với Nexora (audit A7): Nexora chỉ đòi `status === PAID`, tức
 * khách trả tiền hôm nay cho tour khởi hành 3 tháng nữa vẫn review được ngay
 * — vô nghĩa với người đọc. Ở đây đòi chuyến đã kết thúc.
 *
 * Thứ tự kiểm là CỐ Ý: quyền sở hữu trước trạng thái, để caller không phải
 * chủ booking không suy ra được trạng thái booking của người khác.
 */
export function checkReviewEligibility(input: EligibilityInput): EligibilityResult {
  if (input.callerId !== input.ownerId) return { ok: false, reason: 'NOT_OWNER' };
  if (input.bookingStatus !== BookingStatus.PAID) return { ok: false, reason: 'NOT_PAID' };
  if (calendarDay(input.departureEndDate) > calendarDay(input.now)) {
    return { ok: false, reason: 'TRIP_NOT_COMPLETED' };
  }
  return { ok: true };
}
```

- [ ] **Bước 4: Chạy test, xác nhận XANH**

Chạy: `cd apps/api && pnpm vitest run src/modules/reviews/review-eligibility.spec.ts`
Kỳ vọng: PASS — 6 test

- [ ] **Bước 5: Commit**

```bash
cd ~/projects/tourism-v2
pnpm lint:fix
git add apps/api/src/modules/reviews/
git commit -m "feat(api): gate điều kiện review — siết phải đi xong tour (P3a-W1)"
```

---

## Task 4: Contract reviews + endpoint tạo review

**Files:**
- Create: `libs/shared/contract/src/schemas/reviews.ts`
- Modify: `libs/shared/contract/src/contract.ts`, `libs/shared/contract/src/index.ts`
- Create: `apps/api/src/modules/reviews/reviews.service.ts`, `reviews.controller.ts`, `reviews.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `checkReviewEligibility` (Task 3), `PageQuerySchema` (Task 1)
- Produces: `ReviewsService.create(userId, input)` → `PublicReview`; contract `reviews.create`. Task 5 và 6 mở rộng service này.

- [ ] **Bước 1: Schema contract**

```ts
// libs/shared/contract/src/schemas/reviews.ts
import { z } from 'zod';
import { PageQuerySchema } from './common.js';

export const RatingSchema = z.int().min(1).max(5);

/** Review hiển thị công khai. KHÔNG có userId/bookingId — Zod strip field
 * không khai báo nên không thể rò rỉ, khác Nexora trả nguyên row Prisma. */
export const PublicReviewSchema = z.object({
  id: z.uuid(),
  rating: RatingSchema,
  title: z.string().nullable(),
  body: z.string(),
  /** null khi tác giả đã xoá tài khoản — FE render "Deleted account". */
  authorName: z.string().nullable(),
  authorDeleted: z.boolean(),
  createdAt: z.iso.datetime(),
});

export const CreateReviewInputSchema = z.object({
  bookingCode: z.string().regex(/^BK-[A-Z0-9]{8}$/),
  rating: RatingSchema,
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10).max(2000),
});

export const ReviewsByTourQuerySchema = PageQuerySchema.extend({
  tourSlug: z.string().min(1).max(120),
});

export type PublicReview = z.infer<typeof PublicReviewSchema>;
```

- [ ] **Bước 2: Thêm vào contract**

Trong `libs/shared/contract/src/contract.ts`, thêm nhánh `reviews` (sau `catalog`):

```ts
  /**
   * Review phía khách. `create` cần auth (AuthGuard trên controller);
   * `listByTour` là public.
   */
  reviews: {
    listByTour: oc
      .route({ method: 'GET', path: '/api/tours/{tourSlug}/reviews', summary: 'Approved reviews of a tour' })
      .input(ReviewsByTourQuerySchema)
      .output(PagedSchema(PublicReviewSchema))
      .errors({ TOUR_NOT_FOUND: { status: 404, message: 'Tour not found' } }),

    create: oc
      .route({ method: 'POST', path: '/api/reviews', summary: 'Write a review for a completed booking' })
      .input(CreateReviewInputSchema)
      .output(PublicReviewSchema)
      .errors({
        BOOKING_NOT_FOUND: { status: 404, message: 'Booking not found' },
        // 403 cố ý, KHÔNG 404: khách đã thấy mã này trong danh sách của mình
        // nên che giấu là giả tạo.
        BOOKING_FORBIDDEN: { status: 403, message: 'Not your booking' },
        REVIEW_NOT_ELIGIBLE: { status: 400, message: 'Booking is not eligible for review' },
        REVIEW_TRIP_NOT_COMPLETED: { status: 400, message: 'Trip has not finished yet' },
        REVIEW_ALREADY_EXISTS: { status: 409, message: 'This booking already has a review' },
      }),
  },
```

Thêm import ở đầu file:

```ts
import {
  CreateReviewInputSchema,
  PublicReviewSchema,
  ReviewsByTourQuerySchema,
} from './schemas/reviews.js';
```

Và trong `index.ts`: `export * from './schemas/reviews.js';`

- [ ] **Bước 3: Service — hàm create**

```ts
// apps/api/src/modules/reviews/reviews.service.ts
import { Injectable } from '@nestjs/common';
import type { CreateReviewInputSchema, PublicReview } from '@tourism/contract';
import type { z } from 'zod';
import { prisma } from '../../auth/auth.config.js';
import { Prisma } from '../../generated/prisma/client.js';
import { ReviewSource } from '../../generated/prisma/enums.js';
import { checkReviewEligibility } from './review-eligibility.js';

/** Lỗi domain — controller map sang error code của contract. */
export class ReviewError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/** Row Prisma → shape công khai. Không bao giờ trả thẳng row (tránh rò userId). */
export function toPublicReview(row: {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  authorDeleted: boolean;
  createdAt: Date;
}): PublicReview {
  return {
    id: row.id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    // Tác giả đã xoá tài khoản → giấu tên đã scrub, FE hiện "Deleted account".
    authorName: row.authorDeleted ? null : row.authorName,
    authorDeleted: row.authorDeleted,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class ReviewsService {
  async create(
    callerId: string,
    input: z.infer<typeof CreateReviewInputSchema>,
  ): Promise<PublicReview> {
    const booking = await prisma.booking.findUnique({
      where: { code: input.bookingCode },
      select: {
        id: true,
        userId: true,
        tourId: true,
        status: true,
        departureEndDate: true,
        user: { select: { name: true } },
      },
    });
    if (!booking) throw new ReviewError('BOOKING_NOT_FOUND');

    const eligibility = checkReviewEligibility({
      bookingStatus: booking.status,
      departureEndDate: booking.departureEndDate,
      now: new Date(),
      ownerId: booking.userId,
      callerId,
    });
    if (!eligibility.ok) {
      throw new ReviewError(
        eligibility.reason === 'NOT_OWNER'
          ? 'BOOKING_FORBIDDEN'
          : eligibility.reason === 'TRIP_NOT_COMPLETED'
            ? 'REVIEW_TRIP_NOT_COMPLETED'
            : 'REVIEW_NOT_ELIGIBLE',
      );
    }

    try {
      const row = await prisma.review.create({
        data: {
          source: ReviewSource.VERIFIED,
          tourId: booking.tourId,
          userId: booking.userId,
          bookingId: booking.id,
          // Snapshot tên lúc tạo — review vẫn đọc được sau khi user đổi tên.
          authorName: booking.user.name ?? 'Anonymous',
          rating: input.rating,
          title: input.title ?? null,
          body: input.body,
          isApproved: false,
        },
      });
      return toPublicReview(row);
    } catch (err) {
      // unique(bookingId) → mỗi booking đúng một review.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ReviewError('REVIEW_ALREADY_EXISTS');
      }
      throw err;
    }
  }
}
```

- [ ] **Bước 4: Controller + module**

```ts
// apps/api/src/modules/reviews/reviews.controller.ts
import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { AuthGuard } from '../../auth/auth.guard.js';
import { CurrentUser, type SessionUser } from '../../auth/current-user.decorator.js';
import { ReviewError, ReviewsService } from './reviews.service.js';

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @UseGuards(AuthGuard)
  @Implement(contract.reviews.create)
  create(@CurrentUser() user: SessionUser) {
    return implement(contract.reviews.create).handler(async ({ input, errors }) => {
      try {
        return await this.reviews.create(user.id, input);
      } catch (err) {
        if (err instanceof ReviewError) {
          // Map lỗi domain → error code đã khai trong contract (client có type).
          const map = errors as Record<string, () => never>;
          map[err.code]?.();
        }
        throw err;
      }
    });
  }
}
```

```ts
// apps/api/src/modules/reviews/reviews.module.ts
import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
```

Đăng ký trong `apps/api/src/app.module.ts`: thêm `ReviewsModule` vào mảng `imports`.

- [ ] **Bước 5: Chạy gate**

Chạy: `cd ~/projects/tourism-v2 && pnpm gate`
Kỳ vọng: `Tasks: 13 successful` + biome sạch

- [ ] **Bước 6: Commit**

```bash
pnpm lint:fix
git add libs/shared/contract/src apps/api/src
git commit -m "feat(api,contract): endpoint tạo review với gate điều kiện (P3a-W1)"
```

---

## Task 5: Transaction duyệt review 4-trong-1 + endpoint admin

**Files:**
- Modify: `apps/api/src/modules/reviews/reviews.service.ts`
- Create: `apps/api/src/modules/reviews/admin-reviews.controller.ts`
- Modify: `libs/shared/contract/src/contract.ts`, `libs/shared/contract/src/schemas/reviews.ts`, `apps/api/src/modules/reviews/reviews.module.ts`

**Interfaces:**
- Consumes: `ReviewsService` (Task 4)
- Produces: `ReviewsService.moderate(actorId, reviewId, { approve, note? })` → `{ id, isApproved }`; contract `admin.reviews.{list, moderate}`. Task 6 dùng dữ liệu đã duyệt.

- [ ] **Bước 1: Schema + contract admin**

Thêm vào `schemas/reviews.ts`:

```ts
export const ModerateReviewInputSchema = z.object({
  id: z.uuid(),
  approve: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

export const AdminReviewSchema = PublicReviewSchema.extend({
  isApproved: z.boolean(),
  source: z.enum(['VERIFIED', 'CURATED']),
  tourSlug: z.string().nullable(),
  moderatedAt: z.iso.datetime().nullable(),
});

export const AdminReviewsQuerySchema = PageQuerySchema.extend({
  isApproved: z.boolean().optional(),
});
```

Thêm nhánh `admin.reviews` vào contract (trong object `admin` đã có):

```ts
    reviews: {
      list: oc
        .route({ method: 'GET', path: '/api/admin/reviews', summary: 'Moderation queue' })
        .input(AdminReviewsQuerySchema)
        .output(PagedSchema(AdminReviewSchema)),

      moderate: oc
        .route({ method: 'POST', path: '/api/admin/reviews/{id}/moderate', summary: 'Approve or unapprove a review' })
        .input(ModerateReviewInputSchema)
        .output(AdminReviewSchema)
        .errors({ REVIEW_NOT_FOUND: { status: 404, message: 'Review not found' } }),
    },
```

- [ ] **Bước 2: Service — transaction 4-trong-1**

Thêm vào `ReviewsService`:

```ts
  /**
   * Duyệt / bỏ duyệt review — MỘT transaction gồm 4 việc:
   *   ① flip isApproved + dấu vết người duyệt
   *   ② ghi ReviewModerationEvent (append-only, audit A8)
   *   ③ recompute Tour.ratingAvg/ratingCount
   *   ④ enqueue outbox REVIEW_APPROVED, CHỈ khi false→true
   *
   * ③ nằm trong transaction nên rating không bao giờ lệch với trạng thái
   * duyệt — Nexora tính live mỗi page load (scan toàn bảng reviews).
   *
   * Review CURATED có tourId null (testimonial admin viết) nên BỎ QUA ③:
   * nó là social proof, không phải đánh giá chuyến đi.
   */
  async moderate(
    actorId: string,
    input: { id: string; approve: boolean; note?: string },
  ): Promise<AdminReview> {
    const existing = await prisma.review.findUnique({
      where: { id: input.id },
      select: { id: true, isApproved: true, tourId: true },
    });
    if (!existing) throw new ReviewError('REVIEW_NOT_FOUND');

    const justApproved = !existing.isApproved && input.approve;

    return prisma.$transaction(async (tx) => {
      // ① trạng thái + dấu vết
      await tx.review.update({
        where: { id: input.id },
        data: {
          isApproved: input.approve,
          moderatedById: actorId,
          moderatedAt: new Date(),
        },
      });

      // ② lịch sử append-only
      await tx.reviewModerationEvent.create({
        data: {
          reviewId: input.id,
          actorId,
          fromApproved: existing.isApproved,
          toApproved: input.approve,
          note: input.note ?? null,
        },
      });

      // ③ recompute rating của ĐÚNG tour đó (bỏ qua nếu là CURATED)
      if (existing.tourId) {
        const agg = await tx.review.aggregate({
          where: { tourId: existing.tourId, isApproved: true },
          _avg: { rating: true },
          _count: { _all: true },
        });
        await tx.tour.update({
          where: { id: existing.tourId },
          data: {
            ratingAvg: agg._avg.rating ?? null,
            ratingCount: agg._count._all,
          },
        });
      }

      // ④ email — chỉ ở lần chuyển false→true; dedupeKey chặn gửi lại khi
      // unapprove rồi approve lần nữa (quy ước <event>:<entityId>).
      if (justApproved) {
        await tx.outbox.createMany({
          data: [
            {
              type: 'REVIEW_APPROVED',
              payload: { reviewId: input.id },
              dedupeKey: `review-approved:${input.id}`,
            },
          ],
          skipDuplicates: true,
        });
      }

      // Trả LUÔN shape admin từ trong transaction — không gọi lại query
      // ngoài tx (tránh đọc trạng thái đã cũ và tránh một round-trip thừa).
      const fresh = await tx.review.findUniqueOrThrow({
        where: { id: input.id },
        include: { tour: { select: { slug: true } } },
      });
      return toAdminReview(fresh);
    });
  }

  /** Hàng đợi moderation cho admin. Mặc định không lọc — admin thấy tất cả. */
  async adminList(query: { page: number; pageSize: number; isApproved?: boolean }) {
    const where = query.isApproved === undefined ? {} : { isApproved: query.isApproved };
    const [rows, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: { tour: { select: { slug: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.review.count({ where }),
    ]);
    return {
      items: rows.map(toAdminReview),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }
```

Và thêm mapper cạnh `toPublicReview` (cùng file):

```ts
/** Row + tour slug → shape admin. Admin thấy cả review chưa duyệt. */
export function toAdminReview(row: {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  authorDeleted: boolean;
  createdAt: Date;
  isApproved: boolean;
  source: ReviewSource;
  moderatedAt: Date | null;
  tour: { slug: string } | null;
}): AdminReview {
  return {
    ...toPublicReview(row),
    isApproved: row.isApproved,
    source: row.source,
    tourSlug: row.tour?.slug ?? null,
    moderatedAt: row.moderatedAt?.toISOString() ?? null,
  };
}
```

Import thêm ở đầu `reviews.service.ts`: `import type { AdminReview } from '@tourism/contract';`
và trong `schemas/reviews.ts` thêm: `export type AdminReview = z.infer<typeof AdminReviewSchema>;`

- [ ] **Bước 3: Controller admin**

```ts
// apps/api/src/modules/reviews/admin-reviews.controller.ts
import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { AuthGuard } from '../../auth/auth.guard.js';
import { CurrentUser, type SessionUser } from '../../auth/current-user.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { ReviewError, ReviewsService } from './reviews.service.js';

@Controller()
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Implement(contract.admin.reviews.moderate)
  moderate(@CurrentUser() user: SessionUser) {
    return implement(contract.admin.reviews.moderate).handler(async ({ input, errors }) => {
      try {
        // moderate trả LUÔN shape admin (đọc trong transaction) — không cần
        // query lại sau đó.
        return await this.reviews.moderate(user.id, input);
      } catch (err) {
        if (err instanceof ReviewError && err.code === 'REVIEW_NOT_FOUND') errors.REVIEW_NOT_FOUND();
        throw err;
      }
    });
  }

  @Implement(contract.admin.reviews.list)
  list() {
    return implement(contract.admin.reviews.list).handler(({ input }) =>
      this.reviews.adminList(input),
    );
  }
}
```

- [ ] **Bước 4: Đăng ký controller**

Trong `reviews.module.ts`, thêm `AdminReviewsController` vào `controllers`.

- [ ] **Bước 5: Gate + commit**

```bash
cd ~/projects/tourism-v2 && pnpm gate
pnpm lint:fix
git add .
git commit -m "feat(api,contract): duyệt review — transaction 4-trong-1 + audit trail (P3a-W1)"
```

---

## Task 6: Danh sách công khai + `mine` + integration test vòng đời

**Files:**
- Modify: `apps/api/src/modules/reviews/reviews.service.ts`, `reviews.controller.ts`
- Create: `apps/api/src/modules/reviews/reviews.int.spec.ts`

**Interfaces:**
- Consumes: toàn bộ Task 3–5
- Produces: `ReviewsService.{listByTour, mine, adminList, adminById}`

- [ ] **Bước 1: Service — list công khai**

```ts
  /**
   * Review đã duyệt của một tour. Sort [authorDeleted asc, createdAt desc]
   * chạy thẳng trên index [tourId, isApproved, authorDeleted, createdAt desc]
   * — review khuyết danh tự trôi xuống dưới, review có danh tính lên trước.
   */
  async listByTour(tourSlug: string, page: number, pageSize: number) {
    const tour = await prisma.tour.findFirst({
      where: { slug: tourSlug, isPublished: true },
      select: { id: true },
    });
    // 404 thay vì "200 rỗng": 200-rỗng che mất bug routing của FE.
    if (!tour) throw new ReviewError('TOUR_NOT_FOUND');

    const where = { tourId: tour.id, isApproved: true };
    const [rows, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: [{ authorDeleted: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.review.count({ where }),
    ]);

    return {
      items: rows.map(toPublicReview),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }
```

- [ ] **Bước 2: Integration test — vòng đời + bất biến**

Helper dựng dữ liệu (đặt đầu file, dùng lại cho mọi test):

```ts
// apps/api/src/modules/reviews/reviews.int.spec.ts
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import { BookingStatus, ReviewSource, UserRole } from '../../generated/prisma/enums.js';

let app: NestFastifyApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
    rawBody: true,
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  // Thứ tự truncate theo chiều phụ thuộc FK.
  await prisma.$executeRawUnsafe(
    'TRUNCATE review_moderation_events, reviews, outbox, bookings, tour_departures, tours, tour_categories, destinations, users, sessions, accounts RESTART IDENTITY CASCADE',
  );
});

/** Dựng 1 tour + 1 departure đã kết thúc + 1 booking PAID của user cho sẵn. */
async function seedCompletedBooking(opts: { endDate: Date; userId: string }) {
  const category = await prisma.tourCategory.create({
    data: { slug: 'walking', name: 'Walking', order: 1 },
  });
  const destination = await prisma.destination.create({
    data: { slug: 'hoi-an', name: 'Hội An' },
  });
  const tour = await prisma.tour.create({
    data: {
      slug: 'hoi-an-walking-tour',
      title: 'Hội An Walking Tour',
      categoryId: category.id,
      durationDays: 1,
      basePrice: '39.00',
      currency: 'USD',
      isPublished: true,
      destinations: { create: { destinationId: destination.id, isPrimary: true } },
    },
  });
  const departure = await prisma.tourDeparture.create({
    data: {
      tourId: tour.id,
      startDate: opts.endDate,
      endDate: opts.endDate,
      seatsTotal: 10,
      seatsBooked: 1,
    },
  });
  const booking = await prisma.booking.create({
    data: {
      code: 'BK-TESTREV1',
      userId: opts.userId,
      tourId: tour.id,
      departureId: departure.id,
      numAdults: 1,
      totalAmount: '39.00',
      currency: 'USD',
      status: BookingStatus.PAID,
      tourTitle: tour.title,
      departureStartDate: departure.startDate,
      departureEndDate: departure.endDate,
      unitPrice: '39.00',
      contactName: 'Test',
      contactEmail: 'test@example.com',
      paymentProvider: 'STRIPE',
    },
  });
  return { tour, departure, booking };
}
```

Các test (viết đủ, không bỏ trống):

```ts
describe('reviews (int)', () => {
  it('chuyến CHƯA kết thúc → REVIEW_TRIP_NOT_COMPLETED', async () => {
    const { user, cookie } = await signUpAndSignIn(app, 'a@example.com');
    const future = new Date(Date.now() + 30 * 864e5);
    await seedCompletedBooking({ endDate: future, userId: user.id });

    const res = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers: { cookie },
      payload: { bookingCode: 'BK-TESTREV1', rating: 5, body: 'Tuyệt vời quá đi mất' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('REVIEW_TRIP_NOT_COMPLETED');
    expect(await prisma.review.count()).toBe(0);
  });

  it('booking của người khác → 403 BOOKING_FORBIDDEN', async () => {
    const owner = await signUpAndSignIn(app, 'owner@example.com');
    const other = await signUpAndSignIn(app, 'other@example.com');
    await seedCompletedBooking({ endDate: new Date(Date.now() - 864e5), userId: owner.user.id });

    const res = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers: { cookie: other.cookie },
      payload: { bookingCode: 'BK-TESTREV1', rating: 5, body: 'Không phải booking của tôi' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('BOOKING_FORBIDDEN');
  });

  it('duyệt review: rating tour đổi ĐÚNG trong cùng transaction', async () => {
    const { user, cookie } = await signUpAndSignIn(app, 'c@example.com');
    const { tour } = await seedCompletedBooking({
      endDate: new Date(Date.now() - 864e5),
      userId: user.id,
    });
    const admin = await signUpAdmin(app, 'admin@tourism.test');

    const created = await app.inject({
      method: 'POST',
      url: '/api/reviews',
      headers: { cookie },
      payload: { bookingCode: 'BK-TESTREV1', rating: 4, body: 'Hướng dẫn viên nhiệt tình' },
    });
    const reviewId = created.json().id;

    // Trước khi duyệt: rating chưa đổi.
    let fresh = await prisma.tour.findUniqueOrThrow({ where: { id: tour.id } });
    expect(fresh.ratingAvg).toBeNull();
    expect(fresh.ratingCount).toBe(0);

    await app.inject({
      method: 'POST',
      url: `/api/admin/reviews/${reviewId}/moderate`,
      headers: { cookie: admin.cookie },
      payload: { id: reviewId, approve: true },
    });

    fresh = await prisma.tour.findUniqueOrThrow({ where: { id: tour.id } });
    expect(Number(fresh.ratingAvg)).toBe(4);
    expect(fresh.ratingCount).toBe(1);
  });

  it('duyệt review: đúng 1 ReviewModerationEvent + đúng 1 outbox', async () => {
    const { reviewId, adminCookie } = await createAndApprove(app);

    expect(await prisma.reviewModerationEvent.count({ where: { reviewId } })).toBe(1);
    const event = await prisma.reviewModerationEvent.findFirstOrThrow({ where: { reviewId } });
    expect(event.fromApproved).toBe(false);
    expect(event.toApproved).toBe(true);

    expect(
      await prisma.outbox.count({ where: { dedupeKey: `review-approved:${reviewId}` } }),
    ).toBe(1);
    expect(adminCookie).toBeTruthy();
  });

  it('unapprove rồi approve lại → KHÔNG gửi mail lần hai', async () => {
    const { reviewId, adminCookie } = await createAndApprove(app);

    for (const approve of [false, true]) {
      await app.inject({
        method: 'POST',
        url: `/api/admin/reviews/${reviewId}/moderate`,
        headers: { cookie: adminCookie },
        payload: { id: reviewId, approve },
      });
    }

    // Outbox vẫn đúng 1 row — dedupeKey chặn gửi lại.
    expect(
      await prisma.outbox.count({ where: { dedupeKey: `review-approved:${reviewId}` } }),
    ).toBe(1);
    // Nhưng lịch sử có đủ 3 sự kiện: approve → unapprove → approve.
    expect(await prisma.reviewModerationEvent.count({ where: { reviewId } })).toBe(3);
  });

  it('review CURATED không ảnh hưởng rating của tour nào', async () => {
    const admin = await signUpAdmin(app, 'admin@tourism.test');
    const curated = await prisma.review.create({
      data: {
        source: ReviewSource.CURATED,
        authorName: 'Marketing Team',
        rating: 5,
        body: 'Testimonial do admin viết, không gắn tour nào',
        isApproved: false,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/reviews/${curated.id}/moderate`,
      headers: { cookie: admin.cookie },
      payload: { id: curated.id, approve: true },
    });

    expect(res.statusCode).toBe(200);
    // Không tour nào bị đụng rating.
    const tours = await prisma.tour.findMany({ where: { ratingCount: { gt: 0 } } });
    expect(tours).toHaveLength(0);
  });

  it('list công khai: review khuyết danh xếp SAU review có danh tính', async () => {
    const { tour } = await seedTwoApprovedReviews(app); // 1 thường + 1 authorDeleted

    const res = await app.inject({ method: 'GET', url: `/api/tours/${tour.slug}/reviews` });

    const items = res.json().items;
    expect(items).toHaveLength(2);
    expect(items[0].authorDeleted).toBe(false);
    expect(items[1].authorDeleted).toBe(true);
    expect(items[1].authorName).toBeNull(); // tên đã bị giấu
  });

  it('KHÔNG có dữ liệu trust giả: tour chưa có review → ratingAvg null, list rỗng', async () => {
    // Regression có chủ đích: Nexora từng hiện 4 reviewer bịa (Emily Carter…)
    // khi chưa có review thật, phải gỡ rồi viết test chặn nó sống lại.
    const admin = await signUpAdmin(app, 'admin@tourism.test');
    const { tour } = await seedCompletedBooking({
      endDate: new Date(Date.now() - 864e5),
      userId: admin.user.id,
    });

    const res = await app.inject({ method: 'GET', url: `/api/tours/${tour.slug}/reviews` });

    expect(res.json().items).toEqual([]);
    expect(res.json().total).toBe(0);
    const fresh = await prisma.tour.findUniqueOrThrow({ where: { id: tour.id } });
    expect(fresh.ratingAvg).toBeNull();
    expect(fresh.ratingCount).toBe(0);
  });
});
```

Ba helper còn lại — `signUpAndSignIn(app, email)`, `signUpAdmin(app, email)`,
`createAndApprove(app)`, `seedTwoApprovedReviews(app)` — viết theo đúng pattern
đã có sẵn trong `apps/api/src/auth/auth.int.spec.ts` (gọi
`POST /api/auth/sign-up/email` rồi `sign-in/email`, lấy cookie từ header
`set-cookie`). `signUpAdmin` dùng email nằm trong `ADMIN_EMAILS` để hook
bootstrap tự promote lên ADMIN.

- [ ] **Bước 3: Chạy integration**

Chạy: `cd apps/api && pnpm test:int`
Kỳ vọng: tất cả suite xanh (auth · catalog · outbox · pgboss · bookings · payments · refunds · cancellations · **reviews**)

- [ ] **Bước 4: Gate toàn bộ + commit**

```bash
cd ~/projects/tourism-v2
pnpm gate
pnpm lint:fix
git add .
git commit -m "feat(api): list review công khai + integration suite vòng đời (P3a-W1)"
```

---

## Hoàn thành kế hoạch A khi

- [ ] `pnpm gate` xanh · `pnpm test:int` toàn bộ xanh
- [ ] Vòng đời chạy thật qua API: tạo review → duyệt → hiện ở list công khai,
      `Tour.ratingAvg` đổi đúng
- [ ] 8 bất biến ở Task 6 đều có test
- [ ] CI xanh trên branch (`pnpm ci:wait`)

Sau đó viết **Kế hoạch B** cho W2–W6 (wishlist · enquiry · newsletter · posts ·
site-media) theo đúng pattern mà W1 vừa đóng đinh.
