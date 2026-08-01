# Spec — Bước 4 nối API: cụm Destinations + xoá lớp lệch mock nhìn-thấy-được (2026-07-31)

- **Trạng thái:** Approved 31/07 (3 quyết định phạm vi chốt cùng ngày:
  trọn gói lệch-nhìn-thấy · navbar đổi nguồn API · moments sửa slug thật)
- **Nền:** [ADR-0016](../adr/0016-web-data-layer.md) — khuôn `lib/api` đã hiện
  thực qua 2 cụm (Blog · Tours); spec này KHÔNG có quyết định kiến trúc mới,
  chỉ áp khuôn cũ lên cụm còn lại của lớp catalogue.
- **Vì sao KHẨN:** [CHANGELOG 31/07](../CHANGELOG.md) — trang vùng có **14/16
  card tour mock là link chết 404** sau khi catalogue thật lên; Home/`/about`
  kể "16 tour" trong khi `/tours` kể 30; navbar menu 9 điểm đến trong khi
  listing có 19; moments 3/5 link tour chết.
- **Branch:** `feat/destinations-api`.

## 1. Phạm vi — "trọn gói lệch-nhìn-thấy" (quyết định user 31/07)

Nguyên tắc: sau branch này, **không còn chỗ nào trên site kể chuyện catalogue
bằng dữ liệu mock** — `mocks/tours.ts` và `mocks/destinations.ts` chết hẳn.
Mock không-có-endpoint (faq · testimonials · moments · regions · team ·
offices) sống tiếp đúng thiết kế ADR-0016.

| # | Bề mặt | Đổi gì |
| --- | --- | --- |
| A | `/destinations` | Fetch `destinations.list` + `tours.list` (settle ×2, tri-state như `/tours`); khung 3 miền GIỮ `mocks/regions.ts` (cấu trúc UI thuần — vùng không có contract, số liệu dẫn xuất từ tours THẬT qua `toursInRegion()` với VM) |
| B | `/destinations/[region]` ×3 | `generateStaticParams` giữ nguồn `REGIONS` (3 vùng cố định); data tours/destinations sang API; `regionOf()` bridge giữ nguyên; copy biên tập vùng ở i18n giữ nguyên; `revalidate = 300` |
| C | Home | Tiles gallery (destinations + tourCount dẫn xuất) và mọi số đếm sang dữ liệu API — page (server, đã ISR từ bước 1) fetch rồi truyền props xuống client components, đúng vết teaser Journal; **diff Home tối thiểu** như lệ |
| D | `/about` | `about-numbers`/`about-gallery` đổi số đếm/nguồn tour sang API → `/about` SSG thuần thành ISR 300 (hệ quả ghi nhận; trang không có searchParams nên vẫn serve HTML tĩnh) |
| E | Navbar `destinations-menu` | `site-header` (server, trong root layout) fetch `destinations.list` (ISR 300, tag `TAGS.TOURS`) truyền props cho menu client — 19 điểm đến thật khớp listing. **Hệ quả phải đo:** layout fetch → mọi route mang fetch ISR, các trang tĩnh thuần (legal/auth) đổi render mode — nghiệm thu phải xác nhận nội dung + status không đổi và fetch fail không sập trang (settle → menu rơi về danh sách rỗng/ẩn mục, không crash layout) |
| F | Moments (`/destinations`) | Sửa 3 `tourSlug` chết trong `mocks/moments.ts` sang tour thật cùng bản chất (cruise→`halong-bay-overnight-cruise`, Sa Pa trek→`sapa-terraces-homestay-2d`, Mekong→`mekong-can-tho-2d` — chọn chuẩn khi thi công); test canh "slug phải tồn tại" đổi nguồn đối chiếu sang **danh sách slug roster tĩnh khai trong spec test** (comment ghi nguồn `fixtures/catalog/`, sync tay khi roster đổi — web không import fixtures API) |

## 2. Kỹ thuật — áp khuôn cũ, không quyết định mới

- Dùng lại `lib/api/tours.ts`: `fetchTours()` + `fetchDestinationsFacet()`
  (cân nhắc đổi tên thành `fetchDestinations()` vì giờ nó nuôi cả cụm, không
  chỉ facet — rename nội bộ, không đổi hành vi).
- Mọi fetch tag `TAGS.TOURS` (destinations đi cùng vòng đời tours — đã chốt từ
  cụm Tours), `revalidate = 300`.
- Tri-state: trang destinations lỗi fetch → `LoadErrorState` (khuôn cũ); navbar
  degrade im lặng (menu không phải nơi hiện panel lỗi).
- Type: components cụm destinations đổi `MockTourCard`/`MockDestination` →
  `TourCardVM`/`DestinationVM` (structural, đúng vết cụm Tours). `lib/regions.ts`
  đổi generic tương ứng.
- **Khai tử:** `mocks/tours.ts` (1486 dòng) + `mocks/destinations.ts` + các
  type `Mock*` hết consumer trong `mocks/types.ts` + 3 component detail còn
  `import type` từ mocks (rehome sang VM — nợ đã ghi CHANGELOG 31/07). Grep
  cuối: `mocks/tours|mocks/destinations|MockTourCard|MockTourDetail` toàn
  `apps/web/src` phải rỗng (trừ fixture spec tự chứa nếu có).
- `sitemap`: không đổi số URL (regions vẫn từ `REGIONS` — 3 URL vùng; tours đã
  từ API từ cụm trước).

## 3. Ngoài phạm vi

- Map moments → `siteMedia.list` (chưa xác minh shape — mock moments sống tiếp).
- Testimonials/FAQ/team/offices — mock sống (không endpoint).
- Bước 5+ (contact form, newsletter…); mở rộng contract destinations (region
  enum…) — nợ spec Tours cũ vẫn treo.

## 4. Nghiệm thu (production build, API sống — nghi thức chuẩn)

1. **0 link tour chết toàn site:** trích mọi href `/tours/<slug>` từ HTML của
   `/`, `/destinations`, 3 trang vùng, `/about` → curl từng cái = 200 (bảng
   nguyên văn trong report).
2. 3 trang vùng hiện tour THẬT theo miền (Bắc 12 · Trung 9 · Nam 9 — kiểm số
   card khớp phân bố roster); số đếm mọi nơi thống nhất "30".
3. Navbar menu 19 điểm đến; link `/tours?destinations=<slug>` lọc đúng.
4. Tri-state `/destinations` (tắt API → LoadErrorState); navbar degrade không
   crash khi API tắt (đo dev).
5. Trang legal/auth vẫn 200 + nội dung y nguyên sau khi layout mang fetch.
6. `pnpm gate` 18/18 + `pnpm test:int` + grep khai tử rỗng.

## 5. Rủi ro

- **Layout fetch là thay đổi bán kính rộng nhất** (mọi route) — settle bắt
  buộc, đo mục 5 nghiệm thu; nếu phát hiện trang nào vỡ render mode có hệ quả
  thật (khác status/nội dung), DỪNG báo user thay vì ép.
- Trang vùng từng qua 4-6 vòng dựng lại (plan Destinations cũ) — đổi nguồn
  KHÔNG đổi layout/motion; diff các component vùng phải types + nguồn data
  thuần.
- `tour-reviews.tsx` đang import gì đó từ `mocks/tours` — kiểm khi thi công,
  rehome nếu là type/helper.
