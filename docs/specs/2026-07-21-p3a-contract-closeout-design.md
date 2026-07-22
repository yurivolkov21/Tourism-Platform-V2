# P3a contract closeout — C1 · R1 · R2 (design)

- **Ngày:** 2026-07-21
- **Nguồn:** 3 finding parity từ [sweep parity toàn code](../analysis/2026-07-21-full-parity-sweep-pre-p3ab.md)
  (C1 Quan trọng · R1/R2 Nên có) — v2 thụt lùi so với Nexora ở độ đầy đủ dữ liệu đọc-ra.
- **Không ADR:** thuần contract-additive/parity, không phải quyết định kiến trúc. Không migration.

## Mục tiêu

Đóng các gap **hình dạng contract** của customer/admin API **trước khi mở P3b Web**, để web/admin
xây một lần trên contract ổn định (đổi sau = rework component). Web/admin/mobile hiện mới là
skeleton P0 nên đổi contract không tốn rework hiện tại.

**Không đụng:** money-path, security, invariant ghế/idempotency, worker. Chỉ read-path catalog + reviews.

## C1 — Catalog trả đủ destinations (thay `primaryDestination`)

**Vấn đề:** Tour M:N nhiều destination, nhưng `cardInclude` lọc `isPrimary:true, take:1` và contract chỉ
có `primaryDestination` đơn → destination phụ biến mất khỏi cả card lẫn detail, mâu thuẫn với list cho
lọc theo BẤT KỲ destination (`some`).

**Quyết định (chốt với user):** thay `primaryDestination` bằng mảng `destinations[]` trên **cả card lẫn
detail**; bỏ field đơn (single source of truth; web chưa xây nên đổi contract free; client tự lọc `isPrimary`).

- **Contract** ([catalog.ts](../../libs/shared/contract/src/schemas/catalog.ts)):
  - Thêm `DestinationLinkSchema = z.object({ slug, name, isPrimary: z.boolean() })`.
  - `TourCardSchema`: **bỏ** `primaryDestination`; **thêm** `destinations: z.array(DestinationLinkSchema)`.
  - `TourDetailSchema` extend card → tự có `destinations[]`.
- **Service** ([catalog.service.ts](../../apps/api/src/modules/catalog/catalog.service.ts)):
  - `cardInclude.destinations`: bỏ `where isPrimary`/`take:1`; `select { isPrimary, destination:{ slug, name } }`;
    `orderBy [{ isPrimary: 'desc' }, { destination: { name: 'asc' } }]` (primary trước, rồi theo tên).
  - `toTourCard`: `destinations: tour.destinations.map(d => ({ slug: d.destination.slug, name: d.destination.name, isPrimary: d.isPrimary }))`.
  - Filter list theo `destination` slug (`some`) giữ nguyên.
- **Ripple:** sửa assertion int-spec catalog nào còn so `primaryDestination`.

## R1 — `reviews.mine` mang danh tính tour

**Vấn đề:** `MyReviewSchema` thiếu tên/slug tour; `mine()` không `include:{tour}` → trang "Đánh giá của tôi"
không hiện tên tour, không link được.

- **Contract:** `MyReviewSchema` thêm `tourSlug: z.string().nullable()`, `tourTitle: z.string().nullable()`
  (nullable — FK `tour` nullable trên schema).
- **Service** ([reviews.service.ts](../../apps/api/src/modules/reviews/reviews.service.ts) `mine()`):
  thêm `include:{ tour:{ select:{ slug:true, title:true } } }`; `toMyReview` lấy 2 field (nạp qua tham số row).

## R2 — `admin.reviews.list` search + filter + `moderatedBy`

**Vấn đề:** chỉ lọc được `isApproved`; thiếu search + lọc source/rating; item có `moderatedAt` (khi nào)
nhưng thiếu `moderatedBy` (ai) dù model đã có FK.

**Quyết định (chốt với user):** thêm search+source+rating filter; output thêm `moderatedBy`(tên admin) +
`tourTitle`. **Không** userEmail/userName (PII tối thiểu; admin UI P4 chưa xây).

- **Contract:**
  - `AdminReviewsQuerySchema` thêm `search: z.string().min(1).max(100).optional()`,
    `source: z.enum(['VERIFIED','CURATED']).optional()`, `rating: RatingSchema.optional()`.
  - `AdminReviewSchema` thêm `moderatedBy: z.string().nullable()`, `tourTitle: z.string().nullable()`.
- **Service** ([reviews.service.ts](../../apps/api/src/modules/reviews/reviews.service.ts) `adminList()`):
  - `where` cộng: `search` → `OR [{body},{title},{authorName}] contains insensitive`; `source`; `rating`.
  - `include` thêm `moderatedBy:{ select:{ name:true } }` + `tour:{ select:{ slug:true, title:true } }`.
  - `toAdminReview`: thêm `moderatedBy: row.moderatedBy?.name ?? null`, `tourTitle: row.tour?.title ?? null`.
  - Model đã có FK `moderatedById → moderatedBy` (schema.prisma:611,619) → **chỉ include, không migration**.
- **Controller** admin-reviews: truyền thêm `search/source/rating` từ input query xuống service.

## Test (TDD, mỗi vùng một cụm)

- **C1** (catalog.int.spec): tour gắn nhiều destination → card + detail trả đủ mảng `destinations` với cờ
  `isPrimary` (primary đứng đầu); tour một destination vẫn đúng; filter theo destination phụ vẫn thấy tour.
- **R1** (reviews.int.spec): `mine()` trả `tourSlug`+`tourTitle` khớp tour của review.
- **R2** (reviews.int.spec): lọc `source`/`rating` thu hẹp đúng; `search` khớp body/title/tên; `moderatedBy`
  = tên admin sau khi duyệt, `null` khi chưa duyệt; `tourTitle` hiện.

Contract thay đổi được canh bằng chính schema parse trong int-spec (conformity). Không migration, không
chạm int-spec money-path.

## Ngoài phạm vi (để sau)

- C2 (departures filter endpoint), D1–D4 (nợ chưa-live), các Low khác — không thuộc closeout này.
- Sub-project A (PENDING-lifecycle, ADR-0006 Proposed) — money-path completeness, phase riêng.
