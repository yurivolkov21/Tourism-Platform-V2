# Plan — Bước 4: cụm Destinations lên API + xoá lớp lệch mock nhìn-thấy-được

> **For agentic workers:** REQUIRED SUB-SKILL: dùng
> `superpowers:subagent-driven-development` (khuyến nghị) hoặc
> `superpowers:executing-plans`. Step dùng checkbox (`- [ ]`).

**Goal:** Sau branch này không còn chỗ nào trên site kể chuyện catalogue bằng
mock: `/destinations` + 3 trang vùng + Home + `/about` + navbar đọc API;
`mocks/tours.ts`/`mocks/destinations.ts` chết hẳn; moments hết link chết —
theo [spec](../specs/2026-07-31-destinations-api-design.md) (đã duyệt, 6 bề mặt
A–F) và [ADR-0016](../adr/0016-web-data-layer.md).

**Architecture:** Không quyết định mới — áp khuôn `lib/api` cùng settle/tri-state
và ISR 300 với `TAGS.TOURS` của 2 cụm trước. `lib/regions.ts` giữ nguyên LOGIC
(chỉ đổi generic type Mock→VM); reviews vùng compose từ `fetchTourReviews`
per-tour (mock đã gương đúng ranh giới `reviewsByTour` qua tham số).

**Tech Stack:** như cụm Tours. Không dep mới.

## Global Constraints (áp cho MỌI task)

- **Branch `feat/destinations-api`** từ `main`. Conventional Commits, KHÔNG AI
  attribution — ⚠️ SAU MỖI COMMIT: `git log -1 --format='%B'`, có
  `Co-Authored-By` thì `git commit --amend` gỡ ngay.
- Comment code + JSDoc tiếng Việt; identifier tiếng Anh; copy user-facing vào
  `@tourism/i18n`; tokens-only.
- **KHÔNG đổi layout/motion/markup** các trang đã duyệt — mọi diff component là
  types + nguồn data + props thuần. Trang vùng từng qua 4–6 vòng dựng lại;
  Home là trang duyệt kỹ nhất.
- KHÔNG `loading.tsx` mới; KHÔNG đụng migrations; KHÔNG parse text.
- TDD logic thuần (skill `superpowers:test-driven-development`); jsdom
  ADR-0014; đỏ type-only lấy `tsc` làm tín hiệu RED (tiền lệ 2 cụm).
- Cổng: 3000 trống trước build/dev (curl `000`); API 3001; kill đúng PID
  (`ss -ltnp`), KHÔNG `pkill -f`; container Postgres để nguyên.
- Mock KHÔNG-endpoint giữ nguyên trừ được nói tường minh: `regions.ts` (khung 3
  miền), `faq`, `testimonials`, `moments` (chỉ sửa 3 tourSlug), `team`,
  `offices`, `auth`.

---

### Task 1: `lib/api` bổ trợ + `lib/regions.ts` sang VM

**Files:**
- Modify: `apps/web/src/lib/api/tours.ts` · `apps/web/src/lib/regions.ts` +
  `regions.spec.ts` · call sites của `fetchDestinationsFacet`
  (`app/(site)/tours/(listing)/page.tsx`)

**Interfaces:**
- Produces: `fetchDestinations()` (rename từ `fetchDestinationsFacet` — giờ nuôi
  cả cụm; đổi mọi call site, không giữ alias) · `lib/regions.ts` mọi generic
  `MockTourCard`/`MockDestination`/`MockReview` → `TourCardVM`/`DestinationVM`/
  `TourReviewVM` (import type từ `lib/api/tours`), `MockRegion`/`MockRegionKey`
  GIỮ (regions là mock sống). `RegionReview.review` sang `TourReviewVM`.

- [ ] **Step 1 (TDD):** `regions.spec.ts` — cập nhật fixture theo VM (thêm field
  VM đòi mà fixture thiếu; `TourReviewVM` không có field nào mock thiếu — kiểm
  bằng tsc). RED qua `tsc --noEmit` sau khi đổi type ở lib (tiền lệ cụm Blog
  T9). Mọi bất biến spec hiện có GIỮ NGUYÊN (một-định-nghĩa-hai-chỗ-dùng,
  không-địa-điểm-tàng-hình, distinct xuyên vùng…).
- [ ] **Step 2:** Đổi generic types trong `lib/regions.ts` (KHÔNG đổi logic —
  diff phải là type-only từng hàm); rename `fetchDestinationsFacet` →
  `fetchDestinations` + cập nhật call site listing.
- [ ] **Step 3:** `pnpm --filter @tourism/web test` + `typecheck` — đỏ còn lại
  phải ⊆ lãnh thổ Task 2–6 (2 trang destinations, home, about, header) — khai
  báo inventory trong report.
- [ ] **Step 4:** Commit `refactor(web): lib/regions sang VM + fetchDestinations`

---

### Task 2: `/destinations` đổi nguồn

**Files:**
- Modify: `apps/web/src/app/(site)/destinations/page.tsx` ·
  `components/destinations/region-group.tsx` (types nếu cần) + spec liên quan

- [ ] **Step 1:** Page thành async + `export const revalidate = 300;`;
  `Promise.all([settle(fetchTours()), settle(fetchDestinations())])`; MỘT trong
  hai fail → thay TOÀN khu 2 (3 RegionGroup) bằng `<LoadErrorState />` (giữ
  hero + các khu mock 3–5 nguyên vẹn — chúng không phụ thuộc API); cả hai sống
  → `destinationsInRegion`/`toursInRegion` với data thật. Import `DESTINATIONS`
  + `TOURS` mock XOÁ khỏi page; `MOMENTS`/`TESTIMONIALS`/`FAQ_ITEMS`/`REGIONS`
  GIỮ.
- [ ] **Step 2:** Spec component cập nhật theo VM fixture; đo dev (API sống):
  3 nhóm vùng hiện destinations thật (Bắc 7 · Trung 5 · Nam 7) + tourCount
  thật (12/9/9 — tour xuyên vùng #12 đếm ở cả ba theo `toursInRegion` some());
  tắt API → LoadErrorState ở khu 2, khu khác vẫn hiện.
- [ ] **Step 3:** Test + typecheck (đỏ còn lại ⊆ Task 3–6). Commit
  `feat(web): /destinations doc tu API — 19 diem den that`

---

### Task 3: `/destinations/[region]` ×3 đổi nguồn

**Files:**
- Modify: `apps/web/src/app/(site)/destinations/[region]/page.tsx` (324 dòng —
  đọc trọn trước khi sửa) + spec các component vùng bị đổi type

- [ ] **Step 1:** `revalidate = 300`; `generateStaticParams` GIỮ từ `REGIONS`
  (3 vùng cố định — không đổi); data: `settle(fetchTours())` +
  `settle(fetchDestinations())`; **reviews vùng**: compose `reviewsByTour` từ
  `fetchTourReviews(slug)` cho các tour thuộc vùng (qua `toursInRegion` trước,
  rồi `Promise.all` các settle — fetch từng tour đã có tag `tourTag(slug)` và
  cache riêng; tour fail/0-review chỉ đơn giản không góp — đúng ngữ nghĩa
  `reviewsInRegion` hiện tại). Page fail tours/destinations → `LoadErrorState`
  thay các khu data (giữ hero + khu i18n theo khuôn Task 2).
- [ ] **Step 2:** Mọi derivation giữ nguyên qua lib/regions (đã VM từ Task 1):
  `ownToursInRegion`, `longestTourInRegion`, `regionGlance`, `reviewsInRegion`.
  KHÔNG đổi markup/motion component vùng — chỉ types/props.
- [ ] **Step 3:** Đo dev: 3 trang vùng hiện tour thật; khu reviews hiện review
  CURATED thật kèm ghi công `on <tour>`; vùng nào tour xuyên vùng (#12) xuất
  hiện phải có ở CẢ BA trang (bất biến cũ). Test + typecheck. Commit
  `feat(web): trang vung doc tu API — tours/reviews that theo mien`

---

### Task 4: Home + moments slug + mocks.spec đổi nguồn canh

**Files:**
- Modify: `apps/web/src/app/(site)/page.tsx` (diff TỐI THIỂU — tiền lệ 11 dòng
  cụm Blog) · `components/home/gallery.tsx` (+spec) · `mocks/moments.ts` ·
  `mocks/mocks.spec.ts`

- [ ] **Step 1:** Đọc `gallery.tsx` + `stats-slider.tsx` xác định chính xác
  field mock nào đang dùng (`dest.tourCount`…). Home page fetch
  `settle(fetchDestinations())` (+`fetchTours()` CHỈ nếu gallery cần đếm mà
  DestinationVM.tourCount chưa đủ — contract có `tourCount` thật, nhiều khả
  năng KHÔNG cần) → truyền props như teaser Journal; fail → khu gallery hiện
  `LoadErrorState` compact trong section (khuôn Journal).
- [ ] **Step 2:** `mocks/moments.ts` — sửa 3 `tourSlug` chết theo bảng spec §1F
  (cruise → `halong-bay-overnight-cruise` · Sa Pa trek →
  `sapa-terraces-homestay-2d` · Mekong → `mekong-can-tho-2d`); 2 slug còn lại
  (`hoi-an-lantern-evening`, `hue-imperial-day`) đã sống — kiểm lại.
  `mocks.spec.ts`: test canh "tourSlug tồn tại" đổi nguồn từ `TOURS` mock sang
  **danh sách slug roster tĩnh khai trong spec** (comment ghi nguồn
  `apps/api/prisma/fixtures/catalog/`, sync tay khi roster đổi). TDD: đổi test
  trước với slug cũ → ĐỎ → sửa mock → XANH.
- [ ] **Step 3:** Đo dev: Home tiles hiện tourCount thật; moments trên
  `/destinations` click được cả 5 (curl 200 từng slug). Test + typecheck.
  Commit `feat(web): Home tiles doc tu API + moments het link chet`

---

### Task 5: `/about` đổi nguồn số đếm

**Files:**
- Modify: `apps/web/src/app/(site)/about/page.tsx` ·
  `components/about/about-numbers.tsx` · `about-gallery.tsx` (+spec)

- [ ] **Step 1:** Đọc 2 component xác định chúng lấy gì từ `TOURS`/`DESTINATIONS`
  (about-numbers: tổng tour; about-gallery: nguồn ảnh/nhãn?). Page fetch
  settle → props; fail → số đếm rơi về khu ẩn/hoặc LoadErrorState compact
  (chọn theo cấu trúc thật của section, ghi lý do — CẤM số bịa hardcode).
  `revalidate = 300` + comment SSG→ISR có chủ đích.
- [ ] **Step 2:** Đo dev: `/about` hiện "30" (hoặc đúng số API trả); test +
  typecheck. Commit `feat(web): /about so dem tu API`

---

### Task 6: Navbar destinations-menu đổi nguồn (bán kính rộng nhất)

**Files:**
- Modify: `apps/web/src/components/site-header.tsx` ·
  `components/destinations-menu.tsx` (+specs: `navigation-menu.spec.ts`,
  `user-menu.spec.tsx` nếu đụng)

- [ ] **Step 1:** Đọc `site-header.tsx` — nó server hay client? Nếu client thì
  fetch phải nâng lên layout/server-wrapper truyền props (KHÔNG fetch trong
  client). `settle(fetchDestinations())` → menu nhận `DestinationVM[]`; fail →
  menu degrade: giữ trigger "Destinations" trỏ `/destinations` nhưng dropdown
  rơi về danh sách rỗng/ẩn im lặng (KHÔNG panel lỗi trong navbar — spec §2).
- [ ] **Step 2:** ⚠️ Hệ quả bán kính rộng: layout mang fetch → MỌI route ISR.
  Đo trên PRODUCTION build (API sống): `curl` status + so nội dung (diff HTML
  chính) TRƯỚC/SAU cho đại diện: `/terms` (legal) · `/login` (auth) · `/404`
  slug lạ tour vẫn 404 thật. Nếu trang nào đổi status/nội dung có hệ quả thật
  → DỪNG, report BLOCKED cho controller (điều khoản spec §5).
- [ ] **Step 3:** Menu hiện 19 điểm đến (nhóm theo vùng nếu markup hiện tại đã
  nhóm — giữ nguyên cấu trúc); link `/tours?destinations=<slug>` lọc đúng (đo
  1 slug mới vd `vung-tau`). Test + typecheck. Commit
  `feat(web): navbar destinations tu API — 19 diem den`

---

### Task 7: Khai tử mock + nghiệm thu "0 link chết toàn site"

**Files:**
- Delete: `apps/web/src/mocks/tours.ts` · `apps/web/src/mocks/destinations.ts`
- Modify: `apps/web/src/mocks/types.ts` (xoá `MockTourCard`/`MockTourDetail`/
  `MockTourDeparture`/`MockItineraryDay`/`MockMediaItem`/`MockReview`/
  `MockDestination`/`MockDestinationLink`… — CHỈ type hết consumer; kiểm từng
  cái bằng grep) · 3 component detail còn `import type` từ mocks (rehome sang
  VM — `departure-selection.tsx`, `booking-rail.tsx`, `itinerary-timeline.tsx`)
  · `tour-reviews.tsx` (JSDoc còn nhắc mocks/tours — cập nhật lời) ·
  `mocks.spec.ts` cắt case tours/destinations

- [ ] **Step 1:** Rehome types + xoá file + cắt spec. Grep PHẢI RỖNG:
  `grep -rn "mocks/tours\|mocks/destinations\|MockTourCard\|MockTourDetail\|MockDestination\b" apps/web/src`
  (fixture spec tự chứa được phép — liệt kê nếu có).
- [ ] **Step 2:** Typecheck 0 đỏ toàn repo; `pnpm --filter @tourism/web test`
  0 fail.
- [ ] **Step 3: Nghiệm thu spec §4 trên PRODUCTION build** (API sống, cổng
  3000 trống): 
  1. **0 link tour chết:** script trích MỌI `href="/tours/<slug>"` từ HTML của
     `/`, `/destinations`, 3 trang vùng, `/about` (curl + grep -o) → curl từng
     URL, TẤT CẢ 200 — bảng nguyên văn vào report.
  2. 3 trang vùng: số card khớp phân bố (Bắc 12 · Trung 9 · Nam 9, tour #12 ở
     cả ba); số đếm mọi nơi "30".
  3. Navbar 19 điểm; `/tours?destinations=vung-tau` lọc đúng.
  4. Trang legal/auth 200 + nội dung y nguyên (đã đo T6 — cite).
  5. `pnpm gate` 18/18 + `pnpm test:int` 17/17.
- [ ] **Step 4:** Kill mọi tiến trình tự mở, "cổng sạch". Commit
  `refactor(web): khai tu mocks/tours va mocks/destinations — catalogue thuan API`
  — rồi DỪNG: user review + quyết merge (docs sweep luật 13 sau merge; CHANGELOG
  nhớ luật dấu `+`; cập nhật hàng nợ "3 import type" + "14/16 link chết" thành
  ĐÃ ĐÓNG).
