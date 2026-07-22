# P3a contract closeout (C1 · R1 · R2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans, task-by-task. Steps dùng checkbox `- [ ]`.

**Goal:** Đóng 3 gap hình dạng contract customer/admin API ([spec](../specs/2026-07-21-p3a-contract-closeout-design.md))
trước khi mở P3b Web — C1 catalog destinations[], R1 reviews.mine tour identity, R2 admin.reviews filter/moderatedBy.

**Architecture:** Thuần contract-additive/parity. Schema `@tourism/contract` là nguồn sự thật; int-spec parse
response bằng chính schema đó (conformity). Không migration, không đụng money-path.

**Tech Stack:** oRPC contract (zod) · NestJS 11 · Prisma 7 · Vitest int (PG `tourism_test`).

## Global Constraints (áp cho MỌI task)

- Comment tiếng Việt (#8); Conventional Commits KHÔNG AI attribution (#12); TDD (#4).
- Không migration (model đã đủ cột). Không đụng int-spec money-path.
- `pnpm gate:int` 1 lần cuối branch (#11); docs sweep #13 khi merge.

## File Structure

- `libs/shared/contract/src/schemas/catalog.ts` — DestinationLinkSchema + TourCardSchema.destinations[].
- `libs/shared/contract/src/schemas/catalog.spec.ts` — fixture unit test theo shape mới.
- `apps/api/src/modules/catalog/catalog.service.ts` — cardInclude + toTourCard.
- `apps/api/src/modules/catalog/catalog.int.spec.ts` — assertion destinations[].
- `libs/shared/contract/src/schemas/reviews.ts` — MyReviewSchema + AdminReviewSchema + AdminReviewsQuerySchema.
- `apps/api/src/modules/reviews/reviews.service.ts` — toMyReview/toAdminReview + mine()/adminList().
- `apps/api/src/modules/reviews/reviews.int.spec.ts` — R1/R2 assertions.

---

### Task 1: C1 — catalog `destinations[]` thay `primaryDestination`

**Files:** contract `catalog.ts` + `catalog.spec.ts`; service `catalog.service.ts`; test `catalog.int.spec.ts`.

**Interfaces produces:** `DestinationLinkSchema = { slug, name, isPrimary }`; `TourCard.destinations: DestinationLink[]` (bỏ `primaryDestination`).

- [ ] **Step 1: Đổi contract schema** (`catalog.ts`) — thêm `DestinationLinkSchema`, sửa `TourCardSchema`:
```ts
export const DestinationLinkSchema = z.object({
  slug: z.string(),
  name: z.string(),
  isPrimary: z.boolean(),
});
// trong TourCardSchema: BỎ dòng primaryDestination, THÊM:
  destinations: z.array(DestinationLinkSchema),
```
- [ ] **Step 2: Sửa contract unit fixture** (`catalog.spec.ts:24,70`) — thay `primaryDestination` bằng
  `destinations: [{ slug: 'hoi-an', name: 'Hội An', isPrimary: true }]` (case valid) và `destinations: []` (case null cũ).
- [ ] **Step 3: Sửa int-spec đỏ** (`catalog.int.spec.ts`) — fixture tour gắn ≥2 destination (1 primary), assert:
```ts
// thay expect(card?.primaryDestination).not.toBeNull():
expect(card?.destinations.length).toBeGreaterThanOrEqual(2);
expect(card?.destinations[0]?.isPrimary).toBe(true); // primary đứng đầu
expect(card?.destinations.map((d) => d.slug)).toContain('hoi-an');
```
  (Kiểm fixture seed hiện có gắn mấy destination cho tour test; nếu chỉ 1, thêm link destination phụ trong seed của spec.)
- [ ] **Step 4: Run int → FAIL** (service còn trả `primaryDestination`, schema parse rớt `destinations`).
Run: `pnpm --filter @tourism/api exec vitest run --config vitest.int.config.ts src/modules/catalog/catalog.int.spec.ts`
- [ ] **Step 5: Sửa service** (`catalog.service.ts`) — `cardInclude.destinations` + `toTourCard`:
```ts
// cardInclude.destinations:
  destinations: {
    select: { isPrimary: true, destination: { select: { slug: true, name: true } } },
    orderBy: [{ isPrimary: 'desc' }, { destination: { name: 'asc' } }],
  },
// toTourCard: thay dòng primaryDestination bằng:
  destinations: tour.destinations.map((d) => ({
    slug: d.destination.slug,
    name: d.destination.name,
    isPrimary: d.isPrimary,
  })),
```
- [ ] **Step 6: Run int + contract unit → PASS.**
Run: contract `pnpm --filter @tourism/contract test`; int như Step 4.
- [ ] **Step 7: Commit:** `feat(contract,api): catalog trả destinations[] thay primaryDestination (C1 parity)`

---

### Task 2: R1 — `reviews.mine` mang `tourSlug`/`tourTitle`

**Files:** contract `reviews.ts` (MyReviewSchema); service `reviews.service.ts` (toMyReview + mine()); test `reviews.int.spec.ts`.

- [ ] **Step 1: Đổi contract** (`reviews.ts`) — `MyReviewSchema`:
```ts
export const MyReviewSchema = PublicReviewSchema.extend({
  isApproved: z.boolean(),
  tourSlug: z.string().nullable(),
  tourTitle: z.string().nullable(),
});
```
- [ ] **Step 2: Sửa int-spec đỏ** (`reviews.int.spec.ts`, ca `mine`) — assert:
```ts
expect(mine.items[0]?.tourSlug).toBe(<slug của tour review>);
expect(mine.items[0]?.tourTitle).toBe(<title của tour>);
```
- [ ] **Step 3: Run → FAIL** (`toMyReview` chưa có 2 field; `mine()` chưa include tour).
- [ ] **Step 4: Sửa service** (`reviews.service.ts`):
```ts
// toMyReview: mở rộng tham số row + trả thêm
export function toMyReview(
  row: Parameters<typeof toPublicReview>[0] & {
    isApproved: boolean;
    tour: { slug: string; title: string } | null;
  },
): MyReview {
  return {
    ...toPublicReview(row),
    isApproved: row.isApproved,
    tourSlug: row.tour?.slug ?? null,
    tourTitle: row.tour?.title ?? null,
  };
}
// mine(): thêm include vào findMany:
  include: { tour: { select: { slug: true, title: true } } },
```
- [ ] **Step 5: Run → PASS.**
- [ ] **Step 6: Commit:** `feat(contract,api): reviews.mine trả tourSlug/tourTitle (R1 parity)`

---

### Task 3: R2 — `admin.reviews.list` search/source/rating + `moderatedBy`/`tourTitle`

**Files:** contract `reviews.ts` (AdminReviewsQuerySchema + AdminReviewSchema); service `reviews.service.ts` (toAdminReview + adminList()); test `reviews.int.spec.ts`.

**Interfaces consumes:** controller `admin-reviews.controller.ts` truyền `input` nguyên khối → KHÔNG sửa controller.

- [ ] **Step 1: Đổi contract** (`reviews.ts`):
```ts
export const AdminReviewSchema = PublicReviewSchema.extend({
  isApproved: z.boolean(),
  source: z.enum(['VERIFIED', 'CURATED']),
  tourSlug: z.string().nullable(),
  tourTitle: z.string().nullable(),
  moderatedAt: z.iso.datetime().nullable(),
  moderatedBy: z.string().nullable(),
});
export const AdminReviewsQuerySchema = PageQuerySchema.extend({
  isApproved: z.boolean().optional(),
  source: z.enum(['VERIFIED', 'CURATED']).optional(),
  rating: RatingSchema.optional(),
  search: z.string().min(1).max(100).optional(),
});
```
- [ ] **Step 2: Sửa int-spec đỏ** (`reviews.int.spec.ts`, ca admin list) — assert: lọc `source`/`rating` thu hẹp đúng;
  `search` khớp body/title/tên; sau khi moderate, item có `moderatedBy = <tên admin>` và `tourTitle` không null.
- [ ] **Step 3: Run → FAIL** (schema/service chưa có field + filter).
- [ ] **Step 4: Sửa service** (`reviews.service.ts`):
```ts
// toAdminReview: mở rộng row + trả thêm
export function toAdminReview(row: {
  /* ...các field cũ... */
  tour: { slug: string; title: string } | null;
  moderatedBy: { name: string } | null;
}): AdminReview {
  return {
    ...toPublicReview(row),
    isApproved: row.isApproved,
    source: row.source,
    tourSlug: row.tour?.slug ?? null,
    tourTitle: row.tour?.title ?? null,
    moderatedAt: row.moderatedAt?.toISOString() ?? null,
    moderatedBy: row.moderatedBy?.name ?? null,
  };
}
// adminList(): mở rộng param type {search?, source?, rating?}; where cộng:
  const where: Prisma.ReviewWhereInput = {
    ...(query.isApproved === undefined ? {} : { isApproved: query.isApproved }),
    ...(query.source ? { source: query.source } : {}),
    ...(query.rating ? { rating: query.rating } : {}),
    ...(query.search
      ? {
          OR: [
            { body: { contains: query.search, mode: 'insensitive' } },
            { title: { contains: query.search, mode: 'insensitive' } },
            { authorName: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
// findMany include: thêm tour {slug,title} + moderatedBy {name}
  include: {
    tour: { select: { slug: true, title: true } },
    moderatedBy: { select: { name: true } },
  },
```
  *(`moderate()` cũng đọc lại review cuối tx với `toAdminReview` — cập nhật include của nó thêm `tour:{slug,title}` + `moderatedBy:{name}` để shape khớp, xem reviews.service.ts:312.)*
- [ ] **Step 5: Run → PASS.**
- [ ] **Step 6: Commit:** `feat(contract,api): admin.reviews search/filter + moderatedBy/tourTitle (R2 parity)`

---

### Task 4: gate:int + docs sweep + merge

- [ ] **Step 1:** `pnpm gate:int` toàn repo → xanh.
- [ ] **Step 2:** Docs sweep #13: CHANGELOG (ngày · hash range · C1/R1/R2 · số test) + README map: spec/plan status → ✅ đã merge. `./scripts/docs-freshness.sh` xanh.
- [ ] **Step 3:** Rebase main → `merge --ff-only` → push (xác nhận user, #2). Xóa branch.

## Self-Review (đã chạy)

- **Spec coverage:** C1 (Task 1) · R1 (Task 2) · R2 (Task 3). ✓
- **Placeholder scan:** chỗ `<slug>`/`<title>`/`<tên admin>` là giá trị fixture cụ-thể-hoá lúc code theo seed spec, không phải logic-placeholder. ✓
- **Type consistency:** `DestinationLinkSchema` dùng nhất quán card+detail; `moderatedBy` là `string|null` (tên), khớp include `{name}`; controller không đổi (truyền input nguyên khối). ✓
- **Ripple:** `primaryDestination` còn ở `catalog.service.ts:59`, `catalog.int.spec.ts:145`, `catalog.spec.ts:24,70` — Task 1 xử hết. ✓
