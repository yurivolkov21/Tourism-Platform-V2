# Rà soát docs ↔ code và tiến độ dự án — 2026-07-30

Chụp tại `main` `5c81549`, ngay sau khi merge cụm Destinations. Mục đích: user yêu
cầu *"rà soát lại docs 1 lần từ đầu đến cuối để xem tiến độ dự án"* trước khi bắt
tay nối API cho các trang tĩnh đã dựng.

Mọi khẳng định dưới đây kiểm được bằng `file:line`. Chỗ nào chưa kiểm được thì ghi
thẳng là chưa kiểm được.

## 1. Tiến độ theo phase

| Phase | Trạng thái | Bằng chứng |
| --- | --- | --- |
| P0 khung xương | ✅ | monorepo + toolchain, `CLAUDE.md` §Toolchain |
| P1 API lõi | ✅ | `specs/2026-07-18-p1-api-core.md` |
| P2 money-path | ✅ | `specs/2026-07-18-p2-money-path.md`, 2 webhook `apps/api/src/modules/payments/webhooks.controller.ts` |
| P3a API khách | ✅ | **33 procedure oRPC đã cài đặt** (đếm `@Implement(contract.…)` trong `apps/api/src`) |
| P3b web | 🚧 | **19 trang đã dựng, 0 trang gọi API** (xem §4) |
| P4 admin · P5 mobile · P6 AI · P7 polish | ⬜ | chưa mở |

**19 trang P3b:** 6 auth (`login` · `register` · `forgot-password` · `reset-password` ·
`two-factor` · `verify-email`) và 13 site (`/` · `/about` · `/contact` · `/faq` ·
`/terms` · `/privacy` · `/cancellation-policy` · `/blog` · `/blog/[slug]` · `/tours` ·
`/tours/[slug]` · `/destinations` · `/destinations/[region]`), cộng `not-found` ·
`sitemap.ts` · `robots.ts` · `blog/rss.xml`.

## 2. Doc lệch code

| Mức | Doc nói | Code nói | Bằng chứng |
| --- | --- | --- | --- |
| **chặn** | `/destinations` "CHƯA tồn tại" nên không có trong sitemap | trang đã ship và prerender SSG | `apps/web/src/lib/sitemap.ts:22`; `STATIC_PAGES` ở `:25-34` **không có** `/destinations` lẫn 3 URL vùng |
| **chặn** | spec Destinations đề xuất "tint chiếm trang" cho trang vùng | ADR-0015 đã **rút lớp tint TOÀN SITE**; ba khối `[data-region]` đã xoá | `specs/2026-07-28-destinations-pages-design.md` vs `adr/0015-retire-region-tint.md`; đã dán cảnh báo vào `docs/README.md` hàng spec |
| **gây nhầm** | — | hai spec **không có trong bản đồ** `docs/README.md`, nên theo CLAUDE.md luật 13 chúng "coi như không tồn tại" | `specs/2026-07-22-wuling-theme-tokens-design.md`, `specs/2026-07-22-ui-typeset-design.md` |
| **không phải lỗi** | dãy ADR khuyết số 0007 | **reserve có chủ ý** cho outbox | `adr/0008-admin-bootstrap-verified.md:7`, `adr/0009-refund-correctness.md:14` |

58 doc trên đĩa. Bản đồ không trỏ tới doc nào đã mất. CHANGELOG cập nhật tới
2026-07-30 và `scripts/docs-freshness.sh` báo xanh.

## 3. Thứ tự nối API — đơn giản → phức tạp

Tiêu chí sắp: **chỉ GET** trước **có ghi**; **không auth** trước **cần auth**; **không
tiền** trước **có tiền**; và **procedure đã có** trước **phải làm mới**.

| # | Trang | Procedure | Có sẵn? | Chặn gì |
| --- | --- | --- | --- | --- |
| 1 | `/blog`, `/blog/[slug]` | `posts.list` · `posts.bySlug` · `posts.tags` | ✅ cả 3 | — |
| 2 | `/tours` | `catalog.tours.list` | ✅ | mock đã **gương contract** (`mocks/types.ts` ghi rõ) nên là swap nguồn, không rename |
| 3 | `/tours/[slug]` | `catalog.tours.bySlug` · `reviews.listByTour` | ✅ cả 2 | **`media` KHÔNG có trong contract** → ảnh tour vẫn placeholder (ADR-0005 hoãn có chủ ý) |
| 4 | `/destinations`, `/destinations/[region]` | `catalog.destinations.list` + `catalog.tours.list` | ✅ | `region` trong contract là **string tự do nullable** (`schemas/catalog.ts:137`), không phải enum — `lib/regions.ts` `regionOf()` đã là cầu nối. Copy biên tập của vùng (heading, blurb, nhãn gallery) **không có contract**, sống trong i18n |
| 5 | form `/contact` | `enquiries.create` | ✅ | bước ghi đầu tiên |
| 6 | newsletter ở footer | `newsletter.subscribe` · `unsubscribe` · `resubscribe` · `unsubscribeConfirm` | ✅ cả 4 | cần trang xác nhận unsubscribe (chưa có) |
| 7 | 6 trang auth | Better Auth `/api/auth/*` (KHÔNG qua oRPC) | ✅ | `apps/api/src/auth/auth.controller.ts:33` mount handler; cần quyết cơ chế session ở web |
| 8 | wishlist | `wishlist.set` · `list` · `check` | ✅ cả 3 | **chưa có UI nào** — phải dựng |
| 9 | viết review | `reviews.create` · `reviews.mine` | ✅ cả 2 | **chưa có UI nào** |
| 10 | booking | `bookings.create` · `checkout` · `mine` · `byCode` · `cancel` · `cancelPending` | ✅ cả 6 | **chưa có UI nào**; Stripe/PayPal luôn sandbox |

### Mock không có endpoint nào

| Mock | Dùng ở | Tình trạng |
| --- | --- | --- |
| `mocks/faq` | `/faq`, `/destinations` | ❌ không có procedure. Contract có `faqs` **lồng trong tour** (`question`/`answer`) nhưng không có FAQ site-level |
| `mocks/testimonials` | `/`, `/destinations` | ❌ không có procedure |
| `mocks/moments` | `/destinations` | có thể map `siteMedia.list` — **chưa xác minh shape** |
| `mocks/regions` | `/destinations`, `/destinations/[region]` | ❌ không có type region trong contract; số liệu dẫn xuất được từ tours, copy thì không |

## 4. Chưa có API client — đây là chỗ chặn thật

`apps/web/package.json` **không có** `@tourism/contract`, `@orpc/client`, TanStack Query
hay SWR. `find apps/web/src -name "*api*" -o -name "*client*"` trả **rỗng**. Và
`grep -rl "fetch(\|axios\|apiClient" apps/web/src` cũng rỗng — không trang nào gọi API.

Nghĩa là: nối trang đầu tiên **không phải** việc sửa một trang, mà là một quyết định
kiến trúc dùng cho cả 19 trang — client oRPC gõ kiểu đầu-cuối, hay `fetch` trần; fetch
ở Server Component hay Client Component; cache/revalidate ra sao; lỗi và loading hiển
thị thế nào. CLAUDE.md **luật 5** đòi **ADR đi TRƯỚC code** cho quyết định kiến trúc.

Vì API đã contract-first bằng oRPC, dùng `@orpc/client` giữ được kiểu từ contract sang
web mà không khai lại type — nhưng đó là đề xuất, chưa phải quyết định.

## 5. Procedure đã có mà chưa UI nào dùng

**16 procedure**: 6 booking · 3 wishlist · 2 review (`create`, `mine`) · `siteMedia.list` ·
và 7 admin (`admin.bookings.*`, `admin.cancellations.*`, `admin.reviews.*` — thuộc P4).

Đây là chiều ngược lại của §3: backend đi trước UI khá xa. Việc nối API vì thế **cũng
là việc dựng thêm giao diện**, không chỉ thay nguồn dữ liệu.

## 6. Giao diện chưa dựng

| Trang | Cần cho | Ghi chú |
| --- | --- | --- |
| `/tours/[slug]/book` | booking | `lib/sitemap.ts:22` đã ghi nó "CHƯA tồn tại" — đúng |
| khu tài khoản (`bookings.mine`, `wishlist.list`, `reviews.mine`) | P3b | 3 procedure sẵn, 0 UI |
| trang xác nhận unsubscribe newsletter | P3b | `newsletter.unsubscribeConfirm` sẵn |
| form viết review | P3b | `reviews.create` sẵn |
| admin | P4 | 7 procedure sẵn |

## 7. Ba việc nên làm NGAY, trước dòng API đầu tiên

1. **Đóng Task 6 của cụm Destinations.** Thêm `/destinations` và 3 URL vùng vào
   `STATIC_PAGES`/sitemap, sửa comment sai ở `lib/sitemap.ts:22`. Trang đang sống mà
   crawler không thấy — và `lib/sitemap.ts` có 12 test canh nên sửa là có lưới.
2. **Thêm hai spec thiếu vào bản đồ `docs/README.md`.** Rẻ, và luật 13 nói doc ngoài
   bản đồ coi như không tồn tại.
3. **Viết ADR cho tầng dữ liệu của web** trước khi nối trang đầu. Đây là quyết định
   dùng chung cho 19 trang; làm sau sẽ phải sửa lại tất cả. Luật 5.
