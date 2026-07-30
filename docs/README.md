# Tài liệu — tourism-v2

Đây là **cửa vào duy nhất**. Mọi tài liệu của dự án đều nằm dưới `docs/` và
được liệt kê ở đây — không có spec nào nằm chỗ khác.

## Bốn thể loại, đừng lẫn

| Thư mục | Trả lời câu hỏi | Viết khi nào |
| --- | --- | --- |
| [`adr/`](adr/) | **Vì sao** chọn thế này? | TRƯỚC khi code (luật CLAUDE.md #5) |
| [`specs/`](specs/) | **Sẽ xây gì** ở phase này? | Đầu mỗi phase, user duyệt rồi mới code |
| [`plans/`](plans/) | **Làm theo bước nào** để hiện thực spec? | Sau khi spec được duyệt, trước khi code |
| [`analysis/`](analysis/) | **Học được gì** từ Nexora? | Khi cần dữ liệu để ra quyết định |
| [`conventions/`](conventions/) | Quy tắc **áp dụng mãi mãi** | Khi một bài học cần thành luật |

Ngoài ra: [`CHANGELOG.md`](CHANGELOG.md) — lịch sử mỗi merge ·
[`skills.md`](skills.md) — skill đã cài & dùng khi nào ·
[`../CLAUDE.md`](../CLAUDE.md) — hợp đồng vận hành.

## ADR — quyết định kiến trúc

| # | Nội dung |
| --- | --- |
| [0001](adr/0001-tech-stack.md) | Tech stack + lộ trình vertical slice + chiến lược UI |
| [0002](adr/0002-payment-gateway-refund-ledger.md) | PaymentGateway interface · Refund ledger · atomic claim thế hệ 2 |
| [0003](adr/0003-auth-fail-closed.md) | Auth mặc định fail-closed — global guard + `@Public()` |
| [0004](adr/0004-post-visibility-helper.md) | Post visibility — helper bắt buộc `publishedPostWhere()` (status + publishedAt<=now) |
| [0005](adr/0005-media-read-build-url.md) | Media đọc — API dựng & trả Cloudinary URL (chỉ cần cloud name công khai) |
| [0006](adr/0006-pending-lifecycle.md) | **Accepted** — vòng đời PENDING: CHECKOUT_FAILED+re-checkout · expired→CANCELLED · cron sweep · self-cancel (BK-1/BK-2/PAY-1/WRK-1) |
| [0008](adr/0008-admin-bootstrap-verified.md) | Admin bootstrap — promote gated `emailVerified` + reconcile lúc boot (SEC-1/AUTH-1/AUTH-2) |
| [0009](adr/0009-refund-correctness.md) | Đúng đắn refund — advisory-lock serialize + trigger `SUM≤total` + gate re-derive orphan (BK-R1/PAY-R1/TOCTOU) |
| [0010](adr/0010-infra-hardening.md) | Infra hardening trước P3b — global exception filter (envelope oRPC) + `@fastify/helmet` + Sentry env-gated |
| [0011](adr/0011-p3b-web-architecture.md) | Kiến trúc web P3b — Next.js 16 + React 19 + Tailwind v4; shared UI `libs/shared/ui` (web+admin), custom-in-app; Biome-không-ESLint |
| [0012](adr/0012-typeset-typography.md) | Typography nội dung render — vendor shadcn/typeset (lõi nguyên bản + 3 preset docs/chat/reading) trong `@tourism/ui`, thay `@tailwindcss/typography` của Nexora |
| [0013](adr/0013-wuling-theme-tokens.md) | Theme Wuling + region tint — giữ pipeline Style Dictionary P0, thay giá trị brand, lớp `--region-*` (north/central/south), wire ui vào tokens.css, font Be Vietnam Pro + Lora |
| [0014](adr/0014-web-component-testing.md) | Test tầng component `apps/web` — Vitest 2 project (node + jsdom) + Testing Library, ranh giới với test logic thuần, ghim 1 bản React cho workspace |
| [0015](adr/0015-retire-region-tint.md) | Rút lớp tint theo vùng TOÀN SITE — xoá 3 khối `[data-region]`; trang vùng, Home gallery và About timeline/gallery dùng thẳng token brand; hero về `bg-hero` + TopoPattern; giữ `regionDefaults` cho 4 file auth/contact; bản sắc vùng chuyển sang cấu trúc |

## Specs — theo phase

| Phase | Spec | Trạng thái |
| --- | --- | --- |
| P1 API lõi | [2026-07-18-p1-api-core](specs/2026-07-18-p1-api-core.md) | ✅ đã merge |
| P2 Money-path | [2026-07-18-p2-money-path](specs/2026-07-18-p2-money-path.md) | ✅ đã merge |
| P3a API khách hàng | [2026-07-19-p3a-customer-api](specs/2026-07-19-p3a-customer-api.md) | ✅ đã merge (A+B+C) |
| P3a closeout (C1·R1·R2) | [2026-07-21-p3a-contract-closeout-design](specs/2026-07-21-p3a-contract-closeout-design.md) | ✅ đã merge |
| P3b Web | [ADR-0011](adr/0011-p3b-web-architecture.md) | 🚧 Home ✅ + navbar ✅ + /about ✅ + /contact ✅ + auth 6/6 ✅ + gia vị bản đồ ✅ + cụm pháp lý/utility ✅ 25/07 + **cụm Blog ✅ merge 27/07** (/blog · /blog/[slug] · rss.xml) + thân trang 404 & nền lưới động Contact ✅ 27/07 + **cụm Tours ✅ merge 27/07** (`/tours` · `/tours/[slug]` · robots.txt · sitemap.xml) + **hình ảnh & uy tín trang chi tiết ✅ merge 28/07** (card thiết kế lại 5 vòng · gallery khảm + lightbox · khu Traveller reviews); **cụm Destinations ✅ merge 30/07** (`/destinations` · `/destinations/[region]` ×3 · ADR-0015 rút tint vùng toàn site · chuyển động 3 trục miền); **chính sách ảnh hiện hành: toàn site dùng `ImagePlaceholder`, chỉ đổi ảnh thật khi user yêu cầu riêng**; **kế tiếp**: nối API cho các trang tĩnh đã dựng (đơn giản → phức tạp), dựng song song các trang còn thiếu |
| P3b — trang Home | [2026-07-23-home-page-design](specs/2026-07-23-home-page-design.md) | ✅ đã merge (static-first, 33 vòng điều chỉnh) |
| P3b — cụm 6 trang auth | [2026-07-24-auth-pages-design](specs/2026-07-24-auth-pages-design.md) | ✅ trọn bộ 6/6 merge 25/07 (vé tàu + ảnh Sa Pa + topo mask + OTP + strength field); nợ wire API ghi trong spec |
| P3b — cụm pháp lý/utility | [2026-07-25-legal-utility-pages-design](specs/2026-07-25-legal-utility-pages-design.md) | ✅ merge 25/07 — 4 trang nội dung dài + 3 route boundary; nợ robots/sitemap + EnquiryCta + API FAQ ghi trong spec |
| P3b — cụm Blog | [2026-07-25-blog-pages-design](specs/2026-07-25-blog-pages-design.md) | ✅ merge 27/07 — /blog · /blog/[slug] · rss.xml; giữa chừng user đổi hướng 2 lần (gộp PostCard theo thiết kế Home · toàn site về placeholder); nợ tách ArticleBody + phân trang + API ghi trong spec |
| P3b — cụm Tours | [2026-07-27-tours-pages-design](specs/2026-07-27-tours-pages-design.md) | ✅ merge 27/07 (2 đợt) — `/tours` duyệt sau **4 vòng thiết kế lại** · `/tours/[slug]` "Departure Board": chọn đợt đồng bộ **3 nơi** · robots + sitemap. §8 ghi **5 nợ contract** (media tour · next-departure trên card · sort rating · filter price/duration/difficulty · suitableFor+badges) — ĐỪNG vá trong cụm tĩnh; **chỉ #2–#5 cần ADR mới**, #1 đã được ADR-0005 chốt shape và hoãn có chủ đích. ⚠️ Đợt **hình ảnh & uy tín 28/07** (card thiết kế lại · gallery · reviews) nằm **NGOÀI** spec này — user yêu cầu sau khi cụm đã đóng, ghi trong [CHANGELOG](CHANGELOG.md), không có spec riêng |
| P3b — cụm Destinations | [2026-07-28-destinations-pages-design](specs/2026-07-28-destinations-pages-design.md) | ✅ merge 30/07 — nhưng ⚠️ **spec này đã LỆCH bản đã ship**: nó đề xuất "tint chiếm trang", thứ [ADR-0015](adr/0015-retire-region-tint.md) đã rút bỏ TOÀN SITE sau khi user bác màu theo vùng. Bản thật phân hoá bằng **cấu trúc** (thứ tự khu · gallery 3 bố cục · trục chuyển động), không bằng màu. §4.2 vá khuyết tật **`tourCount` mock phồng 2–5×** (đã làm, lan sang `/about` 68 → 16); §7 **cắt ≈202 dòng copy i18n** quảng cáo **4 địa danh v2 không bán** (Hà Giang 5 lần, Lan Hạ, Fansipan, Pù Luông = 0 trong mock — đã cắt). Đọc [CHANGELOG 30/07](CHANGELOG.md) để biết bản đã ship, đừng đọc spec như hiện trạng |
| P4 Admin · P5 Mobile · P6 AI · P7 Polish UI | — | ⬜ chưa mở |

## Plans — kế hoạch triển khai (task-by-task)

| Kế hoạch | Phủ | Trạng thái |
| --- | --- | --- |
| [P3a-A: Nền chung + Reviews](plans/2026-07-19-p3a-a-foundation-reviews.md) | W0 + W1 (6 task) | ✅ đã merge |
| [P3a-B: Wishlist · Enquiry · Newsletter](plans/2026-07-19-p3a-b-wishlist-enquiry-newsletter.md) | W2–W4 + hạ tầng rate limiting (6 task) | ✅ đã merge |
| [P3a-C: Posts · Site-media](plans/2026-07-21-p3a-c-posts-site-media.md) | W5–W6 + hạ tầng media-đọc (7 task) | ✅ đã merge |
| [Admin bootstrap emailVerified + AUTH-2](plans/2026-07-21-admin-bootstrap-verified.md) | SEC-1/AUTH-1/AUTH-2 (5 task) | ✅ đã merge |
| [Refund correctness](plans/2026-07-21-refund-correctness.md) | BK-R1/PAY-R1/TOCTOU (5 task) | ✅ đã merge |
| [P3a contract closeout](plans/2026-07-21-p3a-contract-closeout.md) | C1·R1·R2 parity (4 task) | ✅ đã merge |
| [Vòng đời PENDING](plans/2026-07-22-pending-lifecycle.md) | BK-1·BK-2·PAY-1·WRK-1 (5 task) | ✅ đã merge |
| [Typeset trong @tourism/ui](plans/2026-07-22-ui-typeset.md) | ADR-0012 (3 task) | ✅ đã merge |
| [Theme Wuling + region tokens](plans/2026-07-22-wuling-theme-tokens.md) | ADR-0013 (5 task) | ✅ đã merge |
| [Trang Home tĩnh](plans/2026-07-23-home-page.md) | Shell + mocks + 8 section gốc (sau thành 10 qua review) | ✅ đã merge |
| [Cụm 6 trang auth](plans/2026-07-24-auth-pages.md) | Route group + AuthScreen/TicketCard + 6 trang (6 task) | ✅ đã merge trọn (Task 1–2 ngày 24/07 · Task 3–6 ngày 25/07) |
| [Cụm pháp lý/utility](plans/2026-07-25-legal-utility-pages.md) | i18n + LegalArticle + 4 trang + 3 boundary (7 task) | ✅ đã merge |
| [Cụm Blog](plans/2026-07-25-blog-pages.md) | mock 9 bài + lib/blog + 3 route + RSS (7 task + 3 đợt vá) | ✅ đã merge |
| [Cụm Tours](plans/2026-07-27-tours-pages.md) | mock 16 tour theo contract + lib/tours + `/tours` + `/tours/[slug]` + robots/sitemap + 4 khoản nợ (13 task) | ✅ đã merge (2 đợt 27/07). Có **bảng 4 vòng thiết kế lại** của listing + mục **bẫy soft 404 do `loading.tsx`** (đọc trước khi thêm `loading.tsx` vào bất kỳ route động nào) |
| [Cụm Destinations](plans/2026-07-28-destinations-pages.md) | token `--region-hero` + đắp lại mock gương contract + `lib/regions` + 2 trang + nối dây nav/sitemap; nở từ 7 task thành **Task 1–7 cộng 4b và 5b–5o** (~3.900 dòng) | 🚧 **merge 30/07 nhưng CHƯA đóng cụm.** Xong: Task 1–5 và toàn bộ 4b, 5b–5o (2 lần dựng lại `/destinations`, 4 lần dựng lại trang vùng). **CÒN NỢ: Task 6** — `/destinations` và 3 URL vùng **không có trong sitemap**, và `lib/sitemap.ts:22` vẫn ghi "`/destinations` … CHƯA tồn tại" (nay sai) — và **Task 7** (đo 404 trên production build · `gate:int`). Có **2 mốc dừng bắt buộc**, lý lẽ vì sao **KHÔNG** dùng `color-mix` cho hero vùng, và mục **4 thứ pre-flight bắt được** — trong đó việc sửa `tourCount` lan sang `/about` (68 → 16 tour) |

## Analysis — nghiên cứu từ Nexora

| Tài liệu | Dùng để |
| --- | --- |
| [Schema audit](analysis/2026-07-18-schema-audit-nexora.md) | Soi 27 model + quyết định tối ưu (H/M/LOW) |
| [API parity + upgrade map](analysis/2026-07-19-api-parity-upgrade-map.md) | Kiểm kê ~64 endpoint còn thiếu + 14 nâng cấp + 10 delta schema |
| [Infra parity](analysis/2026-07-19-infra-parity-nexora.md) | 8 lỗ hạ tầng xuyên suốt — thứ API parity map bỏ lọt |
| [Quét sâu Nexora](analysis/2026-07-19-nexora-deep-sweep.md) | **Bảng theo dõi A1–A11** + quy tắc nghiệp vụ W2–W6 + kiến trúc P3b |
| [Kiểm kê env keys](analysis/2026-07-19-env-keys-inventory.md) | Key nào đã lấy/còn thiếu, rủi ro ngày bảo vệ |
| [Đối chiếu lại P3a-B](analysis/2026-07-21-p3a-b-parity-recheck.md) | Rà song song wishlist·enquiry·newsletter — không thụt lùi Quan trọng, chỉ 2 điểm Nhỏ |
| [Rà soát độc lập toàn API](analysis/2026-07-21-independent-review.md) | **Parity + review defect toàn `apps/api`** — 4 High (refund/spam), chùm Medium, 19 invariant canh mạnh; tiền-RA là điểm yếu |
| [Sweep parity toàn code trước P3a-B](analysis/2026-07-21-full-parity-sweep-pre-p3ab.md) | Đối chiếu parity 7 vùng (catalog·reviews·bookings·payments·cancel/refund·auth·worker), 7 agent — 1 Quan trọng (C1 catalog destination phụ) + 4 Nên có + 3 Nhỏ + nợ; invariant money/security lõi sạch. *Snapshot 21/07; B2·C3 đã vá sau (CAT-4/BK-3)* |
| [Đối chiếu Nexora — cụm Tours](analysis/2026-07-27-tours-parity-nexora.md) | Hai tầng (endpoint/feature + hạ tầng xuyên suốt) cho listing & detail. Nexora **hardcode `departures: []`** nên khối chọn ngày của họ luôn ẩn — v2 có dữ liệu thật, đây là điểm nhấn số 1 của trang detail. Kèm 7 thụt lùi Quan trọng (robots/sitemap · JSON-LD Product · cache-tag revalidate · next-departure trên card…) |
| [Độ sẵn sàng backend + đối chiếu Nexora (trước P3b)](analysis/2026-07-22-backend-readiness-vs-nexora.md) | **Go/No-Go cho web** — 4 agent (endpoint·hạ tầng·money-path·auth/chất lượng). Backend P1-P3a xong & vượt Nexora ở tầng lõi; còn cụm PENDING-lifecycle (ADR-0006) + 3 infra-TB + P4-admin (58 ep, phase sau). Web không bị chặn cứng |

## Conventions — luật áp dụng mãi

| Tài liệu | Nội dung |
| --- | --- |
| [booking-states](conventions/booking-states.md) | Ledger kể chuyện tiền, status kể chuyện ghế — 4 trạng thái terminal |
| [outbox-dedupe-key](conventions/outbox-dedupe-key.md) | `<event>:<entityId>[:<state>]` — chống bug nuốt email 16/07 |
| [read-then-write-races](conventions/read-then-write-races.md) | Bẫy EvalPlanQual — đã cắn dự án 2 lần, kèm cách sai đã thử |
| [color-system](conventions/color-system.md) | Hệ màu brand Wuling + 3 vùng: nguồn cảm hứng (Endfield — codename nội bộ), số đo raw → giá trị chốt, luật 90/10, pháp lý |

## Quy tắc viết

- **ADR trước code**; spec được user duyệt trước khi triển khai.
- **CHANGELOG là nơi duy nhất** giữ lịch sử và tiến trình số test.
- Doc hiện-trạng giữ NGẮN, chỉ phản ánh hiện tại; chuyện đã qua để CHANGELOG lo.
- Spec của skill `superpowers:brainstorming` cũng ghi vào `specs/` — **không tạo
  `docs/superpowers/`** (skill cho phép override đường dẫn mặc định).
