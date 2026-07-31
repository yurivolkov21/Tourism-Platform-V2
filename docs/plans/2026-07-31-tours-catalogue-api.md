# Plan — Catalogue thật: seed ~30 tour + nối `/tours` và `/tours/[slug]`

> **For agentic workers:** REQUIRED SUB-SKILL: dùng
> `superpowers:subagent-driven-development` (khuyến nghị) hoặc
> `superpowers:executing-plans`. Step dùng checkbox (`- [ ]`).

**Goal:** DB có ~30 tour "như thật" (itinerary mốc giờ, departures tương lai,
reviews CURATED) thay trọn 23 tour cũ, và `/tours` + `/tours/[slug]` đọc từ API
— theo [spec](../specs/2026-07-31-tours-catalogue-api-design.md) (roster §3,
chuẩn nội dung §4, tour mẫu §5) và [ADR-0016](../adr/0016-web-data-layer.md).

**Architecture:** Nửa A — fixtures mới tách theo miền dưới
`apps/api/prisma/fixtures/catalog/`, seed idempotent bằng UUID tĩnh, reviews
CURATED + recompute rating trong seed. Nửa B — lặp đúng khuôn cụm Blog:
`lib/api/tours.ts` (fetch + VM cạnh nhau), ISR 300 + `TAGS.TOURS`/`tourTag`,
tri-state, đo 404 thật trên production build.

**Tech Stack:** như cụm Blog (oRPC `OpenAPILink` 1.14.8 đã cài · Vitest 2
project · Prisma seed swc). Không dep mới.

## Global Constraints (áp cho MỌI task)

- **Branch `feat/tours-catalogue-api`** từ `main`. Conventional Commits, KHÔNG
  AI attribution — ⚠️ SAU MỖI COMMIT: `git log -1 --format='%B'`, có
  `Co-Authored-By` thì `git commit --amend` gỡ ngay (bài học cụm Blog: trailer
  tự chèn dù brief cấm).
- **Comment code + JSDoc tiếng Việt**; identifier tiếng Anh; copy user-facing
  tiếng Anh (danh từ riêng giữ dấu — "Hội An", "Gành Hào").
- **Nội dung tour tuân spec §4 (chuẩn) + §5 (mẫu Vũng Tàu)** — reviewer đối
  chiếu theo chuẩn, không sửa lời văn nếu đã đạt chuẩn.
- **KHÔNG đụng `apps/api/prisma/migrations/`** — reset DB bằng
  `prisma migrate reset` là REPLAY, không sửa file. **KHÔNG đổi
  schema/contract.** **KHÔNG parse ngược** text itinerary thành dữ liệu.
- **KHÔNG tạo `loading.tsx`**; route động không bao giờ có (soft-404 đã đo).
- **TDD logic thuần** (skill `superpowers:test-driven-development`); component
  test jsdom theo ADR-0014. `pnpm gate` (cần API sống khi build) + thử
  `pnpm test:int` (máy này chạy được — 145/145 đo 31/07).
- **Cổng:** 3000 phải TRỐNG trước build (`curl -s -o /dev/null -w "%{http_code}"
  --max-time 3 http://localhost:3000/` → `000`); API 3001; kill đúng PID qua
  `ss -ltnp`, KHÔNG `pkill -f`; container Postgres Docker để nguyên.
- **UUID tĩnh series MỚI** tránh đụng dữ liệu cũ: destination `c0000002-…`,
  tour `d0000002-…`, itinerary `f0000002-…` (nếu cần id), departure
  `e0000002-…`, review `a0000002-…` — đánh số `…-0000000000NN` tuần tự.
- `mocks/tours.ts` + `mocks/destinations.ts` **CHƯA chết** (consumer:
  `/destinations`, `/about`, Home — bước 4+). Chỉ trang đổi nguồn bỏ import.

---

### Task 1: Tách fixtures thành `fixtures/catalog/` + destinations mới

**Files:**
- Create: `apps/api/prisma/fixtures/catalog/index.ts` · `categories.ts` ·
  `destinations.ts` · `tours-north.ts` · `tours-central.ts` · `tours-south.ts`
  (3 file miền tạo RỖNG-có-khuôn ở task này, content ở Task 2–4) ·
  `reviews.ts` (rỗng-có-khuôn, content Task 5)
- Delete: `apps/api/prisma/fixtures/catalog.ts` (file cũ 23 tour)
- Modify: `apps/api/prisma/seed.ts` (đổi import + concat mảng 3 miền)

**Interfaces:**
- Produces: `index.ts` re-export đúng các tên seed.ts đang dùng
  (`tourCategories`, `destinations`, `tours`, `tourDestinations`,
  `tourItineraryDays`, `tourFaqs`, `tourPolicies`, `tourDepartures` — mỗi mảng
  là concat của 3 file miền) + `tourReviews` (mới, Task 5 đổ content). Shape
  từng phần tử GIỮ NGUYÊN như file cũ (đã kiểm: departures có id tĩnh +
  startDate `YYYY-MM-DD`; tourDestinations `{tourId, destinationId, isPrimary}`).

- [ ] **Step 1:** `categories.ts` — copy NGUYÊN VĂN 6 category từ file cũ
  (5 active + `seasonal-classics` inactive; spec giữ nguyên bộ này).
- [ ] **Step 2:** `destinations.ts` — 19 destination theo spec §3, series
  `c0000002-…01` → `…19` theo thứ tự spec liệt kê; `region` đúng MỘT trong
  `'Northern Vietnam' | 'Central Vietnam' | 'Southern Vietnam'`;
  `description` 1–2 câu biên tập; `isActive: true`; field khớp shape cũ.
- [ ] **Step 3:** 3 file miền + `reviews.ts`: mỗi file export đủ các mảng con
  (`tours`, `tourDestinations`, `tourItineraryDays`, `tourFaqs`,
  `tourPolicies`, `tourDepartures`) hiện RỖNG, kèm comment tiếng Việt trỏ spec
  §3–§5 và ghi dải UUID được cấp cho miền đó (north `…01–…12`, central
  `…13–…21`, south `…22–…30` theo cột # của roster).
- [ ] **Step 4:** `index.ts` concat + re-export; sửa `seed.ts` import
  `./fixtures/catalog/index.js`. `pnpm turbo run typecheck --filter=@tourism/api`
  → xanh (seed compile được với mảng rỗng).
- [ ] **Step 5:** Commit `refactor(api): tach fixtures catalog theo mien, dat khuon seed moi`

---

### Task 2: Content 12 tour miền Bắc (`tours-north.ts`)

**Files:** Modify: `apps/api/prisma/fixtures/catalog/tours-north.ts`

- [ ] **Step 1:** Viết 12 tour #1–#12 đúng roster spec §3 (slug/title/điểm
  đến/ngày/category/giá) và chuẩn §4 — mỗi tour ĐỦ: summary ≤200 ·
  itinerary MỖI ngày 4–8 dòng `HH:MM — …` tăng dần, phủ sáng/trưa/chiều(/tối),
  địa danh/món ăn có thật, nối bằng `\n`, ≤2000 ký tự/ngày · highlights 4–6 ·
  included 4–7/excluded 2–4 · meetingPoint địa chỉ thật · faqs 3–5 ·
  policies đủ 3 kind · departures 3–6 đợt TĨNH trong 2026-08 → 2027-01
  (endDate = startDate + durationDays − 1), seatsTotal 8–20, vài đợt
  seatsBooked > 0, 1–2 đợt promo `priceOverride` · suitableFor/badges/
  difficulty/maxGroupSize khớp bản chất (Hà Giang CHALLENGING…) ·
  `isFeatured` cho 2–3 tour Bắc. Grand tour #12: itinerary 12 ngày vẫn đủ
  chuẩn từng ngày (được phép 4–6 dòng/ngày cho gọn).
- [ ] **Step 2:** Tự kiểm bằng script nhỏ (chạy `node --experimental-strip-types`
  hoặc qua vitest tạm trong `apps/api`): mỗi tour có itinerary đủ số ngày
  (`durationDays` khớp số row), mỗi description ≥4 dòng khớp `/^\d{2}:\d{2} — /`,
  ≤2000 ký tự; departures đều `startDate > 2026-08-01`. Dán kết quả vào report.
  (Kiểm này là script dùng-một-lần trong report, KHÔNG commit file kiểm.)
- [ ] **Step 3:** `typecheck` API xanh. Commit
  `feat(api): fixtures 12 tour mien Bac theo chuan spec`

---

### Task 3: Content 9 tour miền Trung (`tours-central.ts`)

Y hệt khuôn Task 2 cho #13–#21 (Huế, Phong Nha, Hội An ×3, Đà Nẵng, Quy Nhơn,
package Central Heritage, honeymoon Central). `isFeatured` 2 tour. Cùng bước
tự kiểm + typecheck. Commit `feat(api): fixtures 9 tour mien Trung theo chuan spec`

---

### Task 4: Content 9 tour miền Nam (`tours-south.ts`) — CÓ TOUR MẪU

Y hệt khuôn Task 2 cho #22–#30. **#22 `vung-tau-coastal-2d` phải khớp spec §5
TỪNG MỤC** (summary/giá/badges/suitableFor/meetingPoint/highlights/itinerary 2
ngày đúng các dòng giờ đã duyệt/included/excluded/faqs 4/policies/departures 4
đợt thứ Bảy cách tuần từ 2026-08-15 với 1 đợt promo 119.00) — reviewer sẽ đối
chiếu từng dòng với spec. `isFeatured` 2–3 tour Nam (gồm Vũng Tàu). Cùng bước
tự kiểm + typecheck. Commit `feat(api): fixtures 9 tour mien Nam + tour mau Vung Tau`

---

### Task 5: Reviews CURATED + bước seed mới + recompute rating

**Files:**
- Modify: `apps/api/prisma/fixtures/catalog/reviews.ts` · `apps/api/prisma/seed.ts`

**Interfaces:**
- Produces: `tourReviews: Array<{id; tourId; rating; title; body; authorName;
  authorLocation; createdAt}>` — seed gắn `source: 'CURATED'`,
  `isApproved: true`, không userId/bookingId.

- [ ] **Step 1:** Viết reviews theo spec §4: 2–5 review/tour cho 24 tour;
  **6 tour 0-review CỐ Ý** — chọn và GHI RÕ trong comment đầu file (đề xuất:
  #3 craft villages, #10 Mai Châu, #18 Mỹ Sơn, #20 Quy Nhơn, #26 Bến Tre,
  #30 Côn Đảo — các tour mới/ngách, hợp lý khi chưa có review). Rating đa số
  4–5, rải vài 3 kèm lời chê hợp lý; tác giả đa quốc tịch; `createdAt` quá
  khứ (2026-01 → 2026-07). Riêng 3 review của Vũng Tàu khớp spec §5.
- [ ] **Step 2:** Seed bước 6 mới trong `main()` của seed.ts (sau bước posts):

```ts
  // 6. Reviews CURATED cho tour (spec 2026-07-31-tours-catalogue §4) — row
  //    curated không cần booking/user (FK nullable có chủ đích trong schema).
  //    Idempotent nhờ id tĩnh + skipDuplicates.
  const { count: reviewCount } = await prisma.review.createMany({
    data: catalog.tourReviews.map((review) => ({
      ...review,
      createdAt: new Date(review.createdAt),
      source: ReviewSource.CURATED,
      isApproved: true,
    })),
    skipDuplicates: true,
  });
  console.log(`[seed] tour reviews: +${reviewCount}`);

  // 6b. Recompute ratingAvg/ratingCount — CÙNG CÔNG THỨC với
  //     ReviewsService.moderate ③ (đọc hàm đó và làm y hệt cách làm tròn;
  //     rating phải đại diện đúng các review approved).
  //     Chạy cho MỌI tour (kể cả 0 review → ratingAvg null, ratingCount 0).
```

  Import `ReviewSource` từ enums. Trước khi viết 6b, MỞ
  `apps/api/src/modules/reviews/reviews.service.ts` (quanh dòng 158) xem đúng
  aggregate + làm tròn rồi sao lại trong seed (raw groupBy + update từng tour
  là đủ; ~30 update một lần seed, không cần tối ưu).
- [ ] **Step 3:** Cập nhật header comment seed.ts (thêm mục reviews).
  Typecheck xanh. Commit `feat(api): seed reviews CURATED + recompute rating`

---

### Task 6: Reset DB + seed + đo API (nửa A khép)

- [ ] **Step 1:** DB là Docker CỤC BỘ (không phải môi trường ai khác dùng
  chung — xác nhận `docker ps` + DATABASE_URL localhost trước khi reset; nếu
  DATABASE_URL KHÔNG phải localhost thì DỪNG, báo BLOCKED):
  `pnpm --filter @tourism/api exec prisma migrate reset --force --skip-seed`
  rồi `pnpm --filter @tourism/api db:seed` **hai lần** — lần 2 không nhân bản
  (log +0 mọi bảng catalog).
- [ ] **Step 2:** Bật API, đo và DÁN NGUYÊN VĂN vào report:

```bash
curl -s http://localhost:3001/api/tours | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['total'])"        # 30
curl -s http://localhost:3001/api/tours/vung-tau-coastal-2d | grep -c '07:30'                                            # >=1
curl -s "http://localhost:3001/api/tours/vung-tau-coastal-2d/reviews" | head -c 400                                      # 3 review CURATED
curl -s http://localhost:3001/api/tours | grep -o '"ratingAvg":null' | wc -l                                             # 6
curl -s http://localhost:3001/api/destinations | grep -c '"slug"'                                                        # 19
```

  Kiểm thêm booking overlay: log seed có `PAID booking BK-SEEDPAID` gắn vào
  một tour mới (pickPaidDeparture tự chọn).
- [ ] **Step 3:** `pnpm turbo run build typecheck test --filter=@tourism/api`
  + `pnpm exec biome check .` + **`pnpm test:int`** (chạy được ở máy này) →
  tất cả xanh. Kill API, cổng sạch. Commit (nếu có sửa lặt vặt phát sinh)
  `fix(api): chỉnh sau đo seed catalogue` — không có gì thì bỏ qua.

---

### Task 7: Web — `lib/api/tours.ts` + mở rộng tags

**Files:**
- Modify: `apps/web/src/lib/api/tags.ts` (+`tags.spec.ts`)
- Create: `apps/web/src/lib/api/tours.ts` + `tours.spec.ts`
- Modify: `apps/web/src/lib/tours.ts` (đổi type import) + các file
  `components/tours/*.tsx` đổi type import (CHỈ type, không logic — như vết
  Task 5 cụm Blog)

**Interfaces:**
- Produces (mock đã gương contract nên VM = type contract, KHÔNG map field):

```ts
// tags.ts thêm:
export const TAGS = { POSTS: 'posts', TOURS: 'tours' } as const;
export function tourTag(slug: string): string { return `tour:${slug}`; }

// tours.ts:
import type { ContractOutputs } from '@tourism/contract'; // nếu contract export sẵn helper type — KIỂM libs/shared/contract/src/index.ts; không có thì z.output<typeof TourCardSchema>
export type TourCardVM = /* z.output TourCardSchema */;
export type TourDetailVM = /* z.output TourDetailSchema */;
export type TourReviewVM = /* z.output PublicReviewSchema */;
export async function fetchTours(): Promise<TourCardVM[]>;            // list pageSize 50, tag TAGS.TOURS, revalidate 300
export async function fetchDestinationsFacet(): Promise<...>;          // catalog.destinations.list, tag TAGS.TOURS (facet đi cùng vòng đời tours)
export const fetchTourDetail: (slug: string) => Promise<TourDetailVM | null>; // cache(), null CHỈ khi NOT_FOUND
export async function fetchTourReviews(slug: string, page: number): Promise<Paged<TourReviewVM>>; // tag tourTag(slug)
```

- [ ] **Step 1 (TDD):** test tags mới (`tourTag('x') === 'tour:x'`,
  `TAGS.TOURS === 'tours'`) — đỏ → xanh. `tours.spec.ts`: vì KHÔNG có mapper
  (VM = contract type), test thuần chỉ còn những helper nào tours.ts tự thêm;
  nếu không thêm helper nào thì spec chỉ smoke-test type export compile —
  ghi rõ trong report thay vì bịa test rỗng.
- [ ] **Step 2:** Viết `tours.ts` theo interface trên, đúng vết `posts.ts`
  (context `{next: {revalidate, tags}}`, `safe()` + `isDefinedError` cho
  NOT_FOUND của `catalog.tours.bySlug` — code lỗi là `NOT_FOUND`, xem
  contract.ts:101).
- [ ] **Step 3:** Đổi type import: `lib/tours.ts` các generic
  `<T extends MockTourCard>` → `<T extends TourCardVM>` (structural — mock
  cùng shape nên `/destinations`/`/about`/Home dùng mock VẪN compile);
  components/tours đổi `MockTourCard/MockTourDetail/MockReview` →
  `TourCardVM/TourDetailVM/TourReviewVM` (types-only; `MockMediaItem` cho
  gallery GIỮ — media vẫn mock/placeholder). Đỏ phát sinh ở page listing/
  detail là lãnh thổ Task 8–9, khai báo inventory trong report.
- [ ] **Step 4:** Test node + dom hiện có chạy lại; typecheck: đỏ còn lại ⊆
  {2 page tours, sitemap nếu đụng}. Commit
  `feat(web): lib/api/tours + tag TOURS — VM la type contract`

---

### Task 8: `/tours` listing đổi nguồn

**Files:** Modify: `apps/web/src/app/(site)/tours/(listing)/page.tsx` ·
`components/tours/tours-explorer.tsx` (props type nếu cần) · spec liên quan

- [ ] **Step 1:** Page: `export const revalidate = 300;`;
  `Promise.all([settle(fetchTours()), settle(fetchDestinationsFacet())])`;
  tours fail → `<LoadErrorState />` (tri-state, cấm empty-state khi lỗi);
  facet destinations fail nhưng tours sống → explorer với `destinations=[]`.
  BỎ import `TOURS`/`DESTINATIONS` mock khỏi page. Filter/sort/search/URL-sync
  client-side GIỮ NGUYÊN hành vi (nợ server-side pagination như blog).
- [ ] **Step 2:** Facet destination options giờ từ API (19 slug mới) — kiểm
  `facetOptionCounts` vẫn đếm đúng trên tập tour thật; cập nhật spec explorer
  theo fixture VM shape (thêm case: chọn destination `vung-tau` lọc ra #22).
- [ ] **Step 3:** Đo dev (API sống): `/tours` hiện 30; filter category/
  destination/duration/price; search "vung tau" fold dấu ra #22. Test + 
  typecheck (đỏ còn lại chỉ detail). Commit
  `feat(web): /tours doc tu API — 30 tour that + facet destinations tu API`

---

### Task 9: `/tours/[slug]` detail đổi nguồn

**Files:** Modify: `apps/web/src/app/(site)/tours/[slug]/page.tsx` ·
`components/tours/tour-reviews.tsx` (nguồn reviews) · `tour-gallery.tsx`
(đường degrade media rỗng) · specs liên quan

- [ ] **Step 1:** `generateStaticParams` = `(await fetchTours()).map(...)` —
  KHÔNG settle (build fail to, comment như blog); metadata + body cùng
  `fetchTourDetail(slug)` (cache()); null → `notFound()`.
- [ ] **Step 2:** Departure board: dữ liệu `detail.departures` THẬT (mock cùng
  shape nên 3 nơi đồng bộ giữ nguyên logic). Itinerary: `ItineraryTimeline`
  render description text thuần — mốc giờ cần XUỐNG DÒNG: kiểm component, nếu
  đang render 1 khối text thì thêm `whitespace-pre-line` (giữ `\n`) — đổi
  hiển thị tối thiểu, KHÔNG parse.
- [ ] **Step 3:** Reviews: `TourReviews` nhận từ `fetchTourReviews(slug, 1)`;
  tour 0-review hiện đúng trạng thái "chưa có đánh giá" (ratingAvg null ≠ 0 —
  mock types đã dặn). Gallery: media contract CHƯA có → truyền `[]`,
  `tourGallery([])`/component render dàn `ImagePlaceholder` mặc định — kiểm
  hành vi thật của component, sửa degrade nếu nó giả định luôn có media.
  `mocks/tour-reviews.ts` + `mocks/tour-media.ts`: xoá nếu hết consumer
  (grep xác nhận), types tương ứng xoá theo.
- [ ] **Step 4:** Test + typecheck 0 đỏ toàn repo. KHÔNG loading.tsx
  (`find apps/web/src/app -name loading.tsx` → chỉ còn `(listing)` cũ).
  Commit `feat(web): /tours/[slug] doc tu API — departures/reviews that, gallery degrade`

---

### Task 10: sitemap tours đổi nguồn + nghiệm thu toàn cụm

**Files:** Modify: `apps/web/src/app/sitemap.ts` · `apps/web/src/lib/sitemap.ts`
(+spec) — mục tours nhận `Pick<TourCardVM,'slug'>[]` từ `settle(fetchTours())`
(fail → `[]`, cùng lý lẽ posts); regions/`/destinations` GIỮ mock.

- [ ] **Step 1:** Đổi nguồn + cập nhật `sitemap.spec.ts` (tổng URL đổi:
  38 − 16 tour mock + 30 tour thật = **52** — sửa bất biến tổng, giữ mọi bất
  biến khác; TDD: sửa expect trước, đỏ, sửa code).
- [ ] **Step 2:** Nghiệm thu spec §8 trên PRODUCTION build (API sống, cổng
  3000 trống): 6 mục — dán output nguyên văn: (1) seed idempotent + `/api/tours`
  30 + itinerary `HH:MM` + 6 null-rating; (2) `/tours` 30 tour, filter/search
  sống, tri-state tắt-API; (3) slug lạ 404 thật + 3 slug thật 200 + departures
  tương lai + reviews CURATED + tour 0-review; (4) `sitemap.xml` 52 URL không
  còn slug mock; (5) `pnpm gate` 18/18 + `pnpm test:int`; (6) ghi nhận lệch
  tạm mock ở `/destinations`/`/about`/Home (chụp bằng chứng 1 câu mỗi trang).
- [ ] **Step 3:** Kill mọi tiến trình tự mở, "cổng sạch". Commit cuối. DỪNG —
  user review + quyết merge (docs sweep luật 13 làm sau merge: CHANGELOG nhớ
  luật dấu `+`, cập nhật README các dòng spec/plan/P3b, và cập nhật hàng nợ
  spec Tours cũ §8 nếu mục nào được cụm này chạm).
