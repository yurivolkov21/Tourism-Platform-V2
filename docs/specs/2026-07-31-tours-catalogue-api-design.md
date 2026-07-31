# Spec — Catalogue thật: seed lại ~30 tour + nối `/tours` và `/tours/[slug]` (2026-07-31)

- **Trạng thái:** Approved 31/07 — user duyệt trọn spec kể cả §2 gộp detail (thiết kế tổng duyệt cùng ngày: itinerary =
  text kỷ luật có mốc giờ · thay trọn bộ 23 tour cũ · seed reviews CURATED ·
  gộp seed + wiring một branch. **Điểm MỚI so với duyệt miệng: nửa B gộp cả
  trang detail — xem §2 lý do bắt buộc**)
- **Nền:** [ADR-0016](../adr/0016-web-data-layer.md) (tầng dữ liệu — đã hiện
  thực ở cụm Blog, dùng lại nguyên khuôn) · [thứ tự nối API 10 bước]
  (../analysis/2026-07-30-docs-audit-progress.md) — spec này phủ **bước 2 + 3**.
- **Branch:** `feat/tours-catalogue-api`.

## 1. Vì sao làm lại seed (quyết định user 31/07)

Seed cũ 23 tour là port cơ học từ Nexora: nội dung mỏng, itinerary 1–2 câu/ngày,
không mốc thời gian. User chốt: catalogue phải **như tour thật** — ví dụ chuẩn:
tour Vũng Tàu 2N1Đ phải có mốc giờ từng hoạt động trong ngày (sáng/trưa/chiều/
tối). Số lượng ~30, phân bổ địa điểm giao cho agent đề xuất (§3).

Ba quyết định đã chốt kèm lý do:

1. **Mốc giờ nằm TRONG `TourItineraryDay.description`** (text thuần ≤2000/ngày,
   mỗi dòng `HH:MM — hoạt động`) — không migration, không đổi contract, web
   render text thuần sẵn. Luật cứng đi kèm: **không bao giờ parse ngược** text
   này thành dữ liệu (đúng bẫy regex `tour-detail-derive.ts` của Nexora đã
   được quyết định không port).
2. **Thay trọn bộ:** fixtures 23 tour cũ xoá khỏi repo; DB dev (Postgres Docker
   cục bộ) reset bằng `prisma migrate reset` (replay migrations — KHÔNG sửa
   migration nào) rồi seed sạch. `BK-SEEDPAID` tự gắn vào tour mới đủ điều kiện
   (logic `pickPaidDeparture` sẵn có).
3. **Seed reviews CURATED** — model `Review` cho phép row CURATED không cần
   booking/user (FK nullable có chủ đích, comment ngay trong schema).

## 2. Phạm vi — một branch, hai nửa; vì sao detail BẮT BUỘC đi cùng

**Nửa A — seed catalogue mới (API, zero thay đổi schema/contract).**
**Nửa B — nối `/tours` + `/tours/[slug]` + `reviews.listByTour` (bước 2 + 3).**

Gộp detail không phải phình phạm vi tuỳ hứng: nối riêng listing thì mọi card
trỏ `/tours/<slug-mới>` trong khi detail còn prerender từ 16 slug mock →
**toàn bộ card là link 404**. Cụm Blog không gặp vì listing + detail đổi nguồn
cùng lúc. Trang **KHÔNG** đổi nguồn ở branch này: `/destinations` (+ trang
vùng), teaser/featured trên Home, số đếm tour ở `/about` — chúng vẫn đọc
`mocks/tours.ts` (bước 4 trở đi), tạo **lệch tạm có chủ đích**: các trang đó kể
chuyện 16 tour mock trong khi `/tours` hiện ~30 tour thật. Ghi nhận, không vá
trong branch này (luật mock-chết-theo-trang của ADR-0016).

## 3. Roster ~30 tour (Bắc 12 · Trung 9 · Nam 9)

Nguyên tắc phân bổ: phủ đủ 5 category active hiện có (`day` · `package` ·
`cruise` · `trekking` · `honeymoon`); trộn day-trip / 2N1Đ / 3-5 ngày / một
grand tour; miền Nam được bồi đắp (trước mỏng nhất) với Vũng Tàu, Cần Thơ,
Bến Tre, Đà Lạt, Côn Đảo. Title tiếng Anh, danh từ riêng giữ dấu (nếp seed
hiện tại: "Hội An Ancient Town Walking Tour"). Giá USD string.

| # | Slug | Title | Điểm đến (primary đầu) | Ngày | Cat | Giá |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `hanoi-old-quarter-food-night` | Hanoi Old Quarter Street Food by Night | Hà Nội | 1 | day | 35 |
| 2 | `hanoi-heritage-day` | Hanoi Heritage in a Day | Hà Nội | 1 | day | 49 |
| 3 | `red-river-craft-villages-day` | Bát Tràng & Red River Craft Villages | Hà Nội | 1 | day | 45 |
| 4 | `ninh-binh-trang-an-day` | Ninh Bình: Tràng An, Múa Cave & Rice Fields | Ninh Bình | 1 | day | 59 |
| 5 | `halong-bay-overnight-cruise` | Hạ Long Bay Overnight Cruise 2D1N | Hạ Long | 2 | cruise | 185 |
| 6 | `lan-ha-kayak-cruise-3d` | Lan Hạ Bay & Cát Bà Kayak Cruise 3D2N | Cát Bà, Hạ Long | 3 | cruise | 289 |
| 7 | `sapa-terraces-homestay-2d` | Sa Pa Terraces & Homestay Trek 2D1N | Sa Pa | 2 | trekking | 119 |
| 8 | `sapa-fansipan-summit-3d` | Sa Pa Villages & Fansipan Summit 3D2N | Sa Pa | 3 | trekking | 199 |
| 9 | `ha-giang-loop-4d` | Hà Giang Loop by Easyrider 4D3N | Hà Giang | 4 | trekking | 329 |
| 10 | `mai-chau-cycling-2d` | Mai Châu Valley Cycling & Stilt House 2D1N | Mai Châu | 2 | trekking | 99 |
| 11 | `northern-highlights-5d` | Northern Highlights: Hanoi–Hạ Long–Ninh Bình 5D4N | Hà Nội, Hạ Long, Ninh Bình | 5 | package | 549 |
| 12 | `vietnam-grand-journey-12d` | Vietnam Grand Journey: North to South 12D11N | Hà Nội, Hạ Long, Ninh Bình, Huế, Hội An, TP. Hồ Chí Minh, Cần Thơ | 12 | package | 1890 |
| 13 | `hue-imperial-day` | Huế Imperial City & Royal Tombs | Huế | 1 | day | 55 |
| 14 | `phong-nha-paradise-cave-day` | Phong Nha & Paradise Cave Day Trip | Phong Nha | 1 | day | 65 |
| 15 | `hoi-an-lantern-evening` | Hội An Old Town & Lantern Evening | Hội An | 1 | day | 39 |
| 16 | `hoi-an-countryside-cooking-day` | Hội An Countryside, Basket Boat & Cooking | Hội An | 1 | day | 52 |
| 17 | `bana-hills-golden-bridge-day` | Bà Nà Hills & Golden Bridge Day Trip | Đà Nẵng | 1 | day | 79 |
| 18 | `my-son-sunrise-halfday` | Mỹ Sơn Sanctuary at Sunrise | Hội An | 1 | day | 36 |
| 19 | `central-heritage-4d` | Central Heritage: Đà Nẵng–Hội An–Huế 4D3N | Đà Nẵng, Hội An, Huế | 4 | package | 459 |
| 20 | `quy-nhon-coastal-3d` | Quy Nhơn Coastal Escape 3D2N | Quy Nhơn | 3 | package | 269 |
| 21 | `central-honeymoon-5d` | Central Vietnam Honeymoon 5D4N | Hội An, Huế, Đà Nẵng | 5 | honeymoon | 699 |
| 22 | `vung-tau-coastal-2d` | Vũng Tàu Coastal Escape 2D1N | Vũng Tàu | 2 | package | 129 |
| 23 | `saigon-cu-chi-day` | Sài Gòn City & Củ Chi Tunnels | TP. Hồ Chí Minh | 1 | day | 49 |
| 24 | `saigon-after-dark-vespa` | Sài Gòn After Dark by Vespa | TP. Hồ Chí Minh | 1 | day | 65 |
| 25 | `mekong-can-tho-2d` | Mekong Delta & Cái Răng Floating Market 2D1N | Cần Thơ | 2 | package | 139 |
| 26 | `ben-tre-coconut-day` | Bến Tre Coconut Country Day Trip | Bến Tre | 1 | day | 45 |
| 27 | `da-lat-highlands-3d` | Đà Lạt Highlands, Waterfalls & Farms 3D2N | Đà Lạt | 3 | trekking | 219 |
| 28 | `phu-quoc-island-hopping-day` | Phú Quốc 4-Island Hopping & Snorkelling | Phú Quốc | 1 | day | 59 |
| 29 | `phu-quoc-honeymoon-4d` | Phú Quốc Honeymoon Hideaway 4D3N | Phú Quốc | 4 | honeymoon | 579 |
| 30 | `con-dao-history-nature-3d` | Côn Đảo History & Nature 3D2N | Côn Đảo | 3 | package | 389 |

Destinations đi kèm (bảng mới thay trọn bảng cũ, `region` là MỘT trong ba chuỗi
chuẩn `Northern/Central/Southern Vietnam` — khớp `regionOf()` của web): Hà Nội,
Hạ Long, Cát Bà, Sa Pa, Ninh Bình, Hà Giang, Mai Châu (Bắc) · Huế, Hội An,
Đà Nẵng, Phong Nha, Quy Nhơn (Trung) · TP. Hồ Chí Minh, Vũng Tàu, Cần Thơ,
Bến Tre, Đà Lạt, Phú Quốc, Côn Đảo (Nam). Mỗi destination: description 1–2 câu
biên tập. (Đà Lạt xếp Nam theo nếp phân miền 3 vùng của site — Tây Nguyên không
có vùng riêng.)

## 4. Chuẩn nội dung từng tour (bắt buộc, reviewer đối chiếu theo chuẩn này)

- **`summary`** ≤200 ký tự, cụ thể (địa danh/trải nghiệm thật, không sáo rỗng).
- **`itinerary`** — trái tim của đợt này. Mỗi ngày: `title` ngắn có hồn
  ("Day 1 — Sand dunes, seafood and the Lighthouse") + `description` gồm
  **4–8 dòng, mỗi dòng `HH:MM — nội dung`** (24h, tăng dần), phủ tối thiểu
  sáng/trưa/chiều và thêm tối nếu tour có hoạt động tối; mỗi dòng nêu địa danh
  hoặc món ăn CÓ THẬT; ngăn dòng bằng `\n`; ≤2000 ký tự/ngày. Day-trip (1 ngày)
  vẫn có itinerary 1 day đủ mốc giờ.
- **`highlights`** 4–6 gạch; **`included`/`excluded`** 4–7 và 2–4 mục;
  **`meetingPoint`** địa chỉ thật kiểu "78 Lê Lợi street".
- **`faqs`** 3–5 câu/tour, trả lời thật (thời tiết, mang gì, trẻ em, huỷ đổi).
- **`policies`** đủ 3 kind (`CANCELLATION`/`BOOKING`/`GENERAL`), nội dung khớp
  độ dài/giá tour.
- **`departures`** 3–6 đợt/tour, `startDate` **TĨNH và ở TƯƠNG LAI**, trải từ
  2026-08 đến 2027-01 (qua ngày bảo vệ ~11/2026; contract chỉ trả đợt OPEN
  tương lai — ngược bài học ngày-quá-khứ của blog). Ngày tĩnh để seed
  idempotent; hết hạn dần sau 01/2027 là chấp nhận được cho capstone, ghi nợ
  "làm tươi departures" nếu cần sau bảo vệ. `seatsTotal` 8–20 tuỳ tour,
  `seatsBooked` lác đác >0 cho thật; 1–2 đợt `priceOverride`/`compareAtPrice`
  làm promo.
- **`suitableFor`/`badges`/`difficulty`/`maxGroupSize`** khớp bản chất tour
  (Vũng Tàu 2N1Đ: FAMILY+COUPLE, EASY; Hà Giang: CHALLENGING…). `isFeatured`
  6–8 tour trải đều 3 miền.
- **Reviews CURATED:** 2–5 review/tour cho ~24 tour; **6 tour cố ý 0 review**
  (test trạng thái `ratingAvg = null` ≠ 0). Rating phân bố thật (đa số 4–5, rải
  vài 3 kèm lời chê hợp lý); `authorName`/`authorLocation` đa dạng quốc tịch;
  `source: CURATED`, `isApproved: true`, `tourId` gắn thật, không booking/user;
  `createdAt` quá khứ. Sau insert: **recompute `ratingAvg`/`ratingCount`**
  trên bảng tours ngay trong seed (round half-up 1 chữ số thập phân — khớp
  cách `ReviewsService` denormalize).
- **IDs** UUID tĩnh theo nếp prefix hiện có (`b…` category, `c…` destination,
  `d…` tour…); copy toàn bộ tiếng Anh (luật 7), danh từ riêng giữ dấu.

## 5. Tour mẫu — #22 Vũng Tàu Coastal Escape 2D1N (chuẩn 100%, 29 tour theo khuôn này)

- **summary:** "Two easy days on the closest beach to Sài Gòn — seafood by the
  water, a dawn climb to the Lighthouse, and an afternoon you set the pace for."
- **category** `package` · 2 ngày · EASY · maxGroupSize 16 ·
  suitableFor FAMILY, COUPLE, FRIENDS · badges BEST_VALUE ·
  basePrice 129.00 / compareAtPrice 149.00 USD · isFeatured true.
- **destinations:** Vũng Tàu (primary), TP. Hồ Chí Minh.
- **meetingPoint:** "Pick-up at your hotel in District 1, Hồ Chí Minh City".
- **highlights:** Front Beach and Back Beach in one loop · Sunrise from the
  102-year-old Lighthouse · Seafood dinner at Gành Hào with the tide under your
  table · Cable ride up Hồ Mây if the sky is clear · Hydrofoil-speed return via
  the new expressway.
- **itinerary:**
  - *Day 1 — Beaches, banh khot and the night market:*
    `07:30 — Pick-up at your hotel in District 1, expressway drive (~2h)`
    `10:00 — Check in near Front Beach, welcome coconut`
    `10:30 — Swim or walk the Front Beach promenade`
    `12:00 — Lunch: bánh khọt Gốc Vú Sữa, the dish Vũng Tàu is famous for`
    `14:00 — Statue of Christ climb (847 steps) or free beach time — your call`
    `17:30 — Sunset coffee at Nghinh Phong cape`
    `19:00 — Seafood dinner at Gành Hào, table over the water`
    `21:00 — Night market stroll, salt-coffee nightcap`
  - *Day 2 — Lighthouse dawn and the slow road home:*
    `05:15 — Optional sunrise run: the 1910 Lighthouse (best light of the trip)`
    `07:30 — Breakfast bánh mì chảo at Cô Ba Vũng Tàu`
    `09:00 — Hồ Mây cable car and hilltop park, or Back Beach swim`
    `12:00 — Lunch and check-out`
    `13:30 — Long Hải coastal road detour with photo stops`
    `16:30 — Drop-off at your hotel in Sài Gòn`
- **included:** Private van from/to Sài Gòn · 1 night 3★ hotel near Front Beach
  (twin-share) · Breakfast day 2 · English-speaking guide · Lighthouse and Hồ
  Mây tickets · Bottled water. **excluded:** Lunches & dinner (guide books the
  tables, you pick the menu) · Single-room supplement $25 · Personal expenses.
- **faqs (4):** swim season/water quality theo mùa · có phù hợp trẻ nhỏ ·
  single supplement · mưa thì lịch trình đổi thế nào.
- **policies:** CANCELLATION (miễn phí tới 72h, 50% trong 72h, no-show mất
  100%) · BOOKING (giữ chỗ 20%, thanh toán đủ trước 7 ngày) · GENERAL (mang
  kem chống nắng, đồ bơi; xe đón trong quận 1/3).
- **departures:** ~~thứ Bảy cách tuần từ 2026-08-15 tới 2026-11-21~~ **AMENDED
  31/07 (bản gốc tự mâu thuẫn — 4 đợt cách tuần từ 15/08 chỉ tới được 26/09):**
  4 thứ Bảy giãn ~tháng 2026-08-15 · 09-19 · 10-17 · 11-21, ưu tiên đợt cuối sát
  ngày bảo vệ để demo còn đợt tương lai (xem [CHANGELOG 31/07](../CHANGELOG.md)).
  Đã ship đúng 4 đợt này,
  seatsTotal 16, một đợt promo priceOverride 119.00.
- **reviews (3):** 5★ (gia đình, khen mốc giờ thật và bữa Gành Hào) · 5★ (cặp
  đôi, khen sunrise Lighthouse) · 4★ (khen tổng thể, chê khách sạn xa chợ đêm
  một chút — lời chê giữ cho thật). → `ratingAvg 4.7`, `ratingCount 3`.

## 6. Nửa B — nối `/tours` + `/tours/[slug]` (khuôn ADR-0016, đúng vết cụm Blog)

- `lib/api/tags.ts` mở thêm `TAGS.TOURS` + `tourTag(slug)` (khuôn có sẵn).
- `lib/api/tours.ts`: `fetchTours()` (list, pageSize 50, ISR 300 + `TAGS.TOURS`)
  · `fetchTourDetail(slug)` (React `cache()`, null khi `NOT_FOUND`) ·
  `fetchTourReviews(slug, page)` (`reviews.listByTour`, tag `tourTag(slug)`) —
  fetch + map DTO→VM cạnh nhau; mock tour vốn gương contract nên VM ≈ đổi tên
  type, component gần như giữ nguyên.
- `/tours`: đổi nguồn listing, tri-state (`settle` + `LoadErrorState`), filter/
  sort/search + URL-sync **giữ nguyên hành vi client-side** trên tập fetch trọn
  (nợ server-side pagination dùng chung điều kiện kích hoạt với blog).
- `/tours/[slug]`: `generateStaticParams` từ API (không settle — build fail to),
  detail + departures board đổi nguồn; khu Traveller reviews đổi sang
  `reviews.listByTour`; **gallery/ảnh GIỮ placeholder + mock media hiện trạng**
  (contract không có media — ADR-0005 hoãn có chủ đích, không phải việc của
  branch này). KHÔNG `loading.tsx` mới; đo lại slug lạ 404 thật trên production
  build (luật plan Tours).
- `sitemap`: mục tours đổi nguồn sang API (~30 URL thay 16); `robots` giữ.
- `mocks/tours.ts` **CHƯA chết** (còn `/destinations`, `/about`, Home dùng —
  bước 4+); chỉ các trang đổi nguồn bỏ import. `mocks/tour-reviews.ts` chết
  nếu hết consumer sau khi detail đổi nguồn.

## 7. Ngoài phạm vi

- `/destinations`, trang vùng, Home featured/moments, `/about` — bước 4+.
- Media/ảnh tour thật (ADR-0005) · mở rộng contract (sort rating, filter
  price/duration — nợ spec Tours §8) · on-demand revalidation (bước riêng) ·
  form viết review (bước 9).

## 8. Nghiệm thu (production build, API sống — đúng nghi thức cụm Blog)

1. Seed: reset + seed 2 lần idempotent; `/api/tours` trả đúng 30; spot-check
   itinerary một tour bất kỳ có đủ dòng `HH:MM — `; 6 tour `ratingAvg: null`.
2. `/tours` hiện 30 tour từ DB; filter category/destination + search fold dấu
   sống; tri-state đo bằng tắt API.
3. `/tours/<slug lạ>` → 404 thật; 3 slug thật → 200; departures board hiện đợt
   TƯƠNG LAI đúng dữ liệu; khu reviews hiện review CURATED, tour 0-review hiện
   trạng thái "chưa có đánh giá" (null ≠ 0).
4. `sitemap.xml` chứa ~30 URL tour mới, không còn URL tour mock.
5. `pnpm gate` 18/18 + `pnpm test:int` (máy này chạy được — đo 31/07).
6. Lệch tạm mock ở `/destinations`/`/about`/Home ghi nhận trong CHANGELOG.
